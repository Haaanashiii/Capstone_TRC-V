const express = require('express');
const router = express.Router();
const franchiseApplicationController = require('../controllers/franchiseApplicationController');
const authenticate = require('../middlewares/authenticate');
const upload = require('../middlewares/upload');

// Accept multipart/form-data for application creation (documents)
// REQUIRED authentication: Must be logged in as operator to submit application
// This ensures userId is always captured and linked to the application
router.post('/', authenticate, upload.uploadOperatorDocuments, franchiseApplicationController.createFranchiseApplication);
router.get('/', franchiseApplicationController.getAllFranchiseApplications);
router.get('/mine', authenticate, franchiseApplicationController.getMyFranchiseApplication);

// Proxy route to fetch Cloudflare files (must come before /:id to avoid conflict)
router.get('/proxy-file', franchiseApplicationController.proxyCloudflareFile);

router.get('/:id', franchiseApplicationController.getFranchiseApplication);
router.put('/:id', franchiseApplicationController.updateFranchiseApplication);
router.put('/:id/approve', franchiseApplicationController.approveFranchiseApplication);
router.delete('/:id', franchiseApplicationController.deleteFranchiseApplication);

module.exports = router;