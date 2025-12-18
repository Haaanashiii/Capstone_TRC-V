const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const util = require('util');
const crypto = require('crypto');
const zlib = require('zlib');
const os = require('os');
const Backup = require('../models/backupModel');

const execPromise = util.promisify(exec);

// Backup configuration
const BACKUP_CONFIG = {
  // Base directory for backups
  baseDir: process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups'),
  
  // Retention periods (in days)
  retention: {
    automatic: 7,    // Keep automatic backups for 7 days
    manual: 30,      // Keep manual backups for 30 days
    emergency: 90,   // Keep emergency backups for 90 days
    'pre-update': 60 // Keep pre-update backups for 60 days
  },
  
  // Maximum number of backups to keep
  maxBackups: {
    automatic: 14,   // Keep last 14 automatic backups
    manual: 10,      // Keep last 10 manual backups
    emergency: 5,    // Keep last 5 emergency backups
    'pre-update': 5  // Keep last 5 pre-update backups
  },
  
  // Automatic backup schedule (cron expression)
  // Default: Every day at 11:00 PM (23:00) - after administrative office hours
  // Cron format: minute hour day-of-month month day-of-week
  // 0 23 * * * = At 11:00 PM every day
  autoBackupCron: process.env.AUTO_BACKUP_CRON || '0 23 * * *',
  
  // Enable/disable automatic backups
  autoBackupEnabled: process.env.AUTO_BACKUP_ENABLED !== 'false',
  
  // Collections to backup (empty = all collections)
  collectionsToBackup: []
};

class BackupService {
  constructor() {
    this.isBackupInProgress = false;
    this.currentBackupId = null;
    this.ensureBackupDirectory();
  }
  
  /**
   * Ensure backup directory exists
   */
  ensureBackupDirectory() {
    const dirs = [
      BACKUP_CONFIG.baseDir,
      path.join(BACKUP_CONFIG.baseDir, 'automatic'),
      path.join(BACKUP_CONFIG.baseDir, 'manual'),
      path.join(BACKUP_CONFIG.baseDir, 'emergency'),
      path.join(BACKUP_CONFIG.baseDir, 'pre-update')
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[BACKUP] Created directory: ${dir}`);
      }
    });
  }
  
  /**
   * Generate unique backup ID
   */
  generateBackupId(type = 'manual') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `backup-${type}-${timestamp}-${random}`;
  }
  
  /**
   * Calculate checksum of a file
   */
  async calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
  
  /**
   * Get all collections in the database
   */
  async getCollections() {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    return collections.map(c => c.name);
  }
  
  /**
   * Export a single collection to JSON
   * Note: collection.stats() is deprecated in MongoDB driver 6+, using db.command instead
   */
  async exportCollection(collectionName) {
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);
    
    const documents = await collection.find({}).toArray();
    
    // Get collection stats using db.command (compatible with MongoDB driver 6+)
    let collectionSize = 0;
    try {
      const stats = await db.command({ collStats: collectionName });
      collectionSize = stats.size || 0;
    } catch (err) {
      // Fallback: estimate size from document count
      collectionSize = documents.length * 1024; // rough estimate
    }
    
    return {
      name: collectionName,
      documents,
      documentCount: documents.length,
      size: collectionSize
    };
  }
  
  /**
   * Create a backup (core method)
   */
  async createBackup(options = {}) {
    const {
      type = 'manual',
      notes = '',
      initiatedBy = null,
      collections = BACKUP_CONFIG.collectionsToBackup
    } = options;
    
    // Prevent concurrent backups
    if (this.isBackupInProgress) {
      throw new Error('Another backup is already in progress');
    }
    
    this.isBackupInProgress = true;
    const startTime = Date.now();
    const backupId = this.generateBackupId(type);
    this.currentBackupId = backupId;
    
    // Pre-calculate backup file path
    const backupDir = path.join(BACKUP_CONFIG.baseDir, type);
    const backupFileName = `${backupId}.json.gz`;
    const backupFilePath = path.join(backupDir, backupFileName);
    
    console.log(`[BACKUP] Starting ${type} backup: ${backupId}`);
    
    // Create backup record in database
    const backupRecord = new Backup({
      backupId,
      backupType: type,
      status: 'in-progress',
      filePath: backupFilePath,
      notes,
      initiatedBy,
      startedAt: new Date(),
      metadata: {
        databaseName: mongoose.connection.name,
        hostname: os.hostname(),
        nodeVersion: process.version
      },
      retention: {
        expiresAt: new Date(Date.now() + (BACKUP_CONFIG.retention[type] * 24 * 60 * 60 * 1000)),
        isProtected: type === 'emergency'
      }
    });
    
    await backupRecord.save();
    
    try {
      // Get collections to backup
      let collectionsToBackup = collections.length > 0 
        ? collections 
        : await this.getCollections();
      
      // Filter out system collections
      collectionsToBackup = collectionsToBackup.filter(c => !c.startsWith('system.'));
      
      console.log(`[BACKUP] Backing up ${collectionsToBackup.length} collections`);
      
      // Export all collections
      const backupData = {
        backupId,
        backupType: type,
        createdAt: new Date().toISOString(),
        databaseName: mongoose.connection.name,
        mongoVersion: mongoose.version,
        collections: {}
      };
      
      const collectionStats = [];
      let totalDocuments = 0;
      
      for (const collectionName of collectionsToBackup) {
        console.log(`[BACKUP] Exporting collection: ${collectionName}`);
        const collectionData = await this.exportCollection(collectionName);
        
        backupData.collections[collectionName] = collectionData.documents;
        
        collectionStats.push({
          name: collectionName,
          documentCount: collectionData.documentCount,
          size: collectionData.size
        });
        
        totalDocuments += collectionData.documentCount;
      }
      
      // Compress and write backup data
      const jsonData = JSON.stringify(backupData, null, 2);
      const compressedData = await new Promise((resolve, reject) => {
        zlib.gzip(jsonData, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      fs.writeFileSync(backupFilePath, compressedData);
      
      // Calculate file size and checksum
      const stats = fs.statSync(backupFilePath);
      const checksum = await this.calculateChecksum(backupFilePath);
      
      const durationMs = Date.now() - startTime;
      
      // Update backup record
      backupRecord.status = 'completed';
      backupRecord.filePath = backupFilePath;
      backupRecord.fileSize = stats.size;
      backupRecord.collections = collectionStats;
      backupRecord.completedAt = new Date();
      backupRecord.metadata.totalDocuments = totalDocuments;
      backupRecord.metadata.durationMs = durationMs;
      backupRecord.metadata.compression = 'gzip';
      backupRecord.metadata.checksum = checksum;
      backupRecord.recovery.isRecoverable = true;
      backupRecord.recovery.lastVerifiedAt = new Date();
      
      await backupRecord.save();
      
      console.log(`[BACKUP] SUCCESS - Backup completed: ${backupId}`);
      console.log(`[BACKUP] - Duration: ${durationMs}ms`);
      console.log(`[BACKUP] - Size: ${this.formatBytes(stats.size)}`);
      console.log(`[BACKUP] - Documents: ${totalDocuments}`);
      console.log(`[BACKUP] - Path: ${backupFilePath}`);
      
      // Cleanup old backups
      await this.cleanupOldBackups(type);
      
      this.isBackupInProgress = false;
      this.currentBackupId = null;
      
      return {
        success: true,
        backupId,
        filePath: backupFilePath,
        fileSize: stats.size,
        formattedSize: this.formatBytes(stats.size),
        totalDocuments,
        collections: collectionStats.length,
        durationMs,
        checksum
      };
      
    } catch (error) {
      console.error(`[BACKUP] ERROR - Backup failed: ${error.message}`);
      
      // Update backup record with error
      backupRecord.status = 'failed';
      backupRecord.completedAt = new Date();
      backupRecord.metadata.durationMs = Date.now() - startTime;
      backupRecord.error = {
        message: error.message,
        stack: error.stack,
        code: error.code
      };
      backupRecord.recovery.isRecoverable = false;
      
      await backupRecord.save();
      
      this.isBackupInProgress = false;
      this.currentBackupId = null;
      
      throw error;
    }
  }
  
  /**
   * Restore from a backup
   */
  async restoreBackup(backupId, options = {}) {
    const {
      collections = [],  // Empty = restore all
      dropExisting = false,
      dryRun = false
    } = options;
    
    console.log(`[RESTORE] Starting restore from backup: ${backupId}`);
    
    // Find backup record
    const backupRecord = await Backup.findOne({ backupId });
    if (!backupRecord) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    
    if (backupRecord.status !== 'completed') {
      throw new Error(`Cannot restore from ${backupRecord.status} backup`);
    }
    
    if (!fs.existsSync(backupRecord.filePath)) {
      throw new Error(`Backup file not found: ${backupRecord.filePath}`);
    }
    
    // Verify checksum
    const currentChecksum = await this.calculateChecksum(backupRecord.filePath);
    if (currentChecksum !== backupRecord.metadata.checksum) {
      throw new Error('Backup file integrity check failed - checksum mismatch');
    }
    
    // Read and decompress backup
    const compressedData = fs.readFileSync(backupRecord.filePath);
    const jsonData = await new Promise((resolve, reject) => {
      zlib.gunzip(compressedData, (err, result) => {
        if (err) reject(err);
        else resolve(result.toString());
      });
    });
    
    const backupData = JSON.parse(jsonData);
    const db = mongoose.connection.db;
    
    const restoredCollections = [];
    const collectionsToRestore = collections.length > 0 
      ? collections 
      : Object.keys(backupData.collections);
    
    if (dryRun) {
      console.log(`[RESTORE] DRY RUN - Would restore ${collectionsToRestore.length} collections`);
      return {
        success: true,
        dryRun: true,
        collectionsToRestore,
        totalDocuments: collectionsToRestore.reduce((sum, c) => 
          sum + (backupData.collections[c]?.length || 0), 0
        )
      };
    }
    
    for (const collectionName of collectionsToRestore) {
      const documents = backupData.collections[collectionName];
      if (!documents || documents.length === 0) continue;
      
      console.log(`[RESTORE] Restoring collection: ${collectionName} (${documents.length} documents)`);
      
      const collection = db.collection(collectionName);
      
      if (dropExisting) {
        await collection.deleteMany({});
        console.log(`[RESTORE] Dropped existing documents in ${collectionName}`);
      }
      
      // Convert string _id back to ObjectId where applicable
      const processedDocs = documents.map(doc => {
        if (doc._id && typeof doc._id === 'string' && doc._id.length === 24) {
          try {
            doc._id = new mongoose.Types.ObjectId(doc._id);
          } catch (e) {
            // Keep as string if not valid ObjectId
          }
        }
        return doc;
      });
      
      // Insert documents in batches
      const batchSize = 1000;
      for (let i = 0; i < processedDocs.length; i += batchSize) {
        const batch = processedDocs.slice(i, i + batchSize);
        try {
          await collection.insertMany(batch, { ordered: false });
        } catch (error) {
          // Handle duplicate key errors gracefully
          if (error.code !== 11000) {
            console.error(`[RESTORE] Error inserting documents: ${error.message}`);
          }
        }
      }
      
      restoredCollections.push({
        name: collectionName,
        documentCount: documents.length
      });
    }
    
    // Update backup record
    backupRecord.recovery.restoredCount += 1;
    await backupRecord.save();
    
    console.log(`[RESTORE] SUCCESS - Restore completed from backup: ${backupId}`);
    
    return {
      success: true,
      backupId,
      restoredCollections,
      totalDocuments: restoredCollections.reduce((sum, c) => sum + c.documentCount, 0)
    };
  }
  
  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId) {
    const backupRecord = await Backup.findOne({ backupId });
    if (!backupRecord) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    
    if (!fs.existsSync(backupRecord.filePath)) {
      backupRecord.status = 'corrupted';
      backupRecord.recovery.isRecoverable = false;
      await backupRecord.save();
      
      return {
        valid: false,
        error: 'Backup file not found'
      };
    }
    
    // Verify checksum
    const currentChecksum = await this.calculateChecksum(backupRecord.filePath);
    const checksumValid = currentChecksum === backupRecord.metadata.checksum;
    
    if (!checksumValid) {
      backupRecord.status = 'corrupted';
      backupRecord.recovery.isRecoverable = false;
      await backupRecord.save();
      
      return {
        valid: false,
        error: 'Checksum mismatch - file may be corrupted'
      };
    }
    
    // Try to decompress and parse
    try {
      const compressedData = fs.readFileSync(backupRecord.filePath);
      const jsonData = await new Promise((resolve, reject) => {
        zlib.gunzip(compressedData, (err, result) => {
          if (err) reject(err);
          else resolve(result.toString());
        });
      });
      
      JSON.parse(jsonData);
      
      backupRecord.recovery.lastVerifiedAt = new Date();
      backupRecord.recovery.isRecoverable = true;
      await backupRecord.save();
      
      return {
        valid: true,
        checksum: currentChecksum,
        verifiedAt: new Date()
      };
      
    } catch (error) {
      backupRecord.status = 'corrupted';
      backupRecord.recovery.isRecoverable = false;
      await backupRecord.save();
      
      return {
        valid: false,
        error: `Failed to parse backup: ${error.message}`
      };
    }
  }
  
  /**
   * Cleanup old backups based on retention policy
   */
  async cleanupOldBackups(type = null) {
    const types = type ? [type] : Object.keys(BACKUP_CONFIG.retention);
    
    for (const backupType of types) {
      // Get all backups of this type, sorted by date
      const backups = await Backup.find({
        backupType,
        'retention.isProtected': false
      }).sort({ createdAt: -1 });
      
      const maxBackups = BACKUP_CONFIG.maxBackups[backupType] || 10;
      
      // Delete backups exceeding max count
      if (backups.length > maxBackups) {
        const backupsToDelete = backups.slice(maxBackups);
        
        for (const backup of backupsToDelete) {
          await this.deleteBackup(backup.backupId);
        }
      }
      
      // Delete expired backups
      const expiredBackups = await Backup.find({
        backupType,
        'retention.expiresAt': { $lt: new Date() },
        'retention.isProtected': false
      });
      
      for (const backup of expiredBackups) {
        await this.deleteBackup(backup.backupId);
      }
    }
  }
  
  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId) {
    const backup = await Backup.findOne({ backupId });
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    
    if (backup.retention.isProtected) {
      throw new Error('Cannot delete protected backup');
    }
    
    // Delete file if exists
    if (fs.existsSync(backup.filePath)) {
      fs.unlinkSync(backup.filePath);
      console.log(`[BACKUP] Deleted backup file: ${backup.filePath}`);
    }
    
    // Delete record
    await Backup.deleteOne({ backupId });
    console.log(`[BACKUP] Deleted backup record: ${backupId}`);
    
    return { success: true, backupId };
  }
  
  /**
   * Get backup history
   */
  async getBackupHistory(options = {}) {
    const {
      type = null,
      status = null,
      limit = 50,
      page = 1
    } = options;
    
    const query = {};
    if (type) query.backupType = type;
    if (status) query.status = status;
    
    const skip = (page - 1) * limit;
    
    const [backups, total] = await Promise.all([
      Backup.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Backup.countDocuments(query)
    ]);
    
    return {
      backups,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
  
  /**
   * Get last backup info
   */
  async getLastBackupInfo() {
    const lastBackup = await Backup.getLastSuccessfulBackup();
    const lastAutoBackup = await Backup.getLastSuccessfulBackup('automatic');
    const lastManualBackup = await Backup.getLastSuccessfulBackup('manual');
    
    const stats = await Backup.getBackupStats();
    
    // Calculate time since last backup
    const timeSinceLastBackup = lastBackup 
      ? Date.now() - new Date(lastBackup.completedAt).getTime()
      : null;
    
    return {
      lastBackup: lastBackup ? {
        backupId: lastBackup.backupId,
        type: lastBackup.backupType,
        completedAt: lastBackup.completedAt,
        fileSize: lastBackup.fileSize,
        formattedSize: this.formatBytes(lastBackup.fileSize),
        totalDocuments: lastBackup.metadata?.totalDocuments,
        timeSinceBackup: this.formatDuration(timeSinceLastBackup)
      } : null,
      lastAutoBackup: lastAutoBackup ? {
        backupId: lastAutoBackup.backupId,
        completedAt: lastAutoBackup.completedAt,
        fileSize: lastAutoBackup.fileSize,
        formattedSize: this.formatBytes(lastAutoBackup.fileSize)
      } : null,
      lastManualBackup: lastManualBackup ? {
        backupId: lastManualBackup.backupId,
        completedAt: lastManualBackup.completedAt,
        fileSize: lastManualBackup.fileSize,
        formattedSize: this.formatBytes(lastManualBackup.fileSize)
      } : null,
      isBackupInProgress: this.isBackupInProgress,
      currentBackupId: this.currentBackupId,
      autoBackupEnabled: BACKUP_CONFIG.autoBackupEnabled,
      nextAutoBackupCron: BACKUP_CONFIG.autoBackupCron,
      stats
    };
  }
  
  /**
   * Get backup configuration
   */
  getConfig() {
    return {
      baseDir: BACKUP_CONFIG.baseDir,
      retention: BACKUP_CONFIG.retention,
      maxBackups: BACKUP_CONFIG.maxBackups,
      autoBackupCron: BACKUP_CONFIG.autoBackupCron,
      autoBackupEnabled: BACKUP_CONFIG.autoBackupEnabled
    };
  }
  
  /**
   * Update backup configuration
   */
  updateConfig(newConfig) {
    if (newConfig.retention) {
      Object.assign(BACKUP_CONFIG.retention, newConfig.retention);
    }
    if (newConfig.maxBackups) {
      Object.assign(BACKUP_CONFIG.maxBackups, newConfig.maxBackups);
    }
    if (newConfig.autoBackupEnabled !== undefined) {
      BACKUP_CONFIG.autoBackupEnabled = newConfig.autoBackupEnabled;
    }
    
    return this.getConfig();
  }
  
  /**
   * Toggle backup protection
   */
  async toggleProtection(backupId, isProtected) {
    const backup = await Backup.findOne({ backupId });
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    
    backup.retention.isProtected = isProtected;
    if (isProtected) {
      backup.retention.expiresAt = null;
    } else {
      // Reset expiry based on type
      const retentionDays = BACKUP_CONFIG.retention[backup.backupType] || 30;
      backup.retention.expiresAt = new Date(Date.now() + (retentionDays * 24 * 60 * 60 * 1000));
    }
    
    await backup.save();
    
    return {
      backupId,
      isProtected: backup.retention.isProtected,
      expiresAt: backup.retention.expiresAt
    };
  }
  
  /**
   * Format bytes to human-readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Format duration to human-readable
   */
  formatDuration(ms) {
    if (!ms) return 'Never';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  }
  
  /**
   * Download backup file
   */
  async getBackupFile(backupId) {
    const backup = await Backup.findOne({ backupId });
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    
    if (!fs.existsSync(backup.filePath)) {
      throw new Error('Backup file not found on disk');
    }
    
    return {
      filePath: backup.filePath,
      fileName: path.basename(backup.filePath),
      fileSize: backup.fileSize
    };
  }
  
  /**
   * Archive old data - Extract data older than specified years and optionally remove from database
   * This helps keep the database lean while preserving historical data
   * 
   * @param {Object} options
   * @param {number} options.olderThanYears - Archive data older than this many years (default: 10)
   * @param {boolean} options.deleteAfterArchive - Remove archived data from database (default: false)
   * @param {Array} options.collections - Specific collections to archive (default: all date-based collections)
   * @param {string} options.dateField - The date field to use for filtering (default: 'createdAt')
   * @param {Object} options.initiatedBy - Admin who initiated the archive
   */
  async archiveOldData(options = {}) {
    const {
      olderThanYears = 10,
      deleteAfterArchive = false,
      collections = [],
      dateField = 'createdAt',
      initiatedBy = null,
      notes = ''
    } = options;
    
    // Prevent concurrent operations
    if (this.isBackupInProgress) {
      throw new Error('Another backup/archive operation is already in progress');
    }
    
    this.isBackupInProgress = true;
    const startTime = Date.now();
    const archiveId = this.generateBackupId('archive');
    
    console.log(`[ARCHIVE] Starting data archive: ${archiveId}`);
    console.log(`[ARCHIVE] Archiving data older than ${olderThanYears} years`);
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - olderThanYears);
    
    console.log(`[ARCHIVE] Cutoff date: ${cutoffDate.toISOString()}`);
    
    // Create archive directory
    const archiveDir = path.join(BACKUP_CONFIG.baseDir, 'archives');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    
    // Collections that typically have date-based data
    const dateBasedCollections = collections.length > 0 ? collections : [
      'franchiseapplications',
      'franchiseinformations', 
      'announcements',
      'auditlogs',
      'reports',
      'sessions'
    ];
    
    const db = mongoose.connection.db;
    const archivedData = {
      archiveId,
      archiveType: 'data-archive',
      createdAt: new Date().toISOString(),
      cutoffDate: cutoffDate.toISOString(),
      olderThanYears,
      deleteAfterArchive,
      databaseName: mongoose.connection.name,
      collections: {}
    };
    
    const archiveStats = [];
    let totalArchivedDocuments = 0;
    let totalDeletedDocuments = 0;
    
    // Get all available collections
    const availableCollections = await this.getCollections();
    
    for (const collectionName of dateBasedCollections) {
      // Check if collection exists
      if (!availableCollections.includes(collectionName)) {
        console.log(`[ARCHIVE] Collection not found, skipping: ${collectionName}`);
        continue;
      }
      
      const collection = db.collection(collectionName);
      
      // Build query for old documents
      const query = {
        [dateField]: { $lt: cutoffDate }
      };
      
      try {
        // Find old documents
        const oldDocuments = await collection.find(query).toArray();
        
        if (oldDocuments.length === 0) {
          console.log(`[ARCHIVE] No old documents in: ${collectionName}`);
          continue;
        }
        
        console.log(`[ARCHIVE] Found ${oldDocuments.length} old documents in: ${collectionName}`);
        
        // Add to archive
        archivedData.collections[collectionName] = oldDocuments;
        totalArchivedDocuments += oldDocuments.length;
        
        let deletedCount = 0;
        
        // Optionally delete from database
        if (deleteAfterArchive) {
          const deleteResult = await collection.deleteMany(query);
          deletedCount = deleteResult.deletedCount;
          totalDeletedDocuments += deletedCount;
          console.log(`[ARCHIVE] Deleted ${deletedCount} documents from: ${collectionName}`);
        }
        
        archiveStats.push({
          name: collectionName,
          archivedCount: oldDocuments.length,
          deletedCount,
          oldestDocument: oldDocuments.length > 0 ? oldDocuments[0][dateField] : null,
          newestDocument: oldDocuments.length > 0 ? oldDocuments[oldDocuments.length - 1][dateField] : null
        });
        
      } catch (error) {
        console.error(`[ARCHIVE] Error processing collection ${collectionName}:`, error.message);
        archiveStats.push({
          name: collectionName,
          error: error.message
        });
      }
    }
    
    // Save archive file
    const archiveFileName = `${archiveId}.json.gz`;
    const archiveFilePath = path.join(archiveDir, archiveFileName);
    
    const jsonData = JSON.stringify(archivedData, null, 2);
    const compressedData = await new Promise((resolve, reject) => {
      zlib.gzip(jsonData, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    fs.writeFileSync(archiveFilePath, compressedData);
    
    const fileStats = fs.statSync(archiveFilePath);
    const checksum = await this.calculateChecksum(archiveFilePath);
    const durationMs = Date.now() - startTime;
    
    // Create backup record for the archive
    const archiveRecord = new Backup({
      backupId: archiveId,
      backupType: 'archive',
      status: 'completed',
      filePath: archiveFilePath,
      fileSize: fileStats.size,
      notes: notes || `Data archive: ${olderThanYears}+ years old data${deleteAfterArchive ? ' (deleted from DB)' : ''}`,
      initiatedBy,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      collections: archiveStats,
      metadata: {
        databaseName: mongoose.connection.name,
        hostname: os.hostname(),
        nodeVersion: process.version,
        totalDocuments: totalArchivedDocuments,
        durationMs,
        compression: 'gzip',
        checksum,
        archiveDetails: {
          olderThanYears,
          cutoffDate: cutoffDate.toISOString(),
          deleteAfterArchive,
          deletedDocuments: totalDeletedDocuments
        }
      },
      retention: {
        expiresAt: null, // Archives never auto-expire
        isProtected: true // Archives are always protected
      },
      recovery: {
        isRecoverable: true,
        lastVerifiedAt: new Date()
      }
    });
    
    await archiveRecord.save();
    
    console.log(`[ARCHIVE] SUCCESS - Archive completed: ${archiveId}`);
    console.log(`[ARCHIVE] - Duration: ${durationMs}ms`);
    console.log(`[ARCHIVE] - Size: ${this.formatBytes(fileStats.size)}`);
    console.log(`[ARCHIVE] - Archived: ${totalArchivedDocuments} documents`);
    console.log(`[ARCHIVE] - Deleted: ${totalDeletedDocuments} documents`);
    console.log(`[ARCHIVE] - Path: ${archiveFilePath}`);
    
    this.isBackupInProgress = false;
    
    return {
      success: true,
      archiveId,
      filePath: archiveFilePath,
      fileSize: fileStats.size,
      formattedSize: this.formatBytes(fileStats.size),
      cutoffDate: cutoffDate.toISOString(),
      olderThanYears,
      totalArchivedDocuments,
      totalDeletedDocuments,
      deleteAfterArchive,
      collections: archiveStats,
      durationMs,
      checksum
    };
  }
  
  /**
   * Get archive history
   */
  async getArchiveHistory(options = {}) {
    const { limit = 50, page = 1 } = options;
    
    const query = { backupType: 'archive' };
    const skip = (page - 1) * limit;
    
    const [archives, total] = await Promise.all([
      Backup.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Backup.countDocuments(query)
    ]);
    
    return {
      archives,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
  
  /**
   * Preview archive - Show what data would be archived without actually archiving
   */
  async previewArchive(options = {}) {
    const {
      olderThanYears = 10,
      collections = [],
      dateField = 'createdAt'
    } = options;
    
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - olderThanYears);
    
    const dateBasedCollections = collections.length > 0 ? collections : [
      'franchiseapplications',
      'franchiseinformations',
      'announcements',
      'auditlogs',
      'reports',
      'sessions'
    ];
    
    const db = mongoose.connection.db;
    const availableCollections = await this.getCollections();
    
    const preview = [];
    let totalDocuments = 0;
    
    for (const collectionName of dateBasedCollections) {
      if (!availableCollections.includes(collectionName)) continue;
      
      const collection = db.collection(collectionName);
      const query = { [dateField]: { $lt: cutoffDate } };
      
      try {
        const count = await collection.countDocuments(query);
        
        if (count > 0) {
          // Get date range
          const oldest = await collection.findOne(query, { sort: { [dateField]: 1 } });
          const newest = await collection.findOne(query, { sort: { [dateField]: -1 } });
          
          preview.push({
            collection: collectionName,
            documentCount: count,
            oldestDate: oldest?.[dateField],
            newestDate: newest?.[dateField]
          });
          
          totalDocuments += count;
        }
      } catch (error) {
        preview.push({
          collection: collectionName,
          error: error.message
        });
      }
    }
    
    return {
      cutoffDate: cutoffDate.toISOString(),
      olderThanYears,
      totalDocuments,
      collections: preview
    };
  }
  
  /**
   * Get database storage statistics
   * Note: collection.stats() is deprecated in MongoDB driver 6+, using db.command instead
   */
  async getDatabaseStats() {
    const db = mongoose.connection.db;
    
    // Get database stats using db.command (compatible with MongoDB driver 6+)
    let dbStats;
    try {
      dbStats = await db.command({ dbStats: 1 });
    } catch (err) {
      dbStats = { dataSize: 0, storageSize: 0, indexSize: 0 };
    }
    
    const collections = await this.getCollections();
    const collectionStats = [];
    
    for (const collectionName of collections) {
      if (collectionName.startsWith('system.')) continue;
      
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        
        // Get collection stats using db.command
        let colStats;
        try {
          colStats = await db.command({ collStats: collectionName });
        } catch (e) {
          colStats = { size: count * 1024, totalIndexSize: 0 }; // rough estimate
        }
        
        collectionStats.push({
          name: collectionName,
          documentCount: count,
          size: colStats.size || 0,
          formattedSize: this.formatBytes(colStats.size || 0),
          avgDocumentSize: count > 0 ? Math.round((colStats.size || 0) / count) : 0,
          indexSize: colStats.totalIndexSize || 0,
          formattedIndexSize: this.formatBytes(colStats.totalIndexSize || 0)
        });
      } catch (error) {
        collectionStats.push({
          name: collectionName,
          error: error.message
        });
      }
    }
    
    // Sort by size descending
    collectionStats.sort((a, b) => (b.size || 0) - (a.size || 0));
    
    return {
      database: {
        name: db.databaseName,
        totalSize: dbStats.dataSize || 0,
        formattedSize: this.formatBytes(dbStats.dataSize || 0),
        storageSize: dbStats.storageSize || 0,
        formattedStorageSize: this.formatBytes(dbStats.storageSize || 0),
        indexSize: dbStats.indexSize || 0,
        formattedIndexSize: this.formatBytes(dbStats.indexSize || 0),
        collections: dbStats.collections || collections.length,
        objects: dbStats.objects || 0
      },
      collections: collectionStats,
      backupDirectory: {
        path: BACKUP_CONFIG.baseDir,
        size: this.getDirectorySize(BACKUP_CONFIG.baseDir),
        formattedSize: this.formatBytes(this.getDirectorySize(BACKUP_CONFIG.baseDir))
      }
    };
  }
  
  /**
   * Get directory size recursively
   */
  getDirectorySize(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    
    let size = 0;
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        size += this.getDirectorySize(filePath);
      } else {
        size += stats.size;
      }
    }
    
    return size;
  }
  
  /**
   * Restore from archive - Bring back archived data to the database
   */
  async restoreFromArchive(archiveId, options = {}) {
    const {
      collections = [],
      skipExisting = true
    } = options;
    
    console.log(`[ARCHIVE] Starting restore from archive: ${archiveId}`);
    
    const archiveRecord = await Backup.findOne({ backupId: archiveId, backupType: 'archive' });
    if (!archiveRecord) {
      throw new Error(`Archive not found: ${archiveId}`);
    }
    
    if (!fs.existsSync(archiveRecord.filePath)) {
      throw new Error(`Archive file not found: ${archiveRecord.filePath}`);
    }
    
    // Verify checksum
    const currentChecksum = await this.calculateChecksum(archiveRecord.filePath);
    if (currentChecksum !== archiveRecord.metadata.checksum) {
      throw new Error('Archive file integrity check failed - checksum mismatch');
    }
    
    // Read and decompress
    const compressedData = fs.readFileSync(archiveRecord.filePath);
    const jsonData = await new Promise((resolve, reject) => {
      zlib.gunzip(compressedData, (err, result) => {
        if (err) reject(err);
        else resolve(result.toString());
      });
    });
    
    const archiveData = JSON.parse(jsonData);
    const db = mongoose.connection.db;
    
    const collectionsToRestore = collections.length > 0
      ? collections
      : Object.keys(archiveData.collections);
    
    const restoredStats = [];
    let totalRestored = 0;
    
    for (const collectionName of collectionsToRestore) {
      const documents = archiveData.collections[collectionName];
      if (!documents || documents.length === 0) continue;
      
      console.log(`[ARCHIVE] Restoring ${documents.length} documents to: ${collectionName}`);
      
      const collection = db.collection(collectionName);
      let insertedCount = 0;
      let skippedCount = 0;
      
      // Process documents
      const processedDocs = documents.map(doc => {
        if (doc._id && typeof doc._id === 'string' && doc._id.length === 24) {
          try {
            doc._id = new mongoose.Types.ObjectId(doc._id);
          } catch (e) {
            // Keep as string
          }
        }
        return doc;
      });
      
      // Insert in batches
      const batchSize = 500;
      for (let i = 0; i < processedDocs.length; i += batchSize) {
        const batch = processedDocs.slice(i, i + batchSize);
        
        try {
          if (skipExisting) {
            // Insert only if not exists
            const result = await collection.insertMany(batch, { ordered: false });
            insertedCount += result.insertedCount;
          } else {
            // Use upsert for each document
            for (const doc of batch) {
              await collection.replaceOne({ _id: doc._id }, doc, { upsert: true });
              insertedCount++;
            }
          }
        } catch (error) {
          if (error.code === 11000) {
            // Duplicate key - count as skipped
            skippedCount += batch.length - (error.insertedDocs?.length || 0);
            insertedCount += error.insertedDocs?.length || 0;
          } else {
            console.error(`[ARCHIVE] Error restoring: ${error.message}`);
          }
        }
      }
      
      restoredStats.push({
        collection: collectionName,
        totalInArchive: documents.length,
        inserted: insertedCount,
        skipped: skippedCount
      });
      
      totalRestored += insertedCount;
    }
    
    console.log(`[ARCHIVE] SUCCESS - Restore from archive completed: ${archiveId}`);
    console.log(`[ARCHIVE] - Total restored: ${totalRestored} documents`);
    
    return {
      success: true,
      archiveId,
      totalRestored,
      collections: restoredStats
    };
  }
  
  /**
   * Create a full database export for external storage (Hard Disk)
   * This creates a comprehensive backup that can be saved to external media
   * INCLUDES GridFS files for complete backup with all uploaded documents/images
   */
  async createFullExport(options = {}) {
    const {
      format = 'json',
      includeGridFSFiles = true, // Include uploaded files (GridFS)
      notes = '',
      initiatedBy = null
    } = options;
    
    if (this.isBackupInProgress) {
      throw new Error('Another backup/export operation is already in progress');
    }
    
    this.isBackupInProgress = true;
    const startTime = Date.now();
    const exportId = this.generateBackupId('full-export');
    
    console.log(`[EXPORT] Starting full database export: ${exportId}`);
    console.log(`[EXPORT] Include GridFS files: ${includeGridFSFiles}`);
    
    // Create export directory
    const exportDir = path.join(BACKUP_CONFIG.baseDir, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // Pre-calculate export file path
    const exportFileName = `${exportId}.json.gz`;
    const exportFilePath = path.join(exportDir, exportFileName);
    
    // Create export record
    const exportRecord = new Backup({
      backupId: exportId,
      backupType: 'manual',
      status: 'in-progress',
      filePath: exportFilePath,
      notes: notes || `Full database export for HDD${includeGridFSFiles ? ' (includes all files)' : ''}`,
      initiatedBy,
      startedAt: new Date(),
      metadata: {
        databaseName: mongoose.connection.name,
        hostname: os.hostname(),
        nodeVersion: process.version,
        exportType: 'full-export',
        includeGridFSFiles
      },
      retention: {
        expiresAt: null,
        isProtected: true
      }
    });
    
    await exportRecord.save();
    
    try {
      // Get all collections
      let allCollections = await this.getCollections();
      allCollections = allCollections.filter(c => !c.startsWith('system.'));
      
      console.log(`[EXPORT] Exporting ${allCollections.length} collections`);
      
      // Build export data
      const exportData = {
        exportId,
        exportType: 'full-database-export-with-files',
        version: '2.0', // New version that includes GridFS
        createdAt: new Date().toISOString(),
        databaseName: mongoose.connection.name,
        mongoVersion: mongoose.version,
        includesGridFSFiles: includeGridFSFiles,
        serverInfo: {
          hostname: os.hostname(),
          platform: os.platform(),
          nodeVersion: process.version,
          totalMemory: os.totalmem(),
          freeMemory: os.freemem()
        },
        instructions: {
          howToRestore: [
            '1. Go to Admin Dashboard > Settings > Backup & Recovery',
            '2. Click "Restore from File"',
            '3. Upload this .json.gz file',
            '4. System will restore all data AND uploaded files',
            '5. Wait for completion confirmation'
          ],
          apiRestore: 'POST /api/backup/import with multipart/form-data',
          warning: 'This will overwrite existing data. Always create a backup first!',
          fileInfo: includeGridFSFiles 
            ? 'This backup includes ALL uploaded files (photos, documents, etc.)' 
            : 'This backup contains database records only (no uploaded files)'
        },
        collections: {},
        gridfsFiles: null // Will be populated if includeGridFSFiles is true
      };
      
      const collectionStats = [];
      let totalDocuments = 0;
      let totalSize = 0;
      
      // Export regular collections
      for (const collectionName of allCollections) {
        // Skip GridFS internal collections - we'll handle them specially
        if (collectionName === 'trcv_files.files' || collectionName === 'trcv_files.chunks') {
          console.log(`[EXPORT] Skipping GridFS collection (will export separately): ${collectionName}`);
          continue;
        }
        
        console.log(`[EXPORT] Exporting collection: ${collectionName}`);
        const collectionData = await this.exportCollection(collectionName);
        
        exportData.collections[collectionName] = collectionData.documents;
        
        collectionStats.push({
          name: collectionName,
          documentCount: collectionData.documentCount,
          size: collectionData.size
        });
        
        totalDocuments += collectionData.documentCount;
        totalSize += collectionData.size;
      }
      
      // Export GridFS files if requested
      let gridfsStats = { fileCount: 0, totalSize: 0 };
      if (includeGridFSFiles) {
        console.log(`[EXPORT] Exporting GridFS files...`);
        const gridfsResult = await this.exportGridFSFiles();
        exportData.gridfsFiles = gridfsResult;
        gridfsStats = {
          fileCount: gridfsResult.files.length,
          totalSize: gridfsResult.totalSize
        };
        
        console.log(`[EXPORT] GridFS export: ${gridfsStats.fileCount} files, ${this.formatBytes(gridfsStats.totalSize)}`);
        
        collectionStats.push({
          name: 'gridfs_files (uploaded documents/images)',
          documentCount: gridfsStats.fileCount,
          size: gridfsStats.totalSize
        });
        
        totalDocuments += gridfsStats.fileCount;
        totalSize += gridfsStats.totalSize;
      }
      
      exportData.summary = {
        totalCollections: allCollections.length,
        totalDocuments,
        gridfsFiles: gridfsStats.fileCount,
        estimatedSize: this.formatBytes(totalSize),
        includesUploadedFiles: includeGridFSFiles
      };
      
      // Compress and write (maximum compression for HDD storage)
      console.log(`[EXPORT] Compressing data...`);
      const jsonData = JSON.stringify(exportData);
      const compressedData = await new Promise((resolve, reject) => {
        zlib.gzip(jsonData, { level: 9 }, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      fs.writeFileSync(exportFilePath, compressedData);
      
      const fileStats = fs.statSync(exportFilePath);
      const checksum = await this.calculateChecksum(exportFilePath);
      const durationMs = Date.now() - startTime;
      
      // Update export record
      exportRecord.status = 'completed';
      exportRecord.filePath = exportFilePath;
      exportRecord.fileSize = fileStats.size;
      exportRecord.collections = collectionStats;
      exportRecord.completedAt = new Date();
      exportRecord.metadata.totalDocuments = totalDocuments;
      exportRecord.metadata.durationMs = durationMs;
      exportRecord.metadata.compression = 'gzip';
      exportRecord.metadata.checksum = checksum;
      exportRecord.metadata.gridfsFileCount = gridfsStats.fileCount;
      exportRecord.recovery.isRecoverable = true;
      exportRecord.recovery.lastVerifiedAt = new Date();
      
      await exportRecord.save();
      
      console.log(`[EXPORT] SUCCESS - Full export completed: ${exportId}`);
      console.log(`[EXPORT] - Duration: ${this.formatDuration(durationMs)}`);
      console.log(`[EXPORT] - File Size: ${this.formatBytes(fileStats.size)}`);
      console.log(`[EXPORT] - Documents: ${totalDocuments}`);
      console.log(`[EXPORT] - GridFS Files: ${gridfsStats.fileCount}`);
      console.log(`[EXPORT] - Path: ${exportFilePath}`);
      
      this.isBackupInProgress = false;
      
      return {
        success: true,
        exportId,
        fileName: exportFileName,
        filePath: exportFilePath,
        fileSize: fileStats.size,
        formattedSize: this.formatBytes(fileStats.size),
        totalDocuments,
        totalCollections: allCollections.length,
        gridfsFileCount: gridfsStats.fileCount,
        includesGridFSFiles: includeGridFSFiles,
        collections: collectionStats,
        durationMs,
        formattedDuration: this.formatDuration(durationMs),
        checksum,
        downloadUrl: `/api/backup/export/${exportId}/download`,
        instructions: includeGridFSFiles 
          ? 'Download this file and save it to your external hard disk. This backup includes ALL data and uploaded files (photos, documents, etc.).'
          : 'Download this file and save it to your external hard disk. Note: This backup contains database records only.'
      };
      
    } catch (error) {
      console.error(`[EXPORT] ERROR - Export failed: ${error.message}`);
      
      exportRecord.status = 'failed';
      exportRecord.completedAt = new Date();
      exportRecord.metadata.durationMs = Date.now() - startTime;
      exportRecord.error = {
        message: error.message,
        stack: error.stack,
        code: error.code
      };
      
      await exportRecord.save();
      
      this.isBackupInProgress = false;
      throw error;
    }
  }
  
  /**
   * Export all GridFS files (uploaded documents, photos, etc.)
   * Returns file metadata and base64-encoded content
   */
  async exportGridFSFiles() {
    const db = mongoose.connection.db;
    
    // Get file metadata from GridFS files collection
    const filesCollection = db.collection('trcv_files.files');
    const chunksCollection = db.collection('trcv_files.chunks');
    
    const files = await filesCollection.find({}).toArray();
    
    console.log(`[EXPORT] Found ${files.length} GridFS files to export`);
    
    const exportedFiles = [];
    let totalSize = 0;
    
    for (const file of files) {
      try {
        // Get all chunks for this file
        const chunks = await chunksCollection
          .find({ files_id: file._id })
          .sort({ n: 1 })
          .toArray();
        
        // Combine chunks into single buffer
        const buffers = chunks.map(chunk => chunk.data.buffer);
        const fileBuffer = Buffer.concat(buffers);
        
        // Convert to base64 for JSON storage
        const base64Data = fileBuffer.toString('base64');
        
        exportedFiles.push({
          _id: file._id.toString(),
          filename: file.filename,
          contentType: file.contentType || file.metadata?.mimetype,
          length: file.length,
          uploadDate: file.uploadDate,
          metadata: file.metadata,
          // Store file content as base64
          data: base64Data
        });
        
        totalSize += file.length;
        
      } catch (error) {
        console.error(`[EXPORT] Error exporting file ${file.filename}:`, error.message);
        // Continue with other files
      }
    }
    
    console.log(`[EXPORT] Successfully exported ${exportedFiles.length}/${files.length} GridFS files`);
    
    return {
      bucketName: 'trcv_files',
      files: exportedFiles,
      totalSize,
      formattedSize: this.formatBytes(totalSize)
    };
  }
  
  /**
   * Import database from an external backup file (from Hard Disk)
   * Supports version 2.0 backups that include GridFS files
   */
  async importFromFile(filePath, options = {}) {
    const {
      dropExisting = false,
      collections = [],
      restoreGridFSFiles = true // Restore uploaded files by default
    } = options;
    
    console.log(`[IMPORT] Starting import from file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Import file not found');
    }
    
    // Read and decompress
    const compressedData = fs.readFileSync(filePath);
    let jsonData;
    
    try {
      jsonData = await new Promise((resolve, reject) => {
        zlib.gunzip(compressedData, (err, result) => {
          if (err) reject(err);
          else resolve(result.toString());
        });
      });
    } catch (error) {
      throw new Error('Failed to decompress file. Make sure it is a valid .json.gz backup file.');
    }
    
    let importData;
    try {
      importData = JSON.parse(jsonData);
    } catch (error) {
      throw new Error('Failed to parse backup file. The file may be corrupted.');
    }
    
    // Validate import data structure
    if (!importData.collections || typeof importData.collections !== 'object') {
      throw new Error('Invalid backup file format. Missing collections data.');
    }
    
    console.log(`[IMPORT] Backup info: ${importData.exportId || importData.backupId}`);
    console.log(`[IMPORT] Created at: ${importData.createdAt}`);
    console.log(`[IMPORT] Version: ${importData.version || '1.0'}`);
    console.log(`[IMPORT] Includes GridFS: ${importData.includesGridFSFiles || false}`);
    console.log(`[IMPORT] Collections found: ${Object.keys(importData.collections).length}`);
    
    const db = mongoose.connection.db;
    const collectionsToImport = collections.length > 0
      ? collections
      : Object.keys(importData.collections);
    
    const importStats = [];
    let totalDocuments = 0;
    let gridfsStats = { restored: 0, skipped: 0, failed: 0 };
    
    // Import regular collections
    for (const collectionName of collectionsToImport) {
      const documents = importData.collections[collectionName];
      if (!documents || documents.length === 0) continue;
      
      console.log(`[IMPORT] Importing ${documents.length} documents to: ${collectionName}`);
      
      const collection = db.collection(collectionName);
      
      if (dropExisting) {
        await collection.deleteMany({});
        console.log(`[IMPORT] Cleared existing data in: ${collectionName}`);
      }
      
      // Process documents (convert _id strings back to ObjectId)
      const processedDocs = documents.map(doc => {
        if (doc._id && typeof doc._id === 'string' && doc._id.length === 24) {
          try {
            doc._id = new mongoose.Types.ObjectId(doc._id);
          } catch (e) {
            // Keep as string if conversion fails
          }
        }
        return doc;
      });
      
      let insertedCount = 0;
      let errorCount = 0;
      
      // Insert in batches
      const batchSize = 500;
      for (let i = 0; i < processedDocs.length; i += batchSize) {
        const batch = processedDocs.slice(i, i + batchSize);
        
        try {
          const result = await collection.insertMany(batch, { ordered: false });
          insertedCount += result.insertedCount;
        } catch (error) {
          if (error.code === 11000) {
            // Duplicate key errors
            insertedCount += error.insertedCount || 0;
            errorCount += batch.length - (error.insertedCount || 0);
          } else {
            console.error(`[IMPORT] Error importing to ${collectionName}:`, error.message);
            errorCount += batch.length;
          }
        }
      }
      
      importStats.push({
        collection: collectionName,
        totalInFile: documents.length,
        imported: insertedCount,
        skipped: errorCount
      });
      
      totalDocuments += insertedCount;
    }
    
    // Import GridFS files if present and requested
    if (restoreGridFSFiles && importData.gridfsFiles && importData.gridfsFiles.files) {
      console.log(`[IMPORT] Restoring GridFS files...`);
      gridfsStats = await this.importGridFSFiles(importData.gridfsFiles, { dropExisting });
      
      importStats.push({
        collection: 'gridfs_files',
        totalInFile: importData.gridfsFiles.files.length,
        imported: gridfsStats.restored,
        skipped: gridfsStats.skipped,
        failed: gridfsStats.failed
      });
      
      totalDocuments += gridfsStats.restored;
    }
    
    // Clean up uploaded file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.log('[IMPORT] Could not delete uploaded file:', e.message);
    }
    
    console.log(`[IMPORT] SUCCESS - Import completed`);
    console.log(`[IMPORT] - Total imported: ${totalDocuments} documents`);
    console.log(`[IMPORT] - GridFS files restored: ${gridfsStats.restored}`);
    
    return {
      success: true,
      sourceBackupId: importData.exportId || importData.backupId,
      sourceCreatedAt: importData.createdAt,
      backupVersion: importData.version || '1.0',
      includedGridFSFiles: importData.includesGridFSFiles || false,
      totalDocuments,
      gridfsFilesRestored: gridfsStats.restored,
      collections: importStats
    };
  }
  
  /**
   * Import GridFS files from backup data
   */
  async importGridFSFiles(gridfsData, options = {}) {
    const { dropExisting = false } = options;
    const db = mongoose.connection.db;
    
    const filesCollection = db.collection('trcv_files.files');
    const chunksCollection = db.collection('trcv_files.chunks');
    
    if (dropExisting) {
      console.log(`[IMPORT] Clearing existing GridFS files...`);
      await filesCollection.deleteMany({});
      await chunksCollection.deleteMany({});
    }
    
    const stats = { restored: 0, skipped: 0, failed: 0 };
    
    for (const file of gridfsData.files) {
      try {
        // Check if file already exists
        const existingFile = await filesCollection.findOne({ 
          _id: new mongoose.Types.ObjectId(file._id) 
        });
        
        if (existingFile && !dropExisting) {
          console.log(`[IMPORT] Skipping existing file: ${file.filename}`);
          stats.skipped++;
          continue;
        }
        
        // Decode base64 data back to buffer
        const fileBuffer = Buffer.from(file.data, 'base64');
        
        // Insert file metadata
        const fileDoc = {
          _id: new mongoose.Types.ObjectId(file._id),
          length: file.length,
          chunkSize: 261120, // Default GridFS chunk size
          uploadDate: new Date(file.uploadDate),
          filename: file.filename,
          contentType: file.contentType,
          metadata: file.metadata
        };
        
        await filesCollection.insertOne(fileDoc);
        
        // Split buffer into chunks and insert
        const chunkSize = 261120;
        let chunkNumber = 0;
        
        for (let offset = 0; offset < fileBuffer.length; offset += chunkSize) {
          const chunkData = fileBuffer.slice(offset, offset + chunkSize);
          
          await chunksCollection.insertOne({
            files_id: fileDoc._id,
            n: chunkNumber,
            data: chunkData
          });
          
          chunkNumber++;
        }
        
        console.log(`[IMPORT] Restored GridFS file: ${file.filename}`);
        stats.restored++;
        
      } catch (error) {
        console.error(`[IMPORT] Failed to restore file ${file.filename}:`, error.message);
        stats.failed++;
      }
    }
    
    console.log(`[IMPORT] GridFS restore complete: ${stats.restored} restored, ${stats.skipped} skipped, ${stats.failed} failed`);
    
    return stats;
  }
}

// Singleton instance
const backupService = new BackupService();

module.exports = {
  backupService,
  BACKUP_CONFIG
};
