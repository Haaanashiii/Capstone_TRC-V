const cron = require('node-cron');
const { backupService, BACKUP_CONFIG } = require('./backupService');
const { auditLogService } = require('./auditLogService');

let autoBackupJob = null;

/**
 * Initialize automatic backup scheduler
 */
const initializeBackupScheduler = () => {
  if (!BACKUP_CONFIG.autoBackupEnabled) {
    if (process.env.DEBUG === 'true') console.log('[BACKUP] Auto-backups disabled');
    return;
  }
  
  const cronExpression = BACKUP_CONFIG.autoBackupCron;
  
  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    console.error(`[BACKUP] Invalid cron: ${cronExpression}`);
    return;
  }
  
  autoBackupJob = cron.schedule(cronExpression, async () => {
    console.log('[BACKUP] Running scheduled backup...');
    
    try {
      const result = await backupService.createBackup({
        type: 'automatic',
        notes: 'Scheduled automatic backup',
        initiatedBy: {
          adminId: null,
          adminName: 'System Scheduler',
          adminRole: 'scheduler'
        }
      });
      
      console.log(`[BACKUP SCHEDULER] SUCCESS - Automatic backup completed: ${result.backupId}`);
      console.log(`[BACKUP SCHEDULER] - Size: ${result.formattedSize}`);
      console.log(`[BACKUP SCHEDULER] - Documents: ${result.totalDocuments}`);
      
      // Log to audit trail - AUTOMATIC BACKUP SUCCESS
      await auditLogService.logAutomaticBackup(result, true);
      
      // Also run cleanup after successful backup
      await backupService.cleanupOldBackups();
      console.log('[BACKUP SCHEDULER] SUCCESS - Old backup cleanup completed');
      
    } catch (error) {
      console.error('[BACKUP SCHEDULER] ERROR - Automatic backup failed:', error.message);
      
      // Log to audit trail - AUTOMATIC BACKUP FAILED
      await auditLogService.logAutomaticBackup(null, false, error.message);
      
      // Could add alerting here (email, SMS, etc.)
      // await sendBackupFailureAlert(error);
    }
  }, {
    scheduled: true,
    timezone: process.env.BACKUP_TIMEZONE || 'Asia/Manila' // Philippines timezone
  });
  
  // Silent initialization - only log if DEBUG mode
  if (process.env.DEBUG === 'true') {
    console.log(`[DEBUG] Backup scheduler: ${cronExpression}`);
  }
};

/**
 * Stop automatic backup scheduler
 */
const stopBackupScheduler = () => {
  if (autoBackupJob) {
    autoBackupJob.stop();
    autoBackupJob = null;
    console.log('[BACKUP SCHEDULER] Automatic backup scheduler stopped');
  }
};

/**
 * Restart automatic backup scheduler with new configuration
 */
const restartBackupScheduler = () => {
  stopBackupScheduler();
  initializeBackupScheduler();
};

/**
 * Check if scheduler is running
 */
const isSchedulerRunning = () => {
  return autoBackupJob !== null;
};

/**
 * Get next backup time (approximate)
 */
const getNextBackupTime = (cronExpression) => {
  try {
    // Parse cron expression to get next execution time
    // This is a simplified version - for exact time, use cron-parser library
    const parts = cronExpression.split(' ');
    
    if (parts.length >= 5) {
      const minute = parts[0];
      const hour = parts[1];
      const dayOfMonth = parts[2];
      const month = parts[3];
      const dayOfWeek = parts[4];
      
      // For daily backups at specific time
      if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        const now = new Date();
        const nextRun = new Date();
        nextRun.setHours(parseInt(hour) || 0, parseInt(minute) || 0, 0, 0);
        
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        
        return nextRun.toISOString();
      }
    }
    
    return 'See cron expression: ' + cronExpression;
  } catch (error) {
    return 'Unable to calculate next run time';
  }
};

/**
 * Trigger an immediate backup (bypasses scheduler)
 */
const triggerImmediateBackup = async (notes = 'Manually triggered backup') => {
  console.log('[BACKUP SCHEDULER] Triggering immediate backup...');
  
  return backupService.createBackup({
    type: 'automatic',
    notes,
    initiatedBy: {
      adminId: null,
      adminName: 'System Trigger',
      adminRole: 'manual-trigger'
    }
  });
};

/**
 * Get scheduler status
 */
const getSchedulerStatus = () => {
  return {
    isRunning: isSchedulerRunning(),
    autoBackupEnabled: BACKUP_CONFIG.autoBackupEnabled,
    cronExpression: BACKUP_CONFIG.autoBackupCron,
    nextBackupTime: isSchedulerRunning() ? getNextBackupTime(BACKUP_CONFIG.autoBackupCron) : null,
    timezone: process.env.BACKUP_TIMEZONE || 'Asia/Manila'
  };
};

module.exports = {
  initializeBackupScheduler,
  stopBackupScheduler,
  restartBackupScheduler,
  isSchedulerRunning,
  getNextBackupTime,
  triggerImmediateBackup,
  getSchedulerStatus
};
