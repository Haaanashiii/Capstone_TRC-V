const FranchiseApplication = require('../models/franchiseApplicationModel');
const FranchiseInformation = require('../models/franchiseInformationModel');
const Report = require('../models/reportsModel');

/**
 * Get dashboard statistics
 * Optimized aggregation queries for dashboard KPIs
 */
exports.getDashboardStatistics = async (req, res, next) => {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Run all queries in parallel for optimal performance
    const [
      totalRegisteredResult,
      expiredFranchiseResult,
      pendingVerificationsResult,
      pendingReportsResult,
      monthlyTrendResult
    ] = await Promise.all([
      // Total Registered Units (from FranchiseInformation - actual registered franchises)
      FranchiseInformation.countDocuments(),

      // Expired Franchises (Registered franchises with past expiry dates)
      FranchiseInformation.countDocuments({ 
        expiryDate: { $lt: currentDate }
      }),

      // Pending Verifications (Applications without actionTaken)
      FranchiseApplication.countDocuments({
        $or: [
          { actionTaken: { $exists: false } },
          { actionTaken: null },
          { actionTaken: '' }
        ]
      }),

      // Pending Reports (Reports with pending status)
      Report.countDocuments({ status: 'pending' }),

      // Monthly Trend Data - Registered franchises by month (current year)
      FranchiseInformation.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(currentYear, 0, 1), // Start of current year
              $lte: new Date(currentYear, 11, 31, 23, 59, 59) // End of current year
            }
          }
        },
        {
          $group: {
            _id: { $month: '$createdAt' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ])
    ]);

    // Transform monthly trend data to array format
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrend = monthNames.map((month, index) => {
      const monthData = monthlyTrendResult.find(m => m._id === index + 1);
      return {
        month,
        verifications: monthData ? monthData.count : 0
      };
    });

    // Calculate additional statistics
    const totalApplications = await FranchiseApplication.countDocuments();
    const approvalRate = totalApplications > 0 
      ? ((totalRegisteredResult / totalApplications) * 100).toFixed(1)
      : 0;

    // Get current month statistics for comparison (from FranchiseInformation)
    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    
    const currentMonthApplications = await FranchiseInformation.countDocuments({
      createdAt: {
        $gte: currentMonthStart,
        $lte: currentMonthEnd
      }
    });

    // Previous month for trend calculation
    const prevMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const prevMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    
    const prevMonthApplications = await FranchiseInformation.countDocuments({
      createdAt: {
        $gte: prevMonthStart,
        $lte: prevMonthEnd
      }
    });

    const monthlyTrendPercentage = prevMonthApplications > 0
      ? (((currentMonthApplications - prevMonthApplications) / prevMonthApplications) * 100).toFixed(1)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        kpis: {
          totalRegistered: totalRegisteredResult,
          expiredFranchise: expiredFranchiseResult,
          pendingVerifications: pendingVerificationsResult,
          pendingReports: pendingReportsResult,
          totalApplications,
          approvalRate: parseFloat(approvalRate)
        },
        trends: {
          monthly: monthlyTrend,
          currentMonth: {
            applications: currentMonthApplications,
            change: parseFloat(monthlyTrendPercentage),
            month: monthNames[currentMonth],
            year: currentYear
          }
        },
        timestamp: currentDate.toISOString()
      }
    });
  } catch (error) {
    console.error('[Dashboard] Error fetching statistics:', error);
    next(error);
  }
};

/**
 * Get recent applications for dashboard activity feed
 * @param {number} limit - Number of recent applications to fetch (default: 5)
 */
exports.getRecentApplications = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const recentApplications = await FranchiseApplication.find()
      .sort({ submittedAt: -1 })
      .limit(limit)
      .select('operatorName actionType submittedAt actionTaken')
      .lean();

    res.status(200).json({
      success: true,
      data: recentApplications
    });
  } catch (error) {
    console.error('[Dashboard] Error fetching recent applications:', error);
    next(error);
  }
};

/**
 * Get quick statistics for admin overview
 * Lightweight endpoint for frequent polling
 */
exports.getQuickStats = async (req, res, next) => {
  try {
    const [totalRegistered, pendingVerifications, expiredFranchise, pendingReports] = await Promise.all([
      FranchiseApplication.countDocuments({ 
        actionTaken: { $exists: true, $ne: null, $ne: '' }
      }),
      FranchiseApplication.countDocuments({
        $or: [
          { actionTaken: { $exists: false } },
          { actionTaken: null },
          { actionTaken: '' }
        ]
      }),
      FranchiseInformation.countDocuments({ 
        expiryDate: { $lt: new Date() }
      }),
      Report.countDocuments({ status: 'pending' })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalRegistered,
        pendingVerifications,
        expiredFranchise,
        pendingReports
      }
    });
  } catch (error) {
    console.error('[Dashboard] Error fetching quick stats:', error);
    next(error);
  }
};

/**
 * Get analytics data for franchise distribution by barangay
 * Provides comprehensive analytics including total, active, and expired franchises per barangay
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const currentDate = new Date();

    // Run all queries in parallel for optimal performance
    const [
      totalFranchises,
      activeFranchises,
      expiredFranchises,
      pendingApplications,
      barangayStats
    ] = await Promise.all([
      // Total franchises count
      FranchiseInformation.countDocuments(),

      // Active franchises (not expired)
      FranchiseInformation.countDocuments({ 
        expiryDate: { $gte: currentDate }
      }),

      // Expired franchises
      FranchiseInformation.countDocuments({ 
        expiryDate: { $lt: currentDate }
      }),

      // Pending applications
      FranchiseApplication.countDocuments({
        $or: [
          { actionTaken: { $exists: false } },
          { actionTaken: null },
          { actionTaken: '' }
        ]
      }),

      // Barangay-wise franchise distribution
      FranchiseInformation.aggregate([
        {
          $facet: {
            // Get active franchises by barangay
            activeByBarangay: [
              {
                $match: {
                  expiryDate: { $gte: currentDate }
                }
              },
              {
                $group: {
                  _id: '$barangay',
                  count: { $sum: 1 }
                }
              }
            ],
            // Get expired franchises by barangay
            expiredByBarangay: [
              {
                $match: {
                  expiryDate: { $lt: currentDate }
                }
              },
              {
                $group: {
                  _id: '$barangay',
                  count: { $sum: 1 }
                }
              }
            ],
            // Get total franchises by barangay
            totalByBarangay: [
              {
                $group: {
                  _id: '$barangay',
                  count: { $sum: 1 }
                }
              }
            ]
          }
        }
      ])
    ]);

    // Process barangay statistics
    const barangayMap = new Map();

    // Extract results from aggregation
    const { activeByBarangay, expiredByBarangay, totalByBarangay } = barangayStats[0] || {
      activeByBarangay: [],
      expiredByBarangay: [],
      totalByBarangay: []
    };

    // Initialize map with total counts
    totalByBarangay.forEach(item => {
      if (item._id) {
        barangayMap.set(item._id, {
          barangay: item._id,
          active: 0,
          expired: 0,
          total: item.count
        });
      }
    });

    // Add active counts
    activeByBarangay.forEach(item => {
      if (item._id && barangayMap.has(item._id)) {
        barangayMap.get(item._id).active = item.count;
      }
    });

    // Add expired counts
    expiredByBarangay.forEach(item => {
      if (item._id && barangayMap.has(item._id)) {
        barangayMap.get(item._id).expired = item.count;
      }
    });

    // Convert map to array and sort by active count (descending)
    const barangayData = Array.from(barangayMap.values())
      .sort((a, b) => b.active - a.active);

    res.status(200).json({
      success: true,
      data: {
        totalFranchises,
        activeFranchises,
        expiredFranchises,
        pendingApplications,
        barangayData
      },
      timestamp: currentDate.toISOString()
    });
  } catch (error) {
    console.error('[Dashboard] Error fetching analytics:', error);
    next(error);
  }
};
