import axios from 'axios';

// ============================================
// CONFIGURATION
// ============================================
const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170',
  timeout: 30000, // 30 seconds for large file uploads
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
};

// Token storage keys
const TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';

// ============================================
// SECURE TOKEN MANAGEMENT
// ============================================

/**
 * Secure token storage using sessionStorage only
 * Note: localStorage is vulnerable to XSS attacks
 * Refresh tokens are stored in HTTP-only cookies by backend (not accessible to JS)
 */
const TokenManager = {
  // Get access token from sessionStorage
  getAccessToken: () => {
    return sessionStorage.getItem(TOKEN_KEY);
  },

  // Set tokens (only access token - refresh token is in HTTP-only cookie)
  setTokens: (accessToken) => {
    if (accessToken) {
      sessionStorage.setItem(TOKEN_KEY, accessToken);
    }
    // Note: refreshToken is stored in HTTP-only cookie by backend
    // We don't store it client-side for security
  },

  // Clear all tokens
  clearTokens: () => {
    // Clear sessionStorage (access token)
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY); // Legacy cleanup
    
    // Clean up any legacy localStorage tokens (security cleanup)
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('token');
    localStorage.removeItem(USER_KEY);
    
    // Note: HTTP-only refresh token cookie is cleared by backend on logout
    // We can't access or delete it from JavaScript (that's the security feature)
  },

  // Decode JWT token (client-side validation only)
  decodeToken: (token) => {
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      return payload;
    } catch (error) {
      console.error('Token decode error:', error);
      return null;
    }
  },

  // Check if token is expired
  isTokenExpired: (token) => {
    const decoded = TokenManager.decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    // Add 60 second buffer before expiration
    const expirationTime = decoded.exp * 1000 - 60000;
    return Date.now() >= expirationTime;
  },

  // Validate token
  isValid: (token) => {
    return token && !TokenManager.isTokenExpired(token);
  },
};

// ============================================
// AXIOS INSTANCE
// ============================================
const api = axios.create(API_CONFIG);

// Track if we're currently refreshing to prevent multiple refresh requests
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

// ============================================
// REQUEST INTERCEPTOR
// ============================================
api.interceptors.request.use(
  (config) => {
    // Get token from sessionStorage ONLY (no localStorage fallback for security)
    const token = TokenManager.getAccessToken();
    
    if (token) {
      // Validate token before using
      if (TokenManager.isTokenExpired(token)) {
        console.warn('Token expired, will attempt refresh');
        // Let the response interceptor handle the refresh
      }
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request timestamp for monitoring (dev only)
    if (import.meta.env.DEV) {
      config.metadata = { startTime: new Date().getTime() };
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================
// RESPONSE INTERCEPTOR
// ============================================
api.interceptors.response.use(
  (response) => {
    // Log request duration in development
    if (import.meta.env.DEV && response.config.metadata) {
      const duration = new Date().getTime() - response.config.metadata.startTime;
      console.log(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle network errors
    if (!error.response) {
      console.error('Network error: Please check your internet connection');
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        type: 'NETWORK_ERROR'
      });
    }

    // Handle 401 Unauthorized with token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      // Refresh token is in HTTP-only cookie (backend reads it automatically)
      // No need to get it from sessionStorage

      try {
        // Attempt to refresh the token
        // Backend expects: POST /auth/refresh-token (not /auth/refresh)
        // Backend reads refreshToken from HTTP-only cookie (not request body)
        const response = await axios.post(
          `${API_CONFIG.baseURL}/auth/refresh-token`,
          {}, // Empty body - backend reads from cookie
          { 
            withCredentials: true, // Required to send HTTP-only cookie
            timeout: 10000 // 10 second timeout
          }
        );

        const { accessToken } = response.data;
        
        // Store new access token (refresh token stays in HTTP-only cookie)
        TokenManager.setTokens(accessToken);
        
        // Update the original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        
        // Process queued requests
        processQueue(null, accessToken);
        
        isRefreshing = false;
        
        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        processQueue(refreshError, null);
        isRefreshing = false;
        
        TokenManager.clearTokens();
        window.location.href = '/login';
        
        return Promise.reject(refreshError);
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error('Access denied: Insufficient permissions');
      return Promise.reject({
        message: 'You do not have permission to perform this action.',
        type: 'FORBIDDEN'
      });
    }

    // Handle 429 Too Many Requests
    if (error.response?.status === 429) {
      console.error('Rate limit exceeded');
      return Promise.reject({
        message: 'Too many requests. Please try again later.',
        type: 'RATE_LIMIT'
      });
    }

    // Handle 500+ Server Errors
    if (error.response?.status >= 500) {
      console.error('Server error:', error.response?.status);
      return Promise.reject({
        message: 'Server error. Please try again later.',
        type: 'SERVER_ERROR'
      });
    }

    return Promise.reject(error);
  }
);

// ============================================
// API ENDPOINTS
// ============================================

export const authAPI = {
  // Login
  login: (credentials) => api.post('/auth/login', credentials),
  
  // Signup
  signup: (userData) => api.post('/auth/signup', userData),
  
  // Logout (call backend first to clear HTTP-only cookie, then clear sessionStorage)
  logout: async () => {
    try {
      // Backend clears the refresh token cookie
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Always clear client-side tokens, even if backend call fails
      TokenManager.clearTokens();
    }
  },
  
  // Get current user (used by AuthContext)
  getMe: () => api.get('/auth/me'),
  
  // Verify email
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  
  // Refresh token (manual refresh - auto refresh happens in response interceptor)
  // Backend reads refreshToken from HTTP-only cookie (not request body)
  refreshToken: () => api.post('/auth/refresh-token'),
  
  // Request password reset
  requestPasswordReset: (email) => api.post('/auth/forgot-password', { email }),
  
  // Reset password
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
  
  // Google OAuth
  googleAuth: () => api.get('/auth/google'),
  
  // Request OTP (used by UserManagement)
  requestOTP: (email) => api.post('/auth/request-otp', { email }),
  
  // Verify OTP (used by verification modal)
  verifyOTP: (email, otp) => api.post('/auth/verify-otp', { email, otp }),
};

export const operatorAPI = {
  // Get operator information
  getOperatorInfo: (operatorId) => api.get(`/operators/${operatorId}`),
  
  // Update operator information
  updateOperatorInfo: (operatorId, data) => api.put(`/operators/${operatorId}`, data),
  
  // Get franchise status
  getFranchiseStatus: (operatorId) => api.get(`/operators/${operatorId}/franchise`),
  
  // Upload operator document
  uploadDocument: (operatorId, file, documentType) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    
    return api.post(`/operators/${operatorId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // 60 seconds for file uploads
    });
  },
};

export const franchiseAPI = {
  // Get franchise applications
  getApplications: (params = {}) => api.get('/api/pending-apps', { params }),
  
  // Get approved franchises
  getApprovedFranchises: (params = {}) => api.get('/api/pending-apps/approved', { params }),
  
  // Submit franchise application
  submitApplication: (data) => {
    // Handle FormData for file uploads
    if (data instanceof FormData) {
      return api.post('/api/pending-apps', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000, // 60 seconds for file uploads
      });
    }
    return api.post('/api/pending-apps', data);
  },
  
  // Update franchise application
  updateApplication: (id, data) => api.put(`/api/pending-apps/${id}`, data),
  
  // Delete franchise application
  deleteApplication: (id) => api.delete(`/api/pending-apps/${id}`),
  
  // Approve franchise application
  approveApplication: (id, data = {}) => api.put(`/api/pending-apps/${id}/approve`, data),
  
  // Reject franchise application
  rejectApplication: (id, reason) => api.put(`/api/pending-apps/${id}/reject`, { reason }),
};

export const reportsAPI = {
  // Submit report
  submitReport: (data) => api.post('/reports', data),
  
  // Get reports with filters
  getReports: (filters = {}) => api.get('/reports', { params: filters }),
  
  // Get single report
  getReport: (reportId) => api.get(`/reports/${reportId}`),
  
  // Get monthly reports export
  getMonthlyReportsCSV: (month, year) => 
    api.get('/reports/monthly', {
      params: { month, year, format: 'csv' },
      responseType: 'blob',
      timeout: 60000, // 60 seconds for large exports
    }),
  
  // Update report status
  updateReportStatus: (reportId, status) => api.put(`/reports/${reportId}`, { status }),
  
  // Delete report
  deleteReport: (reportId) => api.delete(`/reports/${reportId}`),
  
  // Additional backwards compatibility: allow direct query string calls
  getReportsWithQuery: (queryString) => api.get(`/reports?${queryString}`),
};

export const userAPI = {
  // Get all users
  getUsers: (params = {}) => api.get('/users', { params }),
  
  // Get single user
  getUser: (userId) => api.get(`/users/${userId}`),
  
  // Create user
  createUser: (data) => api.post('/users', data),
  
  // Update user
  updateUser: (userId, data) => api.put(`/users/${userId}`, data),
  
  // Delete user
  deleteUser: (userId) => api.delete(`/users/${userId}`),
  
  // Request OTP
  requestOTP: (email) => api.post('/auth/request-otp', { email }),
  
  // Verify OTP
  verifyOTP: (email, otp) => api.post('/auth/verify-otp', { email, otp }),
  
  // Change password
  changePassword: (userId, currentPassword, newPassword) => 
    api.put(`/users/${userId}/password`, { currentPassword, newPassword }),
};

// ============================================
// UTILITY EXPORTS
// ============================================

// Export token utilities (with backward compatibility)
export const getAccessToken = TokenManager.getAccessToken;
export const setTokens = TokenManager.setTokens;
export const clearTokens = TokenManager.clearTokens;
export const decodeToken = TokenManager.decodeToken;
export const isTokenValid = TokenManager.isValid; // Map to isValid for consistency
export const isValid = TokenManager.isValid; // Keep both names for compatibility

// Get current token
export const getToken = () => TokenManager.getAccessToken();

// Export axios instance for custom requests
export default api;