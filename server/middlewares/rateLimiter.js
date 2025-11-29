
const { rateLimit } = require('express-rate-limit');

// Rate limiting disabled in development, enable in production
const RATE_LIMITER_ENABLED = false;

// Create a rate limiter with custom settings
function createRateLimiter(options = {}) {
  // Skip if rate limiting is disabled
  if (!RATE_LIMITER_ENABLED) {
    return (req, res, next) => next();
  }

  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minute time window
    max: 100, // Max 100 requests per window
    standardHeaders: true, // Send limit info in response headers
    legacyHeaders: false, // Disable old header format
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

// OTP: Max 5 attempts per 15 minutes
const otpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many OTP requests, please try again after 15 minutes',
    code: 'OTP_RATE_LIMIT_EXCEEDED'
  }
});

// Login attempts: Max 10 per 15 minutes
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many login attempts from this network, please try again after 15 minutes',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

// Account actions: Max 5 per 15 minutes
const accountLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many login attempts, please try again after 15 minutes',
    code: 'ACCOUNT_RATE_LIMIT_EXCEEDED'
  }
});

// General API: Max 60 requests per minute
const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
});

// QR scanning: Max 30 scans per minute
const qrVerificationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
});

// Report submissions: Max 5 per hour (prevent spam)
const publicReportLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many reports submitted. Please try again after 1 hour.',
    code: 'REPORT_RATE_LIMIT_EXCEEDED'
  }
});

module.exports = {
  authLimiter,
  accountLimiter,
  apiLimiter,
  qrVerificationLimiter,
  otpLimiter,
  publicReportLimiter,
  createRateLimiter
};