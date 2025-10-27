const express = require('express');
const router = express.Router();
const operatorInformationController = require('../controllers/operatorInformationController');
const { combinedQrRateLimiter } = require('../middlewares/qrRateLimiter');
const { sanitizeRequest } = require('../middlewares/validateRequest');
const { uploadOperatorComplete, handleMulterError } = require('../middlewares/upload');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

/**
 * POST /operators
 * Create new operator with profile photo, documents, and auto-generate QR code
 * Protected route - requires authentication
 */
router.post(
  '/',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  uploadOperatorComplete,
  handleMulterError,
  sanitizeRequest,
  operatorInformationController.createOperatorInformation
);

/**
 * GET /operators/:id
 * Get operator information by ID
 * Protected route
 */
router.get(
  '/:id',
  authenticate,
  operatorInformationController.getOperatorInformation
);

/**
 * PUT /operators/:id
 * Update operator information
 * Protected route
 */
router.put(
  '/:id',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  operatorInformationController.updateOperatorInformation
);

/**
 * DELETE /operators/:id
 * Delete operator information
 * Protected route
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  operatorInformationController.deleteOperatorInformation
);

/**
 * POST /operators/:operatorId/regenerate-qr
 * Regenerate QR code for an operator
 * Protected route
 */
router.post(
  '/:operatorId/regenerate-qr',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  operatorInformationController.regenerateQRCode
);

/**
 * GET /operators/qr/:operatorId
 * Public endpoint for QR code scanning
 * Returns operator's public information: driversID, name, address, franchise status
 * 
 * Security Features:
 * - Per-IP rate limiting: Max 10 scans per minute per IP
 * - Per-QR-ID rate limiting: Max 3 scans per 30 seconds per QR code
 * - Input sanitization
 */
router.get(
  '/qr/:operatorId',
  combinedQrRateLimiter,
  sanitizeRequest,
  operatorInformationController.operatorQRIDLookup
);

module.exports = router;
