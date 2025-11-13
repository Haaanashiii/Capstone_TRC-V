const express = require('express');
const router = express.Router();
const adminAccountController = require('../controllers/adminAccountController');

// GET all admin accounts (with optional includeInactive query param)
router.get('/', adminAccountController.getAllAdmins);

// GET admins by role
router.get('/role/:role', adminAccountController.getAdminsByRole);

// GET admin by ID
router.get('/:id', adminAccountController.getAdminById);

// POST create new admin account
router.post('/', adminAccountController.createAdmin);

// PUT update admin account
router.put('/:id', adminAccountController.updateAdmin);

// PATCH deactivate admin account (soft delete)
router.patch('/:id/deactivate', adminAccountController.deactivateAdmin);

// DELETE admin account (hard delete)
router.delete('/:id', adminAccountController.deleteAdmin);

// POST add permission to admin
router.post('/:id/permissions', adminAccountController.addPermission);

// DELETE remove permission from admin
router.delete('/:id/permissions', adminAccountController.removePermission);

module.exports = router;
