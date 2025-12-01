const FranchiseApplication = require('../models/franchiseApplicationModel');
const FranchiseInformation = require('../models/franchiseInformationModel');
const Report = require('../models/reportsModel');
const cacheManager = require('../utils/cache');

// Get main dashboard numbers (saved in memory for 5 minutes)
exports.getDashboardStatistics = async (req, res, next) => {
  try {
    // Get date range from query parameters, default to current week
    const startDate = req.query.startDate ? new Date(req.query.startDate) : (() => {
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
      return new Date(today.setDate(diff));
    })();
    
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    // Set start date to beginning of day and end date to end of day
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    // Create cache key based on date range
    const cacheKey = `dashboard-stats-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}`;
    const cachedStats = cacheManager.get(cacheKey);
    
    if (cachedStats) {
      console.log('[Dashboard] Returning cached data');
      return res.status(200).json({
        success: true,
        data: cachedStats,
        cached: true
      });
    }

    const currentDate = new Date();
    
    console.log('[Dashboard] Querying data from', startDate.toISOString(), 'to', endDate.toISOString());

    // Run all database queries at the same time (faster)
    const [
      totalRegisteredResult,
      expiredFranchiseResult,
      pendingVerificationsResult,
      pendingReportsResult,
      allFranchises
    ] = await Promise.all([
      // Count all franchises (current versions only)
      FranchiseInformation.countDocuments({ 
        isCurrentVersion: true 
      }),

      // Count expired franchises using franchiseStatus field
      FranchiseInformation.countDocuments({ 
        isCurrentVersion: true,
        franchiseStatus: 'Expired'
      }),

      // Count applications waiting for approval
      FranchiseApplication.countDocuments({
        $or: [
          { actionTaken: { $exists: false } },
          { actionTaken: null },
          { actionTaken: '' }
        ]
      }),

      // Count pending reports from public
      Report.countDocuments({ status: 'pending' }),

      // Get ALL current franchises
      FranchiseInformation.find({
        isCurrentVersion: true
      }).select('approvedAt createdAt operatorName franchiseStatus').lean()
    ]);

    console.log('[Dashboard] Total franchises found:', allFranchises.length);
    
    // Log all franchises to see what we have
    allFranchises.forEach((f, i) => {
      console.log(`[Dashboard] Franchise ${i + 1}:`, {
        name: f.operatorName,
        status: f.franchiseStatus,
        approvedAt: f.approvedAt,
        createdAt: f.createdAt
      });
    });

    // Filter franchises by createdAt date within range
    const franchisesInRange = allFranchises.filter(franchise => {
      // Use createdAt as the reference date (it always exists from timestamps)
      const referenceDate = new Date(franchise.createdAt);
      return referenceDate >= startDate && referenceDate <= endDate;
    });
    
    console.log('[Dashboard] Franchises in date range:', franchisesInRange.length);

    // Group franchises by date
    const franchisesByDate = {};
    
    franchisesInRange.forEach(franchise => {
      const dateKey = new Date(franchise.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!franchisesByDate[dateKey]) {
        franchisesByDate[dateKey] = {
          active: 0,
          expired: 0,
          revoked: 0,
          total: 0
        };
      }
      
      // Use franchiseStatus field to determine status
      const status = franchise.franchiseStatus;
      console.log(`[Dashboard] Franchise ${franchise.operatorName} has status: "${status}"`);
      
      if (status === 'Active') {
        franchisesByDate[dateKey].active++;
      } else if (status === 'Expired') {
        franchisesByDate[dateKey].expired++;
      } else if (status === 'Revoked') {
        franchisesByDate[dateKey].revoked++;
      }
      franchisesByDate[dateKey].total++;
    });
    
    // Convert to array and sort by date
    const trendData = Object.keys(franchisesByDate)
      .sort()
      .map(date => ({
        date,
        active: franchisesByDate[date].active,
        expired: franchisesByDate[date].expired,
        revoked: franchisesByDate[date].revoked || 0,
        total: franchisesByDate[date].total
      }));
    
    console.log('[Dashboard] Final trend data:', JSON.stringify(trendData, null, 2));

    // Calculate additional statistics
    const totalApplications = await FranchiseApplication.countDocuments();
    const approvalRate = totalApplications > 0 
      ? ((totalRegisteredResult / totalApplications) * 100).toFixed(1)
      : 0;

    // Get total active and expired in the selected range
    const totalActive = trendData.reduce((sum, item) => sum + item.active, 0);
    const totalExpired = trendData.reduce((sum, item) => sum + item.expired, 0);

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
        monthly: trendData,
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
    
    console.log('[Dashboard] Returning stats:', {
      kpis: statsData.kpis,
      trendDataCount: statsData.trends.monthly.length,
      currentPeriod: statsData.trends.currentMonth
    });

    // Cache the stats for 5 minutes to reduce database load
    cacheManager.set(cacheKey, statsData, 300);

    res.status(200).json({
      success: true,
      data: statsData
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
      .lean(); // Optimization: lean() for read-only queries

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
 * Lightweight endpoint for frequent polling - cached for 2 minutes
 */
exports.getQuickStats = async (req, res, next) => {
  try {
    // Check cache first (TTL: 2 minutes for more frequent updates)
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
        isCurrentVersion: true,
        expiryDate: { $lt: new Date() }
      }),
      Report.countDocuments({ status: 'pending' })
    ]);

    const quickStats = {
      totalRegistered,
      pendingVerifications,
      expiredFranchise,
      pendingReports
    };

    // Cache for 2 minutes
    cacheManager.set('quick-stats', quickStats, 120);

    res.status(200).json({
      success: true,
      data: quickStats
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
      // Total franchises count (only current versions)
      FranchiseInformation.countDocuments({ isCurrentVersion: true }),

      // Active franchises (not expired, only current versions)
      FranchiseInformation.countDocuments({ 
        isCurrentVersion: true,
        expiryDate: { $gte: currentDate }
      }),

      // Expired franchises (only current versions)
      FranchiseInformation.countDocuments({ 
        isCurrentVersion: true,
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
          $match: {
            isCurrentVersion: true
          }
        },
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
                  _id: '$operatorBarangay',
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
                  _id: '$operatorBarangay',
                  count: { $sum: 1 }
                }
              }
            ],
            // Get total franchises by barangay
            totalByBarangay: [
              {
                $group: {
                  _id: '$operatorBarangay',
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
