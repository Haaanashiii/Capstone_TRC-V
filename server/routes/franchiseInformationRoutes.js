const express = require('express');
const router = express.Router();
const franchiseInformationController = require('../controllers/franchiseInformationController');
const { combinedQrRateLimiter } = require('../middlewares/qrRateLimiter');
const { sanitizeRequest } = require('../middlewares/validateRequest');
const { uploadOperatorComplete, handleMulterError } = require('../middlewares/upload');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

// Proxy route to fetch Cloudflare files (must come before /:id to avoid conflict)
router.get('/proxy-file', franchiseInformationController.proxyCloudflareFile);

/**
 * GET /franchise-information
 * Get all franchise information records
 */
router.get('/', franchiseInformationController.getAllFranchiseInformation);

/**
 * POST /franchise-information
 * Create new franchise with profile photo, documents, and auto-generate QR code
 * Protected route - requires authentication
 */
router.post(
  '/',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  uploadOperatorComplete,
  handleMulterError,
  sanitizeRequest,
  franchiseInformationController.createFranchiseInformation
);

/**
 * GET /franchise-information/:id
 * Get franchise information by ID
 * Protected route
 */
router.get(
  '/:id',
  authenticate,
  franchiseInformationController.getFranchiseInformation
);

/**
 * PUT /franchise-information/:id
 * Update franchise information
 * Protected route
 */
router.put(
  '/:id',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  franchiseInformationController.updateFranchiseInformation
);

/**
 * DELETE /franchise-information/:id
 * Delete franchise information
 * Protected route
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  franchiseInformationController.deleteFranchiseInformation
);

/**
 * POST /franchise-information/:franchiseId/regenerate-qr
 * Regenerate QR code for a franchise
 * Protected route
 */
router.post(
  '/:franchiseId/regenerate-qr',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  franchiseInformationController.regenerateQRCode
);

/**
 * GET /franchise-information/qr/hash/:hashedMTOP
 * Public endpoint for QR code scanning with hashed MTOP
 * This is the PRIMARY endpoint that new QR codes link to
 * 
 * Security Features:
 * - Per-IP rate limiting: Max 10 scans per minute per IP
 * - Per-QR-ID rate limiting: Max 3 scans per 30 seconds per QR code
 * - Input sanitization
 * - Hashed MTOP prevents enumeration attacks
 */
router.get(
  '/qr/hash/:hashedMTOP',
  combinedQrRateLimiter,
  sanitizeRequest,
  franchiseInformationController.franchiseQRLookupByHash
);

/**
 * GET /franchise-information/qr/:franchiseId
 * Legacy: Public endpoint for QR code scanning (backward compatibility)
 * Returns franchise's public information: driversID, name, address, franchise status
 * 
 * Security Features:
 * - Per-IP rate limiting: Max 10 scans per minute per IP
 * - Per-QR-ID rate limiting: Max 3 scans per 30 seconds per QR code
 * - Input sanitization
 */
router.get(
  '/qr/:franchiseId',
  combinedQrRateLimiter,
  sanitizeRequest,
  franchiseInformationController.franchiseQRIDLookup
);

module.exports = router;
