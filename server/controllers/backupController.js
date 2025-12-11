const { backupService, BACKUP_CONFIG } = require('../services/backupService');
const Backup = require('../models/backupModel');
const healthMonitor = require('../services/healthMonitorService');
const { auditLogService } = require('../services/auditLogService');

/**
 * Create a manual backup
 * POST /api/backup/create
 */
const createManualBackup = async (req, res) => {
  try {
    const { notes, collections } = req.body;
    
    // Get admin info from authenticated user (JWT contains: id, name, role, accountType)
    const initiatedBy = req.user ? {
      adminId: req.user.adminId || req.user.id || req.user._id,
      adminName: req.user.name,
      adminRole: req.user.role
    } : null;
    
    const result = await backupService.createBackup({
      type: 'manual',
      notes,
      collections,
      initiatedBy
    });
    
    // Log to audit trail
    await auditLogService.logManualBackup(result, req.user, req, true);
    
    res.status(201).json({
      success: true,
      message: 'Backup created successfully',
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Create backup error:', error);
    
    // Log failed attempt
    await auditLogService.logManualBackup(null, req.user, req, false, error.message);
    
    if (error.message.includes('already in progress')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create backup',
      error: error.message
    });
  }
};

/**
 * Create an emergency backup
 * POST /api/backup/emergency
 */
const createEmergencyBackup = async (req, res) => {
  try {
    const { notes } = req.body;
    
    const initiatedBy = req.user ? {
      adminId: req.user.adminId || req.user.id || req.user._id,
      adminName: req.user.name,
      adminRole: req.user.role
    } : null;
    
    const result = await backupService.createBackup({
      type: 'emergency',
      notes: notes || 'Emergency backup created by admin',
      initiatedBy
    });
    
    // Log to audit trail
    await auditLogService.logEmergencyBackup(result, req.user, req, true);
    
    res.status(201).json({
      success: true,
      message: 'Emergency backup created successfully',
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Emergency backup error:', error);
    await auditLogService.logEmergencyBackup(null, req.user, req, false, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create emergency backup',
      error: error.message
    });
  }
};

/**
 * Create a pre-update backup
 * POST /api/backup/pre-update
 */
const createPreUpdateBackup = async (req, res) => {
  try {
    const { notes, updateDescription } = req.body;
    
    const initiatedBy = req.user ? {
      adminId: req.user.adminId || req.user.id || req.user._id,
      adminName: req.user.name,
      adminRole: req.user.role
    } : null;
    
    const result = await backupService.createBackup({
      type: 'pre-update',
      notes: notes || `Pre-update backup: ${updateDescription || 'System update'}`,
      initiatedBy
    });
    
    // Log to audit trail
    await auditLogService.logPreUpdateBackup(result, req.user, req, updateDescription, true);
    
    res.status(201).json({
      success: true,
      message: 'Pre-update backup created successfully',
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Pre-update backup error:', error);
    await auditLogService.logPreUpdateBackup(null, req.user, req, req.body?.updateDescription, false, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create pre-update backup',
      error: error.message
    });
  }
};

/**
 * Get backup history
 * GET /api/backup/history
 */
const getBackupHistory = async (req, res) => {
  try {
    const { type, status, limit = 50, page = 1 } = req.query;
    
    const result = await backupService.getBackupHistory({
      type,
      status,
      limit: parseInt(limit),
      page: parseInt(page)
    });
    
    res.status(200).json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get backup history',
      error: error.message
    });
  }
};

/**
 * Get last backup info (for dashboard)
 * GET /api/backup/last
 */
const getLastBackupInfo = async (req, res) => {
  try {
    const result = await backupService.getLastBackupInfo();
    
    res.status(200).json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Get last backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get last backup info',
      error: error.message
    });
  }
};

/**
 * Get backup details
 * GET /api/backup/:backupId
 */
const getBackupDetails = async (req, res) => {
  try {
    const { backupId } = req.params;
    
    const backup = await Backup.findOne({ backupId }).lean();
    
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: backup
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Get backup details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get backup details',
      error: error.message
    });
  }
};

/**
 * Verify backup integrity
 * POST /api/backup/:backupId/verify
 */
const verifyBackup = async (req, res) => {
  try {
    const { backupId } = req.params;
    
    const result = await backupService.verifyBackup(backupId);
    
    // Log verification to audit trail
    await auditLogService.logBackupVerification(backupId, result, req.user, req);
    
    res.status(200).json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Verify backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify backup',
      error: error.message
    });
  }
};

/**
 * Restore from backup
 * POST /api/backup/:backupId/restore
 */
const restoreBackup = async (req, res) => {
  try {
    const { backupId } = req.params;
    const { collections, dropExisting = false, dryRun = false } = req.body;
    
    // First verify the backup
    const verification = await backupService.verifyBackup(backupId);
    if (!verification.valid) {
      await auditLogService.logBackupRestore(backupId, null, req.user, req, false, 'Backup verification failed');
      return res.status(400).json({
        success: false,
        message: 'Backup verification failed',
        error: verification.error
      });
    }
    
    const result = await backupService.restoreBackup(backupId, {
      collections,
      dropExisting,
      dryRun
    });
    
    // Log restore to audit trail (critical operation!)
    if (!dryRun) {
      await auditLogService.logBackupRestore(backupId, result, req.user, req, true);
    }
    
    res.status(200).json({
      success: true,
      message: dryRun ? 'Dry run completed' : 'Restore completed successfully',
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Restore backup error:', error);
    await auditLogService.logBackupRestore(req.params.backupId, null, req.user, req, false, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to restore backup',
      error: error.message
    });
  }
};

/**
 * Delete a backup
 * DELETE /api/backup/:backupId
 */
const deleteBackup = async (req, res) => {
  try {
    const { backupId } = req.params;
    
    const result = await backupService.deleteBackup(backupId);
    
    // Log deletion to audit trail
    await auditLogService.logBackupDeletion(backupId, req.user, req, true);
    
    res.status(200).json({
      success: true,
      message: 'Backup deleted successfully',
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Delete backup error:', error);
    await auditLogService.logBackupDeletion(req.params.backupId, req.user, req, false, error.message);
    
    if (error.message.includes('protected')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete backup',
      error: error.message
    });
  }
};

/**
 * Toggle backup protection
 * PUT /api/backup/:backupId/protection
 */
const toggleProtection = async (req, res) => {
  try {
    const { backupId } = req.params;
    const { isProtected } = req.body;
    
    if (typeof isProtected !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isProtected must be a boolean'
      });
    }
    
    const result = await backupService.toggleProtection(backupId, isProtected);
    
    // Log to audit trail
    await auditLogService.logBackupProtectionToggle(backupId, isProtected, req.user, req);
    
    res.status(200).json({
      success: true,
      message: isProtected ? 'Backup protected' : 'Backup protection removed',
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Toggle protection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle backup protection',
      error: error.message
    });
  }
};

/**
 * Download backup file
 * GET /api/backup/:backupId/download
 */
const downloadBackup = async (req, res) => {
  try {
    const { backupId } = req.params;
    
    const { filePath, fileName, fileSize } = await backupService.getBackupFile(backupId);
    
    // Log download to audit trail
    await auditLogService.logBackupDownload(backupId, req.user, req);
    
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fileSize);
    
    const fs = require('fs');
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Download backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download backup',
      error: error.message
    });
  }
};

/**
 * Get backup configuration
 * GET /api/backup/config
 */
const getBackupConfig = async (req, res) => {
  try {
    const config = backupService.getConfig();
    
    res.status(200).json({
      success: true,
      data: config
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Get config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get backup configuration',
      error: error.message
    });
  }
};

/**
 * Update backup configuration
 * PUT /api/backup/config
 */
const updateBackupConfig = async (req, res) => {
  try {
    const { retention, maxBackups, autoBackupEnabled } = req.body;
    
    const config = backupService.updateConfig({
      retention,
      maxBackups,
      autoBackupEnabled
    });
    
    // Log config update to audit trail
    await auditLogService.logBackupConfigUpdate(config, req.user, req);
    
    res.status(200).json({
      success: true,
      message: 'Backup configuration updated',
      data: config
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Update config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update backup configuration',
      error: error.message
    });
  }
};

/**
 * Get backup status (for monitoring)
 * GET /api/backup/status
 */
const getBackupStatus = async (req, res) => {
  try {
    const lastBackupInfo = await backupService.getLastBackupInfo();
    const config = backupService.getConfig();
    
    // Calculate health status
    const lastBackupTime = lastBackupInfo.lastBackup?.completedAt 
      ? new Date(lastBackupInfo.lastBackup.completedAt) 
      : null;
    
    const hoursSinceLastBackup = lastBackupTime 
      ? (Date.now() - lastBackupTime.getTime()) / (1000 * 60 * 60)
      : Infinity;
    
    let healthStatus = 'healthy';
    let healthMessage = 'Backups are up to date';
    
    if (!lastBackupTime) {
      healthStatus = 'warning';
      healthMessage = 'No backups found';
    } else if (hoursSinceLastBackup > 48) {
      healthStatus = 'critical';
      healthMessage = 'No backup in the last 48 hours';
    } else if (hoursSinceLastBackup > 24) {
      healthStatus = 'warning';
      healthMessage = 'No backup in the last 24 hours';
    }
    
    res.status(200).json({
      success: true,
      data: {
        health: {
          status: healthStatus,
          message: healthMessage,
          hoursSinceLastBackup: Math.round(hoursSinceLastBackup * 10) / 10
        },
        ...lastBackupInfo,
        config
      }
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Get status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get backup status',
      error: error.message
    });
  }
};

/**
 * Trigger automatic backup cleanup
 * POST /api/backup/cleanup
 */
const triggerCleanup = async (req, res) => {
  try {
    const { type } = req.body;
    
    await backupService.cleanupOldBackups(type);
    
    res.status(200).json({
      success: true,
      message: 'Backup cleanup completed'
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run backup cleanup',
      error: error.message
    });
  }
};

/**
 * Archive old data
/**
 * Archive old data
 * POST /api/backup/archive
 * 
 * Extract data older than specified years and optionally remove from database
 */
const archiveOldData = async (req, res) => {
  try {
    const { 
      olderThanYears = 10, 
      deleteAfterArchive = false, 
      collections,
      dateField = 'createdAt',
      notes 
    } = req.body;
    
    const initiatedBy = req.user ? {
      adminId: req.user.adminId || req.user.id || req.user._id,
      adminName: req.user.name,
      adminRole: req.user.role
    } : null;
    
    const result = await backupService.archiveOldData({
      olderThanYears: parseInt(olderThanYears),
      deleteAfterArchive,
      collections,
      dateField,
      initiatedBy,
      notes
    });
    
    // Log to audit trail
    await auditLogService.logDataArchive(result, req.user, req, true);
    
    res.status(201).json({
      success: true,
      message: `Data archive completed. ${result.totalArchivedDocuments} documents archived${deleteAfterArchive ? `, ${result.totalDeletedDocuments} deleted from database` : ''}.`,
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Archive error:', error);
    await auditLogService.logDataArchive(null, req.user, req, false, error.message);
    
    if (error.message.includes('already in progress')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to archive old data',
      error: error.message
    });
  }
};

/**
 * Preview archive - see what would be archived without doing it
 * POST /api/backup/archive/preview
 */
const previewArchive = async (req, res) => {
  try {
    const { 
      olderThanYears = 10, 
      collections,
      dateField = 'createdAt'
    } = req.body;
    
    const result = await backupService.previewArchive({
      olderThanYears: parseInt(olderThanYears),
      collections,
      dateField
    });
    
    res.status(200).json({
      success: true,
      message: `Found ${result.totalDocuments} documents older than ${olderThanYears} years`,
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Preview archive error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preview archive',
      error: error.message
    });
  }
};

/**
 * Get archive history
 * GET /api/backup/archive/history
 */
const getArchiveHistory = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    
    const result = await backupService.getArchiveHistory({
      limit: parseInt(limit),
      page: parseInt(page)
    });
    
    res.status(200).json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Get archive history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get archive history',
      error: error.message
    });
  }
};

/**
 * Restore from archive
 * POST /api/backup/archive/:archiveId/restore
 */
const restoreFromArchive = async (req, res) => {
  try {
    const { archiveId } = req.params;
    const { collections, skipExisting = true } = req.body;
    
    const result = await backupService.restoreFromArchive(archiveId, {
      collections,
      skipExisting
    });
    
    // Log to audit trail
    await auditLogService.logRestoreFromArchive(archiveId, result, req.user, req, true);
    
    res.status(200).json({
      success: true,
      message: `Restored ${result.totalRestored} documents from archive`,
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Restore from archive error:', error);
    await auditLogService.logRestoreFromArchive(req.params.archiveId, null, req.user, req, false, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to restore from archive',
      error: error.message
    });
  }
};

/**
 * Get database storage statistics
 * GET /api/backup/stats
 */
const getDatabaseStats = async (req, res) => {
  try {
    const result = await backupService.getDatabaseStats();
    
    res.status(200).json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Get database stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get database statistics',
      error: error.message
    });
  }
};

/**
 * Export complete database for external storage (Hard Disk)
 * POST /api/backup/export-full
 * 
 * Creates a complete database export including all uploaded files (GridFS)
 * that can be downloaded and saved to external storage like a portable HDD
 * 
 * @body {boolean} includeGridFSFiles - Include uploaded files/images (default: true)
 * @body {string} notes - Optional notes about the export
 */
const exportFullDatabase = async (req, res) => {
  try {
    const { includeGridFSFiles = true, notes } = req.body;
    
    const initiatedBy = req.user ? {
      adminId: req.user.adminId || req.user.id || req.user._id,
      adminName: req.user.name,
      adminRole: req.user.role
    } : null;
    
    console.log(`[BACKUP CONTROLLER] Starting full export (includeGridFS: ${includeGridFSFiles})`);
    
    const result = await backupService.createFullExport({
      includeGridFSFiles,
      notes: notes || `Full database export for HDD${includeGridFSFiles ? ' (with all files)' : ''}`,
      initiatedBy
    });
    
    // Log to audit trail
    await auditLogService.logFullExport(result, req.user, req, true);
    
    res.status(201).json({
      success: true,
      message: includeGridFSFiles 
        ? 'Complete database export with all files created. Ready for download to HDD.'
        : 'Database export created. Ready for download to HDD.',
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Export full database error:', error);
    await auditLogService.logFullExport(null, req.user, req, false, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to export database',
      error: error.message
    });
  }
};

/**
 * Download full export as a single file for Hard Disk storage
 * GET /api/backup/export/:exportId/download
 */
const downloadFullExport = async (req, res) => {
  try {
    const { exportId } = req.params;
    
    const { filePath, fileName, fileSize } = await backupService.getBackupFile(exportId);
    
    // Set headers for download
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('X-File-Size', fileSize);
    res.setHeader('X-File-Name', fileName);
    
    const fs = require('fs');
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Download full export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download export',
      error: error.message
    });
  }
};

/**
 * Import database from external backup file (from Hard Disk)
 * POST /api/backup/import
 * 
 * Restore database from an uploaded backup file
 */
const importFromFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No backup file uploaded'
      });
    }
    
    const { dropExisting = false, collections } = req.body;
    
    const result = await backupService.importFromFile(req.file.path, {
      dropExisting: dropExisting === 'true' || dropExisting === true,
      collections: collections ? JSON.parse(collections) : []
    });
    
    // Log to audit trail (critical operation!)
    await auditLogService.logDatabaseImport(result, req.user, req, true);
    
    res.status(200).json({
      success: true,
      message: `Import completed. ${result.totalDocuments} documents restored.`,
      data: result
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Import from file error:', error);
    await auditLogService.logDatabaseImport(null, req.user, req, false, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to import backup',
      error: error.message
    });
  }
};

/**
 * Get database health status
 * GET /api/backup/health
 */
const getHealthStatus = async (req, res) => {
  try {
    const status = healthMonitor.getHealthStatus();
    
    res.status(200).json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Get health status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get health status',
      error: error.message
    });
  }
};

/**
 * Run health check manually
 * POST /api/backup/health/check
 */
const runHealthCheck = async (req, res) => {
  try {
    const report = await healthMonitor.performHealthCheck();
    
    res.status(200).json({
      success: true,
      message: report.isHealthy ? 'Database is healthy' : 'Issues detected',
      data: report
    });
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Run health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run health check',
      error: error.message
    });
  }
};

/**
 * Trigger manual recovery from last backup
 * POST /api/backup/recover
 */
const triggerRecovery = async (req, res) => {
  try {
    const { backupId } = req.body;
    
    if (backupId) {
      // Restore from specific backup
      const verification = await backupService.verifyBackup(backupId);
      if (!verification.valid) {
        await auditLogService.logBackupRestore(backupId, null, req.user, req, false, 'Backup verification failed');
        return res.status(400).json({
          success: false,
          message: 'Backup verification failed',
          error: verification.error
        });
      }
      
      const result = await backupService.restoreBackup(backupId, {
        dropExisting: false,
        dryRun: false
      });
      
      // Log recovery to audit trail
      await auditLogService.logBackupRestore(backupId, result, req.user, req, true);
      
      return res.status(200).json({
        success: true,
        message: `Recovery completed from backup ${backupId}`,
        data: result
      });
    }
    
    // Auto-recovery from last good backup
    const result = await healthMonitor.attemptAutoRecovery();
    
    // Log auto-recovery attempt
    await auditLogService.logAutoRecovery(result, 'admin-triggered', result.success, result.error);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Recovery completed successfully',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Recovery failed',
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('[BACKUP CONTROLLER] Trigger recovery error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger recovery',
      error: error.message
    });
  }
};

module.exports = {
  createManualBackup,
  createEmergencyBackup,
  createPreUpdateBackup,
  getBackupHistory,
  getLastBackupInfo,
  getBackupDetails,
  verifyBackup,
  restoreBackup,
  deleteBackup,
  toggleProtection,
  downloadBackup,
  getBackupConfig,
  updateBackupConfig,
  getBackupStatus,
  triggerCleanup,
  // Archive functions
  archiveOldData,
  previewArchive,
  getArchiveHistory,
  restoreFromArchive,
  getDatabaseStats,
  // Health & Recovery
  getHealthStatus,
  runHealthCheck,
  triggerRecovery,
  // Full Export/Import for Hard Disk storage
  exportFullDatabase,
  downloadFullExport,
  importFromFile
};
