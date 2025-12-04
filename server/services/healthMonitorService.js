const cron = require('node-cron');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { backupService } = require('./backupService');
const Backup = require('../models/backupModel');
const { auditLogService } = require('./auditLogService');

/**
 * Database Health Monitor & Auto-Recovery Service
 * 
 * This service monitors database health and can automatically restore
 * from the last known good backup if corruption is detected.
 */

// Health check configuration
const HEALTH_CONFIG = {
  // Run health check every 30 minutes
  checkInterval: process.env.HEALTH_CHECK_INTERVAL || '*/30 * * * *',
  
  // Enable auto-recovery
  autoRecoveryEnabled: process.env.AUTO_RECOVERY_ENABLED !== 'false',
  
  // Minimum documents expected per critical collection (sanity check)
  minimumDocuments: {
    adminaccounts: 1,  // At least 1 admin should exist
    // Add more as needed
  },
  
  // Collections to validate
  criticalCollections: [
    'adminaccounts',
    'useraccounts',
    'franchiseapplications',
    'franchiseinformations'
  ]
};

// Health status tracking
let lastHealthStatus = {
  isHealthy: true,
  lastCheck: null,
  consecutiveFailures: 0,
  lastError: null,
  recoveryAttempts: 0
};

/**
 * Perform database health check
 */
async function performHealthCheck() {
  console.log('[HEALTH] Starting database health check...');
  
  const issues = [];
  const startTime = Date.now();
  
  try {
    // Check 1: MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      issues.push({
        type: 'connection',
        severity: 'critical',
        message: 'MongoDB is not connected'
      });
      return createHealthReport(issues, startTime);
    }
    
    const db = mongoose.connection.db;
    
    // Check 2: Database is responsive
    try {
      await db.admin().ping();
    } catch (error) {
      issues.push({
        type: 'connection',
        severity: 'critical',
        message: `Database not responding: ${error.message}`
      });
      return createHealthReport(issues, startTime);
    }
    
    // Check 3: Collections exist and are readable
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    for (const criticalCollection of HEALTH_CONFIG.criticalCollections) {
      if (!collectionNames.includes(criticalCollection)) {
        // Collection might not exist yet (fresh install) - warning only
        issues.push({
          type: 'collection',
          severity: 'warning',
          message: `Collection not found: ${criticalCollection}`
        });
        continue;
      }
      
      try {
        const collection = db.collection(criticalCollection);
        const count = await collection.countDocuments();
        
        // Check minimum document count
        const minDocs = HEALTH_CONFIG.minimumDocuments[criticalCollection];
        if (minDocs && count < minDocs) {
          issues.push({
            type: 'data',
            severity: 'warning',
            message: `${criticalCollection} has ${count} documents, expected at least ${minDocs}`
          });
        }
        
        // Try to read a sample document to verify collection is readable
        await collection.findOne({});
        
      } catch (error) {
        issues.push({
          type: 'collection',
          severity: 'critical',
          message: `Cannot read collection ${criticalCollection}: ${error.message}`
        });
      }
    }
    
    // Check 4: Verify last backup exists and is valid
    const lastBackup = await Backup.getLastSuccessfulBackup();
    if (!lastBackup) {
      issues.push({
        type: 'backup',
        severity: 'warning',
        message: 'No successful backup found'
      });
    } else {
      // Check if backup file exists
      if (!fs.existsSync(lastBackup.filePath)) {
        issues.push({
          type: 'backup',
          severity: 'warning',
          message: `Last backup file missing: ${lastBackup.filePath}`
        });
      }
      
      // Check backup age
      const backupAge = Date.now() - new Date(lastBackup.completedAt).getTime();
      const maxAge = 48 * 60 * 60 * 1000; // 48 hours
      
      if (backupAge > maxAge) {
        issues.push({
          type: 'backup',
          severity: 'warning',
          message: `Last backup is ${Math.round(backupAge / (60 * 60 * 1000))} hours old`
        });
      }
    }
    
    // Check 5: Disk space for backups directory
    try {
      const backupDir = backupService.getConfig().baseDir;
      const dirSize = backupService.getDirectorySize(backupDir);
      const maxSize = 10 * 1024 * 1024 * 1024; // 10GB warning threshold
      
      if (dirSize > maxSize) {
        issues.push({
          type: 'storage',
          severity: 'warning',
          message: `Backup directory is ${backupService.formatBytes(dirSize)}, consider cleanup`
        });
      }
    } catch (error) {
      // Ignore disk check errors
    }
    
    return createHealthReport(issues, startTime);
    
  } catch (error) {
    console.error('[HEALTH] Health check error:', error);
    issues.push({
      type: 'system',
      severity: 'critical',
      message: `Health check failed: ${error.message}`
    });
    return createHealthReport(issues, startTime);
  }
}

/**
 * Create health report from issues
 */
function createHealthReport(issues, startTime) {
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const warningIssues = issues.filter(i => i.severity === 'warning');
  
  const isHealthy = criticalIssues.length === 0;
  const durationMs = Date.now() - startTime;
  
  const report = {
    isHealthy,
    timestamp: new Date().toISOString(),
    durationMs,
    summary: {
      critical: criticalIssues.length,
      warnings: warningIssues.length,
      total: issues.length
    },
    issues
  };
  
  // Update tracking
  if (isHealthy) {
    lastHealthStatus.consecutiveFailures = 0;
    lastHealthStatus.lastError = null;
  } else {
    lastHealthStatus.consecutiveFailures++;
    lastHealthStatus.lastError = criticalIssues[0]?.message || warningIssues[0]?.message;
  }
  
  lastHealthStatus.isHealthy = isHealthy;
  lastHealthStatus.lastCheck = new Date();
  
  // Log status
  if (isHealthy) {
    console.log(`[HEALTH] ✅ Database healthy (${durationMs}ms)`);
  } else {
    console.log(`[HEALTH] ⚠️  Issues detected: ${criticalIssues.length} critical, ${warningIssues.length} warnings`);
    issues.forEach(i => console.log(`[HEALTH]   - [${i.severity.toUpperCase()}] ${i.message}`));
  }
  
  return report;
}

/**
 * Attempt automatic recovery from last good backup
 */
async function attemptAutoRecovery() {
  console.log('[RECOVERY] 🔄 Attempting automatic recovery...');
  
  lastHealthStatus.recoveryAttempts++;
  
  try {
    // Find last successful backup
    const lastBackup = await Backup.getLastSuccessfulBackup();
    
    if (!lastBackup) {
      console.error('[RECOVERY] ❌ No backup available for recovery');
      const result = { success: false, error: 'No backup available' };
      await auditLogService.logAutoRecovery(result, 'health-monitor', false, 'No backup available');
      return result;
    }
    
    // Verify backup before restore
    console.log(`[RECOVERY] Verifying backup: ${lastBackup.backupId}`);
    const verification = await backupService.verifyBackup(lastBackup.backupId);
    
    if (!verification.valid) {
      console.error(`[RECOVERY] ❌ Backup verification failed: ${verification.error}`);
      const result = { success: false, error: `Backup verification failed: ${verification.error}` };
      await auditLogService.logAutoRecovery(result, 'health-monitor', false, result.error);
      return result;
    }
    
    // Create emergency backup of current state before restore
    console.log('[RECOVERY] Creating emergency backup of current state...');
    try {
      await backupService.createBackup({
        type: 'emergency',
        notes: `Pre-recovery backup - attempting restore from ${lastBackup.backupId}`,
        initiatedBy: {
          adminId: null,
          adminName: 'Auto-Recovery System',
          adminRole: 'auto-recovery'
        }
      });
    } catch (error) {
      console.warn('[RECOVERY] Could not create pre-recovery backup:', error.message);
    }
    
    // Perform restore
    console.log(`[RECOVERY] Restoring from backup: ${lastBackup.backupId}`);
    const restoreResult = await backupService.restoreBackup(lastBackup.backupId, {
      dropExisting: false,  // Don't drop - merge instead
      dryRun: false
    });
    
    console.log(`[RECOVERY] ✅ Recovery completed: ${restoreResult.totalDocuments} documents restored`);
    
    const result = {
      success: true,
      backupId: lastBackup.backupId,
      totalDocuments: restoreResult.totalDocuments,
      restoredCollections: restoreResult.restoredCollections
    };
    
    // Log successful auto-recovery to audit trail
    await auditLogService.logAutoRecovery(result, 'health-monitor', true);
    
    return result;
    
  } catch (error) {
    console.error('[RECOVERY] ❌ Recovery failed:', error.message);
    const result = { success: false, error: error.message };
    await auditLogService.logAutoRecovery(result, 'health-monitor', false, error.message);
    return result;
  }
}

/**
 * Get current health status
 */
function getHealthStatus() {
  return {
    ...lastHealthStatus,
    config: {
      checkInterval: HEALTH_CONFIG.checkInterval,
      autoRecoveryEnabled: HEALTH_CONFIG.autoRecoveryEnabled,
      criticalCollections: HEALTH_CONFIG.criticalCollections
    }
  };
}

/**
 * Initialize health monitor scheduler
 */
let healthCheckJob = null;

function initializeHealthMonitor() {
  console.log('[HEALTH] Initializing database health monitor...');
  
  // Validate cron expression
  if (!cron.validate(HEALTH_CONFIG.checkInterval)) {
    console.error(`[HEALTH] Invalid cron expression: ${HEALTH_CONFIG.checkInterval}`);
    return;
  }
  
  // Schedule periodic health checks
  healthCheckJob = cron.schedule(HEALTH_CONFIG.checkInterval, async () => {
    const report = await performHealthCheck();
    
    // If critical issues and auto-recovery is enabled
    if (!report.isHealthy && 
        report.summary.critical > 0 && 
        HEALTH_CONFIG.autoRecoveryEnabled &&
        lastHealthStatus.consecutiveFailures >= 3) {
      
      console.log('[HEALTH] Multiple consecutive failures detected, initiating auto-recovery...');
      await attemptAutoRecovery();
      
      // Re-check health after recovery
      await performHealthCheck();
    }
  }, {
    scheduled: true,
    timezone: process.env.BACKUP_TIMEZONE || 'Asia/Manila'
  });
  
  console.log(`[HEALTH] ✅ Health monitor initialized (checking ${HEALTH_CONFIG.checkInterval})`);
  console.log(`[HEALTH] Auto-recovery: ${HEALTH_CONFIG.autoRecoveryEnabled ? 'ENABLED' : 'DISABLED'}`);
  
  // Run initial health check
  performHealthCheck();
}

function stopHealthMonitor() {
  if (healthCheckJob) {
    healthCheckJob.stop();
    healthCheckJob = null;
    console.log('[HEALTH] Health monitor stopped');
  }
}

module.exports = {
  performHealthCheck,
  attemptAutoRecovery,
  getHealthStatus,
  initializeHealthMonitor,
  stopHealthMonitor,
  HEALTH_CONFIG
};
