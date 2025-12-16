const FranchiseInformation = require('../models/franchiseInformationModel');

exports.createFranchiseInformation = async (data) => {
  const franchiseInformation = new FranchiseInformation(data);
  return await franchiseInformation.save();
}

// Get all franchises with pagination (optimized for 10K+ docs)
exports.getAllFranchiseInformation = async (options = {}) => {
  const { page = 1, limit = 50, status = '', barangay = '', currentOnly = true, lean = true } = options;

  const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  // Build query
  const query = {};
  if (currentOnly) query.isCurrentVersion = true;
  if (status) query.franchiseStatus = status;
  if (barangay) query.operatorBarangay = barangay;

  // Execute with pagination
  const [franchises, total] = await Promise.all([
    FranchiseInformation.find(query)
      // Documents are now included - needed for FranchiseeList to display document links
      .sort({ franchiseNumber: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(lean),
    FranchiseInformation.countDocuments(query)
  ]);

  return {
    franchises,
    pagination: {
      page: parseInt(page),
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  };
}

// Get franchises by barangay
exports.getFranchisesByBarangay = async (barangay, options = {}) => {
  const { page = 1, limit = 50, status = '' } = options;
  const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
  const limitNum = Math.min(100, parseInt(limit));

  const query = { 
    operatorBarangay: barangay,
    isCurrentVersion: true 
  };
  if (status) query.franchiseStatus = status;

  const [franchises, total] = await Promise.all([
    FranchiseInformation.find(query)
      .sort({ franchiseNumber: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    FranchiseInformation.countDocuments(query)
  ]);

  return {
    franchises,
    pagination: { page: parseInt(page), limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  };
}

// Get franchises by year
exports.getFranchisesByYear = async (year, options = {}) => {
  const { page = 1, limit = 50, status = '' } = options;
  const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
  const limitNum = Math.min(100, parseInt(limit));

  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

  const query = { 
    isCurrentVersion: true,
    $or: [
      { approvedAt: { $gte: startOfYear, $lte: endOfYear } },
      { createdAt: { $gte: startOfYear, $lte: endOfYear } }
    ]
  };
  if (status) query.franchiseStatus = status;

  const [franchises, total] = await Promise.all([
    FranchiseInformation.find(query)
      .sort({ approvedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    FranchiseInformation.countDocuments(query)
  ]);

  return {
    franchises,
    pagination: { page: parseInt(page), limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  };
}

// Lookup franchise by number (for QR verification)
exports.findByFranchiseNumber = async (franchiseNumber) => {
  return await FranchiseInformation.findOne({
    franchiseNumber: franchiseNumber,
    isCurrentVersion: true
  })
  .select('franchiseNumber franchiseChainId franchiseStatus operatorName operatorAddress operatorBarangay todaMembership expiryDate version documents.operatorPictureObj')
  .lean();
}

exports.getFranchiseInformationById = async (id) => {
  return await FranchiseInformation.findById(id).lean();        
}

exports.updateFranchiseInformation = async (id, data) => {
  return await FranchiseInformation.findByIdAndUpdate(id, data, { new: true });
}

exports.deleteFranchiseInformation = async (id) => {
  return await FranchiseInformation.findByIdAndDelete(id);
}

// Get aggregated statistics for dashboard
exports.getStatistics = async () => {
  const stats = await FranchiseInformation.aggregate([
    { $match: { isCurrentVersion: true } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$franchiseStatus', 'Active'] }, 1, 0] } },
        expired: { $sum: { $cond: [{ $eq: ['$franchiseStatus', 'Expired'] }, 1, 0] } },
        revoked: { $sum: { $cond: [{ $eq: ['$franchiseStatus', 'Revoked'] }, 1, 0] } }
      }
    }
  ]);

  return stats[0] || { total: 0, active: 0, expired: 0, revoked: 0 };
}

// Get barangay distribution for analytics
exports.getBarangayDistribution = async () => {
  return await FranchiseInformation.aggregate([
    { $match: { isCurrentVersion: true } },
    {
      $group: {
        _id: '$operatorBarangay',
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$franchiseStatus', 'Active'] }, 1, 0] } },
        expired: { $sum: { $cond: [{ $eq: ['$franchiseStatus', 'Expired'] }, 1, 0] } }
      }
    },
    { $sort: { total: -1 } }
  ]);
}

