const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { apiLimiter, publicReportLimiter } = require('../middlewares/rateLimiter');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

// ====================================================================
// TRICYCLE INCIDENT REPORTING ROUTES
// ====================================================================

// Public route for getting incident categories (no auth required)
router.get('/categories', reportsController.getCategories);

// Public route for submitting incident reports - Strict rate limiting (5 per hour)
// NO authentication required, just public report limiter
router.post('/public', publicReportLimiter, reportsController.createPublicReport);

// Apply rate limiting to authenticated routes only
router.use(apiLimiter);
router.use(authenticate);

// Basic CRUD routes (require authentication)
router.post('/', reportsController.createReport);
router.get('/', reportsController.getAllReports);
router.get('/statistics', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getReportsStatistics);

// Monthly incident reports with CSV export (admin only)
router.get('/monthly', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getMonthlyReports);

// Date range incident reports with CSV export (admin only)
router.get('/date-range', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getReportsByDateRange);

// Individual incident report operations
router.get('/:id', reportsController.getReportById);
router.put('/:id', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.updateReport);
router.delete('/:id', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.deleteReport);

module.exports = router;