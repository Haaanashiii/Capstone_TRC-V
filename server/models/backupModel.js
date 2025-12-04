const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
  // Backup identification
  backupId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Backup type: 'automatic', 'manual', 'pre-update', 'emergency', 'archive'
  backupType: {
    type: String,
    enum: ['automatic', 'manual', 'pre-update', 'emergency', 'archive'],
    required: true
  },
  
  // Status of the backup
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'failed', 'corrupted'],
    default: 'in-progress'
  },
  
  // Backup location/path
  filePath: {
    type: String,
    required: true
  },
  
  // File size in bytes
  fileSize: {
    type: Number,
    default: 0
  },
  
  // Collections included in backup
  collections: [{
    name: String,
    documentCount: Number,
    size: Number
  }],
  
  // Backup metadata
  metadata: {
    // Database name
    databaseName: String,
    
    // MongoDB version
    mongoVersion: String,
    
    // Total documents backed up
    totalDocuments: {
      type: Number,
      default: 0
    },
    
    // Backup duration in milliseconds
    durationMs: {
      type: Number,
      default: 0
    },
    
    // Compression used
    compression: {
      type: String,
      enum: ['none', 'gzip', 'zip'],
      default: 'gzip'
    },
    
    // Checksum for integrity verification
    checksum: String,
    
    // Server hostname
    hostname: String,
    
    // Node.js version
    nodeVersion: String
  },
  
  // Who initiated the backup (for manual backups)
  initiatedBy: {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminAccount'
    },
    adminName: String,     // Admin's display name (from JWT)
    adminEmail: String,    // Admin's email (legacy, may be null)
    adminRole: String
  },
  
  // Error details if backup failed
  error: {
    message: String,
    stack: String,
    code: String
  },
  
  // Notes/description
  notes: {
    type: String,
    maxlength: 500
  },
  
  // Recovery information
  recovery: {
    isRecoverable: {
      type: Boolean,
      default: true
    },
    lastVerifiedAt: Date,
    restoredCount: {
      type: Number,
      default: 0
    }
  },
  
  // Retention policy
  retention: {
    // When should this backup expire
    expiresAt: Date,
    // Is this backup protected from auto-deletion
    isProtected: {
      type: Boolean,
      default: false
    }
  },
  
  // Timestamps
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  
}, {
  timestamps: true
});

// Indexes for efficient queries
backupSchema.index({ backupType: 1, status: 1 });
backupSchema.index({ createdAt: -1 });
backupSchema.index({ 'retention.expiresAt': 1 });
backupSchema.index({ status: 1, createdAt: -1 });

// Virtual for formatted file size
backupSchema.virtual('formattedSize').get(function() {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Virtual for duration formatted
backupSchema.virtual('formattedDuration').get(function() {
  const ms = this.metadata?.durationMs || 0;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
});

// Static method to get last successful backup
backupSchema.statics.getLastSuccessfulBackup = async function(type = null) {
  const query = { status: 'completed' };
  if (type) query.backupType = type;
  
  return this.findOne(query)
    .sort({ completedAt: -1 })
    .lean();
};

// Static method to get backup statistics
backupSchema.statics.getBackupStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalSize: { $sum: '$fileSize' }
      }
    }
  ]);
  
  const lastBackup = await this.getLastSuccessfulBackup();
  const lastAutoBackup = await this.getLastSuccessfulBackup('automatic');
  const lastManualBackup = await this.getLastSuccessfulBackup('manual');
  
  return {
    stats,
    lastBackup,
    lastAutoBackup,
    lastManualBackup
  };
};

// Static method to clean up expired backups
backupSchema.statics.getExpiredBackups = async function() {
  return this.find({
    'retention.expiresAt': { $lt: new Date() },
    'retention.isProtected': false
  }).lean();
};

// Ensure virtuals are included in JSON
backupSchema.set('toJSON', { virtuals: true });
backupSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Backup', backupSchema);
