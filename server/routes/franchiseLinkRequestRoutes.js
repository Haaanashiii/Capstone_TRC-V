const express = require('express');
const router = express.Router();
const franchiseLinkRequestController = require('../controllers/franchiseLinkRequestController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const multer = require('multer');
const upload = require('../middlewares/upload');

// Configure multer for single document upload
const documentUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimes = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf']
    };
    if (allowedMimes[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // Max 10MB
  }
});

/**
 * Franchise Link Request Routes
 * 
 * Handles franchise linking requests from operators (submit + track)
 * and admin actions (review, approve, reject)
 */

// === OPERATOR ROUTES ===

/**
 * POST /api/franchise-link-requests
 * Create a new link request (Operator)
 * Requires: franchiseNumber in body, optional supportingDocument file
 */
router.post(
  '/',
  authenticate,
  authorize(['operator', 'user']),
  documentUpload.single('supportingDocument'),
  franchiseLinkRequestController.createLinkRequest
);

/**
 * GET /api/franchise-link-requests/my-requests
 * Get operator's own link requests
 */
router.get(
  '/my-requests',
  authenticate,
  authorize(['operator', 'user']),
  franchiseLinkRequestController.getMyRequests
);

// === ADMIN ROUTES (SB-Admin and Super-Admin only) ===

/**
 * GET /api/franchise-link-requests/statistics
 * Get link request statistics (Admin)
 */
router.get(
  '/statistics',
  authenticate,
  authorize(['sb-admin', 'super-admin']),
  franchiseLinkRequestController.getStatistics
);

/**
 * GET /api/franchise-link-requests/pending
 * Get all pending link requests (Admin)
 */
router.get(
  '/pending',
  authenticate,
  authorize(['sb-admin', 'super-admin']),
  franchiseLinkRequestController.getPendingRequests
);

/**
 * GET /api/franchise-link-requests/pending-count
 * Get pending count for badge (Admin)
 */
router.get(
  '/pending-count',
  authenticate,
  authorize(['sb-admin', 'super-admin']),
  franchiseLinkRequestController.getPendingCount
);

/**
 * GET /api/franchise-link-requests
 * Get all link requests with filters (Admin)
 * Query params: page, limit, status, search, sortBy, sortOrder
 */
router.get(
  '/',
  authenticate,
  authorize(['sb-admin', 'super-admin']),
  franchiseLinkRequestController.getAllRequests
);

/**
 * GET /api/franchise-link-requests/:id
 * Get single link request by ID (Admin)
 */
router.get(
  '/:id',
  authenticate,
  authorize(['sb-admin', 'super-admin']),
  franchiseLinkRequestController.getRequestById
);

/**
 * POST /api/franchise-link-requests/:id/approve
 * Approve a link request (Admin)
 * Body: { adminNotes? }
 */
router.post(
  '/:id/approve',
  authenticate,
  authorize(['sb-admin', 'super-admin']),
  franchiseLinkRequestController.approveRequest
);

/**
 * POST /api/franchise-link-requests/:id/reject
 * Reject a link request (Admin)
 * Body: { rejectionReason, adminNotes? }
 */
router.post(
  '/:id/reject',
  authenticate,
  authorize(['sb-admin', 'super-admin']),
  franchiseLinkRequestController.rejectRequest
);

module.exports = router;
