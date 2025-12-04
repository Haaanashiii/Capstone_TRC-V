const Backup = require('../models/backupModel');

/**
 * Create a new backup record
 */
const createBackup = async (backupData) => {
  const backup = new Backup(backupData);
  return await backup.save();
};

/**
 * Find backup by ID
 */
const findByBackupId = async (backupId) => {
  return await Backup.findOne({ backupId }).lean();
};

/**
 * Find backup by MongoDB _id
 */
const findById = async (id) => {
  return await Backup.findById(id).lean();
};

/**
 * Update backup by backupId
 */
const updateByBackupId = async (backupId, updateData) => {
  return await Backup.findOneAndUpdate(
    { backupId },
    updateData,
    { new: true }
  );
};

/**
 * Delete backup by backupId
 */
const deleteByBackupId = async (backupId) => {
  return await Backup.findOneAndDelete({ backupId });
};

/**
 * Get all backups with pagination
 */
const findAll = async (options = {}) => {
  const {
    type = null,
    status = null,
    limit = 50,
    page = 1,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;
  
  const query = {};
  if (type) query.backupType = type;
  if (status) query.status = status;
  
  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder };
  
  const [backups, total] = await Promise.all([
    Backup.find(query).sort(sort).skip(skip).limit(limit).lean(),
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
};

/**
 * Get last successful backup
 */
const getLastSuccessful = async (type = null) => {
  const query = { status: 'completed' };
  if (type) query.backupType = type;
  
  return await Backup.findOne(query).sort({ completedAt: -1 }).lean();
};

/**
 * Get backup statistics
 */
const getStats = async () => {
  return await Backup.aggregate([
    {
      $group: {
        _id: {
          type: '$backupType',
          status: '$status'
        },
        count: { $sum: 1 },
        totalSize: { $sum: '$fileSize' }
      }
    },
    {
      $group: {
        _id: '$_id.type',
        statuses: {
          $push: {
            status: '$_id.status',
            count: '$count',
            totalSize: '$totalSize'
          }
        },
        totalCount: { $sum: '$count' },
        totalSize: { $sum: '$totalSize' }
      }
    }
  ]);
};

/**
 * Get expired backups
 */
const getExpired = async () => {
  return await Backup.find({
    'retention.expiresAt': { $lt: new Date() },
    'retention.isProtected': false
  }).lean();
};

/**
 * Get backups by date range
 */
const findByDateRange = async (startDate, endDate, type = null) => {
  const query = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };
  
  if (type) query.backupType = type;
  
  return await Backup.find(query).sort({ createdAt: -1 }).lean();
};

/**
 * Get failed backups
 */
const getFailedBackups = async (limit = 10) => {
  return await Backup.find({ status: 'failed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get protected backups
 */
const getProtectedBackups = async () => {
  return await Backup.find({ 'retention.isProtected': true })
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * Count backups by type
 */
const countByType = async (type) => {
  return await Backup.countDocuments({ backupType: type });
};

/**
 * Get total storage used by backups
 */
const getTotalStorageUsed = async () => {
  const result = await Backup.aggregate([
    {
      $group: {
        _id: null,
        totalSize: { $sum: '$fileSize' }
      }
    }
  ]);
  
  return result[0]?.totalSize || 0;
};

/**
 * Bulk delete old backups
 */
const bulkDelete = async (backupIds) => {
  return await Backup.deleteMany({ backupId: { $in: backupIds } });
};

/**
 * Mark backup as corrupted
 */
const markAsCorrupted = async (backupId) => {
  return await Backup.findOneAndUpdate(
    { backupId },
    {
      status: 'corrupted',
      'recovery.isRecoverable': false
    },
    { new: true }
  );
};

module.exports = {
  createBackup,
  findByBackupId,
  findById,
  updateByBackupId,
  deleteByBackupId,
  findAll,
  getLastSuccessful,
  getStats,
  getExpired,
  findByDateRange,
  getFailedBackups,
  getProtectedBackups,
  countByType,
  getTotalStorageUsed,
  bulkDelete,
  markAsCorrupted
};
