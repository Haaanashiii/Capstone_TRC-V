const cron = require('node-cron');
const FranchiseInformation = require('../models/franchiseInformationModel');
const { sendFranchiseExpiryEmail } = require('./emailService');
const { sendFranchiseExpiryNotification } = require('./notificationQueueService');
const { auditLogService } = require('./auditLogService');

/**
 * Franchise Expiry Reminder Scheduler
 * Runs daily at 6:00 AM to check for franchises expiring soon
 * 
 * Checks the LATEST VERSION of each franchise number:
 * - 30 days before expiry (urgent renewal notice)
 * - 7 days before expiry (final warning)
 * - On expiry date (franchise expired notice)
 * - 1 year after expiry without renewal (auto-revoke for franchise number recycling)
 */

// Track sent notifications to avoid duplicate emails
const sentNotifications = new Map(); // { franchiseId: { 30days: true, 7days: true, expired: true } }

/**
 * Get the latest version of each franchise number
 * @returns {Promise<Array>} List of latest franchise versions
 */
async function getLatestFranchiseVersions() {
  try {
    // Group by franchiseNumber and get the one with highest version number
    const latestFranchises = await FranchiseInformation.aggregate([
      {
        $match: {
          franchiseNumber: { $exists: true, $ne: null }
        }
      },
      {
        $sort: { franchiseNumber: 1, versionNumber: -1 }
      },
      {
        $group: {
          _id: '$franchiseNumber',
          latestFranchise: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$latestFranchise' }
      }
    ]);
    
    return latestFranchises;
  } catch (error) {
    console.error('[EXPIRY_CHECK] Error fetching latest franchise versions:', error);
    return [];
  }
}

/**
 * Check for latest franchises expiring within the specified days
 * @param {number} daysBeforeExpiry - Number of days before expiry to check
 * @returns {Promise<Array>} List of latest franchises expiring
 */
async function getLatestFranchisesExpiringIn(daysBeforeExpiry) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);
    
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Get all latest franchise versions
    const latestFranchises = await getLatestFranchiseVersions();
    
    // Filter for active franchises expiring on target date
    const expiringFranchises = latestFranchises.filter(franchise => {
      const expiryDate = new Date(franchise.expiryDate);
      return franchise.franchiseStatus === 'active' &&
             expiryDate >= targetDate &&
             expiryDate < nextDay;
    });
    
    return expiringFranchises;
  } catch (error) {
    console.error(`[EXPIRY_CHECK] Error fetching latest franchises expiring in ${daysBeforeExpiry} days:`, error);
    return [];
  }
}

/**
 * Check if notification was already sent for this franchise and interval
 * @param {string} franchiseId - Franchise ID
 * @param {string} interval - Notification interval (30days, 7days, expired)
 * @returns {boolean} True if already sent
 */
function wasNotificationSent(franchiseId, interval) {
  const sent = sentNotifications.get(franchiseId);
  return sent && sent[interval] === true;
}

/**
 * Mark notification as sent
 * @param {string} franchiseId - Franchise ID
 * @param {string} interval - Notification interval
 */
function markNotificationSent(franchiseId, interval) {
  const sent = sentNotifications.get(franchiseId) || {};
  sent[interval] = true;
  sentNotifications.set(franchiseId, sent);
}

/**
 * Send expiry reminder emails for latest franchises expiring in 30 days
 * 30-day reminders: EMAIL ONLY (cost optimization)
 */
async function sendThirtyDayReminders() {
  console.log('\n[EXPIRY_SCHEDULER] Checking latest franchise versions expiring in 30 days...');
  
  const franchises = await getLatestFranchisesExpiringIn(30);
  
  if (franchises.length === 0) {
    console.log('[EXPIRY_SCHEDULER] No latest franchises expiring in 30 days');
    return;
  }
  
  console.log(`[EXPIRY_SCHEDULER] Found ${franchises.length} latest franchise(s) expiring in 30 days`);
  
  for (const franchise of franchises) {
    if (!franchise.operatorEmail) {
      console.log(`[EXPIRY_SCHEDULER] Skipping ${franchise.franchiseNumber} (v${franchise.versionNumber}) - no email address`);
      continue;
    }
    
    // Check if already sent
    if (wasNotificationSent(franchise._id.toString(), '30days')) {
      console.log(`[EXPIRY_SCHEDULER] Already sent 30-day reminder for ${franchise.franchiseNumber} (v${franchise.versionNumber})`);
      continue;
    }
    
    try {
      await sendFranchiseExpiryEmail(
        franchise.operatorEmail,
        franchise.operatorName,
        franchise.franchiseNumber,
        franchise.expiryDate,
        30 // days until expiry
      );
      
      markNotificationSent(franchise._id.toString(), '30days');
      console.log(`[EXPIRY_SCHEDULER] ✅ Sent 30-day reminder for Franchise ${franchise.franchiseNumber} (v${franchise.versionNumber}) to ${franchise.operatorName} (${franchise.operatorEmail})`);
    } catch (error) {
      console.error(`[EXPIRY_SCHEDULER] ❌ Failed to send email to ${franchise.operatorEmail}:`, error.message);
    }
  }
}

/**
 * Send expiry reminder emails for latest franchises expiring in 7 days
 * 7-day reminders: SMS + EMAIL (actionable warning)
 * Uses notification queue for smart delivery (max 2 SMS attempts tracked)
 */
async function sendSevenDayReminders() {
  console.log('\n[EXPIRY_SCHEDULER] Checking latest franchise versions expiring in 7 days...');
  
  const franchises = await getLatestFranchisesExpiringIn(7);
  
  if (franchises.length === 0) {
    console.log('[EXPIRY_SCHEDULER] No latest franchises expiring in 7 days');
    return;
  }
  
  console.log(`[EXPIRY_SCHEDULER] Found ${franchises.length} latest franchise(s) expiring in 7 days`);
  
  for (const franchise of franchises) {
    if (!franchise.operatorEmail && !franchise.operatorContactNumber) {
      console.log(`[EXPIRY_SCHEDULER] Skipping ${franchise.franchiseNumber} (v${franchise.versionNumber}) - no contact info`);
      continue;
    }
    
    // Check if already sent
    if (wasNotificationSent(franchise._id.toString(), '7days')) {
      console.log(`[EXPIRY_SCHEDULER] Already sent 7-day reminder for ${franchise.franchiseNumber} (v${franchise.versionNumber})`);
      continue;
    }
    
    try {
      // Use notification queue: SMS (high priority) + Email (always)
      const notificationResult = await sendFranchiseExpiryNotification(franchise, 7);
      
      markNotificationSent(franchise._id.toString(), '7days');
      console.log(`[EXPIRY_SCHEDULER] ✅ Sent 7-day reminder for Franchise ${franchise.franchiseNumber} (v${franchise.versionNumber}):`, {
        sms: notificationResult.sms?.success ? 'SENT' : 'FAILED',
        email: notificationResult.email?.success ? 'SENT' : 'FAILED',
        operator: franchise.operatorName
      });
    } catch (error) {
      console.error(`[EXPIRY_SCHEDULER] ❌ Failed to send 7-day notification to ${franchise.franchiseNumber}:`, error.message);
    }
  }
}

/**
 * Mark expired latest franchises and send expiry notice
 * Final day reminders: SMS + EMAIL (URGENT - actionable)
 * Uses notification queue for smart delivery
 */
async function handleExpiredFranchises() {
  console.log('\n[EXPIRY_SCHEDULER] Checking for expired latest franchises...');
  
  const franchises = await getLatestFranchisesExpiringIn(0); // Expiring today
  
  if (franchises.length === 0) {
    console.log('[EXPIRY_SCHEDULER] No latest franchises expiring today');
    return;
  }
  
  console.log(`[EXPIRY_SCHEDULER] Found ${franchises.length} latest franchise(s) expiring today`);
  
  for (const franchise of franchises) {
    try {
      // Update franchise status to 'expired'
      franchise.franchiseStatus = 'expired';
      await franchise.save();
      
      console.log(`[EXPIRY_SCHEDULER] Marked Franchise ${franchise.franchiseNumber} (v${franchise.versionNumber}) as EXPIRED`);
      
      // Log franchise expiration in audit trail
      await auditLogService.logFranchiseExpired(franchise).catch(err =>
        console.error('[EXPIRY_SCHEDULER] Audit log error:', err)
      );
      
      // Send expiry notice if contact info exists
      if (franchise.operatorContactNumber || franchise.operatorEmail) {
        // Check if already sent
        if (wasNotificationSent(franchise._id.toString(), 'expired')) {
          console.log(`[EXPIRY_SCHEDULER] Already sent expiry notice for ${franchise.franchiseNumber} (v${franchise.versionNumber})`);
          continue;
        }
        
        // Use notification queue: SMS (URGENT) + Email (always)
        const notificationResult = await sendFranchiseExpiryNotification(franchise, 0);
        
        markNotificationSent(franchise._id.toString(), 'expired');
        console.log(`[EXPIRY_SCHEDULER] ✅ Sent URGENT expiry notice for ${franchise.franchiseNumber} (v${franchise.versionNumber}):`, {
          sms: notificationResult.sms?.success ? 'SENT' : 'FAILED',
          email: notificationResult.email?.success ? 'SENT' : 'FAILED',
          operator: franchise.operatorName
        });
      }
    } catch (error) {
      console.error(`[EXPIRY_SCHEDULER] ❌ Failed to handle expired franchise ${franchise.franchiseNumber} (v${franchise.versionNumber}):`, error.message);
    }
  }
}

/**
 * Check and revoke latest franchise versions that have been expired for more than 1 year
 */
async function revokeExpiredFranchises() {
  console.log('\n[EXPIRY_SCHEDULER] Checking latest franchise versions expired for more than 1 year...');
  
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    // Get all latest franchise versions
    const latestFranchises = await getLatestFranchiseVersions();
    
    // Filter for franchises that are expired and have been expired for more than 1 year
    const franchisesToRevoke = latestFranchises.filter(franchise => {
      return franchise.franchiseStatus === 'expired' && 
             franchise.expiryDate < oneYearAgo;
    });
    
    if (franchisesToRevoke.length === 0) {
      console.log('[EXPIRY_SCHEDULER] No latest franchise versions to revoke');
      return;
    }
    
    console.log(`[EXPIRY_SCHEDULER] Found ${franchisesToRevoke.length} latest franchise version(s) expired for over 1 year`);
    
    for (const franchise of franchisesToRevoke) {
      try {
        // Update franchise status to 'revoked'
        franchise.franchiseStatus = 'revoked';
        franchise.revokedAt = new Date();
        franchise.revokedReason = 'Automatic revocation: Not renewed within 1 year after expiry';
        await franchise.save();
        
        console.log(`[EXPIRY_SCHEDULER] Revoked Franchise ${franchise.franchiseNumber} (v${franchise.versionNumber}) (expired on ${franchise.expiryDate})`);
        
        // Log franchise revocation in audit trail
        await auditLogService.logFranchiseRevoked(
          franchise,
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
          console.error('[EXPIRY_SCHEDULER] Audit log error:', err)
        );
        
        console.log(`[EXPIRY_SCHEDULER] ✅ Franchise ${franchise.franchiseNumber} (v${franchise.versionNumber}) has been revoked - number available for reassignment`);
      } catch (error) {
        console.error(`[EXPIRY_SCHEDULER] ❌ Failed to revoke franchise ${franchise.franchiseNumber} (v${franchise.versionNumber}):`, error.message);
      }
    }
  } catch (error) {
    console.error('[EXPIRY_SCHEDULER] Error checking expired franchises for revocation:', error);
  }
}

/**
 * Run all expiry checks (30 days, 7 days, expired, and revocation)
 */
async function runExpiryChecks() {
  console.log('\n========================================');
  console.log('[EXPIRY_SCHEDULER] Running daily franchise expiry checks...');
  console.log('[EXPIRY_SCHEDULER] Time:', new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }));
  console.log('========================================');
  
  try {
    await sendThirtyDayReminders();
    await sendSevenDayReminders();
    await handleExpiredFranchises();
    await revokeExpiredFranchises(); // Check and revoke franchises expired for over 1 year
    
    console.log('\n========================================');
    console.log('[EXPIRY_SCHEDULER] ✅ Daily checks completed');
    console.log('========================================\n');
  } catch (error) {
    console.error('[EXPIRY_SCHEDULER] ❌ Error during expiry checks:', error);
  }
}

/**
 * Initialize the expiry scheduler
 * Runs every Monday at 8:00 AM (Philippine Time)
 */
function initializeFranchiseExpiryScheduler() {

  // '0 6 * * *' = At 6:00 AM every day
  const cronExpression = '0 6 * * *';
  
  cron.schedule(cronExpression, async () => {
    await runExpiryChecks();
  }, {
    scheduled: true,
    timezone: 'Asia/Manila' 
  });
  
  // Calculate next run at 6:00 AM tomorrow
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(6, 0, 0, 0);
  if (now.getHours() >= 6) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  console.log('========================================');
  console.log('[EXPIRY_SCHEDULER] 📅 Franchise Expiry Scheduler initialized');
  console.log('[EXPIRY_SCHEDULER] Schedule: Every day at 6:00 AM (Philippine Time)');
  console.log('[EXPIRY_SCHEDULER] Next run:', nextRun.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }));
  console.log('========================================\n');
  
  // Run immediately on startup (optional - for testing)
  if (process.env.RUN_EXPIRY_CHECK_ON_STARTUP === 'true') {
    console.log('[EXPIRY_SCHEDULER] Running initial expiry check...');
    setTimeout(() => runExpiryChecks(), 5000); // Run after 5 seconds
  }
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
  runExpiryChecks
};
