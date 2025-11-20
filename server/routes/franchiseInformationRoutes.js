const express = require('express');
const router = express.Router();
const franchiseInformationController = require('../controllers/franchiseInformationController');
const { combinedQrRateLimiter } = require('../middlewares/qrRateLimiter');
const { sanitizeRequest } = require('../middlewares/validateRequest');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

// ========================================
// PUBLIC ROUTES (No Authentication)
// ========================================

/**
 * GET /franchise-information/proxy-file?url=...
 * Proxy Cloudflare R2 files through backend (bypasses CORS)
 * PUBLIC - Used by QR verification pages to display driver pictures
 */
router.get('/proxy-file', franchiseInformationController.proxyCloudflareFile);

/**
 * GET /franchise-information/qr/hash/:hashedMTOP
 * PRIMARY QR code verification endpoint - returns DRIVER details
 * PUBLIC - Rate limited, shows driver info for verification
 * 
 * Security: Rate limited (10/min per IP, 3/30sec per QR)
 * Returns: Driver name, picture, address, vehicle info, franchise status
 */
router.get(
  '/qr/hash/:hashedMTOP',
  combinedQrRateLimiter,
  sanitizeRequest,
  franchiseInformationController.franchiseQRLookupByHash
);

/**
 * GET /franchise-information/qr/:franchiseId
 * LEGACY QR code endpoint (backward compatibility)
 * PUBLIC - Rate limited
 * ⚠️ DEPRECATED - Old QR codes only, use /qr/hash/:hashedMTOP for new QR codes
 */
router.get(
  '/qr/:franchiseId',
  combinedQrRateLimiter,
  sanitizeRequest,
  franchiseInformationController.franchiseQRIDLookup
);

// ========================================
// PROTECTED ROUTES (Authentication Required)
// ========================================

/**
 * GET /franchise-information
 * Get all current franchise records with WebSocket notifications
 * PROTECTED - Admin only
 */
router.get(
  '/',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  franchiseInformationController.getAllFranchiseInformation
);

/**
 * GET /franchise-information/search?q=...
 * Smart search: Name (letters only) OR Franchise Number (with numbers)
 * Returns all versions matching the search criteria
 * PROTECTED - Admin only
 * 
 * Examples:
 * - /franchise-information/search?q=Juan      → Searches by name
 * - /franchise-information/search?q=F-2024-001 → Searches by franchise number
 */
router.get(
  '/search',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  franchiseInformationController.searchFranchiseInformation
);

/**
 * GET /franchise-information/:id
 * Get specific franchise by ID (any version)
 * PROTECTED - Admin only
 */
router.get(
  '/:id',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  franchiseInformationController.getFranchiseInformation
);

/**
 * POST /franchise-information/:franchiseId/regenerate-qr
 * Regenerate QR code for existing franchise
 * PROTECTED - Admin only
 */
router.post(
  '/:franchiseId/regenerate-qr',
  authenticate,
  authorize(['sb-admin', 'bplo-admin']),
  franchiseInformationController.regenerateQRCode
);

module.exports = router;
