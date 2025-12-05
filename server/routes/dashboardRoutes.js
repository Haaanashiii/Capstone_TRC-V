const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { apiLimiter } = require('../middlewares/rateLimiter');

router.use(apiLimiter);

// Dashboard routes (Admin only)
router.get('/statistics', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), dashboardController.getDashboardStatistics);
router.get('/recent-applications', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), dashboardController.getRecentApplications);
router.get('/quick-stats', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), dashboardController.getQuickStats);
router.get('/analytics', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), dashboardController.getAnalytics);

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
