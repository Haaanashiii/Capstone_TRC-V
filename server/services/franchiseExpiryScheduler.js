const cron = require('node-cron');
const FranchiseInformation = require('../models/franchiseInformationModel');
const SchedulerState = require('../models/schedulerStateModel');
const { sendFranchiseExpiryEmail } = require('./emailService');
const { sendFranchiseExpiryNotification } = require('./notificationQueueService');
const { auditLogService } = require('./auditLogService');

// Import cache invalidation for QR scans
let invalidateQRCache;
try {
  invalidateQRCache = require('../controllers/qrCodeController').invalidateQRCache;
} catch (e) {
  invalidateQRCache = () => {}; // Fallback if not available
}

/**
 * Franchise Expiry Reminder Scheduler - OPTIMIZED VERSION
 * Runs daily at 6:00 AM to check for franchises expiring soon
 * 
 * Features:
 * - Catches up on missed days after server downtime
 * - Tracks last successful run in database
 * - Processes missed expirations and notifications
 * 
 * Checks the LATEST VERSION of each franchiseChainId:
 * - 30 days before expiry (email only - cost optimization)
 * - 7 days before expiry (SMS + email - actionable warning)
 * - On expiry date (SMS + email - URGENT)
 * - 1 year after expiry without renewal (auto-revoke for franchise number recycling)
 * 
 * OPTIMIZATION: Single database query with all filters, batch processing, resilient error handling
 */

const SCHEDULER_NAME = 'franchise-expiry';

// Track sent notifications in-memory to avoid duplicate emails within same cron run
const sentNotifications = new Map(); // { franchiseId: { 30days: true, 7days: true, expired: true, revoked: true } }

// Batch configuration - optimized for 5K-7K franchise volume with 500/day spikes
const BATCH_CONFIG = {
  emailBatchSize: 50,         // Larger batch: 50 emails at once (safe for modern services)
  smsBatchSize: 25,           // SMS batch of 25 (Twilio can handle this easily)
  processingDelayMs: 50,      // 50ms between batches (smoother distribution)
  maxAggregationMemory: 150,  // MongoDB memory limit in MB (bumped for large result sets)
  queryTimeoutMs: 45000,      // 45 second timeout per aggregation (handles large queries)
  // Performance thresholds
  slowQueryWarningMs: 5000,   // Log warnings for queries over 5s
  slowNotificationWarningMs: 500 // Log slow individual notifications
};

/**
 * Get franchises expiring in specified date range - OPTIMIZED FOR HIGH VOLUME (5K-7K)
 * Uses database-level filtering to reduce data transfer
 * Only fetches fields needed for expiry notifications
 * Processes in chunks if result set is large
 * 
 * @param {number} daysBeforeExpiry - Number of days before expiry to check
 * @returns {Promise<Array>} List of latest franchise versions expiring on target date
 */
async function getFranchisesExpiringOn(daysBeforeExpiry) {
  const queryStartTime = Date.now();
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);
    
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Single optimized query: find latest version per chain that expires on target date
    const expiringFranchises = await FranchiseInformation.aggregate([
      // STAGE 1: Filter for franchises expiring on target date (database-level)
      {
        $match: {
          franchiseChainId: { $exists: true, $ne: null },
          franchiseStatus: 'active',
          expiryDate: {
            $gte: targetDate,
            $lt: nextDay
          }
        }
      },
      // STAGE 2: Get latest version per chain
      {
        $sort: { franchiseChainId: 1, version: -1 }
      },
      {
        $group: {
          _id: '$franchiseChainId',
          latestFranchise: { $first: '$$ROOT' }
        }
      },
      // STAGE 3: Project only needed fields (reduce memory usage significantly)
      {
        $project: {
          _id: 1,
          franchiseNumber: '$latestFranchise.franchiseNumber',
          franchiseChainId: '$latestFranchise.franchiseChainId',
          operatorName: '$latestFranchise.operatorName',
          operatorEmail: '$latestFranchise.operatorEmail',
          operatorContactNumber: '$latestFranchise.operatorContactNumber',
          expiryDate: '$latestFranchise.expiryDate',
          version: '$latestFranchise.version',
          franchiseStatus: '$latestFranchise.franchiseStatus'
        }
      },
      // STAGE 4: For high volume, sort by expiry date (most urgent first)
      {
        $sort: { expiryDate: 1 }
      }
    ])
    .allowDiskUse(true)  // CRITICAL: Allow MongoDB to use disk for large aggregations
    .maxTimeMS(BATCH_CONFIG.queryTimeoutMs)  // Timeout protection
    .lean()
    .exec();
    
    const queryTime = Date.now() - queryStartTime;
    
    if (expiringFranchises.length > 0) {
      // Log slow queries for monitoring
      const logFn = queryTime > BATCH_CONFIG.slowQueryWarningMs ? console.warn : console.log;
      logFn(`[EXPIRY_QUERY] Got ${expiringFranchises.length} franchises in ${queryTime}ms (target: ${daysBeforeExpiry} days)`);
    }
    
    return expiringFranchises;
  } catch (error) {
    console.error(`[EXPIRY_CHECK] Error fetching franchises expiring in ${daysBeforeExpiry} days:`, error.message);
    return [];
  }
}

/**
 * Get ALL expired franchises eligible for revocation (expired > 1 year ago)
 * Uses optimized query to find candidates for revocation
 * 
 * @returns {Promise<Array>} List of franchises expired for over 1 year
 */
async function getFranchisesEligibleForRevocation() {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    // Single query: find latest version per chain that's been expired for 1+ year
    const franchisesToRevoke = await FranchiseInformation.aggregate([
      // STAGE 1: Filter for franchises expired for over 1 year
      {
        $match: {
          franchiseChainId: { $exists: true, $ne: null },
          franchiseStatus: 'expired',  // Only check expired status
          expiryDate: { $lt: oneYearAgo }  // Expired over 1 year ago
        }
      },
      // STAGE 2: Get latest version per chain
      {
        $sort: { franchiseChainId: 1, version: -1 }
      },
      {
        $group: {
          _id: '$franchiseChainId',
          latestFranchise: { $first: '$$ROOT' }
        }
      },
      // STAGE 3: Project only needed fields
      {
        $project: {
          _id: 1,
          franchiseNumber: '$latestFranchise.franchiseNumber',
          franchiseChainId: '$latestFranchise.franchiseChainId',
          operatorName: '$latestFranchise.operatorName',
          expiryDate: '$latestFranchise.expiryDate',
          version: '$latestFranchise.version',
          franchiseStatus: '$latestFranchise.franchiseStatus'
        }
      },
      {
        $limit: 1000
      }
    ])
    .allowDiskUse(true)
    .lean()
    .exec();
    
    return franchisesToRevoke;
  } catch (error) {
    console.error('[EXPIRY_CHECK] Error fetching franchises eligible for revocation:', error.message);
    return [];
  }
}

/**
 * Process items in batches with delay between batches
 * Prevents overwhelming the backend service
 * Optimized for monitoring and error tracking
 * 
 * @param {Array} items - Items to process
 * @param {Function} processFn - Async function to process each item
 * @param {number} batchSize - Items per batch
 * @param {number} delayMs - Delay between batches
 * @returns {Promise<Array>} Results array with successful and failed items
 */
async function processBatch(items, processFn, batchSize, delayMs) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchStartTime = Date.now();
    
    // Process batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(item => processFn(item))
    );
    
    results.push(...batchResults);
    
    const batchTime = Date.now() - batchStartTime;
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(items.length / batchSize);
    
    // Log slow batches for monitoring
    if (batchTime > BATCH_CONFIG.slowNotificationWarningMs) {
      console.warn(`[BATCH] Slow batch ${batchNum}/${totalBatches}: ${batchTime}ms for ${batch.length} items`);
    }
    
    // Delay before next batch (except last batch)
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

/**
 * Send 30-day expiry reminder emails - BATCH OPTIMIZED
 * EMAIL ONLY (cost optimization - no SMS)
 * Batch processing prevents backend overload
 */
async function sendThirtyDayReminders() {
  console.log('[EXPIRY_SCHEDULER] [30-DAY] Starting...');
  const startTime = Date.now();
  
  try {
    const franchises = await getFranchisesExpiringOn(30);
    
    if (franchises.length === 0) {
      console.log('[EXPIRY_SCHEDULER] [30-DAY] ✓ No franchises expiring in 30 days');
      return;
    }
    
    console.log(`[EXPIRY_SCHEDULER] [30-DAY] Found ${franchises.length} franchises expiring in 30 days`);
    
    // Filter out franchises without email
    const validFranchises = franchises.filter(f => {
      if (!f.operatorEmail) {
        console.log(`[EXPIRY_SCHEDULER] [30-DAY] ⊘ Skipping ${f.franchiseNumber}/${f.franchiseChainId} (v${f.version}) - no email`);
        return false;
      }
      return true;
    });
    
    if (validFranchises.length === 0) {
      console.log('[EXPIRY_SCHEDULER] [30-DAY] ✓ No valid contact info found');
      return;
    }
    
    // Process emails in batches
    const sendEmail = async (franchise) => {
      const key = franchise._id.toString();
      
      // Skip if already sent this run
      if (sentNotifications.has(key) && sentNotifications.get(key)['30days']) {
        return { success: false, reason: 'already_sent', franchise };
      }
      
      try {
        await sendFranchiseExpiryEmail(
          franchise.operatorEmail,
          franchise.operatorName,
          franchise.franchiseNumber,
          franchise.expiryDate,
          30
        );
        
        sentNotifications.set(key, { ...sentNotifications.get(key), '30days': true });
        return { success: true, franchise };
      } catch (error) {
        console.error(`[EXPIRY_SCHEDULER] [30-DAY] ✗ Email failed for ${franchise.franchiseNumber}:`, error.message);
        return { success: false, reason: error.message, franchise };
      }
    };
    
    const results = await processBatch(
      validFranchises,
      sendEmail,
      BATCH_CONFIG.emailBatchSize,
      BATCH_CONFIG.processingDelayMs
    );
    
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;
    
    console.log(`[EXPIRY_SCHEDULER] [30-DAY] ✓ Completed in ${Date.now() - startTime}ms: ${succeeded} sent, ${failed} failed`);
  } catch (error) {
    console.error('[EXPIRY_SCHEDULER] [30-DAY] ✗ Fatal error:', error.message);
  }
}

/**
 * Send 7-day expiry reminders - BATCH OPTIMIZED
 * SMS + EMAIL (actionable warning)
 * Uses smaller batch for SMS to respect rate limits
 */
async function sendSevenDayReminders() {
  console.log('[EXPIRY_SCHEDULER] [7-DAY] Starting...');
  const startTime = Date.now();
  
  try {
    const franchises = await getFranchisesExpiringOn(7);
    
    if (franchises.length === 0) {
      console.log('[EXPIRY_SCHEDULER] [7-DAY] ✓ No franchises expiring in 7 days');
      return;
    }
    
    console.log(`[EXPIRY_SCHEDULER] [7-DAY] Found ${franchises.length} franchises expiring in 7 days`);
    
    // Filter for contact info
    const validFranchises = franchises.filter(f => {
      if (!f.operatorEmail && !f.operatorContactNumber) {
        console.log(`[EXPIRY_SCHEDULER] [7-DAY] ⊘ Skipping ${f.franchiseNumber}/${f.franchiseChainId} (v${f.version}) - no contact`);
        return false;
      }
      return true;
    });
    
    if (validFranchises.length === 0) {
      console.log('[EXPIRY_SCHEDULER] [7-DAY] ✓ No valid contact info found');
      return;
    }
    
    const sendNotification = async (franchise) => {
      const key = franchise._id.toString();
      
      if (sentNotifications.has(key) && sentNotifications.get(key)['7days']) {
        return { success: false, reason: 'already_sent', franchise };
      }
      
      try {
        const notificationResult = await sendFranchiseExpiryNotification(franchise, 7);
        sentNotifications.set(key, { ...sentNotifications.get(key), '7days': true });
        return { success: true, result: notificationResult, franchise };
      } catch (error) {
        console.error(`[EXPIRY_SCHEDULER] [7-DAY] ✗ Notification failed for ${franchise.franchiseNumber}:`, error.message);
        return { success: false, reason: error.message, franchise };
      }
    };
    
    // Smaller batch for SMS rate limit
    const results = await processBatch(
      validFranchises,
      sendNotification,
      BATCH_CONFIG.smsBatchSize,
      BATCH_CONFIG.processingDelayMs
    );
    
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;
    
    console.log(`[EXPIRY_SCHEDULER] [7-DAY] ✓ Completed in ${Date.now() - startTime}ms: ${succeeded} sent, ${failed} failed`);
  } catch (error) {
    console.error('[EXPIRY_SCHEDULER] [7-DAY] ✗ Fatal error:', error.message);
  }
}

/**
 * Mark franchises as expired and send urgent notice - BATCH OPTIMIZED
 * SMS + EMAIL (URGENT - must-act notification)
 */
async function handleExpiredFranchises() {
  console.log('[EXPIRY_SCHEDULER] [EXPIRY] Starting...');
  const startTime = Date.now();
  
  try {
    const franchises = await getFranchisesExpiringOn(0); // Today
    
    if (franchises.length === 0) {
      console.log('[EXPIRY_SCHEDULER] [EXPIRY] ✓ No franchises expiring today');
      return;
    }
    
    console.log(`[EXPIRY_SCHEDULER] [EXPIRY] Found ${franchises.length} franchises expiring today`);
    
    const handleExpiry = async (franchise) => {
      const key = franchise._id.toString();
      
      try {
        // Update status to 'expired'
        const updated = await FranchiseInformation.findByIdAndUpdate(
          key,
          {
            franchiseStatus: 'expired',
            changedAt: new Date(),
            changeType: 'auto_expired'
          },
          { new: true, lean: true }
        );
        
        if (!updated) {
          return { success: false, reason: 'update_failed', franchise };
        }
        
        console.log(`[EXPIRY_SCHEDULER] [EXPIRY] → Marked ${franchise.franchiseNumber}/${franchise.franchiseChainId} (v${franchise.version}) as EXPIRED`);
        
        // Audit log (non-blocking)
        auditLogService.logFranchiseExpired(updated).catch(err =>
          console.error('[EXPIRY_SCHEDULER] [EXPIRY] Audit log error:', err.message)
        );
        
        // Send notification if contact exists
        if (!franchise.operatorContactNumber && !franchise.operatorEmail) {
          return { success: true, reason: 'no_contact', franchise };
        }
        
        // Skip if already sent
        if (sentNotifications.has(key) && sentNotifications.get(key)['expired']) {
          return { success: true, reason: 'already_sent', franchise };
        }
        
        const notificationResult = await sendFranchiseExpiryNotification(franchise, 0);
        sentNotifications.set(key, { ...sentNotifications.get(key), 'expired': true });
        
        return { success: true, result: notificationResult, franchise };
      } catch (error) {
        console.error(`[EXPIRY_SCHEDULER] [EXPIRY] ✗ Failed for ${franchise.franchiseNumber}:`, error.message);
        return { success: false, reason: error.message, franchise };
      }
    };
    
    const results = await processBatch(
      franchises,
      handleExpiry,
      BATCH_CONFIG.smsBatchSize,
      BATCH_CONFIG.processingDelayMs
    );
    
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;
    
    console.log(`[EXPIRY_SCHEDULER] [EXPIRY] ✓ Completed in ${Date.now() - startTime}ms: ${succeeded} handled, ${failed} failed`);
  } catch (error) {
    console.error('[EXPIRY_SCHEDULER] [EXPIRY] ✗ Fatal error:', error.message);
  }
}

/**
 * Revoke franchises expired for 1+ year - BATCH OPTIMIZED
 * Only checks 'expired' status - never checks 'active' directly
 * After 1 year of no renewal/amendment, number is available for reassignment
 */
async function revokeExpiredFranchises() {
  console.log('[EXPIRY_SCHEDULER] [REVOKE] Starting...');
  const startTime = Date.now();
  
  try {
    const franchisesToRevoke = await getFranchisesEligibleForRevocation();
    
    if (franchisesToRevoke.length === 0) {
      console.log('[EXPIRY_SCHEDULER] [REVOKE] ✓ No franchises eligible for revocation');
      return;
    }
    
    console.log(`[EXPIRY_SCHEDULER] [REVOKE] Found ${franchisesToRevoke.length} franchises eligible for revocation`);
    
    const revokeOne = async (franchise) => {
      const key = franchise._id.toString();
      
      try {
        // Update status to 'revoked'
        const updated = await FranchiseInformation.findByIdAndUpdate(
          key,
          {
            franchiseStatus: 'revoked',
            revokedAt: new Date(),
            revokedReason: 'Automatic revocation: Not renewed within 1 year after expiry',
            changeType: 'auto_revoked',
            changedAt: new Date()
          },
          { new: true, lean: true }
        );
        
        if (!updated) {
          return { success: false, reason: 'update_failed', franchise };
        }
        
        // Invalidate QR cache so scans show updated status
        invalidateQRCache(franchise.franchiseNumber);
        
        console.log(`[EXPIRY_SCHEDULER] [REVOKE] → ${franchise.franchiseNumber}/${franchise.franchiseChainId} (v${franchise.version}) revoked - number available for reassignment`);
        
        // Audit log (non-blocking)
        auditLogService.logFranchiseRevoked(
          updated,
          {
            id: 'SYSTEM',
            userId: 'SYSTEM',
            username: 'System',
            name: 'Automated System',
            role: 'super-admin',
            accountType: 'admin'
          },
          {
            headers: { 'user-agent': 'System Scheduler' },
            connection: { remoteAddress: '127.0.0.1' }
          },
          'Not renewed within 1 year after expiry'
        ).catch(err =>
          console.error('[EXPIRY_SCHEDULER] [REVOKE] Audit log error:', err.message)
        );
        
        return { success: true, franchise };
      } catch (error) {
        console.error(`[EXPIRY_SCHEDULER] [REVOKE] ✗ Failed for ${franchise.franchiseNumber}:`, error.message);
        return { success: false, reason: error.message, franchise };
      }
    };
    
    const results = await processBatch(
      franchisesToRevoke,
      revokeOne,
      BATCH_CONFIG.emailBatchSize,
      BATCH_CONFIG.processingDelayMs
    );
    
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;
    
    console.log(`[EXPIRY_SCHEDULER] [REVOKE] ✓ Completed in ${Date.now() - startTime}ms: ${succeeded} revoked, ${failed} failed`);
  } catch (error) {
    console.error('[EXPIRY_SCHEDULER] [REVOKE] ✗ Fatal error:', error.message);
  }
}

/**
 * Get franchises that should have expired during downtime
 * Finds all franchises with expiryDate between lastRun and today that are still 'active'
 * 
 * @param {Date} fromDate - Start date (last successful run)
 * @param {Date} toDate - End date (today)
 * @returns {Promise<Array>} List of franchises that missed expiration processing
 */
async function getMissedExpiredFranchises(fromDate, toDate) {
  try {
    const missedFranchises = await FranchiseInformation.aggregate([
      {
        $match: {
          franchiseChainId: { $exists: true, $ne: null },
          franchiseStatus: 'active', // Still active but should be expired
          expiryDate: {
            $gte: fromDate,
            $lt: toDate
          }
        }
      },
      { $sort: { franchiseChainId: 1, version: -1 } },
      {
        $group: {
          _id: '$franchiseChainId',
          latestFranchise: { $first: '$$ROOT' }
        }
      },
      {
        $project: {
          _id: '$latestFranchise._id',
          franchiseNumber: '$latestFranchise.franchiseNumber',
          franchiseChainId: '$latestFranchise.franchiseChainId',
          operatorName: '$latestFranchise.operatorName',
          operatorEmail: '$latestFranchise.operatorEmail',
          operatorContactNumber: '$latestFranchise.operatorContactNumber',
          expiryDate: '$latestFranchise.expiryDate',
          version: '$latestFranchise.version',
          franchiseStatus: '$latestFranchise.franchiseStatus'
        }
      }
    ])
    .allowDiskUse(true)
    .lean()
    .exec();
    
    return missedFranchises;
  } catch (error) {
    console.error('[CATCH-UP] Error fetching missed franchises:', error.message);
    return [];
  }
}

/**
 * Process missed expirations during downtime
 * Marks franchises as expired and sends notifications
 */
async function processMissedExpirations(missedDays) {
  console.log(`[CATCH-UP] Processing ${missedDays} missed day(s)...`);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - missedDays);
  
  // Get franchises that should have expired during downtime
  const missedFranchises = await getMissedExpiredFranchises(fromDate, today);
  
  if (missedFranchises.length === 0) {
    console.log('[CATCH-UP] ✓ No missed expirations found');
    return { processed: 0, errors: 0 };
  }
  
  console.log(`[CATCH-UP] Found ${missedFranchises.length} franchises that should have expired during downtime`);
  
  let processed = 0;
  let errors = 0;
  
  for (const franchise of missedFranchises) {
    try {
      // Mark as expired
      await FranchiseInformation.findByIdAndUpdate(
        franchise._id,
        {
          franchiseStatus: 'expired',
          changedAt: new Date(),
          changeType: 'auto_expired_catchup',
          changeNotes: `Expired during server downtime. Original expiry: ${franchise.expiryDate.toISOString()}`
        }
      );
      
      console.log(`[CATCH-UP] → Marked ${franchise.franchiseNumber} as EXPIRED (was due: ${franchise.expiryDate.toDateString()})`);
      
      // Send notification (SMS + email for missed expirations)
      if (franchise.operatorEmail || franchise.operatorContactNumber) {
        try {
          await sendFranchiseExpiryNotification(franchise, 0);
          console.log(`[CATCH-UP] → Sent catch-up notification to ${franchise.operatorName}`);
        } catch (notifError) {
          console.error(`[CATCH-UP] ✗ Notification failed for ${franchise.franchiseNumber}:`, notifError.message);
        }
      }
      
      // Audit log
      auditLogService.logFranchiseExpired({
        ...franchise,
        _id: franchise._id,
        changeNotes: 'Catch-up expiration after server downtime'
      }).catch(err => console.error('[CATCH-UP] Audit log error:', err.message));
      
      processed++;
    } catch (error) {
      console.error(`[CATCH-UP] ✗ Failed to process ${franchise.franchiseNumber}:`, error.message);
      errors++;
    }
  }
  
  return { processed, errors };
}

/**
 * Run all expiry checks in sequence - optimized for performance
 * Processes: 30-day → 7-day → expiry → revocation
 * 
 * Memory note: ~50-100MB per 1000 franchises
 * For 5K-7K franchises: expect 250-700MB peak usage
 */
async function runExpiryChecks(isCatchUp = false) {
  const runStartTime = Date.now();
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`[EXPIRY_SCHEDULER] ${isCatchUp ? 'Catch-up' : 'Daily'} check cycle starting...`);
  console.log(`[EXPIRY_SCHEDULER] Time: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`);
  
  // Show memory usage (Node.js only)
  const memBefore = process.memoryUsage();
  console.log(`[EXPIRY_SCHEDULER] Memory before: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  let processedCount = 0;
  let errorCount = 0;
  
  try {
    // Clear in-memory cache for this run
    sentNotifications.clear();
    
    // Run checks in sequence (not parallel) to avoid overwhelming backend
    await sendThirtyDayReminders();
    await sendSevenDayReminders();
    await handleExpiredFranchises();
    await revokeExpiredFranchises();
    
    const totalTime = Date.now() - runStartTime;
    const memAfter = process.memoryUsage();
    
    // Update scheduler state
    await SchedulerState.updateLastRun(SCHEDULER_NAME, 'success', {
      processedCount,
      errorCount,
      durationMs: totalTime,
      missedDaysCaughtUp: 0
    });
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`[EXPIRY_SCHEDULER] ✓ ${isCatchUp ? 'Catch-up' : 'Daily'} cycle completed in ${totalTime}ms`);
    console.log(`[EXPIRY_SCHEDULER] Memory after: ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB (delta: ${Math.round((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024)}MB)`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    return { success: true, durationMs: totalTime };
  } catch (error) {
    console.error('[EXPIRY_SCHEDULER] ✗ FATAL ERROR:', error.message);
    console.error(error.stack);
    
    // Update scheduler state with failure
    await SchedulerState.updateLastRun(SCHEDULER_NAME, 'failed', {
      processedCount,
      errorCount: errorCount + 1,
      durationMs: Date.now() - runStartTime
    }).catch(() => {});
    
    return { success: false, error: error.message };
  }
}

/**
 * Check for missed runs and catch up
 * Called on server startup
 */
async function catchUpMissedRuns() {
  try {
    const missedDays = await SchedulerState.getDaysSinceLastRun(SCHEDULER_NAME);
    
    if (missedDays <= 0) {
      console.log('[EXPIRY_SCHEDULER] ✓ No missed runs detected');
      return;
    }
    
    if (missedDays > 30) {
      console.warn(`[EXPIRY_SCHEDULER] ⚠ Server was down for ${missedDays} days! Limiting catch-up to 30 days.`);
    }
    
    const daysToProcess = Math.min(missedDays, 30);
    
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log(`║  CATCH-UP MODE: Server was offline for ${missedDays} day(s)              ║`);
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    
    // Process missed expirations
    const catchUpResult = await processMissedExpirations(daysToProcess);
    
    console.log(`[CATCH-UP] ✓ Processed ${catchUpResult.processed} missed expirations, ${catchUpResult.errors} errors`);
    
    // Now run normal checks for today
    await runExpiryChecks(true);
    
    // Update state with catch-up info
    await SchedulerState.updateLastRun(SCHEDULER_NAME, 'success', {
      processedCount: catchUpResult.processed,
      errorCount: catchUpResult.errors,
      missedDaysCaughtUp: daysToProcess
    });
    
  } catch (error) {
    console.error('[CATCH-UP] ✗ Error during catch-up:', error.message);
  }
}

/**
 * Initialize the expiry scheduler
 * Runs daily at 6:00 AM (Philippine Time)
 * On startup, checks for missed runs and catches up
 */
async function initializeFranchiseExpiryScheduler() {
  // '0 6 * * *' = At 6:00 AM every day
  const cronExpression = '0 6 * * *';
  
  cron.schedule(cronExpression, async () => {
    await runExpiryChecks();
  }, {
    scheduled: true,
    timezone: 'Asia/Manila' 
  });
  
  // Silent initialization - only log if DEBUG mode
  if (process.env.DEBUG === 'true') {
    console.log('[DEBUG] Expiry scheduler: daily at 6:00 AM');
  }
  
  // ALWAYS check for missed runs on startup (after 3 seconds to let DB stabilize)
  setTimeout(async () => {
    console.log('[EXPIRY_SCHEDULER] Checking for missed runs during downtime...');
    await catchUpMissedRuns();
  }, 3000);
}

/**
 * Manual trigger for testing (can be called via API endpoint)
 */
async function triggerManualExpiryCheck() {
  console.log('[EXPIRY_SCHEDULER] Manual trigger initiated...');
  await runExpiryChecks();
}

module.exports = {
  initializeFranchiseExpiryScheduler,
  triggerManualExpiryCheck,
  runExpiryChecks,
  catchUpMissedRuns
};
