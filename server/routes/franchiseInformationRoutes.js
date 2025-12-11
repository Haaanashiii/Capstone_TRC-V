const express = require('express');
const router = express.Router();
const franchiseInformationController = require('../controllers/franchiseInformationController');
const { combinedQrRateLimiter } = require('../middlewares/qrRateLimiter');
const { sanitizeRequest } = require('../middlewares/validateRequest');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

// === PUBLIC ROUTES ===
router.get('/proxy-file', franchiseInformationController.proxyFile);
router.get('/qr/hash/:hashedMTOP', combinedQrRateLimiter, sanitizeRequest, franchiseInformationController.franchiseQRLookupByHash);

// === PROTECTED ROUTES (Admin) ===
router.get('/', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), franchiseInformationController.getAllFranchiseInformation);
router.get('/search', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), franchiseInformationController.searchFranchiseInformation);
router.get('/history/:franchiseNumber', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), franchiseInformationController.getFranchiseHistory);
router.get('/chain/:franchiseChainId', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), franchiseInformationController.getFranchiseChainHistory);
router.get('/available-numbers', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), franchiseInformationController.getAvailableFranchiseNumbers);
router.get('/by-user/:userId', authenticate, franchiseInformationController.getFranchisesByUser);
router.post('/link', authenticate, authorize(['operator']), franchiseInformationController.linkFranchise);
router.get('/:id', authenticate, authorize(['sb-admin', 'bplo-admin', 'super-admin']), franchiseInformationController.getFranchiseInformation);

/**
 * PUT /franchise-information/:id
 * Update franchise information
 * PROTECTED - Admin only (sb-admin, super-admin)
 * 
 * Body: Updated franchise fields (operatorName, address, contact, etc.)
 * Returns: Updated franchise information
 */
router.put(
  '/:id',
  authenticate,
  authorize(['sb-admin', 'super-admin']),
  franchiseInformationController.updateFranchiseInformation
);

module.exports = router;
