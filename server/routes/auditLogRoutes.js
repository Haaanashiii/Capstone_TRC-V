const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { auditLogService } = require('../services/auditLogService');

/**
 * GET /api/audit-logs
 * Retrieve audit logs with filtering
 * Protected: Only admins can view audit logs
 */
router.get(
  '/',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  async (req, res, next) => {
    try {
      const {
        userId,
        role,
        startDate,
        endDate,
        success,
        route,
        action,
        page = 1,
        limit = 50,
        sort = 'createdAt',
        order = 'desc'
      } = req.query;

      const skip = (page - 1) * limit;
      const sortOrder = order === 'asc' ? 1 : -1;

      const logs = await auditLogService.getLogs({
        userId,
        role,
        startDate,
        endDate,
        success: success === 'true' ? true : success === 'false' ? false : undefined,
        route,
        action,
        limit: parseInt(limit),
        skip: parseInt(skip),
        sortBy: sort,
        sortOrder
      });

      res.json({
        success: true,
        data: logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: logs.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/audit-logs/statistics
 * Get audit log statistics
 * Protected: Only admins can view statistics
 */
router.get(
  '/statistics',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  async (req, res, next) => {
    try {
      const { userId, role, startDate, endDate } = req.query;

      const stats = await auditLogService.getStatistics({
        userId,
        role,
        startDate,
        endDate
      });

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/audit-logs/user/:userId
 * Get audit logs for a specific user
 * Protected: Only admins or the user themselves can view their logs
 */
router.get(
  '/user/:userId',
  authenticate,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Allow users to view their own logs, admins can view any
      if (req.user.role !== 'operator' && req.user.id !== userId) {
        return res.status(403).json({ error: 'Unauthorized access to audit logs' });
      }

      const skip = (page - 1) * limit;

      const logs = await auditLogService.getLogs({
        userId,
        limit: parseInt(limit),
        skip: parseInt(skip),
        sortOrder: -1
      });

      res.json({
        success: true,
        data: logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/audit-logs/admin/:adminId
 * Get audit logs for a specific admin
 * Protected: Only super-admins or the admin themselves can view
 */
router.get(
  '/admin/:adminId',
  authenticate,
  async (req, res, next) => {
    try {
      const { adminId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Allow admins to view their own logs, super-admins can view any
      if (req.user.accountType !== 'admin' || (req.user.role !== 'super-admin' && req.user.adminId !== adminId)) {
        return res.status(403).json({ error: 'Unauthorized access to admin audit logs' });
      }

      const skip = (page - 1) * limit;

      const logs = await auditLogService.getLogs({
        adminId,
        limit: parseInt(limit),
        skip: parseInt(skip),
        sortOrder: -1
      });

      res.json({
        success: true,
        data: logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/audit-logs/activity/:route
 * Get all activity on a specific route
 * Protected: Only admins
 */
router.get(
  '/activity/:route',
  authenticate,
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  async (req, res, next) => {
    try {
      const { route } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const skip = (page - 1) * limit;

      const logs = await auditLogService.getLogs({
        route,
        limit: parseInt(limit),
        skip: parseInt(skip),
        sortOrder: -1
      });

      res.json({
        success: true,
        data: logs,
        route,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
