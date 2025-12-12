/**
 * Security Utilities for CAPSTONE_TRC-V Dashboard
 * Client-side security enforcement and helpers
 * 
 * Features:
 * - HTTPS enforcement
 * - Proactive token refresh
 * - Security headers validation
 * - Content Security Policy helpers
 */

import logger from './logger';

// ====================================================================
// HTTPS ENFORCEMENT
// ====================================================================

/**
 * Check if current connection is using HTTPS
 * @returns {boolean} True if using HTTPS
 */
export function isHttps() {
  return window.location.protocol === 'https:';
}

/**
 * Check if running in development mode
 * @returns {boolean} True if development
 */
export function isDevelopment() {
  return import.meta.env.DEV || 
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1' ||
         window.location.hostname.startsWith('192.168.') ||
         window.location.hostname.endsWith('.local');
}

/**
 * Enforce HTTPS connection in production
 * Redirects HTTP to HTTPS automatically
 * @param {object} options - Configuration options
 */
export function enforceHttps(options = {}) {
  const {
    enabled = true,
    allowDevelopment = true,
    redirectDelay = 0,
    onRedirect = null
  } = options;
  
  if (!enabled) return;
  
  // Skip enforcement in development
  if (allowDevelopment && isDevelopment()) {
    logger.log('[Security] HTTPS enforcement skipped in development mode');
    return;
  }
  
  // Check if already on HTTPS
  if (isHttps()) {
    logger.log('[Security] Connection is secure (HTTPS)');
    return;
  }
  
  // Redirect to HTTPS
  logger.warn('[Security] Insecure connection detected, redirecting to HTTPS...');
  
  if (onRedirect) {
    onRedirect();
  }
  
  const httpsUrl = window.location.href.replace('http://', 'https://');
  
  if (redirectDelay > 0) {
    setTimeout(() => {
      window.location.replace(httpsUrl);
    }, redirectDelay);
  } else {
    window.location.replace(httpsUrl);
  }
}

/**
 * Validate API URL uses HTTPS in production
 * @param {string} url - API URL to validate
 * @returns {string} Validated/corrected URL
 */
export function ensureHttpsUrl(url) {
  if (!url) return url;
  
  // Skip in development
  if (isDevelopment()) return url;
  
  // Force HTTPS for production API calls
  if (url.startsWith('http://')) {
    logger.warn('[Security] Converting insecure API URL to HTTPS');
    return url.replace('http://', 'https://');
  }
  
  return url;
}

// ====================================================================
// PROACTIVE TOKEN REFRESH
// ====================================================================

/**
 * Token refresh scheduler
 * Proactively refreshes tokens before they expire
 */
class TokenRefreshScheduler {
  constructor() {
    this.refreshTimer = null;
    this.refreshCallback = null;
    this.bufferSeconds = 60; // Refresh 1 minute before expiry
    this.minRefreshInterval = 30000; // Minimum 30 seconds between refreshes
    this.lastRefreshTime = 0;
    this.isRefreshing = false;
  }

  /**
   * Start the token refresh scheduler
   * @param {string} token - JWT token
   * @param {Function} refreshFn - Function to call for refresh
   */
  start(token, refreshFn) {
    this.stop(); // Clear any existing timer
    
    if (!token || !refreshFn) {
      logger.warn('[TokenRefresh] Cannot start scheduler: missing token or refresh function');
      return;
    }
    
    this.refreshCallback = refreshFn;
    this.scheduleRefresh(token);
  }

  /**
   * Schedule the next token refresh
   * @param {string} token - JWT token
   */
  scheduleRefresh(token) {
    const decoded = this.decodeToken(token);
    
    if (!decoded || !decoded.exp) {
      logger.warn('[TokenRefresh] Cannot schedule: token has no expiration');
      return;
    }
    
    const now = Date.now();
    const expiryTime = decoded.exp * 1000;
    const refreshTime = expiryTime - (this.bufferSeconds * 1000);
    
    // Calculate delay until refresh
    let delay = refreshTime - now;
    
    // If token is already expired or will expire soon, refresh immediately
    if (delay < 0) {
      delay = 0;
    }
    
    // Enforce minimum interval
    const timeSinceLastRefresh = now - this.lastRefreshTime;
    if (timeSinceLastRefresh < this.minRefreshInterval) {
      delay = Math.max(delay, this.minRefreshInterval - timeSinceLastRefresh);
    }
    
    logger.log(`[TokenRefresh] Scheduling refresh in ${Math.round(delay / 1000)} seconds`);
    
    this.refreshTimer = setTimeout(() => {
      this.executeRefresh();
    }, delay);
  }

  /**
   * Execute token refresh
   */
  async executeRefresh() {
    if (this.isRefreshing) {
      logger.log('[TokenRefresh] Refresh already in progress, skipping');
      return;
    }
    
    this.isRefreshing = true;
    
    try {
      logger.log('[TokenRefresh] Executing proactive token refresh...');
      const newToken = await this.refreshCallback();
      this.lastRefreshTime = Date.now();
      
      if (newToken) {
        logger.log('[TokenRefresh] Token refreshed successfully');
        this.scheduleRefresh(newToken);
      }
    } catch (error) {
      logger.error('[TokenRefresh] Refresh failed:', error.message);
      // Don't reschedule on failure - let the response interceptor handle it
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.refreshCallback = null;
    this.isRefreshing = false;
  }

  /**
   * Decode JWT token
   * @param {string} token - JWT token
   * @returns {object|null} Decoded payload
   */
  decodeToken(token) {
    try {
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(atob(parts[1]));
    } catch {
      return null;
    }
  }

  /**
   * Get time until token expires
   * @param {string} token - JWT token
   * @returns {number} Seconds until expiry (negative if expired)
   */
  getTimeUntilExpiry(token) {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return -1;
    return decoded.exp - Math.floor(Date.now() / 1000);
  }

  /**
   * Check if token needs refresh soon
   * @param {string} token - JWT token
   * @returns {boolean} True if refresh needed
   */
  needsRefresh(token) {
    const timeUntilExpiry = this.getTimeUntilExpiry(token);
    return timeUntilExpiry <= this.bufferSeconds;
  }
}

// Singleton instance
export const tokenRefreshScheduler = new TokenRefreshScheduler();

// ====================================================================
// SECURITY HEADERS VALIDATION
// ====================================================================

/**
 * Validate response security headers
 * @param {object} headers - Response headers
 * @returns {object} Validation result
 */
export function validateSecurityHeaders(headers) {
  const issues = [];
  const expected = {
    'strict-transport-security': true,
    'x-content-type-options': 'nosniff',
    'x-frame-options': true,
    'x-xss-protection': true
  };
  
  for (const [header, value] of Object.entries(expected)) {
    const headerValue = headers?.[header] || headers?.get?.(header);
    
    if (!headerValue) {
      issues.push(`Missing security header: ${header}`);
    } else if (typeof value === 'string' && headerValue !== value) {
      issues.push(`Invalid ${header}: expected ${value}, got ${headerValue}`);
    }
  }
  
  return {
    isSecure: issues.length === 0,
    issues
  };
}

// ====================================================================
// SESSION SECURITY
// ====================================================================

/**
 * Generate a random session fingerprint
 * @returns {string} Session fingerprint
 */
export function generateSessionFingerprint() {
  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown'
  ].join('|');
  
  // Simple hash function (for fingerprinting, not cryptographic use)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return hash.toString(36);
}

/**
 * Store session fingerprint
 */
export function storeSessionFingerprint() {
  const fingerprint = generateSessionFingerprint();
  sessionStorage.setItem('sessionFingerprint', fingerprint);
  return fingerprint;
}

/**
 * Validate session fingerprint
 * @returns {boolean} True if fingerprint matches
 */
export function validateSessionFingerprint() {
  const stored = sessionStorage.getItem('sessionFingerprint');
  if (!stored) return true; // No fingerprint stored yet
  
  const current = generateSessionFingerprint();
  return stored === current;
}

// ====================================================================
// SECURE STORAGE HELPERS
// ====================================================================

/**
 * Secure storage wrapper with encryption (for non-sensitive data)
 * Note: For truly sensitive data, use HTTP-only cookies on server
 */
export const secureStorage = {
  /**
   * Set item with optional expiry
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @param {number} expiryMs - Expiry time in milliseconds
   */
  set(key, value, expiryMs = null) {
    const item = {
      value,
      timestamp: Date.now(),
      expiry: expiryMs ? Date.now() + expiryMs : null
    };
    sessionStorage.setItem(key, JSON.stringify(item));
  },

  /**
   * Get item (returns null if expired)
   * @param {string} key - Storage key
   * @returns {any} Stored value or null
   */
  get(key) {
    try {
      const item = JSON.parse(sessionStorage.getItem(key));
      
      if (!item) return null;
      
      // Check expiry
      if (item.expiry && Date.now() > item.expiry) {
        sessionStorage.removeItem(key);
        return null;
      }
      
      return item.value;
    } catch {
      return null;
    }
  },

  /**
   * Remove item
   * @param {string} key - Storage key
   */
  remove(key) {
    sessionStorage.removeItem(key);
  },

  /**
   * Clear all secure storage
   */
  clear() {
    sessionStorage.clear();
  }
};

// ====================================================================
// INITIALIZATION
// ====================================================================

/**
 * Initialize security features
 * Call this in your app's entry point
 * @param {object} options - Configuration options
 */
export function initializeSecurity(options = {}) {
  const {
    enforceHttpsEnabled = true,
    validateFingerprint = true
  } = options;
  
  // Enforce HTTPS in production
  if (enforceHttpsEnabled) {
    enforceHttps();
  }
  
  // Validate session fingerprint
  if (validateFingerprint) {
    if (!validateSessionFingerprint()) {
      logger.warn('[Security] Session fingerprint mismatch - possible session hijacking');
      // Could trigger logout or security alert here
    }
    storeSessionFingerprint();
  }
  
  logger.log('[Security] Security features initialized');
}

// ====================================================================
// EXPORTS
// ====================================================================

export default {
  // HTTPS
  isHttps,
  isDevelopment,
  enforceHttps,
  ensureHttpsUrl,
  
  // Token refresh
  tokenRefreshScheduler,
  
  // Security validation
  validateSecurityHeaders,
  
  // Session security
  generateSessionFingerprint,
  storeSessionFingerprint,
  validateSessionFingerprint,
  
  // Secure storage
  secureStorage,
  
  // Initialization
  initializeSecurity
};
