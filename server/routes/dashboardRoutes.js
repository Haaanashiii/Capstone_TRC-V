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

module.exports = router;
