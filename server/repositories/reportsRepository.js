const Report = require('../models/reportsModel');

exports.createReport = async (reportData) => {
  const report = new Report(reportData);
  return await report.save();
};

// Get all reports with pagination, search, filters
exports.getAllReports = async (options = {}) => {
  const { page = 1, limit = 10, search = '', status = '', category = '', barangay = '', sortBy = 'dateReported', sortOrder = 'desc' } = options;
  const skip = (page - 1) * limit;
  
  let query = {};
  
  // Text search with index fallback
  if (search) {
    const textSearchCount = await Report.countDocuments({ $text: { $search: search } });
    if (textSearchCount > 0) {
      query.$text = { $search: search };
    } else {
      query.$or = [
        { reportID: { $regex: search, $options: 'i' } },
        { operatorName: { $regex: search, $options: 'i' } },
        { franchiseNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { reporterName: { $regex: search, $options: 'i' } },
        { operatorBarangay: { $regex: search, $options: 'i' } }
      ];
    }
  }
  
  if (status) query.status = status;
  if (category) query.category = category;
  if (barangay) query.operatorBarangay = barangay;

  const sortOptions = {
    'reportID': { reportID: sortOrder === 'asc' ? 1 : -1 },
    'dateReported': { dateReported: sortOrder === 'asc' ? 1 : -1 },
    'status': { status: sortOrder === 'asc' ? 1 : -1, dateReported: -1 },
    'category': { category: sortOrder === 'asc' ? 1 : -1, dateReported: -1 },
    'operatorName': { operatorName: sortOrder === 'asc' ? 1 : -1 },
    'operatorBarangay': { operatorBarangay: sortOrder === 'asc' ? 1 : -1, dateReported: -1 },
    'amountCharged': { amountCharged: sortOrder === 'asc' ? 1 : -1 }
  };
  const sortObject = sortOptions[sortBy] || { dateReported: -1 };

  // Special handling for reportID numeric sorting
  if (sortBy === 'reportID') {
    const [reports, total] = await Promise.all([
      Report.aggregate([
        { $match: query },
        { $addFields: { reportNumber: { $toInt: { $substr: ['$reportID', 4, -1] } } } },
        { $sort: { reportNumber: sortOrder === 'asc' ? 1 : -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
        { $project: { reportNumber: 0 } }
      ]),
      Report.countDocuments(query)
    ]);
    return { reports, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } };
  }

  const [reports, total] = await Promise.all([
    Report.find(query).sort(sortObject).skip(skip).limit(parseInt(limit)),
    Report.countDocuments(query)
  ]);

  return { reports, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } };
};

exports.getReportById = async (reportId) => {
  return await Report.findOne({ reportID: reportId });
};

exports.updateReport = async (reportId, updateData) => {
  const query = reportId.match(/^[0-9a-fA-F]{24}$/) ? { _id: reportId } : { reportID: reportId };
  return await Report.findOneAndUpdate(query, updateData, { new: true, runValidators: true });
};

exports.deleteReport = async (reportId) => {
  return await Report.findOneAndDelete({ reportID: reportId });
};

// Get reports for a specific month
exports.getMonthlyReports = async (month, year, options = {}) => {
  const { category = '', barangay = '', page = 1, limit = 0 } = options;
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const query = { dateReported: { $gte: startDate, $lte: endDate } };
  if (category) query.category = category;
  if (barangay) query.operatorBarangay = barangay;

  let reportsQuery = Report.find(query).sort({ dateReported: -1 });
  if (limit > 0) {
    reportsQuery = reportsQuery.skip((Math.max(1, parseInt(page)) - 1) * parseInt(limit)).limit(parseInt(limit));
  }

  return await reportsQuery.lean();
};

// Get aggregated statistics
exports.getReportsStatistics = async () => {
  const [totalReports, pendingReports, resolvedReports, investigatingReports, dismissedReports, categoryStats, barangayStats] = await Promise.all([
    Report.countDocuments(),
    Report.countDocuments({ status: 'pending' }),
    Report.countDocuments({ status: 'resolved' }),
    Report.countDocuments({ status: 'investigating' }),
    Report.countDocuments({ status: 'dismissed' }),
    Report.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    Report.aggregate([
      { $match: { operatorBarangay: { $ne: null, $ne: '' } } },
      { $group: { _id: '$operatorBarangay', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);

  const byCategory = {};
  categoryStats.forEach(stat => { byCategory[stat._id || 'overpricing'] = stat.count; });

  const byBarangay = {};
  barangayStats.forEach(stat => { byBarangay[stat._id] = stat.count; });

  return { total: totalReports, pending: pendingReports, resolved: resolvedReports, investigating: investigatingReports, dismissed: dismissedReports, byCategory, byBarangay };
};

exports.getReportsByDateRange = async (startDate, endDate, options = {}) => {
  const { category = '', barangay = '', page = 1, limit = 0 } = options;
  
  const query = { dateReported: { $gte: startDate, $lte: endDate } };
  if (category) query.category = category;
  if (barangay) query.operatorBarangay = barangay;

  let reportsQuery = Report.find(query).sort({ dateReported: -1 });
  if (limit > 0) {
    reportsQuery = reportsQuery.skip((Math.max(1, parseInt(page)) - 1) * parseInt(limit)).limit(parseInt(limit));
  }

  return await reportsQuery.lean();
};

exports.getReportsByCategory = async (category, options = {}) => {
  const { limit = 50, status, page = 1 } = options;
  const skip = (page - 1) * limit;
  
  const query = { category };
  if (status) query.status = status;
  
  const [reports, total] = await Promise.all([
    Report.find(query).sort({ dateReported: -1 }).skip(skip).limit(limit),
    Report.countDocuments(query)
  ]);
    
  return { reports, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } };
};

exports.getReportsByFranchise = async (franchiseNumber, options = {}) => {
  const { limit = 50, page = 1 } = options;
  const skip = (page - 1) * limit;
  
  const [reports, total] = await Promise.all([
    Report.find({ franchiseNumber }).sort({ dateReported: -1 }).skip(skip).limit(limit),
    Report.countDocuments({ franchiseNumber })
  ]);
    
  return { reports, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } };
};

exports.getReportsByBarangay = async (barangay, options = {}) => {
  const { limit = 50, status, category, page = 1 } = options;
  const skip = (page - 1) * limit;
  
  const query = { operatorBarangay: barangay };
  if (status) query.status = status;
  if (category) query.category = category;
  
  const [reports, total] = await Promise.all([
    Report.find(query).sort({ dateReported: -1 }).skip(skip).limit(limit),
    Report.countDocuments(query)
  ]);
    
  return { reports, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } };
};

exports.getReportsByOperator = async (operatorName, options = {}) => {
  const { limit = 50, status, category, page = 1 } = options;
  const skip = (page - 1) * limit;
  
  const query = { operatorName: { $regex: operatorName, $options: 'i' } };
  if (status) query.status = status;
  if (category) query.category = category;
  
  const [reports, total] = await Promise.all([
    Report.find(query).sort({ dateReported: -1 }).skip(skip).limit(limit),
    Report.countDocuments(query)
  ]);
    
  return { reports, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } };
};

// Barangay summary aggregation
exports.getBarangaySummary = async () => {
  const summary = await Report.aggregate([
    { $match: { operatorBarangay: { $ne: null, $ne: '' } } },
    {
      $group: {
        _id: '$operatorBarangay',
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        investigating: { $sum: { $cond: [{ $eq: ['$status', 'investigating'] }, 1, 0] } },
        dismissed: { $sum: { $cond: [{ $eq: ['$status', 'dismissed'] }, 1, 0] } }
      }
    },
    { $sort: { total: -1 } }
  ]);
  
  return summary.map(s => ({ barangay: s._id, total: s.total, pending: s.pending, resolved: s.resolved, investigating: s.investigating, dismissed: s.dismissed }));
};

// Category summary aggregation
exports.getCategorySummary = async () => {
  const summary = await Report.aggregate([
    {
      $group: {
        _id: '$category',
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        investigating: { $sum: { $cond: [{ $eq: ['$status', 'investigating'] }, 1, 0] } },
        dismissed: { $sum: { $cond: [{ $eq: ['$status', 'dismissed'] }, 1, 0] } }
      }
    },
    { $sort: { total: -1 } }
  ]);
  
  return summary.map(s => ({ category: s._id || 'overpricing', total: s.total, pending: s.pending, resolved: s.resolved, investigating: s.investigating, dismissed: s.dismissed }));
};

// Operator summary (top reporters)
exports.getOperatorSummary = async (options = {}) => {
  const { limit = 20 } = options;
  
  const summary = await Report.aggregate([
    { $match: { operatorName: { $ne: null, $ne: '' } } },
    {
      $group: {
        _id: { name: '$operatorName', franchiseNumber: '$franchiseNumber', barangay: '$operatorBarangay' },
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } }
      }
    },
    { $sort: { total: -1 } },
    { $limit: limit }
  ]);
  
  return summary.map(s => ({ operatorName: s._id.name, franchiseNumber: s._id.franchiseNumber, barangay: s._id.barangay, total: s.total, pending: s.pending, resolved: s.resolved }));
};
