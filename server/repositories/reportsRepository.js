
const Report = require('../models/reportsModel');

exports.createReport = async (reportData) => {
  try {
    const report = new Report(reportData);
    const savedReport = await report.save();
    return savedReport;
  } catch (error) {
    console.error('[Repo] Create error:', error.message);
    throw error;
  }
};

exports.getAllReports = async (options = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      category = '',
      barangay = '',
      sortBy = 'dateReported',
      sortOrder = 'desc'
    } = options;

    const skip = (page - 1) * limit;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { reportID: { $regex: search, $options: 'i' } },
        { operatorName: { $regex: search, $options: 'i' } },
        { franchiseNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { reporterName: { $regex: search, $options: 'i' } },
        { operatorBarangay: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) query.status = status;
    if (category) query.category = category;
    if (barangay) query.operatorBarangay = barangay;

    let sortObject = {};
    
    switch (sortBy) {
      case 'reportID':
        sortObject = { reportID: sortOrder === 'asc' ? 1 : -1 };
        break;
      case 'dateReported':
        sortObject = { dateReported: sortOrder === 'asc' ? 1 : -1 };
        break;
      case 'status':
        sortObject = { status: sortOrder === 'asc' ? 1 : -1, dateReported: -1 };
        break;
      case 'category':
        sortObject = { category: sortOrder === 'asc' ? 1 : -1, dateReported: -1 };
        break;
      case 'operatorName':
        sortObject = { operatorName: sortOrder === 'asc' ? 1 : -1 };
        break;
      case 'operatorBarangay':
        sortObject = { operatorBarangay: sortOrder === 'asc' ? 1 : -1, dateReported: -1 };
        break;
      case 'amountCharged':
        sortObject = { amountCharged: sortOrder === 'asc' ? 1 : -1 };
        break;
      default:
        sortObject = { dateReported: -1 };
    }

    if (sortBy === 'reportID') {
      const [reports, total] = await Promise.all([
        Report.aggregate([
          { $match: query },
          {
            $addFields: {
              reportNumber: {
                $toInt: { $substr: ['$reportID', 4, -1] }
              }
            }
          },
          { $sort: { reportNumber: sortOrder === 'asc' ? 1 : -1 } },
          { $skip: skip },
          { $limit: parseInt(limit) },
          { $project: { reportNumber: 0 } }
        ]),
        Report.countDocuments(query)
      ]);

      return {
        reports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    }

    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort(sortObject)
        .skip(skip)
        .limit(parseInt(limit)),
      Report.countDocuments(query)
    ]);

    return {
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('[Repo] Get error:', error.message);
    throw error;
  }
};

exports.getReportById = async (reportId) => {
  try {
    const report = await Report.findOne({ reportID: reportId });
    return report;
  } catch (error) {
    console.error('Error getting report by ID:', error);
    throw error;
  }
};

exports.updateReport = async (reportId, updateData) => {
  try {
    let query;
    if (reportId.match(/^[0-9a-fA-F]{24}$/)) {
      query = { _id: reportId };
    } else {
      query = { reportID: reportId };
    }
    
    const updatedReport = await Report.findOneAndUpdate(
      query,
      updateData,
      { new: true, runValidators: true }
    );
    return updatedReport;
  } catch (error) {
    console.error('Error updating report:', error);
    throw error;
  }
};

exports.deleteReport = async (reportId) => {
  try {
    const deletedReport = await Report.findOneAndDelete({ reportID: reportId });
    return deletedReport;
  } catch (error) {
    console.error('Error deleting report:', error);
    throw error;
  }
};

exports.getMonthlyReports = async (month, year) => {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const reports = await Report.find({
      dateReported: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ dateReported: -1 });

    return reports;
  } catch (error) {
    console.error('Error getting monthly reports:', error);
    throw error;
  }
};

exports.getReportsStatistics = async () => {
  try {
    const [
      totalReports,
      pendingReports,
      resolvedReports,
      investigatingReports,
      dismissedReports,
      categoryStats,
      barangayStats
    ] = await Promise.all([
      Report.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({ status: 'resolved' }),
      Report.countDocuments({ status: 'investigating' }),
      Report.countDocuments({ status: 'dismissed' }),
      Report.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      Report.aggregate([
        { $match: { operatorBarangay: { $ne: null, $ne: '' } } },
        { $group: { _id: '$operatorBarangay', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    const byCategory = {};
    categoryStats.forEach(stat => {
      byCategory[stat._id || 'overpricing'] = stat.count;
    });

    const byBarangay = {};
    barangayStats.forEach(stat => {
      byBarangay[stat._id] = stat.count;
    });

    return {
      total: totalReports,
      pending: pendingReports,
      resolved: resolvedReports,
      investigating: investigatingReports,
      dismissed: dismissedReports,
      byCategory,
      byBarangay
    };
  } catch (error) {
    console.error('Error getting reports statistics:', error);
    throw error;
  }
};

exports.getReportsByDateRange = async (startDate, endDate) => {
  try {
    const reports = await Report.find({
      dateReported: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ dateReported: -1 });

    return reports;
  } catch (error) {
    console.error('Error getting reports by date range:', error);
    throw error;
  }
};

exports.getReportsByCategory = async (category, options = {}) => {
  try {
    const { limit = 50, status, page = 1 } = options;
    const skip = (page - 1) * limit;
    
    const query = { category };
    if (status) query.status = status;
    
    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort({ dateReported: -1 })
        .skip(skip)
        .limit(limit),
      Report.countDocuments(query)
    ]);
      
    return {
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting reports by category:', error);
    throw error;
  }
};

exports.getReportsByFranchise = async (franchiseNumber, options = {}) => {
  try {
    const { limit = 50, page = 1 } = options;
    const skip = (page - 1) * limit;
    
    const [reports, total] = await Promise.all([
      Report.find({ franchiseNumber })
        .sort({ dateReported: -1 })
        .skip(skip)
        .limit(limit),
      Report.countDocuments({ franchiseNumber })
    ]);
      
    return {
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting reports by franchise:', error);
    throw error;
  }
};

exports.getReportsByBarangay = async (barangay, options = {}) => {
  try {
    const { limit = 50, status, category, page = 1 } = options;
    const skip = (page - 1) * limit;
    
    const query = { operatorBarangay: barangay };
    if (status) query.status = status;
    if (category) query.category = category;
    
    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort({ dateReported: -1 })
        .skip(skip)
        .limit(limit),
      Report.countDocuments(query)
    ]);
      
    return {
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting reports by barangay:', error);
    throw error;
  }
};

exports.getReportsByOperator = async (operatorName, options = {}) => {
  try {
    const { limit = 50, status, category, page = 1 } = options;
    const skip = (page - 1) * limit;
    
    const query = { operatorName: { $regex: operatorName, $options: 'i' } };
    if (status) query.status = status;
    if (category) query.category = category;
    
    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort({ dateReported: -1 })
        .skip(skip)
        .limit(limit),
      Report.countDocuments(query)
    ]);
      
    return {
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting reports by operator:', error);
    throw error;
  }
};

exports.getBarangaySummary = async () => {
  try {
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
    
    return summary.map(s => ({
      barangay: s._id,
      total: s.total,
      pending: s.pending,
      resolved: s.resolved,
      investigating: s.investigating,
      dismissed: s.dismissed
    }));
  } catch (error) {
    console.error('Error getting barangay summary:', error);
    throw error;
  }
};

exports.getCategorySummary = async () => {
  try {
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
    
    return summary.map(s => ({
      category: s._id || 'overpricing',
      total: s.total,
      pending: s.pending,
      resolved: s.resolved,
      investigating: s.investigating,
      dismissed: s.dismissed
    }));
  } catch (error) {
    console.error('Error getting category summary:', error);
    throw error;
  }
};

exports.getOperatorSummary = async (options = {}) => {
  try {
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
    
    return summary.map(s => ({
      operatorName: s._id.name,
      franchiseNumber: s._id.franchiseNumber,
      barangay: s._id.barangay,
      total: s.total,
      pending: s.pending,
      resolved: s.resolved
    }));
  } catch (error) {
    console.error('Error getting operator summary:', error);
    throw error;
  }
};