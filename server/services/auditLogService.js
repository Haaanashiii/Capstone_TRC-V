const mongoose = require('mongoose');
const { getClientIp } = require('../utils/ipHelper');

// Track all user actions for security and auditing
const auditLogSchema = new mongoose.Schema({
  // User information from login token
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  name: { type: String },
  email: { type: String },
  
  // User role and account type
  role: { type: String, required: true, enum: ['operator', 'sb-admin', 'bplo-admin', 'super-admin'] },
  accountType: { type: String, enum: ['user', 'admin'], default: 'user' },
  
  adminId: { type: String },
  department: { type: String },
  position: { type: String },
  
  // API request details
  method: { type: String, required: true }, // GET, POST, PUT, DELETE, etc.
  route: { type: String, required: true }, // URL path
  action: { type: String, required: true }, // What user did (e.g. 'LOGIN', 'CREATE_APPLICATION')
  description: { type: String }, // Human-readable action description
  
  // Response information
  statusCode: { type: Number, required: true },
  success: { type: Boolean, required: true }, // true if status code < 400
  
  // Request body and response
  requestBody: { type: Object }, // Sanitized (passwords removed)
  responseStatus: { type: String }, // 'success', 'failure', 'error'
  errorMessage: { type: String }, // Error details if failed
  
  // What was accessed
  resourceType: { type: String }, // 'franchise', 'application', 'user', etc.
  resourceId: { type: String }, // ID of the resource
  
  // Client information
  ipAddress: { type: String, required: true, index: true },
  userAgent: { type: String },
  browser: { type: String }, // Chrome, Firefox, Safari, etc.
  device: { type: String }, // Desktop, Mobile, Tablet
  
  // When it happened
  createdAt: { type: Date, default: Date.now, index: true },
  
  // Extra context
  details: { type: Object }
}, { collection: 'audit_logs' });

// Create indexes for fast searching
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ role: 1, createdAt: -1 });
auditLogSchema.index({ route: 1, createdAt: -1 });
auditLogSchema.index({ success: 1, createdAt: -1 });
auditLogSchema.index({ ipAddress: 1, createdAt: -1 });

// Create database model
const AuditLog = mongoose.model('AuditLog', auditLogSchema);


class AuditLogService {
  // Detect browser and device from user agent string
  parseUserAgent(userAgent) {
    if (!userAgent) return { browser: 'Unknown', device: 'Unknown' };
    
    // Detect browser type
    let browser = 'Unknown';
    if (userAgent.includes('Chrome')) browser = 'Google Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Mozilla Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Microsoft Edge';
    else if (userAgent.includes('Opera')) browser = 'Opera';
    
    // Detect device type
    let device = 'Desktop';
    if (userAgent.includes('Mobile')) device = 'Mobile';
    else if (userAgent.includes('Tablet')) device = 'Tablet';
    
    return { browser, device };
  }

  // Remove sensitive information from request (passwords, tokens)
  sanitizeRequestBody(body) {
    if (!body) return null;
    const clone = { ...body };
    const sensitiveFields = ['password', 'passwordConfirm', 'otp', 'token', 'refreshToken', 'accessToken', 'creditCard'];
    for (const field of sensitiveFields) {
      if (clone[field]) clone[field] = '[REDACTED]';
    }
    return clone;
  }

  // Save action to audit log from user login token
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

      // Extract user information from JWT
      // JWT payload contains: id, _id, role, name, accountType, adminId (for admins)
      // NOTE: Email is NOT in JWT for security reasons - we fetch it from DB
      const userId = user.id || user.userId || user.adminId || user._id;
      const name = user.name || 'System'; // name is always in JWT
      const role = user.role || 'unknown';
      const accountType = user.accountType || 'user';

      // Check if this is an admin account and extract admin info from JWT
      const isAdmin = accountType === 'admin';
      const adminId = isAdmin ? (user.adminId || user.id || user.userId) : null;
      
      // Fetch email from database (not stored in JWT for security)
      let email = null;
      let username = name; // Default to name if we can't find username
      let department = null;
      let position = null;
      
      try {
        if (isAdmin && adminId) {
          // Fetch admin details from database
          const adminAccountRepository = require('../repositories/adminAccountRepository');
          const adminAccount = await adminAccountRepository.findAdminById(adminId, { lean: true }).catch(() => null);
          if (adminAccount) {
            email = adminAccount.email || null;
            username = adminAccount.username || adminAccount.email || name;
            department = adminAccount.department || null;
            position = adminAccount.position || null;
          }
        } else if (userId) {
          // Fetch user details from database
          const userAccountRepository = require('../repositories/userAccountRepository');
          const userAccount = await userAccountRepository.findAccountById(userId, { lean: true }).catch(() => null);
          if (userAccount) {
            email = userAccount.email || null;
            username = userAccount.username || userAccount.email || name;
          }
        }
      } catch (err) {
        // Don't let email lookup failure break audit logging
        console.warn('[Audit] Failed to fetch user email:', err.message);
      }

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
      
      // Backup & Recovery Actions
      case 'SYSTEM_AUTOMATIC_BACKUP':
        return `System automatically created backup${details?.backupId ? `: ${details.backupId}` : ''} (${details?.formattedSize || 'N/A'})`;
      case 'ADMIN_MANUAL_BACKUP':
        return `${name} manually created backup${details?.backupId ? `: ${details.backupId}` : ''} (${details?.formattedSize || 'N/A'})`;
      case 'ADMIN_EMERGENCY_BACKUP':
        return `${name} created EMERGENCY backup${details?.backupId ? `: ${details.backupId}` : ''} (Protected)`;
      case 'ADMIN_PRE_UPDATE_BACKUP':
        return `${name} created pre-update backup before: ${details?.updateDescription || 'system update'}`;
      case 'ADMIN_RESTORE_BACKUP':
        return `[WARNING] ${name} RESTORED database from backup: ${details?.backupId || 'N/A'} (${details?.totalDocuments || 0} documents)`;
      case 'SYSTEM_AUTO_RECOVERY':
        return `[WARNING] System automatically recovered database from backup: ${details?.backupId || 'last good backup'}`;
      case 'ADMIN_DELETE_BACKUP':
        return `${name} deleted backup: ${details?.backupId || 'N/A'}`;
      case 'ADMIN_DOWNLOAD_BACKUP':
        return `${name} downloaded backup file: ${details?.backupId || 'N/A'}`;
      case 'ADMIN_FULL_DATABASE_EXPORT':
        return `${name} exported FULL DATABASE for external storage (${details?.formattedSize || 'N/A'}, ${details?.totalDocuments || 0} documents)`;
      case 'ADMIN_IMPORT_FROM_EXTERNAL':
        return `[WARNING] ${name} IMPORTED database from external backup file (${details?.totalDocuments || 0} documents)`;
      case 'ADMIN_ARCHIVE_OLD_DATA':
        return `${name} archived ${details?.totalArchivedDocuments || 0} old documents${details?.deleteAfterArchive ? ' and DELETED from database' : ''}`;
      case 'ADMIN_RESTORE_FROM_ARCHIVE':
        return `${name} restored ${details?.totalRestored || 0} documents from archive: ${details?.archiveId || 'N/A'}`;
      case 'ADMIN_PROTECT_BACKUP':
        return `${name} protected backup from auto-deletion: ${details?.backupId || 'N/A'}`;
      case 'ADMIN_UNPROTECT_BACKUP':
        return `${name} removed protection from backup: ${details?.backupId || 'N/A'}`;
      case 'ADMIN_VERIFY_BACKUP':
        return `${name} verified backup ${details?.backupId || 'N/A'}: ${details?.valid ? 'VALID' : 'CORRUPTED'}`;
      case 'ADMIN_UPDATE_BACKUP_CONFIG':
        return `${name} updated backup system configuration`;
      
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

  // ==========================================
  // BACKUP & RECOVERY AUDIT LOGGING
  // ==========================================

  /**
   * Log automatic backup (system-initiated)
   */
  async logAutomaticBackup(backupResult, success = true, errorMessage = null) {
    const systemUser = {
      id: 'SYSTEM',
      userId: 'SYSTEM',
      username: 'System',
      name: 'Automated Backup System',
      role: 'super-admin',
      accountType: 'admin'
    };

    return this.logAction({
      user: systemUser,
      method: 'POST',
      route: '/api/backup/automatic',
      action: 'SYSTEM_AUTOMATIC_BACKUP',
      description: success 
        ? `System automatically created backup: ${backupResult.backupId} (${backupResult.formattedSize || 'N/A'}, ${backupResult.totalDocuments || 0} documents)`
        : `System automatic backup failed: ${errorMessage}`,
      statusCode: success ? 201 : 500,
      ipAddress: '127.0.0.1',
      userAgent: 'System Scheduler',
      resourceType: 'backup',
      resourceId: backupResult?.backupId,
      errorMessage: success ? null : errorMessage,
      details: {
        backupId: backupResult?.backupId,
        backupType: 'automatic',
        fileSize: backupResult?.fileSize,
        formattedSize: backupResult?.formattedSize,
        totalDocuments: backupResult?.totalDocuments,
        totalCollections: backupResult?.collections,
        durationMs: backupResult?.durationMs,
        checksum: backupResult?.checksum,
        scheduledTime: new Date().toISOString()
      }
    });
  }

  /**
   * Log manual backup (admin-initiated)
   */
  async logManualBackup(backupResult, user, req, success = true, errorMessage = null) {
    return this.logAction({
      user,
      method: 'POST',
      route: '/api/backup/create',
      action: 'ADMIN_MANUAL_BACKUP',
      description: success
        ? `${user.name || user.username} manually created backup: ${backupResult.backupId} (${backupResult.formattedSize || 'N/A'})`
        : `${user.name || user.username} attempted manual backup but failed: ${errorMessage}`,
      statusCode: success ? 201 : 500,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'backup',
      resourceId: backupResult?.backupId,
      errorMessage: success ? null : errorMessage,
      details: {
        backupId: backupResult?.backupId,
        backupType: 'manual',
        fileSize: backupResult?.fileSize,
        formattedSize: backupResult?.formattedSize,
        totalDocuments: backupResult?.totalDocuments,
        totalCollections: backupResult?.collections,
        durationMs: backupResult?.durationMs,
        notes: backupResult?.notes
      }
    });
  }

  /**
   * Log emergency backup
   */
  async logEmergencyBackup(backupResult, user, req, success = true, errorMessage = null) {
    return this.logAction({
      user,
      method: 'POST',
      route: '/api/backup/emergency',
      action: 'ADMIN_EMERGENCY_BACKUP',
      description: success
        ? `${user.name || user.username} created EMERGENCY backup: ${backupResult.backupId} (${backupResult.formattedSize || 'N/A'})`
        : `${user.name || user.username} attempted emergency backup but failed: ${errorMessage}`,
      statusCode: success ? 201 : 500,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'backup',
      resourceId: backupResult?.backupId,
      errorMessage: success ? null : errorMessage,
      details: {
        backupId: backupResult?.backupId,
        backupType: 'emergency',
        fileSize: backupResult?.fileSize,
        formattedSize: backupResult?.formattedSize,
        totalDocuments: backupResult?.totalDocuments,
        isProtected: true,
        reason: 'Emergency backup - protected from auto-deletion'
      }
    });
  }

  /**
   * Log pre-update backup
   */
  async logPreUpdateBackup(backupResult, user, req, updateDescription = null, success = true, errorMessage = null) {
    return this.logAction({
      user,
      method: 'POST',
      route: '/api/backup/pre-update',
      action: 'ADMIN_PRE_UPDATE_BACKUP',
      description: success
        ? `${user.name || user.username} created pre-update backup before: ${updateDescription || 'system update'}`
        : `${user.name || user.username} attempted pre-update backup but failed: ${errorMessage}`,
      statusCode: success ? 201 : 500,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'backup',
      resourceId: backupResult?.backupId,
      errorMessage: success ? null : errorMessage,
      details: {
        backupId: backupResult?.backupId,
        backupType: 'pre-update',
        updateDescription,
        fileSize: backupResult?.fileSize,
        formattedSize: backupResult?.formattedSize,
        totalDocuments: backupResult?.totalDocuments
      }
    });
  }

  /**
   * Log backup restore/rollback
   */
  async logBackupRestore(backupId, restoreResult, user, req, success = true, errorMessage = null) {
    return this.logAction({
      user,
      method: 'POST',
      route: `/api/backup/${backupId}/restore`,
      action: 'ADMIN_RESTORE_BACKUP',
      description: success
        ? `${user.name || user.username} RESTORED database from backup: ${backupId} (${restoreResult.totalDocuments || 0} documents restored)`
        : `${user.name || user.username} attempted to restore from backup ${backupId} but failed: ${errorMessage}`,
      statusCode: success ? 200 : 500,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'backup',
      resourceId: backupId,
      errorMessage: success ? null : errorMessage,
      details: {
        backupId,
        restoredCollections: restoreResult?.restoredCollections,
        totalDocuments: restoreResult?.totalDocuments,
        dropExisting: restoreResult?.dropExisting || false,
        dryRun: restoreResult?.dryRun || false,
        warning: 'DATABASE RESTORE OPERATION - Data may have been overwritten'
      }
    });
  }

  /**
   * Log auto-recovery attempt
   */
  async logAutoRecovery(recoveryResult, triggeredBy = 'system', success = true, errorMessage = null) {
    const systemUser = {
      id: 'SYSTEM',
      userId: 'SYSTEM',
      username: 'System',
      name: 'Auto-Recovery System',
      role: 'super-admin',
      accountType: 'admin'
    };

    return this.logAction({
      user: systemUser,
      method: 'POST',
      route: '/api/backup/recover',
      action: 'SYSTEM_AUTO_RECOVERY',
      description: success
        ? `System automatically recovered database from backup: ${recoveryResult?.backupId || 'last good backup'}`
        : `System auto-recovery failed: ${errorMessage}`,
      statusCode: success ? 200 : 500,
      ipAddress: '127.0.0.1',
      userAgent: 'Health Monitor',
      resourceType: 'backup',
      resourceId: recoveryResult?.backupId,
      errorMessage: success ? null : errorMessage,
      details: {
        triggeredBy,
        backupId: recoveryResult?.backupId,
        totalDocuments: recoveryResult?.totalDocuments,
        collectionsRestored: recoveryResult?.restoredCollections?.length,
        criticalAlert: true
      }
    });
  }

  /**
   * Log backup deletion
   */
  async logBackupDeletion(backupId, user, req, success = true, errorMessage = null) {
    return this.logAction({
      user,
      method: 'DELETE',
      route: `/api/backup/${backupId}`,
      action: 'ADMIN_DELETE_BACKUP',
      description: success
        ? `${user.name || user.username} deleted backup: ${backupId}`
        : `${user.name || user.username} attempted to delete backup ${backupId} but failed: ${errorMessage}`,
      statusCode: success ? 200 : 500,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'backup',
      resourceId: backupId,
      errorMessage: success ? null : errorMessage,
      details: {
        backupId,
        action: 'permanent_deletion'
      }
    });
  }

  /**
   * Log backup download
   */
  async logBackupDownload(backupId, user, req) {
    return this.logAction({
      user,
      method: 'GET',
      route: `/api/backup/${backupId}/download`,
      action: 'ADMIN_DOWNLOAD_BACKUP',
      description: `${user.name || user.username} downloaded backup file: ${backupId}`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'backup',
      resourceId: backupId,
      details: {
        backupId,
        action: 'file_download'
      }
    });
  }

  /**
   * Log full database export (for Hard Disk storage)
   */
  async logFullExport(exportResult, user, req, success = true, errorMessage = null) {
    return this.logAction({
      user,
      method: 'POST',
      route: '/api/backup/export-full',
      action: 'ADMIN_FULL_DATABASE_EXPORT',
      description: success
        ? `${user.name || user.username} exported FULL DATABASE for external storage: ${exportResult.exportId} (${exportResult.formattedSize || 'N/A'}, ${exportResult.totalDocuments || 0} documents)`
        : `${user.name || user.username} attempted full database export but failed: ${errorMessage}`,
      statusCode: success ? 201 : 500,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'backup',
      resourceId: exportResult?.exportId,
      errorMessage: success ? null : errorMessage,
      details: {
        exportId: exportResult?.exportId,
        fileName: exportResult?.fileName,
        fileSize: exportResult?.fileSize,
        formattedSize: exportResult?.formattedSize,
        totalDocuments: exportResult?.totalDocuments,
        totalCollections: exportResult?.totalCollections,
        purpose: 'External storage / Hard Disk backup'
      }
    });
  }

  /**
   * Log database import from external file (from Hard Disk)
   */
  async logDatabaseImport(importResult, user, req, success = true, errorMessage = null) {
    return this.logAction({
      user,
      method: 'POST',
      route: '/api/backup/import',
      action: 'ADMIN_IMPORT_FROM_EXTERNAL',
      description: success
        ? `${user.name || user.username} IMPORTED database from external backup file (${importResult.totalDocuments || 0} documents restored)`
        : `${user.name || user.username} attempted to import from external backup but failed: ${errorMessage}`,
      statusCode: success ? 200 : 500,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'backup',
      resourceId: importResult?.sourceBackupId,
      errorMessage: success ? null : errorMessage,
      details: {
        sourceBackupId: importResult?.sourceBackupId,
        sourceCreatedAt: importResult?.sourceCreatedAt,
        totalDocuments: importResult?.totalDocuments,
        collections: importResult?.collections,
        source: 'External file (Hard Disk)',
        warning: 'DATA IMPORT OPERATION - Database content modified'
      }
    });
  }

  /**
   * Log data archival
   */
  async logDataArchive(archiveResult, user, req, success = true, errorMessage = null) {
    return this.logAction({
      user,
      method: 'POST',
      route: '/api/backup/archive',
      action: 'ADMIN_ARCHIVE_OLD_DATA',
      description: success
        ? `${user.name || user.username} archived ${archiveResult.totalArchivedDocuments || 0} old documents (${archiveResult.olderThanYears}+ years)${archiveResult.deleteAfterArchive ? ' and DELETED from database' : ''}`
        : `${user.name || user.username} attempted to archive old data but failed: ${errorMessage}`,
      statusCode: success ? 201 : 500,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'backup',
      resourceId: archiveResult?.archiveId,
      errorMessage: success ? null : errorMessage,
      details: {
        archiveId: archiveResult?.archiveId,
        olderThanYears: archiveResult?.olderThanYears,
        cutoffDate: archiveResult?.cutoffDate,
        totalArchivedDocuments: archiveResult?.totalArchivedDocuments,
        totalDeletedDocuments: archiveResult?.totalDeletedDocuments,
        deleteAfterArchive: archiveResult?.deleteAfterArchive,
        collections: archiveResult?.collections
      }
    });
  }

  /**
   * Log restore from archive
   */
  async logRestoreFromArchive(archiveId, restoreResult, user, req, success = true, errorMessage = null) {
    return this.logAction({
      user,
      method: 'POST',
      route: `/api/backup/archive/${archiveId}/restore`,
      action: 'ADMIN_RESTORE_FROM_ARCHIVE',
      description: success
        ? `${user.name || user.username} restored ${restoreResult.totalRestored || 0} documents from archive: ${archiveId}`
        : `${user.name || user.username} attempted to restore from archive ${archiveId} but failed: ${errorMessage}`,
      statusCode: success ? 200 : 500,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'backup',
      resourceId: archiveId,
      errorMessage: success ? null : errorMessage,
      details: {
        archiveId,
        totalRestored: restoreResult?.totalRestored,
        collections: restoreResult?.collections
      }
    });
  }

  /**
   * Log backup protection toggle
   */
  async logBackupProtectionToggle(backupId, isProtected, user, req) {
    return this.logAction({
      user,
      method: 'PUT',
      route: `/api/backup/${backupId}/protection`,
      action: isProtected ? 'ADMIN_PROTECT_BACKUP' : 'ADMIN_UNPROTECT_BACKUP',
      description: `${user.name || user.username} ${isProtected ? 'protected' : 'unprotected'} backup: ${backupId}`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'backup',
      resourceId: backupId,
      details: {
        backupId,
        isProtected,
        action: isProtected ? 'Backup protected from auto-deletion' : 'Backup can now be auto-deleted'
      }
    });
  }

  /**
   * Log backup verification
   */
  async logBackupVerification(backupId, verificationResult, user, req) {
    const isValid = verificationResult?.valid;
    
    return this.logAction({
      user,
      method: 'POST',
      route: `/api/backup/${backupId}/verify`,
      action: 'ADMIN_VERIFY_BACKUP',
      description: `${user.name || user.username} verified backup ${backupId}: ${isValid ? 'VALID' : 'CORRUPTED/INVALID'}`,
      statusCode: isValid ? 200 : 400,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'backup',
      resourceId: backupId,
      errorMessage: isValid ? null : verificationResult?.error,
      details: {
        backupId,
        valid: isValid,
        checksum: verificationResult?.checksum,
        verifiedAt: verificationResult?.verifiedAt,
        error: verificationResult?.error
      }
    });
  }

  /**
   * Log backup config update
   */
  async logBackupConfigUpdate(newConfig, user, req) {
    return this.logAction({
      user,
      method: 'PUT',
      route: '/api/backup/config',
      action: 'ADMIN_UPDATE_BACKUP_CONFIG',
      description: `${user.name || user.username} updated backup configuration`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'backup',
      details: {
        newConfig,
        action: 'Backup system configuration modified'
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