const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { apiLimiter, publicReportLimiter } = require('../middlewares/rateLimiter');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

// Public route for submitting reports - Strict rate limiting (5 per hour)
// NO authentication required, just public report limiter
router.post('/public', publicReportLimiter, reportsController.createPublicReport);

// Apply rate limiting to authenticated routes only
router.use(apiLimiter);
router.use(authenticate);

// Basic CRUD routes (require authentication)
router.post('/', reportsController.createReport);
router.get('/', reportsController.getAllReports);
router.get('/statistics', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getReportsStatistics);

// Monthly reports with CSV export (admin only)
router.get('/monthly', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getMonthlyReports);

// Date range reports with CSV export (admin only)
router.get('/date-range', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getReportsByDateRange);

// Note: Certificate endpoints have been moved to /api/certificates/*
// See certificateRoutes.js for certificate generation functionality

// Individual report operations
router.get('/:id', reportsController.getReportById);
router.put('/:id', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.updateReport);
router.delete('/:id', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.deleteReport);

module.exports = router;