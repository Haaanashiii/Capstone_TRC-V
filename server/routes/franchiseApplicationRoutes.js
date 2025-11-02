const express = require('express');
const router = express.Router();
const franchiseApplicationController = require('../controllers/franchiseApplicationController');

router.post('/', franchiseApplicationController.createFranchiseApplication);
router.get('/', franchiseApplicationController.getAllFranchiseApplications);
router.get('/:id', franchiseApplicationController.getFranchiseApplication);
router.put('/:id', franchiseApplicationController.updateFranchiseApplication);
router.put('/:id/approve', franchiseApplicationController.approveFranchiseApplication);
router.delete('/:id', franchiseApplicationController.deleteFranchiseApplication);

module.exports = router;