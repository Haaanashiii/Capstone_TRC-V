const cron = require('node-cron');
const FranchiseInformation = require('../models/franchiseInformationModel');
const { sendFranchiseExpiryEmail } = require('./emailService');

/**
 * Franchise Expiry Reminder Scheduler
 * Runs daily at 8:00 AM to check for franchises expiring soon
 * Sends reminder emails to operators at different intervals:
 * - 30 days before expiry (urgent renewal notice)
 * - 7 days before expiry (final warning)
 * - On expiry date (franchise expired notice)
 */

// Track sent notifications to avoid duplicate emails
const sentNotifications = new Map(); // { franchiseId: { 30days: true, 7days: true, expired: true } }

/**
 * Check for franchises expiring within the specified days
 * @param {number} daysBeforeExpiry - Number of days before expiry to check
 * @returns {Promise<Array>} List of franchises expiring
 */
async function getFranchisesExpiringIn(daysBeforeExpiry) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);
    
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Find active franchises expiring on the target date
    const franchises = await FranchiseInformation.find({
      franchiseStatus: 'active',
      expiryDate: {
        $gte: targetDate,
        $lt: nextDay
      }
    }).select('operatorId mtopNumber operatorName email contactNumber expiryDate franchiseStatus');
    
    return franchises;
  } catch (error) {
    console.error(`[EXPIRY_CHECK] Error fetching franchises expiring in ${daysBeforeExpiry} days:`, error);
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
 * Send expiry reminder emails for franchises expiring in 30 days
 */
async function sendThirtyDayReminders() {
  console.log('\n[EXPIRY_SCHEDULER] Checking for franchises expiring in 30 days...');
  
  const franchises = await getFranchisesExpiringIn(30);
  
  if (franchises.length === 0) {
    console.log('[EXPIRY_SCHEDULER] No franchises expiring in 30 days');
    return;
  }
  
  console.log(`[EXPIRY_SCHEDULER] Found ${franchises.length} franchise(s) expiring in 30 days`);
  
  for (const franchise of franchises) {
    if (!franchise.email) {
      console.log(`[EXPIRY_SCHEDULER] Skipping ${franchise.mtopNumber} - no email address`);
      continue;
    }
    
    // Check if already sent
    if (wasNotificationSent(franchise._id.toString(), '30days')) {
      console.log(`[EXPIRY_SCHEDULER] Already sent 30-day reminder for ${franchise.mtopNumber}`);
      continue;
    }
    
    try {
      await sendFranchiseExpiryEmail(
        franchise.email,
        franchise.operatorName,
        franchise.mtopNumber,
        franchise.expiryDate,
        30 // days until expiry
      );
      
      markNotificationSent(franchise._id.toString(), '30days');
      console.log(`[EXPIRY_SCHEDULER] ✅ Sent 30-day reminder to ${franchise.operatorName} (${franchise.email})`);
    } catch (error) {
      console.error(`[EXPIRY_SCHEDULER] ❌ Failed to send email to ${franchise.email}:`, error.message);
    }
  }
}

/**
 * Send expiry reminder emails for franchises expiring in 7 days
 */
async function sendSevenDayReminders() {
  console.log('\n[EXPIRY_SCHEDULER] Checking for franchises expiring in 7 days...');
  
  const franchises = await getFranchisesExpiringIn(7);
  
  if (franchises.length === 0) {
    console.log('[EXPIRY_SCHEDULER] No franchises expiring in 7 days');
    return;
  }
  
  console.log(`[EXPIRY_SCHEDULER] Found ${franchises.length} franchise(s) expiring in 7 days`);
  
  for (const franchise of franchises) {
    if (!franchise.email) {
      console.log(`[EXPIRY_SCHEDULER] Skipping ${franchise.mtopNumber} - no email address`);
      continue;
    }
    
    // Check if already sent
    if (wasNotificationSent(franchise._id.toString(), '7days')) {
      console.log(`[EXPIRY_SCHEDULER] Already sent 7-day reminder for ${franchise.mtopNumber}`);
      continue;
    }
    
    try {
      await sendFranchiseExpiryEmail(
        franchise.email,
        franchise.operatorName,
        franchise.mtopNumber,
        franchise.expiryDate,
        7 // days until expiry
      );
      
      markNotificationSent(franchise._id.toString(), '7days');
      console.log(`[EXPIRY_SCHEDULER] ✅ Sent 7-day reminder to ${franchise.operatorName} (${franchise.email})`);
    } catch (error) {
      console.error(`[EXPIRY_SCHEDULER] ❌ Failed to send email to ${franchise.email}:`, error.message);
    }
  }
}

/**
 * Mark expired franchises and send expiry notice
 */
async function handleExpiredFranchises() {
  console.log('\n[EXPIRY_SCHEDULER] Checking for expired franchises...');
  
  const franchises = await getFranchisesExpiringIn(0); // Expiring today
  
  if (franchises.length === 0) {
    console.log('[EXPIRY_SCHEDULER] No franchises expiring today');
    return;
  }
  
  console.log(`[EXPIRY_SCHEDULER] Found ${franchises.length} franchise(s) expiring today`);
  
  for (const franchise of franchises) {
    try {
      // Update franchise status to 'expired'
      franchise.franchiseStatus = 'expired';
      await franchise.save();
      
      console.log(`[EXPIRY_SCHEDULER] Marked franchise ${franchise.mtopNumber} as EXPIRED`);
      
      // Send expiry notice if email exists
      if (franchise.email) {
        // Check if already sent
        if (wasNotificationSent(franchise._id.toString(), 'expired')) {
          console.log(`[EXPIRY_SCHEDULER] Already sent expiry notice for ${franchise.mtopNumber}`);
          continue;
        }
        
        await sendFranchiseExpiryEmail(
          franchise.email,
          franchise.operatorName,
          franchise.mtopNumber,
          franchise.expiryDate,
          0 // expired today
        );
        
        markNotificationSent(franchise._id.toString(), 'expired');
        console.log(`[EXPIRY_SCHEDULER] ✅ Sent expiry notice to ${franchise.operatorName} (${franchise.email})`);
      }
    } catch (error) {
      console.error(`[EXPIRY_SCHEDULER] ❌ Failed to handle expired franchise ${franchise.mtopNumber}:`, error.message);
    }
  }
}

/**
 * Run all expiry checks (30 days, 7 days, and expired)
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

  // '0 8 * * 1' = At 8:00 AM every Monday
  const cronExpression = '0 8 * * 1';
  
  cron.schedule(cronExpression, async () => {
    await runExpiryChecks();
  }, {
    scheduled: true,
    timezone: 'Asia/Manila' 
  });
  
  // Calculate next Monday at 8:00 AM
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(8, 0, 0, 0);
  
  // Get days until next Monday (1 = Monday, 0 = Sunday)
  const currentDay = now.getDay();
  const daysUntilMonday = currentDay === 0 ? 1 : (8 - currentDay) % 7 || 7;
  
  // If it's Monday but after 8 AM, schedule for next Monday
  if (currentDay === 1 && now.getHours() >= 8) {
    nextRun.setDate(nextRun.getDate() + 7);
  } else if (currentDay !== 1) {
    nextRun.setDate(nextRun.getDate() + daysUntilMonday);
  }
  
  console.log('========================================');
  console.log('[EXPIRY_SCHEDULER] 📅 Franchise Expiry Scheduler initialized');
  console.log('[EXPIRY_SCHEDULER] Schedule: Every Monday at 8:00 AM (Philippine Time)');
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
