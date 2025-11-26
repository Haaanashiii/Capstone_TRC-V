const express = require('express');
const router = express.Router();
const rolePageAccessController = require('../controllers/rolePageAccessController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

/**
 * GET /api/role-page-access
 * Get all role page access configurations
 * Protected: Super admin only
 */
router.get(
  '/',
  authenticate,
  authorize(['super-admin']),
  rolePageAccessController.getAllPageAccess
);

/**
 * GET /api/role-page-access/:role
 * Get page access configuration for a specific role
 * Protected: All admins can check their own role's access
 */
router.get(
  '/:role',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  rolePageAccessController.getPageAccessByRole
);

/**
 * PUT /api/role-page-access/:role
 * Update page access for a specific role
 * Protected: Super admin only
 * Broadcasts via WebSocket to all admin rooms
 */
router.put(
  '/:role',
  authenticate,
  authorize(['super-admin']),
  rolePageAccessController.updatePageAccess
);

/**
 * POST /api/role-page-access/:role/reset
 * Reset page access to default for a specific role
 * Protected: Super admin only
 * Broadcasts via WebSocket to all admin rooms
 */
router.post(
  '/:role/reset',
  authenticate,
  authorize(['super-admin']),
  rolePageAccessController.resetPageAccessToDefault
);

/**
 * GET /api/role-page-access/:role/check/:pageKey
 * Check if a role has access to a specific page
 * Protected: All authenticated users
 */
router.get(
  '/:role/check/:pageKey',
  authenticate,
  rolePageAccessController.checkPageAccess
);

module.exports = router;
