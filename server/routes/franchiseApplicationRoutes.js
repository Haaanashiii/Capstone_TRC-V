const express = require('express');
const router = express.Router();
const controller = require('../controllers/franchiseApplicationController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const upload = require('../middlewares/upload');

// USER ROUTES - Franchise application submission and management
router.post('/new-application', authenticate, authorize(['user']), upload.uploadOperatorDocuments, controller.createNewApplication);
router.get('/pending', authenticate, authorize(['user']), controller.getPendingFranchises);
router.get('/pending/:id', authenticate, authorize(['user']), controller.getSpecificPendingFranchise);
router.put('/pending/:id', authenticate, authorize(['user']), upload.uploadOperatorDocuments, controller.editPendingFranchise);
router.post('/renew-amend', authenticate, authorize(['user']), upload.uploadOperatorDocuments, controller.createRenewOrAmendment);
router.put('/approved/:id/add-receipt', authenticate, authorize(['user']), upload.uploadOperatorDocuments, controller.editApprovedFranchise);

// BPLO ADMIN ROUTES - Review and approve applications
router.get('/bplo/pending-websocket', authenticate, authorize(['bplo-admin', 'sb-admin', 'super-admin']), controller.getFranchisesWithWebSocketIO);
router.put('/bplo/approve/:id', authenticate, authorize(['bplo-admin', 'super-admin']), controller.approveFranchiseByBPLO);
router.put('/bplo/disapprove/:id', authenticate, authorize(['bplo-admin', 'super-admin']), controller.disapproveFranchiseByBPLO);

// SB ADMIN ROUTES - Final acceptance and franchise creation
router.get('/sb/approved-websocket', authenticate, authorize(['sb-admin', 'super-admin']), controller.getApprovedRoutesForSBAdmin);
router.put('/sb/approve/:id', authenticate, authorize(['sb-admin', 'super-admin']), upload.uploadOperatorDocuments, controller.approveFranchiseBySBAdmin);
router.post('/sb/accept-new/:id', authenticate, authorize(['sb-admin', 'super-admin']), upload.uploadOperatorDocuments, controller.sbAdminAcceptNewFranchise);
router.post('/sb/accept-renew-amend/:id', authenticate, authorize(['sb-admin', 'super-admin']), upload.uploadOperatorDocuments, controller.sbAdminAcceptRenewOrAmendment);

// LEGACY ROUTES (backward compatibility)
router.post('/', authenticate, upload.uploadOperatorDocuments, controller.createFranchiseApplication);
router.get('/', controller.getAllFranchiseApplications);
router.get('/mine', authenticate, controller.getMyFranchiseApplication);
router.get('/proxy-file', controller.proxyCloudflareFile);
router.get('/:id', controller.getFranchiseApplication);
router.put('/:id', controller.updateFranchiseApplication);
router.put('/:id/approve', controller.approveFranchiseApplication);
router.delete('/:id', controller.deleteFranchiseApplication);

module.exports = router;
