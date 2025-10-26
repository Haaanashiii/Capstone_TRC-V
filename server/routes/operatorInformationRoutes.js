const express = require('express');
const router = express.Router();
const operatorInformationController = require('../controllers/operatorInformationController');
const { combinedQrRateLimiter } = require('../middlewares/qrRateLimiter');
const { sanitizeRequest } = require('../middlewares/validateRequest');

/**
 * GET /api/operators/:operatorId
 * Public endpoint for QR code scanning
 * Returns operator's public information: driversID, name, address, franchise status
 * 
 * Security Features:
 * - Per-IP rate limiting: Max 10 scans per minute per IP
 * - Per-QR-ID rate limiting: Max 3 scans per 30 seconds per QR code
 * - Input sanitization
 */
router.get(
  '/operators/:operatorId',
  combinedQrRateLimiter,
  sanitizeRequest,
  operatorInformationController.operatorQRIDLookup
);

module.exports = router;
