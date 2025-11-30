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
 * Proxy Cloudflare R2 files to bypass CORS restrictions
 * PUBLIC - Used for driver pictures in QR verification
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
 * GET /franchise-information/history/:franchiseNumber
 * Get FULL HISTORY of a specific franchise number (ALL OWNERS)
 * PROTECTED - Admin only
 * 
 * Returns:
 * - All versions of the franchise number (all owners who had it)
 * - Grouped by franchiseChainId (shows ownership changes)
 * - Includes revoked franchises (important when number was recycled)
 * - Sorted chronologically (oldest to newest)
 * 
 * CRITICAL: Shows ALL owners of a franchise number, including:
 * - Original owner's versions (current or revoked)
 * - New owner's versions (if number was recycled)
 * 
 * Example:
 * - /franchise-information/history/0001 → All owners of franchise #0001
 */
router.get(
  '/history/:franchiseNumber',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  franchiseInformationController.getFranchiseHistory
);

/**
 * GET /franchise-information/chain/:franchiseChainId
 * Get FULL HISTORY of a specific FRANCHISE CHAIN (ONE OWNER ONLY)
 * PROTECTED - Admin only
 * 
 * Returns:
 * - All versions of this specific franchise chain
 * - Tied to ONE user/operator (never shared, never recycled)
 * - Includes revoked franchises (shows complete lifecycle)
 * - Sorted by version (oldest to newest)
 * 
 * CRITICAL: Each franchiseChainId belongs to ONE user forever
 * - When franchise is revoked after 3+ years, chain stays with user
 * - When franchise number is recycled to new user, they get NEW chain
 * 
 * Example:
 * - /franchise-information/chain/user-123-1609459200
 * - Shows User 123's franchise: creation → renewals → amendments → expiry → revoke
 */
router.get(
  '/chain/:franchiseChainId',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  franchiseInformationController.getFranchiseChainHistory
);

/**
 * GET /franchise-information/available-numbers
 * Get available franchise numbers for new applications
 * PROTECTED - Admin only
 * 
 * Returns:
 * - Available numbers (revoked + expired 3+ years)
 * - Next suggested number
 * - Statistics
 */
router.get(
  '/available-numbers',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  franchiseInformationController.getAvailableFranchiseNumbers
);

/**
 * GET /franchise-information/by-user/:userId
 * Get all active franchises for a specific user
 * PROTECTED - User must be authenticated
 * 
 * Returns:
 * - All current franchises linked to the user
 * - Only current versions (isCurrentVersion: true)
 * - Sorted by franchise number
 */
router.get(
  '/by-user/:userId',
  authenticate,
  franchiseInformationController.getFranchisesByUser
);

/**
 * POST /franchise-information/link
 * Link existing franchise to operator account
 * PROTECTED - Operator only
 * 
 * Body:
 * - franchiseNumber: Franchise number to link
 * - mtofDocument: (Optional) MTOF document file
 * 
 * Returns:
 * - Linked franchise information
 */
router.post(
  '/link',
  authenticate,
  authorize(['operator']),
  franchiseInformationController.linkFranchise
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

module.exports = router;
