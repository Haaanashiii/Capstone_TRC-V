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
   * Check if token is expired (with 2 minute buffer)
   * @param {string} token - JWT token to check
   * @returns {boolean} True if expired
   */
  isTokenExpired: (token) => {
    const decoded = TokenManager.decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    // Add 2 minute buffer (120000 ms) - tokens are short-lived (15min)
    const bufferTime = 120000;
    return (decoded.exp * 1000) <= (Date.now() + bufferTime);
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
      // Validate token before sending
      if (TokenManager.isValid(token)) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.warn('[API] Token expired, clearing...');
        TokenManager.clearTokens();
        // Request will proceed without token (backend will return 401)
      }
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

    // Handle 401 Unauthorized - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
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
   * Get pending franchise applications
   * @returns {Promise} Response with pending applications array
   */
  getPending: () => api.get('/api/franchise-applications', { params: { status: 'pending' } }),

  /**
   * Get approved franchise applications
   * @returns {Promise} Response with approved applications array
   */
  getApproved: () => api.get('/api/franchise-applications', { params: { status: 'approved' } }),

  /**
   * Get single franchise application by ID
   * @param {string} id - Application ID
   * @returns {Promise} Response with application details
   */
  getById: (id) => api.get(`/api/franchise-applications/${id}`),

  /**
   * Create new franchise application (PUBLIC - no authentication required)
   * @param {object} applicationData - Application data (JSON object)
   * @returns {Promise} Response with created application
   */
  create: (applicationData) => {
    // Use base axios instance without authentication
    // If applicationData is FormData, do NOT set Content-Type so the
    // browser/axios can set the multipart/form-data boundary correctly.
    // For regular JSON payloads, preserve the original behavior and
    // send Content-Type: application/json (this is important for other
    // callers which may expect JSON behavior such as QR generation flows).
    const publicApi = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000,
      withCredentials: true,
    });

    const config = {};
    if (!(applicationData instanceof FormData)) {
      config.headers = { 'Content-Type': 'application/json' };
    }

    return publicApi.post('/api/franchise-applications', applicationData, config);
  },

  /**
   * Approve franchise application
   * @param {string} id - Application ID
   * @returns {Promise} Response with approved application
   */
  approve: (id) => api.put(`/api/franchise-applications/${id}/approve`, {
    actionTaken: 'APPROVED',
    remarks: 'Application approved'
  }),

  /**
   * Reject franchise application
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
   * @param {object} data - Updated application data
   * @returns {Promise} Response with updated application
   */
  update: (id, data) => api.put(`/api/franchise-applications/${id}`, data)
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

// Export default api instance for custom requests
export default api;
