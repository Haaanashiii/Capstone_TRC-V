const mongoose = require('mongoose');
const { getClientIp } = require('../utils/ipHelper');

// Define audit log schema with comprehensive tracking
const auditLogSchema = new mongoose.Schema({
  // User Identification (from JWT token)
  userId: { type: String, required: true, index: true }, // UUID from JWT 'id' field
  username: { type: String, required: true }, // Username from JWT
  name: { type: String }, // Actual full name of the user
  email: { type: String }, // Email from JWT
  
  // Role & Account Type (from JWT)
  role: { type: String, required: true, enum: ['operator', 'sb-admin', 'bplo-admin', 'super-admin'] },
  accountType: { type: String, enum: ['user', 'admin'], default: 'user' },
  
  
  adminId: { type: String }, // Admin UUID from JWT
  department: { type: String }, // Admin department from JWT
  position: { type: String }, // Admin position from JWT
  
  // Request Information
  method: { type: String, required: true }, // GET, POST, PUT, DELETE, etc.
  route: { type: String, required: true }, // Full route path (e.g., /api/franchise-information/qr/hash/xyz)
  action: { type: String, required: true }, // Human-readable action (e.g., 'USER_LOGIN', 'USER_LOGOUT', 'CREATE_APPLICATION')
  description: { type: String }, // Simple, readable description for admins
  
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
  browser: { type: String }, // Parsed browser name
  device: { type: String }, // Desktop/Mobile/Tablet
  
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
   * Helper to parse browser and device from user agent
   */
  parseUserAgent(userAgent) {
    if (!userAgent) return { browser: 'Unknown', device: 'Unknown' };
    
    // Parse browser
    let browser = 'Unknown';
    if (userAgent.includes('Chrome')) browser = 'Google Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Mozilla Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Microsoft Edge';
    else if (userAgent.includes('Opera')) browser = 'Opera';
    
    // Parse device
    let device = 'Desktop';
    if (userAgent.includes('Mobile')) device = 'Mobile';
    else if (userAgent.includes('Tablet')) device = 'Tablet';
    
    return { browser, device };
  }

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
   * @param {string} options.description - Simple readable description for admins
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
        description,
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
        console.warn('[Audit] No user data provided');
        return null;
      }

      // Extract user information from JWT (UUID only)
      const userId = user.id || user.userId; // Use UUID from JWT
      const username = user.username || user.email || 'Unknown';
      const name = user.name || username; // Actual full name
      const role = user.role || 'unknown';
      const accountType = user.accountType || 'user';
      const email = user.email;

      // Check if this is an admin account and extract admin info from JWT
      const isAdmin = accountType === 'admin';
      const adminId = isAdmin ? (user.adminId || user.id || user.userId) : null; // Use UUID for admin
      const department = isAdmin ? user.department : null;
      const position = isAdmin ? user.position : null;

      const success = statusCode < 400;
      
      // Parse user agent for browser and device info
      const { browser, device } = this.parseUserAgent(userAgent);

      const auditLog = new AuditLog({
        userId,
        username,
        name,
        email,
        role,
        accountType,
        adminId,
        department,
        position,
        method: method.toUpperCase(),
        route,
        action,
        description: description || this.generateDescription(action, details, name),
        statusCode,
        success,
        requestBody: this.sanitizeRequestBody(requestBody),
        responseStatus: success ? 'success' : 'failure',
        errorMessage,
        resourceType,
        resourceId,
        ipAddress,
        userAgent,
        browser,
        device,
        details,
        createdAt: new Date()
      });

      await auditLog.save();
      console.log(`[Audit] ${name} - ${action}`);
      return auditLog;
    } catch (error) {
      console.error('[Audit] Error:', error.message);
      // Don't throw - audit logging should never break the application
      return null;
    }
  }

  /**
   * Generate simple, readable description from action and details
   */
  generateDescription(action, details, userName) {
    const name = userName || 'User';
    
    switch (action) {
      case 'USER_LOGIN':
        return `${name} logged in${details?.browser ? ` via ${details.browser}` : ''}`;
      case 'USER_LOGOUT':
        return `${name} logged out`;
      case 'USER_SIGNUP':
        return `${name} created a new account`;
      case 'CREATE_APPLICATION':
        return `${name} submitted a new franchise application${details?.applicantName ? ` for ${details.applicantName}` : ''}`;
      case 'EDIT_APPLICATION':
        return `${name} edited franchise application${details?.applicantName ? ` for ${details.applicantName}` : ''}`;
      case 'BPLO_APPROVE_APPLICATION':
        return `BPLO Admin ${name} approved application${details?.applicantName ? ` for ${details.applicantName}` : ''}`;
      case 'BPLO_REJECT_APPLICATION':
        return `BPLO Admin ${name} rejected application${details?.applicantName ? ` for ${details.applicantName}` : ''}`;
      case 'OPERATOR_ADD_OR':
        return `${name} added Official Receipt #${details?.orNumber || 'N/A'}`;
      case 'SB_APPROVE_FRANCHISE':
        return `SB Admin ${name} approved and created Franchise #${details?.franchiseNumber || 'N/A'}${details?.operatorName ? ` for ${details.operatorName}` : ''}`;
      case 'SB_UPDATE_FRANCHISE':
        return `SB Admin ${name} updated Franchise #${details?.franchiseNumber || 'N/A'}`;
      case 'FRANCHISE_EXPIRED':
        return `System detected Franchise #${details?.franchiseNumber || 'N/A'} has expired`;
      case 'FRANCHISE_REVOKED':
        return `Franchise #${details?.franchiseNumber || 'N/A'} was revoked by ${name}`;
      case 'DOWNLOAD_APPLICATION_FILE':
        return `${name} downloaded ${details?.fileName || 'application document'}`;
      case 'QR_CODE_SCAN':
        return `QR Code scanned for Franchise #${details?.franchiseNumber || 'N/A'}`;
      case 'CREATE_ANNOUNCEMENT':
        return `${name} created announcement "${details?.title || 'Untitled'}"${details?.published ? ' (Published)' : ' (Draft)'}`;
      case 'UPDATE_ANNOUNCEMENT':
        return `${name} updated announcement "${details?.title || 'Untitled'}"`;
      case 'DELETE_ANNOUNCEMENT':
        return `${name} deleted announcement "${details?.title || 'Untitled'}"`;
      case 'SEARCH_FRANCHISE_NUMBER':
        return `${name} searched for available franchise numbers`;
      case 'UPDATE_FRANCHISE':
        return `${name} updated Franchise #${details?.franchiseNumber || 'N/A'}`;
      case 'CREATE_FRANCHISE':
        return `${name} created new Franchise #${details?.franchiseNumber || 'N/A'}`;
      case 'DELETE_FRANCHISE':
        return `${name} deleted Franchise #${details?.franchiseNumber || 'N/A'}`;
      case 'UPDATE_APPLICATION':
        return `${name} updated application${details?.applicantName ? ` for ${details.applicantName}` : ''}`;
      case 'APPROVE_APPLICATION':
        return `${name} approved application${details?.applicantName ? ` for ${details.applicantName}` : ''}`;
      case 'REJECT_APPLICATION':
        return `${name} rejected application${details?.applicantName ? ` for ${details.applicantName}` : ''}`;
      default:
        return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
  }

  /**
   * Log user login
   */
  async logLogin(user, req, success = true, errorMessage = null) {
    const { browser, device } = this.parseUserAgent(req.headers['user-agent']);
    
    return this.logAction({
      user,
      method: 'POST',
      route: '/api/auth/login',
      action: 'USER_LOGIN',
      description: `${user.name || user.username} logged in via ${browser} on ${device}`,
      statusCode: success ? 200 : 401,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'auth',
      errorMessage: errorMessage,
      details: {
        browser,
        device,
        authProvider: user.oauthProvider || 'local',
        rememberMe: req.body?.rememberMe || false
      }
    });
  }

  /**
   * Log user logout
   */
  async logLogout(user, req) {
    return this.logAction({
      user,
      method: 'POST',
      route: '/api/auth/logout',
      action: 'USER_LOGOUT',
      description: `${user.name || user.username} logged out`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'auth',
      details: {}
    });
  }

  /**
   * Log franchise application creation
   */
  async logApplicationCreation(application, user, req) {
    return this.logAction({
      user,
      method: 'POST',
      route: '/api/franchise-application',
      action: 'CREATE_APPLICATION',
      description: `${user.name || user.username} submitted a new franchise application for ${application.operatorName}`,
      statusCode: 201,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'application',
      resourceId: application._id?.toString(),
      details: {
        applicantName: application.operatorName,
        applicantEmail: application.operatorEmail,
        applicationType: application.applicationType || 'new',
        mvPlateNo: application.mvPlateNo,
        unitModel: application.unitModel,
        operatorBarangay: application.operatorBarangay
      }
    });
  }

  /**
   * Log franchise application edit
   */
  async logApplicationEdit(application, user, req) {
    return this.logAction({
      user,
      method: 'PUT',
      route: `/api/franchise-application/${application._id}`,
      action: 'EDIT_APPLICATION',
      description: `${user.name || user.username} edited franchise application for ${application.operatorName}`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'application',
      resourceId: application._id?.toString(),
      details: {
        applicantName: application.operatorName,
        applicationType: application.applicationType
      }
    });
  }

  /**
   * Log BPLO approval/rejection
   */
  async logBPLOAction(application, actionType, user, req, notes = null) {
    const isApproval = actionType === 'approve';
    
    return this.logAction({
      user,
      method: 'PUT',
      route: `/api/franchise-application/${application._id}/${actionType}`,
      action: isApproval ? 'BPLO_APPROVE_APPLICATION' : 'BPLO_REJECT_APPLICATION',
      description: `BPLO Admin ${user.name || user.username} ${isApproval ? 'approved' : 'rejected'} application for ${application.operatorName}`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'application',
      resourceId: application._id?.toString(),
      details: {
        applicantName: application.operatorName,
        applicantEmail: application.operatorEmail,
        mvPlateNo: application.mvPlateNo,
        adminNotes: notes
      }
    });
  }

  /**
   * Log operator adding OR (Official Receipt)
   */
  async logOperatorAddOR(application, orNumber, user, req) {
    return this.logAction({
      user,
      method: 'PUT',
      route: `/api/franchise-application/${application._id}/add-or`,
      action: 'OPERATOR_ADD_OR',
      description: `${user.name || user.username} added Official Receipt #${orNumber}`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'application',
      resourceId: application._id?.toString(),
      details: {
        orNumber,
        applicantName: application.operatorName
      }
    });
  }

  /**
   * Log SB Admin franchise approval (creating new franchise)
   */
  async logSBApproval(franchise, application, franchiseNumber, user, req) {
    return this.logAction({
      user,
      method: 'POST',
      route: `/api/franchise-information`,
      action: 'SB_APPROVE_FRANCHISE',
      description: `SB Admin ${user.name || user.username} approved and created Franchise #${franchiseNumber} for ${franchise.operatorName}`,
      statusCode: 201,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'franchise',
      resourceId: franchise._id?.toString(),
      details: {
        franchiseNumber,
        operatorName: franchise.operatorName,
        operatorEmail: franchise.operatorEmail,
        mvPlateNo: franchise.mvPlateNo,
        unitModel: franchise.unitModel,
        applicationId: application?._id?.toString()
      }
    });
  }

  /**
   * Log franchise creation (New Franchise)
   */
  async logFranchiseCreation(franchise, application, user, req) {
    return this.logAction({
      user,
      method: 'POST',
      route: `/api/franchise-information`,
      action: 'CREATE_FRANCHISE',
      description: `SB Admin ${user.name || user.username} created new Franchise #${franchise.franchiseNumber} for ${franchise.operatorName}`,
      statusCode: 201,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'franchise',
      resourceId: franchise._id?.toString(),
      details: {
        franchiseNumber: franchise.franchiseNumber,
        operatorName: franchise.operatorName,
        operatorEmail: franchise.operatorEmail,
        mvPlateNo: franchise.mvPlateNo,
        unitModel: franchise.unitModel,
        sessionNumber: franchise.sessionNumber,
        applicationId: application?._id?.toString()
      }
    });
  }

  /**
   * Log franchise update (Renewal/Amendment)
   */
  async logFranchiseUpdate(franchise, application, changeType, user, req) {
    const changeTypeLabel = changeType === 'renewal' ? 'Renewal' : changeType === 'change_unit' ? 'Unit Change' : changeType === 'update_ownership' ? 'Ownership Update' : 'Amendment';
    
    return this.logAction({
      user,
      method: 'PUT',
      route: `/api/franchise-information/${franchise._id}`,
      action: 'UPDATE_FRANCHISE',
      description: `SB Admin ${user.name || user.username} processed ${changeTypeLabel} for Franchise #${franchise.franchiseNumber} (${franchise.operatorName})`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'franchise',
      resourceId: franchise._id?.toString(),
      details: {
        franchiseNumber: franchise.franchiseNumber,
        operatorName: franchise.operatorName,
        operatorEmail: franchise.operatorEmail,
        changeType: changeType,
        version: franchise.version,
        applicationId: application?._id?.toString(),
        mvPlateNo: franchise.mvPlateNo,
        unitModel: franchise.unitModel
      }
    });
  }

  /**
   * Log franchise expiration (system-detected)
   */
  async logFranchiseExpired(franchise) {
    // Create a system user for automated actions
    const systemUser = {
      id: 'SYSTEM',
      userId: 'SYSTEM',
      username: 'System',
      name: 'Automated System',
      role: 'super-admin',
      accountType: 'admin'
    };
    
    return this.logAction({
      user: systemUser,
      method: 'PUT',
      route: `/api/franchise-information/${franchise._id}/expire`,
      action: 'FRANCHISE_EXPIRED',
      description: `System detected Franchise #${franchise.franchiseNumber} has expired`,
      statusCode: 200,
      ipAddress: '127.0.0.1',
      userAgent: 'System Scheduler',
      resourceType: 'franchise',
      resourceId: franchise._id?.toString(),
      details: {
        franchiseNumber: franchise.franchiseNumber,
        operatorName: franchise.operatorName,
        expiryDate: franchise.expiryDate
      }
    });
  }

  /**
   * Log franchise revocation
   */
  async logFranchiseRevoked(franchise, user, req, reason = null) {
    return this.logAction({
      user,
      method: 'PUT',
      route: `/api/franchise-information/${franchise._id}/revoke`,
      action: 'FRANCHISE_REVOKED',
      description: `Franchise #${franchise.franchiseNumber} was revoked by ${user.name || user.username}`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'franchise',
      resourceId: franchise._id?.toString(),
      details: {
        franchiseNumber: franchise.franchiseNumber,
        operatorName: franchise.operatorName,
        reason
      }
    });
  }

  /**
   * Log file download
   */
  async logFileDownload(fileName, resourceType, resourceId, user, req) {
    return this.logAction({
      user,
      method: 'GET',
      route: `/api/${resourceType}/${resourceId}/download`,
      action: 'DOWNLOAD_APPLICATION_FILE',
      description: `${user.name || user.username} downloaded ${fileName}`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType,
      resourceId,
      details: {
        fileName
      }
    });
  }

  /**
   * Log QR code scan
   */
  async logQRScan(franchise, req) {
    // For QR scans, we might not have authenticated user
    const user = req.user || {
      id: 'ANONYMOUS',
      userId: 'ANONYMOUS',
      username: 'Anonymous Scanner',
      name: 'Public Scanner',
      role: 'operator',
      accountType: 'user'
    };
    
    return this.logAction({
      user,
      method: 'GET',
      route: `/api/franchise-information/qr/${franchise.franchiseNumber}`,
      action: 'QR_CODE_SCAN',
      description: `QR Code scanned for Franchise #${franchise.franchiseNumber}`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'franchise',
      resourceId: franchise._id?.toString(),
      details: {
        franchiseNumber: franchise.franchiseNumber,
        operatorName: franchise.operatorName
      }
    });
  }

  /**
   * Log announcement creation
   */
  async logAnnouncementCreation(announcement, user, req) {
    return this.logAction({
      user,
      method: 'POST',
      route: '/api/announcements',
      action: 'CREATE_ANNOUNCEMENT',
      description: `${user.name || user.username} created announcement "${announcement.title}"${announcement.published ? ' (Published)' : ' (Draft)'}`,
      statusCode: 201,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'announcement',
      resourceId: announcement._id?.toString(),
      details: {
        announcementId: announcement._id?.toString(),
        title: announcement.title,
        published: announcement.published
      }
    });
  }

  /**
   * Log announcement update
   */
  async logAnnouncementUpdate(announcement, user, req, changes = {}) {
    const changeDescriptions = [];
    if (changes.title) changeDescriptions.push('title');
    if (changes.description) changeDescriptions.push('description');
    if (changes.published !== undefined) changeDescriptions.push(changes.published ? 'published' : 'unpublished');
    
    const changesText = changeDescriptions.length > 0 ? ` (${changeDescriptions.join(', ')})` : '';
    
    return this.logAction({
      user,
      method: 'PUT',
      route: `/api/announcements/${announcement._id}`,
      action: 'UPDATE_ANNOUNCEMENT',
      description: `${user.name || user.username} updated announcement "${announcement.title}"${changesText}`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'announcement',
      resourceId: announcement._id?.toString(),
      details: {
        announcementId: announcement._id?.toString(),
        title: announcement.title,
        changes
      }
    });
  }

  /**
   * Log announcement deletion
   */
  async logAnnouncementDeletion(announcement, user, req) {
    return this.logAction({
      user,
      method: 'DELETE',
      route: `/api/announcements/${announcement._id}`,
      action: 'DELETE_ANNOUNCEMENT',
      description: `${user.name || user.username} deleted announcement "${announcement.title}"`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'announcement',
      resourceId: announcement._id?.toString(),
      details: {
        announcementId: announcement._id?.toString(),
        title: announcement.title
      }
    });
  }

  /**
   * Helper methods kept for backward compatibility
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
            // Skip logging unauthenticated requests
            return;
          }

          // Skip logging GET requests (read-only operations)
          if (req.method === 'GET') {
            return;
          }

          // Skip routes that have dedicated logging methods to prevent duplicates
          const routesWithDedicatedLogging = [
            '/auth/login',
            '/auth/logout',
            '/announcements'
          ];
          
          const pathWithoutQuery = req.path.split('?')[0];
          if (routesWithDedicatedLogging.some(route => pathWithoutQuery.startsWith(route))) {
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
            ipAddress: getClientIp(req),
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

      // Get total count for pagination
      const total = await AuditLog.countDocuments(query);

      const logs = await AuditLog.find(query)
        .sort({ [sortBy]: sortOrder })
        .limit(limit)
        .skip(skip)
        .lean()
        .exec();
      
      return { total, logs };
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
      ipAddress: getClientIp(req),
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
      ipAddress: getClientIp(req),
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