
const rateLimit = require('express-rate-limit');

/**
 * Creates a rate limiter middleware with configurable options
 * @param {Object} options - Rate limiter configuration options
 * @returns {Function} - Express middleware function
 */
function createRateLimiter(options = {}) {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes by default
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
      error: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  };
  return rateLimit({
    ...defaultOptions,
    ...options,
  });
}

// OTP limiter: 5 requests per 15 minutes per IP
const otpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    error: 'Too many OTP requests, please try again after 15 minutes',
    code: 'OTP_RATE_LIMIT_EXCEEDED'
  }
});

// Create specific rate limiters for different routes
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // number of allowed attempts
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many login attempts from this network, please try again after 15 minutes',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

// Rate limit by email/username - Stricter per-account limits
const accountLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per account
  skipSuccessfulRequests: true,
  // Use email/identifier as key instead of IP
  keyGenerator: (req) => {
    // Use the identifier from request body (email or username)
    return req.body.identifier || req.body.email || req.body.username || req.ip;
  },
  message: {
    error: 'Too many login attempts for this account, please try again after 15 minutes',
    code: 'ACCOUNT_RATE_LIMIT_EXCEEDED'
  }
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
});

const qrVerificationLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 verifications per minute
});

module.exports = {
  authLimiter,
  accountLimiter,
  apiLimiter,
  qrVerificationLimiter,
  otpLimiter,
  createRateLimiter
};