const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { apiLimiter } = require('../middlewares/rateLimiter');

// Apply rate limiting to all dashboard routes
router.use(apiLimiter);

/**
 * GET /api/dashboard/statistics
 * Get comprehensive dashboard statistics including KPIs and trends
 * Protected route - requires admin authentication
 */
router.get(
  '/statistics',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  dashboardController.getDashboardStatistics
);

/**
 * GET /api/dashboard/recent-applications
 * Get recent franchise applications for activity feed
 * Protected route - requires admin authentication
 */
router.get(
  '/recent-applications',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  dashboardController.getRecentApplications
);

/**
 * GET /api/dashboard/quick-stats
 * Get lightweight statistics for frequent polling
 * Protected route - requires admin authentication
 */
router.get(
  '/quick-stats',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  dashboardController.getQuickStats
);

/**
 * GET /api/dashboard/analytics
 * Get comprehensive analytics including franchise distribution by barangay
 * Protected route - requires admin authentication
 */
router.get(
  '/analytics',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  dashboardController.getAnalytics
);

/**
 * GET /api/dashboard/expiring-franchises
 * Get franchises expiring in a specific month/year
 * Query params: month (1-12), year (e.g., 2025)
 * Protected route - requires admin authentication
 */
router.get(
  '/expiring-franchises',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  dashboardController.getExpiringFranchises
);

module.exports = router;
