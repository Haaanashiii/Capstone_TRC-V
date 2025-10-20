
const Report = require('../models/reportsModel');

/**
 * Create a new report
 * @param {Object} reportData - Report data
 * @returns {Promise<Object>} Created report
 */
exports.createReport = async (reportData) => {
  try {
    const report = new Report(reportData);
    const savedReport = await report.save();
    return savedReport;
  } catch (error) {
    console.error('Error creating report:', error);
    throw error;
  }
};

/**
 * Get all reports with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.search - Search term
 * @param {string} options.status - Filter by status
 * @returns {Promise<Object>} Reports with pagination info
 */
exports.getAllReports = async (options = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = ''
    } = options;

    const skip = (page - 1) * limit;
    
    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { reportID: { $regex: search, $options: 'i' } },
        { franchiseeName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
    }

    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort({ createdAt: -1 })
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
    console.error('Error getting reports:', error);
    throw error;
  }
};

/**
 * Get a single report by reportID (RPT-XXXX format)
 * @param {string} reportId - Report ID
 * @returns {Promise<Object|null>} Report or null if not found
 */
exports.getReportById = async (reportId) => {
  try {
    const report = await Report.findOne({ reportID: reportId });
    return report;
  } catch (error) {
    console.error('Error getting report by ID:', error);
    throw error;
  }
};

/**
 * Update a report
 * @param {string} reportId - Report ID
 * @param {Object} updateData - Update data
 * @returns {Promise<Object|null>} Updated report or null if not found
 */
exports.updateReport = async (reportId, updateData) => {
  try {
    const updatedReport = await Report.findOneAndUpdate(
      { reportID: reportId },
      updateData,
      { new: true, runValidators: true }
    );
    return updatedReport;
  } catch (error) {
    console.error('Error updating report:', error);
    throw error;
  }
};

/**
 * Delete a report
 * @param {string} reportId - Report ID
 * @returns {Promise<Object|null>} Deleted report or null if not found
 */
exports.deleteReport = async (reportId) => {
  try {
    const deletedReport = await Report.findOneAndDelete({ reportID: reportId });
    return deletedReport;
  } catch (error) {
    console.error('Error deleting report:', error);
    throw error;
  }
};

/**
 * Get reports for a specific month and year
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Promise<Array>} Array of reports
 */
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

/**
 * Get reports statistics
 * @returns {Promise<Object>} Report statistics
 */
exports.getReportsStatistics = async () => {
  try {
    const [
      totalReports,
      pendingReports,
      resolvedReports,
      investigatingReports,
      dismissedReports
    ] = await Promise.all([
      Report.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({ status: 'resolved' }),
      Report.countDocuments({ status: 'investigating' }),
      Report.countDocuments({ status: 'dismissed' })
    ]);

    return {
      total: totalReports,
      pending: pendingReports,
      resolved: resolvedReports,
      investigating: investigatingReports,
      dismissed: dismissedReports
    };
  } catch (error) {
    console.error('Error getting reports statistics:', error);
    throw error;
  }
};

/**
 * Get reports by date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Array of reports
 */
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

