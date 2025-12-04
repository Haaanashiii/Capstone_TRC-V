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

module.exports = router;
