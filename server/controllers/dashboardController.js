const FranchiseApplication = require('../models/franchiseApplicationModel');
const FranchiseInformation = require('../models/franchiseInformationModel');
const Report = require('../models/reportsModel');
const cacheManager = require('../utils/cache');

// Get dashboard statistics (uses aggregation pipeline, cached 5min)
exports.getDashboardStatistics = async (req, res, next) => {
  try {
    // Get date range from query parameters, default to current week
    const startDate = req.query.startDate ? new Date(req.query.startDate) : (() => {
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(today.setDate(diff));
    })();
    
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    // Cache key based on date range
    const cacheKey = `dashboard-stats-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}`;
    const cachedStats = cacheManager.get(cacheKey);
    
    if (cachedStats) {
      return res.status(200).json({
        success: true,
        data: cachedStats,
        cached: true
      });
    }

    const currentDate = new Date();

    // Run all queries in parallel
    const [
      totalRegisteredResult,
      expiredFranchiseResult,
      pendingVerificationsResult,
      pendingReportsResult,
      totalApplications,
      trendAggregation
    ] = await Promise.all([
      FranchiseInformation.countDocuments({ isCurrentVersion: true }),
      FranchiseInformation.countDocuments({ isCurrentVersion: true, franchiseStatus: 'Expired' }),
      FranchiseApplication.countDocuments({ statusOfBPLO: 'pending' }),
      Report.countDocuments({ status: 'pending' }),
      FranchiseApplication.countDocuments(),
      
      // Trend aggregation - groups by date in DB
      FranchiseInformation.aggregate([
        { $match: { isCurrentVersion: true, createdAt: { $gte: startDate, $lte: endDate } } },
        { $project: { dateKey: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, franchiseStatus: 1 } },
        {
          $group: {
            _id: '$dateKey',
            active: { $sum: { $cond: [{ $eq: ['$franchiseStatus', 'Active'] }, 1, 0] } },
            expired: { $sum: { $cond: [{ $eq: ['$franchiseStatus', 'Expired'] }, 1, 0] } },
            revoked: { $sum: { $cond: [{ $eq: ['$franchiseStatus', 'Revoked'] }, 1, 0] } },
            total: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', active: 1, expired: 1, revoked: 1, total: 1 } }
      ])
    ]);

    const approvalRate = totalApplications > 0 
      ? ((totalRegisteredResult / totalApplications) * 100).toFixed(1)
      : 0;

    const totalActive = trendAggregation.reduce((sum, item) => sum + item.active, 0);
    const totalExpired = trendAggregation.reduce((sum, item) => sum + item.expired, 0);

    const statsData = {
      kpis: {
        totalRegistered: totalRegisteredResult,
        expiredFranchise: expiredFranchiseResult,
        pendingVerifications: pendingVerificationsResult,
        pendingReports: pendingReportsResult,
        totalApplications,
        approvalRate: parseFloat(approvalRate)
      },
      trends: {
        monthly: trendAggregation,
        currentMonth: {
          active: totalActive,
          expired: totalExpired,
          total: totalActive + totalExpired,
          change: 0
        }
      },
      timestamp: currentDate.toISOString(),
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    };

    // Cache for 5 minutes
    cacheManager.set(cacheKey, statsData, 300);

    res.status(200).json({
      success: true,
      data: statsData
    });
  } catch (error) {
    console.error('[Dashboard] Error:', error.message);
    next(error);
  }
};

// Get recent applications (capped at 20)
exports.getRecentApplications = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);

    const recentApplications = await FranchiseApplication.find()
      .sort({ submittedAt: -1 })
      .limit(limit)
      .select('operatorName applicationType submittedAt statusOfBPLO franchiseNumber')
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

// Quick stats for polling (cached 2min)
exports.getQuickStats = async (req, res, next) => {
  try {
    const cacheKey = 'quick-stats';
    const cachedStats = cacheManager.get(cacheKey);
    
    if (cachedStats) {
      return res.status(200).json({
        success: true,
        data: cachedStats,
        cached: true
      });
    }

    const [totalRegistered, pendingVerifications, expiredFranchise, pendingReports] = await Promise.all([
      FranchiseInformation.countDocuments({ isCurrentVersion: true }),
      FranchiseApplication.countDocuments({ statusOfBPLO: 'pending' }),
      FranchiseInformation.countDocuments({ 
        isCurrentVersion: true,
        franchiseStatus: 'Expired'
      }),
      Report.countDocuments({ status: 'pending' })
    ]);

    const quickStats = {
      totalRegistered,
      pendingVerifications,
      expiredFranchise,
      pendingReports
    };

    cacheManager.set(cacheKey, quickStats, 120);

    res.status(200).json({
      success: true,
      data: quickStats
    });
  } catch (error) {
    console.error('[Dashboard] Error fetching quick stats:', error);
    next(error);
  }
};

// Analytics - franchise distribution by barangay (cached 10min)
exports.getAnalytics = async (req, res, next) => {
  try {
    const cacheKey = 'dashboard-analytics';
    const cachedAnalytics = cacheManager.get(cacheKey);
    
    if (cachedAnalytics) {
      return res.status(200).json({
        success: true,
        data: cachedAnalytics,
        cached: true
      });
    }

    const currentDate = new Date();

    const [aggregationResult] = await Promise.all([
      FranchiseInformation.aggregate([
        { $match: { isCurrentVersion: true } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  active: { $sum: { $cond: [{ $eq: ['$franchiseStatus', 'Active'] }, 1, 0] } },
                  expired: { $sum: { $cond: [{ $eq: ['$franchiseStatus', 'Expired'] }, 1, 0] } },
                  revoked: { $sum: { $cond: [{ $eq: ['$franchiseStatus', 'Revoked'] }, 1, 0] } }
                }
              }
            ],
            byBarangay: [
              {
                $group: {
                  _id: '$operatorBarangay',
                  total: { $sum: 1 },
                  active: { $sum: { $cond: [{ $eq: ['$franchiseStatus', 'Active'] }, 1, 0] } },
                  expired: { $sum: { $cond: [{ $eq: ['$franchiseStatus', 'Expired'] }, 1, 0] } }
                }
              },
              { $sort: { active: -1 } },
              { $limit: 50 }
            ]
          }
        }
      ])
    ]);

    const pendingApplications = await FranchiseApplication.countDocuments({ statusOfBPLO: 'pending' });
    const totals = aggregationResult.totals[0] || { total: 0, active: 0, expired: 0, revoked: 0 };
    const barangayData = aggregationResult.byBarangay.map(b => ({
      barangay: b._id || 'Unknown',
      total: b.total,
      active: b.active,
      expired: b.expired
    }));

    const analyticsData = {
      totalFranchises: totals.total,
      activeFranchises: totals.active,
      expiredFranchises: totals.expired,
      revokedFranchises: totals.revoked,
      pendingApplications,
      barangayData
    };

    cacheManager.set(cacheKey, analyticsData, 600);

    res.status(200).json({
      success: true,
      data: analyticsData,
      timestamp: currentDate.toISOString()
    });
  } catch (error) {
    console.error('[Dashboard] Error fetching analytics:', error);
    next(error);
  }
};
