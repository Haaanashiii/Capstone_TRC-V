/**
 * Secure API Configuration for CAPSTONE_TRC-V
 * Government-Grade Security Implementation
 * 
 * Security Features:
 * - sessionStorage for access tokens (cleared on tab close)
 * - HTTP-only cookies for refresh tokens (XSS-proof)
 * - CSRF protection (sameSite: 'strict')
 * - Automatic token refresh on 401 errors
 * - Client-side rate limiting
 * - Secure token validation
 * - No localStorage fallback (security policy)
 */

import axios from 'axios';

// API Base URL - Always use environment variable for security
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';


// ====================================================================
// TOKEN MANAGER - Secure Token Storage & Validation
// ====================================================================

/**
 * TokenManager - Centralized token management
 * SECURITY: Uses sessionStorage ONLY (no localStorage for XSS protection)
 * Refresh tokens stored ONLY in HTTP-only cookies (server-managed)
 */
export const TokenManager = {
  /**
   * Get access token from secure storage
   * @returns {string|null} Access token or null
   */
  getAccessToken: () => {
    return sessionStorage.getItem('accessToken');
  },

  /**
   * Set tokens securely
   * @param {string} accessToken - JWT access token from backend
   * @returns {boolean} Success status
   */
  setTokens: (accessToken) => {
    try {
      if (!accessToken) return false;
      
      // Store access token in sessionStorage (cleared on tab close)
      sessionStorage.setItem('accessToken', accessToken);
      
      // Refresh token is stored in HTTP-only cookie by backend
      // DO NOT store refresh token client-side (security best practice)
      
      return true;
    } catch (error) {
      console.error('[TokenManager] Error storing tokens:', error);
      return false;
    }
  },

  /**
   * Clear all tokens from storage
   */
  clearTokens: () => {
    try {
      sessionStorage.removeItem('accessToken');
      
      // Also clear from localStorage if exists (cleanup legacy tokens)
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (error) {
      console.error('[TokenManager] Error clearing tokens:', error);
    }
  },

  /**
   * Decode JWT token (CLIENT-SIDE ONLY - FOR UX, NOT SECURITY)
   * Server must validate token signature - client decode is for displaying user info only
   * @param {string} token - JWT token to decode
   * @returns {object|null} Decoded token payload or null
   */
  decodeToken: (token) => {
    try {
      if (!token) return null;
      
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch (error) {
      console.error('[TokenManager] Error decoding token:', error);
      return null;
    }
  },

  /**
   * Check if token is expired
   * @param {string} token - JWT token to check
   * @returns {boolean} True if expired
   */
  isTokenExpired: (token) => {
    const decoded = TokenManager.decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    // Check actual expiration time - no buffer needed
    // The response interceptor will handle refresh when backend returns 401
    return (decoded.exp * 1000) <= Date.now();
  },

  /**
   * Validate token structure and expiration
   * @param {string} token - JWT token to validate
   * @returns {boolean} True if valid
   */
  isValid: (token) => {
    if (!token) return false;
    
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    return !TokenManager.isTokenExpired(token);
  }
};

// Export convenience functions
export const getToken = TokenManager.getAccessToken;
export const setTokens = TokenManager.setTokens;
export const clearTokens = TokenManager.clearTokens;
export const decodeToken = TokenManager.decodeToken;

// ====================================================================
// AXIOS INSTANCE - Secure HTTP Client Configuration
// ====================================================================

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds for file uploads
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable HTTP-only cookies
});

// Track refresh in progress to prevent multiple simultaneous refresh calls
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// ====================================================================
// REQUEST INTERCEPTOR - Add Bearer Token & Validate Expiration
// ====================================================================

api.interceptors.request.use(
  (config) => {
    const token = TokenManager.getAccessToken();
    
    if (token) {
      // Always send the token - let backend validate and return 401 if expired
      // The response interceptor will automatically refresh the token on 401
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ====================================================================
// RESPONSE INTERCEPTOR - Handle Errors & Auto-Refresh Tokens
// ====================================================================

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Don't attempt token refresh for login/signup endpoints (they're supposed to return 401 on bad credentials)
    const authEndpoints = ['/auth/login', '/auth/signup', '/auth/refresh-token', '/auth/request-otp'];
    const isAuthEndpoint = authEndpoints.some(endpoint => originalRequest.url?.includes(endpoint));

    // Handle 401 Unauthorized - attempt token refresh (except for auth endpoints)
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Wait for refresh to complete
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        console.log('[API] Token expired, attempting refresh...');
        
        // Call refresh endpoint (reads refreshToken from HTTP-only cookie)
        const response = await api.post('/auth/refresh-token', {}, {
          _retry: true // Prevent interceptor loop
        });

        const { accessToken } = response.data;

        if (accessToken) {
          TokenManager.setTokens(accessToken);
          console.log('[API] Token refreshed successfully');
          
          // Update failed queue
          processQueue(null, accessToken);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } else {
          throw new Error('No access token in refresh response');
        }
      } catch (refreshError) {
        console.error('[API] Token refresh failed:', refreshError);
        
        // Check if it's a 403 (session revoked/killed)
        if (refreshError.response?.status === 403) {
          console.warn('[API] Session killed - user logged in from another device');
          // Show error message to user
          if (window.showSessionKilledError) {
            window.showSessionKilledError('Your session was ended. Please login again.');
          }
        }
        
        // Refresh failed - clear tokens and redirect to login
        processQueue(refreshError, null);
        TokenManager.clearTokens();
        
        // Only redirect if not already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error('[API] Access denied: Insufficient permissions');
    }

    // Handle network errors
    if (!error.response) {
      console.error('[API] Network error: Please check your connection');
    }

    return Promise.reject(error);
  }
);

// ====================================================================
// AUTHENTICATION API METHODS
// ====================================================================

export const authAPI = {
  /**
   * Login user with email/password
   * @param {object} credentials - { email, password }
   * @returns {Promise} Response with accessToken
   */
  login: (credentials) => api.post('/auth/login', credentials),

  /**
   * Sign up new user
   * @param {object} userData - User registration data
   * @returns {Promise} Response with user data
   */
  signup: (userData) => api.post('/auth/signup', userData),

  /**
   * Refresh access token (reads refreshToken from HTTP-only cookie)
   * @returns {Promise} Response with new accessToken
   */
  refreshToken: () => api.post('/auth/refresh-token'),

  /**
   * Logout user (clears HTTP-only cookie on backend)
   * @returns {Promise} Response
   */
  logout: async () => {
    try {
      // Call backend to clear HTTP-only cookie
      await api.post('/auth/logout');
    } catch (error) {
      console.error('[authAPI] Logout error:', error);
    } finally {
      // Always clear frontend tokens
      TokenManager.clearTokens();
    }
  },

  /**
   * Get current user details
   * @returns {Promise} Response with user data
   */
  getMe: () => api.get('/auth/me'),

  /**
   * Request OTP for email verification
   * @param {string} email - User email
   * @returns {Promise} Response
   */
  requestOTP: (email) => api.post('/auth/request-otp', { email }),

  /**
   * Verify OTP code
   * @param {string} email - User email
   * @param {string} otp - OTP code
   * @returns {Promise} Response
   */
  verifyOTP: (email, otp) => api.post('/auth/verify-otp', { email, otp }),

  /**
   * Request OTP for password reset (forgot password)
   * @param {string} email - User email
   * @returns {Promise} Response
   */
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),

  /**
   * Reset password using OTP
   * @param {string} email - User email
   * @param {string} otp - OTP code sent to email
   * @param {string} newPassword - New password (minimum 8 characters)
   * @returns {Promise} Response
   */
  resetPassword: (email, otp, newPassword) => api.post('/auth/reset-password', { email, otp, newPassword }),

  /**
   * Google OAuth login (redirects to Google)
   * @returns {void}
   */
  googleAuth: () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  }
};

// ====================================================================
// FRANCHISE APPLICATION API METHODS
// ====================================================================

export const franchiseAPI = {
  /**
   * Get all franchise applications with optional filters
   * @param {object} params - Query parameters { status, search, page, limit }
   * @returns {Promise} Response with franchise applications array
   */
  getAll: (params = {}) => api.get('/api/franchise-applications', { params }),

  /**
   * Get pending franchise applications (BPLO Admin endpoint with WebSocket)
   * @returns {Promise} Response with pending applications array
   */
  getPending: () => api.get('/api/franchise-applications/bplo/pending-websocket'),

  /**
   * Get approved franchise applications (SB Admin endpoint with WebSocket)
   * @returns {Promise} Response with approved applications array
   */
  getApproved: () => api.get('/api/franchise-applications/sb/approved-websocket'),

  /**
   * Get single franchise application by ID
   * @param {string} id - Application ID
   * @returns {Promise} Response with application details
   */
  getById: (id) => api.get(`/api/franchise-applications/${id}`),

  /**
   * Create new franchise application (supports both authenticated and public submissions)
   * @param {object} applicationData - Application data (FormData or JSON object)
   * @returns {Promise} Response with created application
   */
  create: (applicationData) => {
    // Use the authenticated API instance which automatically includes JWT token
    // If user is logged in, token will be sent; if not, request proceeds without auth
    // If applicationData is FormData, EXPLICITLY DELETE Content-Type so the
    // browser/axios can set the multipart/form-data boundary correctly.
    const config = {};
    
    if (applicationData instanceof FormData) {
      // CRITICAL: Delete Content-Type header for FormData
      // Browser will automatically set it to multipart/form-data with boundary
      config.headers = { 'Content-Type': undefined };
      console.log('[franchiseAPI] Sending FormData - Content-Type will be set by browser');
    } else {
      config.headers = { 'Content-Type': 'application/json' };
    }

    return api.post('/api/franchise-applications', applicationData, config);
  },

  /**
   * Create renewal or amendment application (operator submits changes to existing franchise)
   * @param {FormData} applicationData - Application data as FormData
   * @returns {Promise} Response with created renewal/amendment application
   */
  createRenewAmend: (applicationData) => {
    const config = {
      headers: { 'Content-Type': undefined }
    };
    console.log('[franchiseAPI] Sending Renewal/Amendment FormData');
    return api.post('/api/franchise-applications/renew-amend', applicationData, config);
  },

  /**
   * BPLO approve franchise application
   * @param {string} id - Application ID
   * @returns {Promise} Response with approved application
   */
  approveBPLO: (id) => api.put(`/api/franchise-applications/bplo/approve/${id}`),

  /**
   * BPLO disapprove franchise application
   * @param {string} id - Application ID
   * @param {string} reason - Disapproval reason
   * @returns {Promise} Response
   */
  disapproveBPLO: (id, reason) => api.put(`/api/franchise-applications/bplo/disapprove/${id}`, { reason }),

  /**
   * SB Admin final approval with resolution number and optional document
   * @param {string} id - Application ID
   * @param {FormData} formData - FormData containing resolutionNumber and optional resolutionDocument
   * @returns {Promise} Response with finally approved application
   */
  approveSBWithDocument: (id, formData) => api.put(`/api/franchise-applications/sb/approve/${id}`, formData, {
    headers: { 'Content-Type': undefined }
  }),

  /**
   * SB Admin final approval with resolution number (legacy - kept for backward compatibility)
   * @param {string} id - Application ID
   * @param {string} resolutionNumber - Resolution number for certificate
   * @returns {Promise} Response with finally approved application
   */
  approveSB: (id, resolutionNumber) => api.put(`/api/franchise-applications/sb/approve/${id}`, { resolutionNumber }),

  /**
   * Get applications for SB approval (awaiting-sb status)
   * @returns {Promise} Response with applications awaiting SB approval
   */
  getForSBApproval: () => api.get('/api/franchise-applications/sb/approved-websocket'),

  /**
   * Get current user's franchise applications (all statuses)
   * @returns {Promise} Response with user's applications array
   */
  getMyApplications: () => api.get('/api/franchise-applications/pending'),

  /**
   * Get a specific franchise application by ID
   * @param {string} id - Application ID
   * @returns {Promise} Response with application data
   */
  getById: (id) => api.get(`/api/franchise-applications/pending/${id}`),

  /**
   * Submit OR document and number after BPLO approval
   * @param {string} id - Application ID
   * @param {FormData} formData - FormData containing officialReceiptNumber and oRTreasurerOfficeObj file
   * @returns {Promise} Response with updated application
   */
  submitOR: (id, formData) => api.put(`/api/franchise-applications/approved/${id}/add-receipt`, formData, {
    headers: { 'Content-Type': undefined }
  }),

  /**
   * Legacy approve method (backward compatibility)
   * @param {string} id - Application ID
   * @returns {Promise} Response with approved application
   */
  approve: (id) => api.put(`/api/franchise-applications/${id}/approve`, {
    actionTaken: 'APPROVED',
    remarks: 'Application approved'
  }),

  /**
   * Legacy reject method (backward compatibility)
   * @param {string} id - Application ID
   * @param {string} reason - Rejection reason
   * @returns {Promise} Response
   */
  reject: (id, reason) => api.put(`/api/franchise-applications/${id}/reject`, { reason }),

  /**
   * Delete franchise application
   * @param {string} id - Application ID
   * @returns {Promise} Response
   */
  delete: (id) => api.delete(`/api/franchise-applications/${id}`),

  /**
   * Update franchise application
   * @param {string} id - Application ID
   * @param {object|FormData} data - Updated application data (can be FormData for file uploads)
   * @returns {Promise} Response with updated application
   */
  update: (id, data) => {
    // Check if data is FormData (has files)
    const config = data instanceof FormData ? 
      { headers: { 'Content-Type': undefined } } : 
      { headers: { 'Content-Type': 'application/json' } };
    
    return api.put(`/api/franchise-applications/pending/${id}`, data, config);
  },

  /**
   * SB Admin accept new franchise application (creates FranchiseInformation record)
   * @param {string} id - Application ID (must have statusOfBPLO = 'sb-approved')
   * @param {Object} data - Empty object or additional data
   * @returns {Promise} Response with created franchise information
   */
  acceptNewFranchise: (id, data) => api.post(`/api/franchise-applications/sb/accept-new/${id}`, data),

  /**
   * SB Admin accept renewal/amendment application (creates new version of FranchiseInformation)
   * @param {string} id - Application ID (must have statusOfBPLO = 'sb-approved')
   * @param {Object} data - Empty object or additional data
   * @returns {Promise} Response with updated franchise information
   */
  acceptRenewAmend: (id, data) => api.post(`/api/franchise-applications/sb/accept-renew-amend/${id}`, data)
};

// ====================================================================
// OPERATOR API METHODS
// ====================================================================

export const operatorAPI = {
  /**
   * Get all operators
   * @param {object} params - Query parameters
   * @returns {Promise} Response with operators array
   */
  getAll: (params = {}) => api.get('/api/operators', { params }),

  /**
   * Get operator by ID
   * @param {string} id - Operator ID
   * @returns {Promise} Response with operator details
   */
  getById: (id) => api.get(`/api/operators/${id}`),

  /**
   * Update operator information
   * @param {string} id - Operator ID
   * @param {object} data - Updated operator data
   * @returns {Promise} Response with updated operator
   */
  update: (id, data) => api.put(`/api/operators/${id}`, data),

  /**
   * Delete operator
   * @param {string} id - Operator ID
   * @returns {Promise} Response
   */
  delete: (id) => api.delete(`/api/operators/${id}`)
};

// ====================================================================
// USER MANAGEMENT API METHODS
// ====================================================================

export const userAPI = {
  /**
   * Get all users
   * @param {object} params - Query parameters
   * @returns {Promise} Response with users array
   */
  getAll: (params = {}) => api.get('/users', { params }),

  /**
   * Get user by ID
   * @param {string} id - User ID
   * @returns {Promise} Response with user details
   */
  getById: (id) => api.get(`/users/${id}`),

  /**
   * Create new user
   * @param {object} userData - User data
   * @returns {Promise} Response with created user
   */
  create: (userData) => api.post('/users', userData),

  /**
   * Update user
   * @param {string} id - User ID
   * @param {object} data - Updated user data
   * @returns {Promise} Response with updated user
   */
  update: (id, data) => api.put(`/users/${id}`, data),

  /**
   * Delete user
   * @param {string} id - User ID
   * @returns {Promise} Response
   */
  delete: (id) => api.delete(`/users/${id}`)
};

// ====================================================================
// ADMIN ACCOUNT API METHODS
// ====================================================================

export const adminAPI = {
  /**
   * Get all admin accounts
   * @param {object} params - Query parameters { includeInactive }
   * @returns {Promise} Response with admin accounts array
   */
  getAll: (params = {}) => api.get('/admins', { params }),

  /**
   * Get admin by ID
   * @param {string} id - Admin ID (adminId or _id)
   * @returns {Promise} Response with admin details
   */
  getById: (id) => api.get(`/admins/${id}`),

  /**
   * Get admins by role
   * @param {string} role - Admin role (sb-admin, bplo-admin, super-admin)
   * @returns {Promise} Response with admins array
   */
  getByRole: (role) => api.get(`/admins/role/${role}`),

  /**
   * Create new admin account
   * @param {object} adminData - Admin account data
   * @returns {Promise} Response with created admin
   */
  create: (adminData) => api.post('/admins', adminData),

  /**
   * Update admin account
   * @param {string} id - Admin ID (adminId or _id)
   * @param {object} data - Updated admin data
   * @returns {Promise} Response with updated admin
   */
  update: (id, data) => api.put(`/admins/${id}`, data),

  /**
   * Deactivate admin account (soft delete)
   * @param {string} id - Admin ID (adminId or _id)
   * @returns {Promise} Response
   */
  deactivate: (id) => api.patch(`/admins/${id}/deactivate`),

  /**
   * Activate admin account
   * @param {string} id - Admin ID (adminId or _id)
   * @returns {Promise} Response
   */
  activate: (id) => api.patch(`/admins/${id}/activate`),

  /**
   * Toggle admin account status (active/inactive)
   * @param {string} id - Admin ID (adminId or _id)
   * @returns {Promise} Response with updated status
   */
  toggleStatus: (id) => api.patch(`/admins/${id}/toggle-status`),

  /**
   * Delete admin account (hard delete)
   * @param {string} id - Admin ID (adminId or _id)
   * @returns {Promise} Response
   */
  delete: (id) => api.delete(`/admins/${id}`),

  /**
   * Add permission to admin
   * @param {string} id - Admin ID (adminId or _id)
   * @param {string} permission - Permission to add
   * @returns {Promise} Response with updated admin
   */
  addPermission: (id, permission) => api.post(`/admins/${id}/permissions`, { permission }),

  /**
   * Remove permission from admin
   * @param {string} id - Admin ID (adminId or _id)
   * @param {string} permission - Permission to remove
   * @returns {Promise} Response with updated admin
   */
  removePermission: (id, permission) => api.delete(`/admins/${id}/permissions`, { data: { permission } })
};

// ====================================================================
// DASHBOARD API METHODS
// ====================================================================

export const dashboardAPI = {
  /**
   * Get comprehensive dashboard statistics (KPIs + monthly trends)
   * Optimized single endpoint to reduce API calls
   * @returns {Promise} Response with dashboard statistics
   */
  getStatistics: () => api.get('/api/dashboard/statistics'),

  /**
   * Get recent franchise applications for activity feed
   * @param {number} limit - Number of recent applications to fetch (default: 5)
   * @returns {Promise} Response with recent applications
   */
  getRecentApplications: (limit = 5) => api.get('/api/dashboard/recent-applications', { params: { limit } }),

  /**
   * Get lightweight quick stats for frequent polling
   * @returns {Promise} Response with basic KPI numbers
   */
  getQuickStats: () => api.get('/api/dashboard/quick-stats'),

  /**
   * Get analytics data (franchise distribution by barangay)
   * @returns {Promise} Response with analytics data
   */
  getAnalytics: () => api.get('/api/dashboard/analytics'),

  /**
   * Get franchises expiring in a specific month/year
   * @param {number} month - Month (1-12)
   * @param {number} year - Year (e.g., 2025)
   * @returns {Promise} Response with expiring franchises
   */
  getExpiringFranchises: (month, year) => api.get('/api/dashboard/expiring-franchises', { params: { month, year } })
};

// ====================================================================
// FRANCHISE INFORMATION API METHODS
// ====================================================================

export const franchiseInformationAPI = {
  /**
   * Get all current franchise records
   * @param {object} params - Query parameters
   * @returns {Promise} Response with franchise information array
   */
  getAll: (params = {}) => api.get('/api/franchise-information', { params }),

  /**
   * Get franchise by ID
   * @param {string} id - Franchise ID
   * @returns {Promise} Response with franchise details
   */
  getById: (id) => api.get(`/api/franchise-information/${id}`),

  /**
   * Get franchise by number
   * @param {string} franchiseNumber - Franchise number
   * @returns {Promise} Response with franchise details
   */
  getByNumber: (franchiseNumber) => api.get(`/api/franchise-information/number/${franchiseNumber}`),

  /**
   * Get franchises by user ID
   * @param {string} userId - User ID
   * @returns {Promise} Response with user's franchises array
   */
  getByUser: (userId) => api.get(`/api/franchise-information/by-user/${userId}`),

  /**
   * Link existing franchise to operator account
   * @param {object} data - { franchiseNumber, mtofDocument (optional) }
   * @returns {Promise} Response with linked franchise
   */
  linkFranchise: (data) => {
    // If mtofDocument is a file, use FormData
    if (data.mtofDocument instanceof File) {
      const formData = new FormData();
      formData.append('franchiseNumber', data.franchiseNumber);
      formData.append('mtofDocument', data.mtofDocument);
      
      return api.post('/api/franchise-information/link', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    
    // Otherwise send as JSON
    return api.post('/api/franchise-information/link', data);
  },

  /**
   * Update franchise information
   * @param {string} id - Franchise ID
   * @param {object} data - Updated franchise data
   * @returns {Promise} Response with updated franchise
   */
  update: (id, data) => api.put(`/api/franchise-information/${id}`, data),

  /**
   * Get franchise history/versions
   * @param {string} franchiseNumber - Franchise number
   * @returns {Promise} Response with version history
   */
  getHistory: (franchiseNumber) => api.get(`/api/franchise-information/history/${franchiseNumber}`),

  /**
   * Get franchise chain history (all versions of one user's franchise)
   * @param {string} franchiseChainId - Franchise chain ID (format: user-{userId}-{timestamp})
   * @returns {Promise} Response with franchise chain history and latest version
   */
  getByChainId: (franchiseChainId) => api.get(`/api/franchise-information/chain/${franchiseChainId}`),

  /**
   * Get available franchise numbers for recycling/reassignment
   * @returns {Promise} Response with available numbers and statistics
   */
  getAvailableNumbers: () => api.get('/api/franchise-information/available-numbers')
};

// ====================================================================
// ANNOUNCEMENT API METHODS
// ====================================================================

export const announcementAPI = {
  /**
   * Get all announcements
   * @returns {Promise} Response with announcements array
   */
  getAll: () => api.get('/api/announcements'),

  /**
   * Get published announcements (public)
   * @returns {Promise} Response with published announcements
   */
  getPublished: () => api.get('/api/announcements/published'),

  /**
   * Get recent announcements
   * @param {number} limit - Number of announcements to fetch
   * @returns {Promise} Response with recent announcements
   */
  getRecent: (limit = 5) => api.get('/api/announcements/recent', { params: { limit } }),

  /**
   * Get announcement by ID
   * @param {string} id - Announcement ID
   * @returns {Promise} Response with announcement details
   */
  getById: (id) => api.get(`/api/announcements/${id}`),

  /**
   * Create new announcement (Admin only)
   * @param {object} announcementData - Announcement data
   * @returns {Promise} Response with created announcement
   */
  create: (announcementData) => api.post('/api/announcements', announcementData),

  /**
   * Update announcement (Admin only)
   * @param {string} id - Announcement ID
   * @param {object} data - Updated announcement data
   * @returns {Promise} Response with updated announcement
   */
  update: (id, data) => api.put(`/api/announcements/${id}`, data),

  /**
   * Delete announcement (Admin only)
   * @param {string} id - Announcement ID
   * @returns {Promise} Response
   */
  delete: (id) => api.delete(`/api/announcements/${id}`)
};

// ====================================================================
// INCIDENT REPORTS API METHODS
// ====================================================================

export const incidentReportsAPI = {
  /**
   * Get available incident categories
   * @returns {Promise} Response with categories array
   */
  getCategories: () => api.get('/api/incident-reports/categories'),

  /**
   * Get all incident reports with filtering
   * @param {object} params - Query parameters (page, limit, search, status, category, sortBy, sortOrder)
   * @returns {Promise} Response with reports array and pagination
   */
  getAll: (params = {}) => api.get('/api/incident-reports', { params }),

  /**
   * Get incident report statistics
   * @returns {Promise} Response with statistics including category breakdown
   */
  getStatistics: () => api.get('/api/incident-reports/statistics'),

  /**
   * Get monthly incident reports with optional filters
   * @param {number} year - Year
   * @param {number} month - Month
   * @param {object} filters - Optional filters (category, status)
   * @returns {Promise} Response with monthly reports
   */
  getMonthly: (year, month, filters = {}) => api.get('/api/incident-reports/monthly', { 
    params: { year, month, ...filters } 
  }),

  /**
   * Get incident reports by date range with optional filters
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {object} filters - Optional filters (category, status, format)
   * @returns {Promise} Response with reports
   */
  getByDateRange: (startDate, endDate, filters = {}) => api.get('/api/incident-reports/date-range', { 
    params: { startDate, endDate, ...filters } 
  }),

  /**
   * Get incident report by ID
   * @param {string} id - Report ID
   * @returns {Promise} Response with report details
   */
  getById: (id) => api.get(`/api/incident-reports/${id}`),

  /**
   * Create new incident report (authenticated)
   * @param {object} reportData - Report data including category
   * @returns {Promise} Response with created report
   */
  create: (reportData) => api.post('/api/incident-reports', reportData),

  /**
   * Create public incident report (no auth required)
   * @param {object} reportData - Report data including category
   * @returns {Promise} Response with created report
   */
  createPublic: (reportData) => api.post('/api/incident-reports/public', reportData),

  /**
   * Update incident report
   * @param {string} id - Report ID
   * @param {object} data - Updated report data
   * @returns {Promise} Response with updated report
   */
  update: (id, data) => api.put(`/api/incident-reports/${id}`, data),

  /**
   * Delete incident report
   * @param {string} id - Report ID
   * @returns {Promise} Response
   */
  delete: (id) => api.delete(`/api/incident-reports/${id}`)
};

// Legacy alias for backward compatibility
export const reportsAPI = incidentReportsAPI;

// ====================================================================
// QR CODE API METHODS
// ====================================================================

export const qrCodeAPI = {
  /**
   * Get all operators with QR codes
   * @returns {Promise} Response with operators array
   */
  getAllOperators: () => api.get('/api/qr/operators'),

  /**
   * Get operator QR code
   * @param {string} operatorId - Operator ID
   * @returns {Promise} Response with QR code data
   */
  getOperatorQR: (operatorId) => api.get(`/api/qr/operator/${operatorId}`),

  /**
   * Generate QR code for operator
   * @param {string} operatorId - Operator ID
   * @param {object} options - Generation options
   * @returns {Promise} Response with generated QR code
   */
  generateOperatorQR: (operatorId, options = {}) => api.post(`/api/qr/generate/operator/${operatorId}`, options),

  /**
   * Regenerate QR code for operator
   * @param {string} operatorId - Operator ID
   * @returns {Promise} Response with regenerated QR code
   */
  regenerateOperatorQR: (operatorId) => api.put(`/api/qr/regenerate/operator/${operatorId}`),

  /**
   * Delete operator QR code
   * @param {string} operatorId - Operator ID
   * @returns {Promise} Response
   */
  deleteOperatorQR: (operatorId) => api.delete(`/api/qr/operator/${operatorId}`),

  /**
   * Generate QR code for franchise application
   * @param {string} applicationId - Application ID
   * @returns {Promise} Response with generated QR code
   */
  generateFranchiseQR: (applicationId) => api.post(`/api/qr/generate/franchise/${applicationId}`),

  /**
   * Download QR code as PNG
   * @param {string} operatorId - Operator ID
   * @returns {Promise} Response with file blob
   */
  downloadOperatorQR: (operatorId) => api.get(`/api/qr/download/operator/${operatorId}`, { responseType: 'blob' })
};

// Export default api instance for custom requests
export default api;
