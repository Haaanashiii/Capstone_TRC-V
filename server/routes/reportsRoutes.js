const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { apiLimiter, publicReportLimiter } = require('../middlewares/rateLimiter');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

// Public route for submitting reports - Strict rate limiting (5 per hour)
router.post('/public', publicReportLimiter, reportsController.createPublicReport);

// Apply rate limiting to all other routes
router.use(apiLimiter);

// Basic CRUD routes (require authentication)
router.post('/', authenticate, reportsController.createReport);
router.get('/', authenticate, reportsController.getAllReports);
router.get('/statistics', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getReportsStatistics);

// Monthly reports with CSV export (admin only)
router.get('/monthly', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getMonthlyReports);

// Date range reports with CSV export (admin only)
router.get('/date-range', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getReportsByDateRange);

// Note: Certificate endpoints have been moved to /api/certificates/*
// See certificateRoutes.js for certificate generation functionality

// Individual report operations
router.get('/:id', authenticate, reportsController.getReportById);
router.put('/:id', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.updateReport);
router.delete('/:id', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.deleteReport);

module.exports = router;