const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for backup file uploads
const uploadDir = path.join(__dirname, '..', 'uploads', 'backup-imports');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const backupUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `import-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
  fileFilter: (req, file, cb) => {
    // Accept .gz, .json.gz, .json files
    const allowedExts = ['.gz', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext) || file.originalname.endsWith('.json.gz')) {
      cb(null, true);
    } else {
      cb(new Error('Only .json.gz or .gz backup files are allowed'));
    }
  }
});

// All backup routes require authentication and super-admin role
const backupAuth = [authenticate, authorize(['super-admin'])];

// ==========================================
// BACKUP STATUS & INFO
// ==========================================

/**
 * @route   GET /api/backup/status
 * @desc    Get backup system status and health
 * @access  Super Admin
 */
router.get('/status', backupAuth, backupController.getBackupStatus);

/**
 * @route   GET /api/backup/last
 * @desc    Get last backup information (for dashboard widget)
 * @access  Super Admin
 */
router.get('/last', backupAuth, backupController.getLastBackupInfo);

/**
 * @route   GET /api/backup/stats
 * @desc    Get database storage statistics
 * @access  Super Admin
 */
router.get('/stats', backupAuth, backupController.getDatabaseStats);

/**
 * @route   GET /api/backup/history
 * @desc    Get backup history with pagination
 * @access  Super Admin
 * @query   type - Filter by backup type (automatic, manual, emergency, pre-update)
 * @query   status - Filter by status (completed, failed, corrupted)
 * @query   limit - Number of records per page (default: 50)
 * @query   page - Page number (default: 1)
 */
router.get('/history', backupAuth, backupController.getBackupHistory);

/**
 * @route   GET /api/backup/config
 * @desc    Get backup configuration
 * @access  Super Admin
 */
router.get('/config', backupAuth, backupController.getBackupConfig);

/**
 * @route   PUT /api/backup/config
 * @desc    Update backup configuration
 * @access  Super Admin
 */
router.put('/config', backupAuth, backupController.updateBackupConfig);

// ==========================================
// BACKUP CREATION
// ==========================================

/**
 * @route   POST /api/backup/create
 * @desc    Create a manual backup
 * @access  Super Admin
 * @body    notes - Optional notes for the backup
 * @body    collections - Optional array of collection names to backup
 */
router.post('/create', backupAuth, backupController.createManualBackup);

/**
 * @route   POST /api/backup/emergency
 * @desc    Create an emergency backup (protected from auto-deletion)
 * @access  Super Admin
 */
router.post('/emergency', backupAuth, backupController.createEmergencyBackup);

/**
 * @route   POST /api/backup/pre-update
 * @desc    Create a pre-update backup before system updates
 * @access  Super Admin
 * @body    updateDescription - Description of the update
 */
router.post('/pre-update', backupAuth, backupController.createPreUpdateBackup);

/**
 * @route   POST /api/backup/cleanup
 * @desc    Trigger manual cleanup of old backups
 * @access  Super Admin
 */
router.post('/cleanup', backupAuth, backupController.triggerCleanup);

// ==========================================
// DATA ARCHIVAL (Extract old data)
// ==========================================

/**
 * @route   POST /api/backup/archive/preview
 * @desc    Preview what data would be archived (dry run)
 * @access  Super Admin
 * @body    olderThanYears - Archive data older than this many years (default: 10)
 * @body    collections - Specific collections to check (optional)
 * @body    dateField - Date field to use for filtering (default: 'createdAt')
 */
router.post('/archive/preview', backupAuth, backupController.previewArchive);

/**
 * @route   POST /api/backup/archive
 * @desc    Archive old data and optionally delete from database
 * @access  Super Admin
 * @body    olderThanYears - Archive data older than this many years (default: 10)
 * @body    deleteAfterArchive - Remove data from DB after archiving (default: false)
 * @body    collections - Specific collections to archive (optional)
 * @body    dateField - Date field to use for filtering (default: 'createdAt')
 * @body    notes - Optional notes about the archive
 */
router.post('/archive', backupAuth, backupController.archiveOldData);

/**
 * @route   GET /api/backup/archive/history
 * @desc    Get archive history
 * @access  Super Admin
 */
router.get('/archive/history', backupAuth, backupController.getArchiveHistory);

/**
 * @route   POST /api/backup/archive/:archiveId/restore
 * @desc    Restore data from an archive back to the database
 * @access  Super Admin
 * @body    collections - Specific collections to restore (optional)
 * @body    skipExisting - Skip documents that already exist (default: true)
 */
router.post('/archive/:archiveId/restore', backupAuth, backupController.restoreFromArchive);

// ==========================================
// HEALTH MONITORING & AUTO-RECOVERY
// ==========================================

/**
 * @route   GET /api/backup/health
 * @desc    Get database health status
 * @access  Super Admin
 */
router.get('/health', backupAuth, backupController.getHealthStatus);

/**
 * @route   POST /api/backup/health/check
 * @desc    Run a manual health check
 * @access  Super Admin
 */
router.post('/health/check', backupAuth, backupController.runHealthCheck);

/**
 * @route   POST /api/backup/recover
 * @desc    Trigger manual recovery from last good backup
 * @access  Super Admin
 * @body    backupId - (Optional) Specific backup to restore from
 */
router.post('/recover', backupAuth, backupController.triggerRecovery);

// ==========================================
// INDIVIDUAL BACKUP OPERATIONS
// ==========================================

/**
 * @route   GET /api/backup/:backupId
 * @desc    Get backup details
 * @access  Super Admin
 */
router.get('/:backupId', backupAuth, backupController.getBackupDetails);

/**
 * @route   POST /api/backup/:backupId/verify
 * @desc    Verify backup integrity (checksum and file validity)
 * @access  Super Admin
 */
router.post('/:backupId/verify', backupAuth, backupController.verifyBackup);

/**
 * @route   POST /api/backup/:backupId/restore
 * @desc    Restore from a backup
 * @access  Super Admin
 * @body    collections - Optional array of collection names to restore
 * @body    dropExisting - Whether to drop existing documents before restore
 * @body    dryRun - If true, only simulate the restore
 */
router.post('/:backupId/restore', backupAuth, backupController.restoreBackup);

/**
 * @route   PUT /api/backup/:backupId/protection
 * @desc    Toggle backup protection (prevent auto-deletion)
 * @access  Super Admin
 * @body    isProtected - Boolean to set protection status
 */
router.put('/:backupId/protection', backupAuth, backupController.toggleProtection);

/**
 * @route   GET /api/backup/:backupId/download
 * @desc    Download backup file
 * @access  Super Admin
 */
router.get('/:backupId/download', backupAuth, backupController.downloadBackup);

/**
 * @route   DELETE /api/backup/:backupId
 * @desc    Delete a backup (only unprotected backups)
 * @access  Super Admin
 */
router.delete('/:backupId', backupAuth, backupController.deleteBackup);

// ==========================================
// FULL EXPORT/IMPORT FOR EXTERNAL STORAGE (HARD DISK)
// ==========================================

/**
 * @route   POST /api/backup/export-full
 * @desc    Create a complete database export for saving to external storage (Hard Disk)
 *          Includes all collections and optionally all uploaded files (GridFS)
 * @access  Super Admin
 * @body    includeGridFSFiles - Include all uploaded files/images (default: true)
 * @body    notes - Optional notes about the export
 * 
 * @example Request:
 * { includeGridFSFiles: true, notes: "Monthly full backup for HDD storage" }
 * 
 * @example Response:
 * {
 *   success: true,
 *   message: "Complete database export with all files created. Ready for download to HDD.",
 *   data: {
 *     exportId: "backup-full-export-2024-12-04...",
 *     fileName: "backup-full-export-2024-12-04....json.gz",
 *     fileSize: 157286400,
 *     formattedSize: "150 MB",
 *     gridFSFilesCount: 245,
 *     downloadUrl: "/api/backup/export/backup-full-export-.../download",
 *     instructions: "Download this file and save it to your external hard disk..."
 *   }
 * }
 */
router.post('/export-full', backupAuth, backupController.exportFullDatabase);

/**
 * @route   GET /api/backup/export/:exportId/download
 * @desc    Download the full export file to save to Hard Disk
 * @access  Super Admin
 */
router.get('/export/:exportId/download', backupAuth, backupController.downloadFullExport);

/**
 * @route   POST /api/backup/import
 * @desc    Import/restore database from an external backup file (from Hard Disk)
 *          Automatically restores GridFS files if present in backup
 * @access  Super Admin
 * @body    file - The backup file (.json.gz) uploaded from Hard Disk
 * @body    dropExisting - Whether to clear existing data before import (default: false)
 * @body    collections - JSON array of specific collections to import (optional)
 * 
 * @example Usage:
 * - Upload your backup file from Hard Disk (created via POST /export-full)
 * - System will restore all collections from the backup
 * - GridFS files (images/documents) are automatically restored if present
 * - If dropExisting=true, current data will be replaced
 * 
 * @example Response:
 * {
 *   success: true,
 *   message: "Import completed. 15000 documents restored.",
 *   data: {
 *     totalDocuments: 15000,
 *     collectionsRestored: ["franchises", "applications", ...],
 *     gridFSFilesRestored: 245
 *   }
 * }
 */
router.post('/import', backupAuth, backupUpload.single('file'), backupController.importFromFile);

module.exports = router;
