/**
 * Client-Side Rate Limiter for CAPSTONE_TRC-V
 * Prevents excessive API calls and protects against accidental spam
 * 
 * Features:
 * - Per-endpoint rate limiting
 * - Global rate limiting
 * - Request queuing with exponential backoff
 * - Debouncing and throttling utilities
 */

// ====================================================================
// RATE LIMITER CONFIGURATION
// ====================================================================

const DEFAULT_CONFIG = {
  // Global limits
  globalMaxRequests: 100,        // Max requests across all endpoints
  globalWindowMs: 60000,         // 1 minute window
  
  // Per-endpoint limits
  endpointMaxRequests: 30,       // Max requests per endpoint
  endpointWindowMs: 60000,       // 1 minute window
  
  // Specific endpoint overrides
  endpointOverrides: {
    '/auth/login': { maxRequests: 5, windowMs: 60000 },
    '/auth/signup': { maxRequests: 3, windowMs: 60000 },
    '/auth/request-otp': { maxRequests: 5, windowMs: 300000 },
    '/auth/forgot-password': { maxRequests: 3, windowMs: 300000 },
    '/api/franchise-applications': { maxRequests: 10, windowMs: 60000 },
    '/api/reports/public': { maxRequests: 5, windowMs: 3600000 },
  },
  
  // Retry configuration
  maxRetries: 3,
  baseRetryDelay: 1000,          // 1 second base delay
  maxRetryDelay: 30000,          // 30 seconds max delay
};

// ====================================================================
// RATE LIMITER CLASS
// ====================================================================

class RateLimiter {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.globalRequests = [];
    this.endpointRequests = new Map();
    this.blockedUntil = new Map();
  }

  /**
   * Get endpoint key from URL
   * @param {string} url - Request URL
   * @returns {string} Normalized endpoint key
   */
  getEndpointKey(url) {
    try {
      // Remove query params and normalize
      const path = url.split('?')[0];
      // Remove IDs from paths for grouping (e.g., /api/users/123 → /api/users/:id)
      return path.replace(/\/[0-9a-f]{24}/gi, '/:id')
                 .replace(/\/\d+/g, '/:id');
    } catch {
      return url;
    }
  }

  /**
   * Get config for specific endpoint
   * @param {string} endpoint - Endpoint path
   * @returns {object} Rate limit config for endpoint
   */
  getEndpointConfig(endpoint) {
    const override = Object.entries(this.config.endpointOverrides).find(([key]) => 
      endpoint.includes(key)
    );
    
    if (override) {
      return override[1];
    }
    
    return {
      maxRequests: this.config.endpointMaxRequests,
      windowMs: this.config.endpointWindowMs
    };
  }

  /**
   * Clean up old requests outside the window
   * @param {Array} requests - Array of request timestamps
   * @param {number} windowMs - Window size in milliseconds
   * @returns {Array} Filtered requests within window
   */
  cleanOldRequests(requests, windowMs) {
    const now = Date.now();
    return requests.filter(timestamp => now - timestamp < windowMs);
  }

  /**
   * Check if request can proceed
   * @param {string} url - Request URL
   * @returns {object} { allowed: boolean, retryAfter?: number, reason?: string }
   */
  canMakeRequest(url) {
    const now = Date.now();
    const endpoint = this.getEndpointKey(url);
    
    // Check if endpoint is temporarily blocked
    const blockedUntil = this.blockedUntil.get(endpoint);
    if (blockedUntil && now < blockedUntil) {
      return {
        allowed: false,
        retryAfter: Math.ceil((blockedUntil - now) / 1000),
        reason: 'ENDPOINT_BLOCKED'
      };
    }
    
    // Check global rate limit
    this.globalRequests = this.cleanOldRequests(
      this.globalRequests, 
      this.config.globalWindowMs
    );
    
    if (this.globalRequests.length >= this.config.globalMaxRequests) {
      const oldestRequest = this.globalRequests[0];
      const retryAfter = Math.ceil((oldestRequest + this.config.globalWindowMs - now) / 1000);
      return {
        allowed: false,
        retryAfter,
        reason: 'GLOBAL_LIMIT_EXCEEDED'
      };
    }
    
    // Check endpoint rate limit
    const endpointConfig = this.getEndpointConfig(endpoint);
    let endpointRequests = this.endpointRequests.get(endpoint) || [];
    endpointRequests = this.cleanOldRequests(endpointRequests, endpointConfig.windowMs);
    this.endpointRequests.set(endpoint, endpointRequests);
    
    if (endpointRequests.length >= endpointConfig.maxRequests) {
      const oldestRequest = endpointRequests[0];
      const retryAfter = Math.ceil((oldestRequest + endpointConfig.windowMs - now) / 1000);
      return {
        allowed: false,
        retryAfter,
        reason: 'ENDPOINT_LIMIT_EXCEEDED'
      };
    }
    
    return { allowed: true };
  }

  /**
   * Record a request
   * @param {string} url - Request URL
   */
  recordRequest(url) {
    const now = Date.now();
    const endpoint = this.getEndpointKey(url);
    
    // Record global request
    this.globalRequests.push(now);
    
    // Record endpoint request
    const endpointRequests = this.endpointRequests.get(endpoint) || [];
    endpointRequests.push(now);
    this.endpointRequests.set(endpoint, endpointRequests);
  }

  /**
   * Handle rate limit response from server (429)
   * @param {string} url - Request URL
   * @param {number} retryAfter - Seconds until retry
   */
  handleServerRateLimit(url, retryAfter = 60) {
    const endpoint = this.getEndpointKey(url);
    this.blockedUntil.set(endpoint, Date.now() + (retryAfter * 1000));
  }

  /**
   * Calculate exponential backoff delay
   * @param {number} attempt - Current retry attempt (0-indexed)
   * @returns {number} Delay in milliseconds
   */
  getRetryDelay(attempt) {
    const delay = this.config.baseRetryDelay * Math.pow(2, attempt);
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    return Math.min(delay + jitter, this.config.maxRetryDelay);
  }

  /**
   * Clear rate limit data (for testing or logout)
   */
  reset() {
    this.globalRequests = [];
    this.endpointRequests.clear();
    this.blockedUntil.clear();
  }

  /**
   * Get current rate limit status
   * @returns {object} Current rate limit statistics
   */
  getStatus() {
    return {
      globalRequestsInWindow: this.globalRequests.length,
      globalLimit: this.config.globalMaxRequests,
      endpointsCounted: this.endpointRequests.size,
      blockedEndpoints: Array.from(this.blockedUntil.entries())
        .filter(([, time]) => Date.now() < time)
        .map(([endpoint, time]) => ({
          endpoint,
          blockedUntilMs: time - Date.now()
        }))
    };
  }
}

// ====================================================================
// THROTTLE & DEBOUNCE UTILITIES
// ====================================================================

/**
 * Throttle function - limits how often a function can be called
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between calls in ms
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 1000) {
  let inThrottle = false;
  let lastResult;
  
  return function(...args) {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
    return lastResult;
  };
}

/**
 * Debounce function - delays execution until after pause in calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @param {boolean} immediate - Execute immediately on first call
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300, immediate = false) {
  let timeout;
  
  return function(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(this, args);
  };
}

/**
 * Create a request deduplication wrapper
 * Prevents identical requests from being made simultaneously
 * @returns {object} { dedupe: Function, clear: Function }
 */
export function createRequestDeduplicator() {
  const pendingRequests = new Map();
  
  return {
    /**
     * Deduplicate requests by key
     * @param {string} key - Unique request key
     * @param {Function} requestFn - Request function that returns a Promise
     * @returns {Promise} Request result
     */
    dedupe: async (key, requestFn) => {
      // If request is already pending, return the same promise
      if (pendingRequests.has(key)) {
        return pendingRequests.get(key);
      }
      
      // Create new request promise
      const promise = requestFn()
        .finally(() => {
          // Remove from pending after completion
          pendingRequests.delete(key);
        });
      
      pendingRequests.set(key, promise);
      return promise;
    },
    
    /**
     * Clear all pending requests
     */
    clear: () => {
      pendingRequests.clear();
    },
    
    /**
     * Check if a request is pending
     * @param {string} key - Request key
     * @returns {boolean}
     */
    isPending: (key) => pendingRequests.has(key)
  };
}

// ====================================================================
// SINGLETON INSTANCE
// ====================================================================

// Create singleton rate limiter instance
export const rateLimiter = new RateLimiter();

// Create singleton request deduplicator
export const requestDeduplicator = createRequestDeduplicator();

// ====================================================================
// AXIOS INTEGRATION HELPERS
// ====================================================================

/**
 * Create rate-limited axios request interceptor
 * @param {RateLimiter} limiter - Rate limiter instance
 * @returns {Function} Axios request interceptor
 */
export function createRateLimitInterceptor(limiter = rateLimiter) {
  return async (config) => {
    const url = config.url || '';
    const check = limiter.canMakeRequest(url);
    
    if (!check.allowed) {
      const error = new Error(`Rate limit exceeded: ${check.reason}`);
      error.code = 'RATE_LIMIT_EXCEEDED';
      error.retryAfter = check.retryAfter;
      error.isRateLimited = true;
      throw error;
    }
    
    // Record the request
    limiter.recordRequest(url);
    return config;
  };
}

/**
 * Create rate limit response handler
 * @param {RateLimiter} limiter - Rate limiter instance
 * @returns {Function} Axios error interceptor
 */
export function createRateLimitResponseHandler(limiter = rateLimiter) {
  return (error) => {
    // Handle 429 Too Many Requests from server
    if (error.response?.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after']) || 60;
      limiter.handleServerRateLimit(error.config?.url || '', retryAfter);
      
      error.isRateLimited = true;
      error.retryAfter = retryAfter;
    }
    
    return Promise.reject(error);
  };
}

export default rateLimiter;
