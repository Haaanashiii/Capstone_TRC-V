const mongoose = require('mongoose');

// Define audit log schema
const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: { type: String },
  details: { type: Object },
  ipAddress: { type: String },
  userAgent: { type: String },
  status: { type: String, enum: ['success', 'failure'], required: true },
  timestamp: { type: Date, default: Date.now }
});

// Create model
const AuditLog = mongoose.model('AuditLog', auditLogSchema);


class AuditLogService {
  /**
   * Log a security-sensitive operation
   * @param {Object} logData - Data to log
   * @param {string} logData.userId - ID of the user performing the action
   * @param {string} logData.action - Action being performed (e.g., 'login', 'approve_application')
   * @param {string} logData.resource - Resource being accessed (e.g., 'user', 'application')
   * @param {string} logData.resourceId - ID of the resource
   * @param {Object} logData.details - Additional details about the action
   * @param {string} logData.ipAddress - IP address of the request
   * @param {string} logData.userAgent - User agent of the request
   * @param {string} logData.status - Status of the action ('success' or 'failure')
   * @returns {Promise<Object>} - The created log entry
   */
  async log(logData) {
    try {
      const auditLog = new AuditLog({
        userId: logData.userId,
        action: logData.action,
        resource: logData.resource,
        resourceId: logData.resourceId,
        details: logData.details,
        ipAddress: logData.ipAddress,
        userAgent: logData.userAgent,
        status: logData.status || 'success',
        timestamp: new Date()
      });

      return await auditLog.save();
    } catch (error) {
      console.error('Audit logging error:', error);
      // Don't throw - audit logging should never break the application
      return null;
    }
  }

  /**
   * Create middleware to automatically log requests
   * @param {Object} options - Options for the middleware
   * @returns {Function} - Express middleware function
   */
  createLogMiddleware(options = {}) {
  const defaultOptions = {
    excludePaths: ['/health', '/metrics'],
    logBody: false,
    redactFields: []
  };

  const config = { ...defaultOptions, ...options };

  // Helper to redact sensitive fields if needed
  function redact(obj, fields = []) {
    if (!obj || !fields.length) return obj;
    const clone = { ...obj };
    for (const field of fields) {
      if (clone[field]) clone[field] = '[REDACTED]';
    }
    return clone;
  }

  return (req, res, next) => {
    // Skip logging for excluded paths
    if (config.excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    res.once('finish', () => {
      const logData = {
        userId: req.user ? (req.user._id || req.user.id) : undefined,
        action: req.method,
        resource: req.path,
        resourceId: req.params?.id || Object.values(req.params || {})[0],
        details: {
          query: req.query,
          body: config.logBody ? redact(req.body, config.redactFields) : undefined,
          statusCode: res.statusCode
        },
        ipAddress:
          (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) ||
          req.ip ||
          req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        status: res.statusCode >= 400 ? 'failure' : 'success'
      };
      this.log(logData).catch(err => {
        console.error('Failed to log request:', err);
      });
    });

    next();
  };
}


  /**
   * Log authentication events
   * @param {Object} user - User object
   * @param {string} action - Action (login, logout, etc.)
   * @param {boolean} success - Whether the action was successful
   * @param {Object} req - Express request object
   */
  async logAuth(user, action, success, req) {
    const logData = {
      userId: user ? user._id : null,
      action,
      resource: 'auth',
      details: {
        username: user ? user.username : req.body.username
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      status: success ? 'success' : 'failure'
    };

    return this.log(logData);
  }

  /**
   * Log application status changes
   * @param {Object} application - Application object
   * @param {string} action - Action (approve, reject, etc.)
   * @param {Object} user - User who performed the action
   * @param {Object} req - Express request object
   */
  async logApplicationAction(application, action, user, req) {
    const logData = {
      userId: user.id,
      action,
      resource: 'application',
      resourceId: application._id.toString(),
      details: {
        status: application.status,
        plateNumber: application.plateNumber,
        franchiseId: application.franchiseId
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      status: 'success'
    };

    return this.log(logData);
  }
}

module.exports = {
  AuditLog,
  auditLogService: new AuditLogService()
};