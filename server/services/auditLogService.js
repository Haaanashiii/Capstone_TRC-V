const mongoose = require('mongoose');

// Define audit log schema with comprehensive tracking
const auditLogSchema = new mongoose.Schema({
  // User Identification (from JWT token)
  userId: { type: String, required: true, index: true }, // UUID from JWT 'id' field
  username: { type: String, required: true }, // Username from JWT
  email: { type: String }, // Email from JWT
  
  // Role & Account Type (from JWT)
  role: { type: String, required: true, enum: ['operator', 'sb-admin', 'bplo-admin', 'super-admin'] },
  accountType: { type: String, enum: ['user', 'admin'], default: 'user' },
  
  // Admin-specific fields (from JWT if applicable)
  adminId: { type: String }, // Admin UUID from JWT
  department: { type: String }, // Admin department from JWT
  position: { type: String }, // Admin position from JWT
  
  // Request Information
  method: { type: String, required: true }, // GET, POST, PUT, DELETE, etc.
  route: { type: String, required: true }, // Full route path (e.g., /api/franchise-information/qr/hash/xyz)
  action: { type: String, required: true }, // Human-readable action (e.g., 'GET_FRANCHISE_QR', 'LOGIN', 'APPROVE_APPLICATION')
  
  // Response Information
  statusCode: { type: Number, required: true },
  success: { type: Boolean, required: true }, // true if statusCode < 400
  
  // Request Details
  requestBody: { type: Object }, // Sanitized request body (passwords redacted)
  responseStatus: { type: String }, // e.g., 'success', 'failure', 'error'
  errorMessage: { type: String }, // Error message if failed
  
  // Resource Being Accessed
  resourceType: { type: String }, // e.g., 'franchise', 'application', 'user', 'auth'
  resourceId: { type: String }, // UUID or ID of the resource being accessed
  
  // Network Information
  ipAddress: { type: String, required: true, index: true },
  userAgent: { type: String },
  
  // Timestamp
  createdAt: { type: Date, default: Date.now, index: true },
  
  // Additional Context
  details: { type: Object } // Extra details about the action
}, { collection: 'audit_logs' });

// Create indexes for efficient querying
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ role: 1, createdAt: -1 });
auditLogSchema.index({ route: 1, createdAt: -1 });
auditLogSchema.index({ success: 1, createdAt: -1 });
auditLogSchema.index({ ipAddress: 1, createdAt: -1 });

// Create model
const AuditLog = mongoose.model('AuditLog', auditLogSchema);


class AuditLogService {
  /**
   * Helper to sanitize sensitive fields in request body
   */
  sanitizeRequestBody(body) {
    if (!body) return null;
    const clone = { ...body };
    const sensitiveFields = ['password', 'passwordConfirm', 'otp', 'token', 'refreshToken', 'accessToken', 'creditCard'];
    for (const field of sensitiveFields) {
      if (clone[field]) clone[field] = '[REDACTED]';
    }
    return clone;
  }

  /**
   * Log a user/admin action based on JWT claims
   * @param {Object} options - Logging options
   * @param {Object} options.user - JWT decoded user data (from req.user after auth middleware)
   * @param {string} options.method - HTTP method (GET, POST, etc.)
   * @param {string} options.route - Full request route path
   * @param {string} options.action - Human-readable action name
   * @param {number} options.statusCode - HTTP response status code
   * @param {string} options.ipAddress - Client IP address
   * @param {string} options.userAgent - Client user agent
   * @param {Object} options.requestBody - Request body (will be sanitized)
   * @param {string} options.resourceType - Type of resource being accessed
   * @param {string} options.resourceId - ID of resource being accessed
   * @param {string} options.errorMessage - Error message if request failed
   * @param {Object} options.details - Additional context details
   * @returns {Promise<Object>} - The created audit log entry
   */
  async logAction(options) {
    try {
      const {
        user,
        method,
        route,
        action,
        statusCode,
        ipAddress,
        userAgent,
        requestBody,
        resourceType,
        resourceId,
        errorMessage,
        details
      } = options;

      if (!user) {
        console.warn('[AuditLog] No user data provided');
        return null;
      }

      // Extract user information from JWT (UUID only)
      const userId = user.id || user.userId; // Use UUID from JWT
      const username = user.username || user.email || 'Unknown';
      const role = user.role || 'unknown';
      const accountType = user.accountType || 'user';
      const email = user.email;

      // Check if this is an admin account and extract admin info from JWT
      const isAdmin = accountType === 'admin';
      const adminId = isAdmin ? (user.adminId || user.id || user.userId) : null; // Use UUID for admin
      const department = isAdmin ? user.department : null;
      const position = isAdmin ? user.position : null;

      const success = statusCode < 400;

      const auditLog = new AuditLog({
        userId,
        username,
        email,
        role,
        accountType,
        adminId,
        department,
        position,
        method: method.toUpperCase(),
        route,
        action,
        statusCode,
        success,
        requestBody: this.sanitizeRequestBody(requestBody),
        responseStatus: success ? 'success' : 'failure',
        errorMessage,
        resourceType,
        resourceId,
        ipAddress,
        userAgent,
        details,
        createdAt: new Date()
      });

      await auditLog.save();
      console.log(`[AuditLog] Action logged: ${username} (${role}) - ${method} ${route} - Status: ${statusCode}`);
      return auditLog;
    } catch (error) {
      console.error('[AuditLog] Error logging action:', error.message);
      // Don't throw - audit logging should never break the application
      return null;
    }
  }

  /**
   * Create middleware to automatically log all requests
   * @param {Object} options - Middleware options
   * @returns {Function} - Express middleware
   */
  createAuditMiddleware(options = {}) {
    const defaultOptions = {
      excludePaths: ['/health', '/metrics', '/api/audit-logs'], // Don't log audit log queries
      logRequestBody: false,
      logResponseBody: false
    };

    const config = { ...defaultOptions, ...options };

    return (req, res, next) => {
      // Skip logging for excluded paths
      if (config.excludePaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      // Capture response finish to log after response is sent
      res.once('finish', async () => {
        try {
          if (!req.user) {
            // Skip logging unauthenticated requests (or log differently)
            return;
          }

          // Determine action name from method and route
          const actionName = this.generateActionName(req.method, req.path);

          // Extract resource info from params
          const resourceId = req.params?.id || req.params?.franchiseId || req.params?.userId;
          const resourceType = this.extractResourceType(req.path);

          await this.logAction({
            user: req.user,
            method: req.method,
            route: req.path,
            action: actionName,
            statusCode: res.statusCode,
            ipAddress: req.ip || req.connection?.remoteAddress || 'Unknown',
            userAgent: req.headers['user-agent'],
            requestBody: config.logRequestBody ? req.body : null,
            resourceType,
            resourceId,
            details: {
              query: req.query,
              params: req.params
            }
          });
        } catch (error) {
          console.error('[AuditLog] Middleware error:', error.message);
          // Don't fail the request
        }
      });

      next();
    };
  }

  /**
   * Generate human-readable action name from HTTP method and route
   */
  generateActionName(method, path) {
    // Remove query strings
    const cleanPath = path.split('?')[0];
    
    // Extract meaningful parts
    const parts = cleanPath.split('/').filter(p => p && !p.match(/^[a-f0-9-]{36}$/)); // Filter UUIDs
    
    if (cleanPath.includes('/auth/')) {
      if (method === 'POST' && cleanPath.includes('login')) return 'LOGIN';
      if (method === 'POST' && cleanPath.includes('logout')) return 'LOGOUT';
      if (method === 'POST' && cleanPath.includes('signup')) return 'SIGNUP';
      if (method === 'POST' && cleanPath.includes('verify-otp')) return 'VERIFY_OTP';
      if (method === 'POST' && cleanPath.includes('reset-password')) return 'RESET_PASSWORD';
    }
    
    if (cleanPath.includes('/franchise')) {
      if (method === 'GET') return 'GET_FRANCHISE_INFO';
      if (method === 'POST') return 'CREATE_FRANCHISE';
      if (method === 'PUT') return 'UPDATE_FRANCHISE';
      if (method === 'DELETE') return 'DELETE_FRANCHISE';
    }
    
    if (cleanPath.includes('/application')) {
      if (method === 'GET') return 'GET_APPLICATION';
      if (method === 'POST') return 'CREATE_APPLICATION';
      if (method === 'PUT') return 'UPDATE_APPLICATION';
    }
    
    // Generic fallback
    return `${method}_${parts.join('_').toUpperCase()}`;
  }

  /**
   * Extract resource type from route path
   */
  extractResourceType(path) {
    if (path.includes('/franchise')) return 'franchise';
    if (path.includes('/application')) return 'application';
    if (path.includes('/user')) return 'user';
    if (path.includes('/admin')) return 'admin';
    if (path.includes('/auth')) return 'auth';
    if (path.includes('/qr')) return 'qr_code';
    return 'unknown';
  }

  /**
   * Get audit logs with filtering
   * @param {Object} filter - Filter options
   * @returns {Promise<Array>} - Array of audit logs
   */
  async getLogs(filter = {}) {
    try {
      const {
        userId,
        role,
        startDate,
        endDate,
        success,
        route,
        action,
        limit = 100,
        skip = 0,
        sortBy = 'createdAt',
        sortOrder = -1
      } = filter;

      const query = {};

      if (userId) query.userId = userId;
      if (role) query.role = role;
      if (success !== undefined) query.success = success;
      if (route) query.route = { $regex: route, $options: 'i' };
      if (action) query.action = action;

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const logs = await AuditLog.find(query)
        .sort({ [sortBy]: sortOrder })
        .limit(limit)
        .skip(skip)
        .exec();

      return logs;
    } catch (error) {
      console.error('[AuditLog] Error retrieving logs:', error.message);
      return [];
    }
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(filter = {}) {
    try {
      const { userId, role, startDate, endDate } = filter;

      const query = {};
      if (userId) query.userId = userId;
      if (role) query.role = role;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const stats = await AuditLog.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalActions: { $sum: 1 },
            successCount: { $sum: { $cond: ['$success', 1, 0] } },
            failureCount: { $sum: { $cond: ['$success', 0, 1] } },
            uniqueUsers: { $addToSet: '$userId' },
            uniqueRoles: { $addToSet: '$role' }
          }
        },
        {
          $project: {
            totalActions: 1,
            successCount: 1,
            failureCount: 1,
            successRate: { $multiply: [{ $divide: ['$successCount', '$totalActions'] }, 100] },
            uniqueUserCount: { $size: '$uniqueUsers' },
            uniqueRoles: 1
          }
        }
      ]);

      return stats[0] || null;
    } catch (error) {
      console.error('[AuditLog] Error calculating statistics:', error.message);
      return null;
    }
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(user, action, success, req, errorMessage = null) {
    return this.logAction({
      user,
      method: 'POST',
      route: `/api/auth/${action.toLowerCase()}`,
      action: action.toUpperCase(),
      statusCode: success ? 200 : 401,
      ipAddress: req.ip || req.connection?.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'],
      resourceType: 'auth',
      errorMessage: success ? null : errorMessage,
      details: {
        email: user.email,
        authProvider: user.oauthProvider || 'local'
      }
    });
  }

  /**
   * Log application approval/rejection
   */
  async logApplicationAction(application, action, user, req, adminNotes = null) {
    return this.logAction({
      user,
      method: 'PUT',
      route: `/api/franchise-application/${application._id}/${action.toLowerCase()}`,
      action: `${action.toUpperCase()}_APPLICATION`,
      statusCode: 200,
      ipAddress: req.ip || req.connection?.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'],
      resourceType: 'application',
      resourceId: application._id.toString(),
      details: {
        applicantName: application.operatorName,
        applicantEmail: application.operatorEmail,
        actionNotes: adminNotes,
        previousStatus: application.status
      }
    });
  }
}

module.exports = {
  AuditLog,
  auditLogService: new AuditLogService()
};