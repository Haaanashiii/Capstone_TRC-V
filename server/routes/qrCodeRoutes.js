/**
 * QR Code Routes
 * REST API endpoints for QR code management
 */

const express = require('express');
const router = express.Router();
const qrCodeController = require('../controllers/qrCodeController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

// ============================================================================
// ADMIN ROUTES (Protected - requires authentication and admin role)
// ============================================================================

/**
 * Generate QR code for operator
 * POST /api/qr/generate/operator/:operatorId
 * 
 * Example: POST /api/qr/generate/operator/0cd5aae6-2ea9-4701-a225-64299bce5a47
 * Body: { "saveToFile": true } (optional)
 */
router.post(
  '/generate/operator/:operatorId',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  qrCodeController.generateOperatorQRCode
);

/**
 * Regenerate QR code for operator (replaces old one)
 * PUT /api/qr/regenerate/operator/:operatorId
 * 
 * Example: PUT /api/qr/regenerate/operator/0cd5aae6-2ea9-4701-a225-64299bce5a47
 */
router.put(
  '/regenerate/operator/:operatorId',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  qrCodeController.regenerateOperatorQRCode
);

/**
 * Delete QR code for operator
 * DELETE /api/qr/operator/:operatorId
 * 
 * Example: DELETE /api/qr/operator/0cd5aae6-2ea9-4701-a225-64299bce5a47
 */
router.delete(
  '/operator/:operatorId',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  qrCodeController.deleteOperatorQRCode
);

/**
 * Get operator's QR code info
 * GET /api/qr/operator/:operatorId
 * 
 * Example: GET /api/qr/operator/0cd5aae6-2ea9-4701-a225-64299bce5a47
 */
router.get(
  '/operator/:operatorId',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  qrCodeController.getOperatorQRCode
);

/**
 * Get all operators with QR codes
 * GET /api/qr/operators
 * 
 * Example: GET /api/qr/operators
 */
router.get(
  '/operators',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  qrCodeController.getAllOperatorsWithQR
);

/**
 * Generate QR code for franchise application
 * POST /api/qr/generate/franchise/:applicationId
 * 
 * Example: POST /api/qr/generate/franchise/abc123def456
 */
router.post(
  '/generate/franchise/:applicationId',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  qrCodeController.generateFranchiseQRCode
);

/**
 * Download QR code as PNG file
 * GET /api/qr/download/operator/:operatorId
 * 
 * Example: GET /api/qr/download/operator/0cd5aae6-2ea9-4701-a225-64299bce5a47
 */
router.get(
  '/download/operator/:operatorId',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  qrCodeController.downloadOperatorQRCode
);

module.exports = router;
