const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { apiLimiter, publicReportLimiter } = require('../middlewares/rateLimiter');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

// Public routes
router.post('/public', publicReportLimiter, reportsController.createPublicReport);
router.get('/categories', reportsController.getReportCategories);

router.use(apiLimiter);
router.use(authenticate);

// Reports CRUD
router.post('/', reportsController.createReport);
router.get('/', reportsController.getAllReports);

// Summary/Statistics endpoints
router.get('/statistics', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getReportsStatistics);
router.get('/summary/barangay', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getBarangaySummary);
router.get('/summary/category', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getCategorySummary);
router.get('/summary/operator', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getOperatorSummary);

// Filter endpoints
router.get('/monthly', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getMonthlyReports);
router.get('/date-range', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getReportsByDateRange);
router.get('/by-barangay/:barangay', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getReportsByBarangay);
router.get('/by-category/:category', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getReportsByCategory);
router.get('/by-operator/:operatorName', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.getReportsByOperator);

// Single report operations
router.get('/:id', reportsController.getReportById);
router.put('/:id', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.updateReport);
router.delete('/:id', authorize(['sb-admin', 'bplo-admin', 'super-admin']), reportsController.deleteReport);

module.exports = router;