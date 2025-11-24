const express = require('express');
const router = express.Router();
const adminAccountController = require('../controllers/adminAccountController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

// GET all admin accounts (with optional includeInactive query param)
router.get('/', authenticate, authorize(['super-admin']), adminAccountController.getAllAdmins);

// GET admins by role
router.get('/role/:role', authenticate, authorize(['super-admin']), adminAccountController.getAdminsByRole);

// GET admin by ID
router.get('/:id', authenticate, authorize(['super-admin']), adminAccountController.getAdminById);

// POST create new admin account (super-admin only)
router.post('/', authenticate, authorize(['super-admin']), adminAccountController.createAdmin);

// PUT update admin account (super-admin only)
router.put('/:id', authenticate, authorize(['super-admin']), adminAccountController.updateAdmin);

// PATCH deactivate admin account (soft delete) - super-admin only
router.patch('/:id/deactivate', authenticate, authorize(['super-admin']), adminAccountController.deactivateAdmin);

// DELETE admin account (hard delete) - super-admin only
router.delete('/:id', authenticate, authorize(['super-admin']), adminAccountController.deleteAdmin);

// POST add permission to admin (super-admin only) - broadcasts via WebSocket
router.post('/:id/permissions', authenticate, authorize(['super-admin']), adminAccountController.addPermission);

// DELETE remove permission from admin (super-admin only) - broadcasts via WebSocket
router.delete('/:id/permissions', authenticate, authorize(['super-admin']), adminAccountController.removePermission);

module.exports = router;
