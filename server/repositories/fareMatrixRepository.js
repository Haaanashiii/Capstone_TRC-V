const FareMatrix = require('../models/fareMatrixModel');

/**
 * Get active fare matrix (most recent)
 */
exports.getActiveFareMatrix = async () => {
  return await FareMatrix.findOne({
    isActive: true
  }).sort({ createdAt: -1 }).lean();
};

/**
 * Get all fare matrix records (active and inactive)
 */
exports.getAllFareMatrices = async (includeInactive = false) => {
  const query = includeInactive ? {} : { isActive: true };
  return await FareMatrix.find(query).sort({ createdAt: -1 }).lean();
};

/**
 * Get fare matrix by ID
 */
exports.getFareMatrixById = async (fareMatrixId) => {
  return await FareMatrix.findOne({ fareMatrixId }).lean();
};

/**
 * Create new fare matrix
 */
exports.createFareMatrix = async (data) => {
  const fareMatrix = new FareMatrix(data);
  return await fareMatrix.save();
};

/**
 * Update fare matrix
 */
exports.updateFareMatrix = async (fareMatrixId, updateData) => {
  return await FareMatrix.findOneAndUpdate(
    { fareMatrixId },
    { 
      ...updateData,
      updatedAt: new Date()
    },
    { new: true }
  );
};

/**
 * Soft delete fare matrix (mark as inactive)
 */
exports.softDeleteFareMatrix = async (fareMatrixId, adminId) => {
  return await FareMatrix.findOneAndUpdate(
    { fareMatrixId },
    {
      isActive: false,
      deletedAt: new Date(),
      deletedBy: adminId,
      updatedAt: new Date()
    },
    { new: true }
  );
};

/**
 * Hard delete fare matrix (permanent)
 */
exports.deleteFareMatrix = async (fareMatrixId) => {
  return await FareMatrix.findOneAndDelete({ fareMatrixId });
};

/**
 * Get fare matrix by uploader
 */
exports.getFareMatricesByUploader = async (uploadedBy, includeInactive = false) => {
  const query = { uploadedBy };
  if (!includeInactive) query.isActive = true;
  return await FareMatrix.find(query).sort({ createdAt: -1 }).lean();
};

/**
 * Check if active fare matrix exists
 */
exports.hasActiveFareMatrix = async () => {
  const count = await FareMatrix.countDocuments({ isActive: true });
  return count > 0;
};

/**
 * Deactivate all other fare matrices (when uploading new one)
 */
exports.deactivateOthers = async (excludeFareMatrixId) => {
  return await FareMatrix.updateMany(
    { 
      fareMatrixId: { $ne: excludeFareMatrixId },
      isActive: true
    },
    {
      isActive: false,
      updatedAt: new Date()
    }
  );
};
