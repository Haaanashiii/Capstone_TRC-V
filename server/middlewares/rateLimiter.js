const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const RATE_LIMITER_ENABLED = true;

/**
 * Rate Limiter Configuration
 * 
 * Security vs Usability Balance:
 * - IP-based limiters are lenient (shared networks like offices, schools)
 * - Purpose-specific OTP limiting is handled in otpMiddleware.js
 * - Successful requests can be skipped where appropriate
 */

function createRateLimiter(options = {}) {
  if (!RATE_LIMITER_ENABLED) return (req, res, next) => next();

  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    // Use X-Forwarded-For header if behind proxy (nginx, docker)
    // This ensures proper IP detection
    validate: { xForwardedForHeader: false }, // Disable warning for proxied requests
    message: { error: 'Too many requests, please try again later.', code: 'RATE_LIMIT_EXCEEDED' },
    ...options,
  });
}

// OTP endpoint limiter - generous per-IP since purpose-specific limiting is in otpMiddleware
// This prevents brute-force attacks from single IP across ALL emails
const otpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30, // Increased: allows multiple users on same network (office, school)
  message: { error: 'Too many OTP requests from this network, please try again after 15 minutes', code: 'OTP_RATE_LIMIT_EXCEEDED' }
});

// Auth limiter - protects login endpoint from brute-force per IP
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20, // Increased for shared networks
  skipSuccessfulRequests: true, // Don't count successful logins
  message: { error: 'Too many login attempts from this network, please try again after 15 minutes', code: 'AUTH_RATE_LIMIT_EXCEEDED' }
});

// Per-account limiter - stricter, protects specific accounts from credential stuffing
// Uses email/identifier as key instead of IP
const accountLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5, // Strict per-account
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    // Use the identifier (email/username) if provided, fallback to IP with IPv6 support
    const identifier = req.body?.identifier || req.body?.email;
    return identifier || ipKeyGenerator(req);
  },
  message: { error: 'Too many login attempts for this account, please try again after 15 minutes', code: 'ACCOUNT_RATE_LIMIT_EXCEEDED' }
});

// General API limiter - generous for normal operations
const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120, // 2 requests per second average
});

// QR verification limiter - for public-facing QR scanning
const qrVerificationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60, // Increased for busy verification scenarios
});

// Public report limiter - strict to prevent spam
const publicReportLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many reports submitted. Please try again after 1 hour.', code: 'REPORT_RATE_LIMIT_EXCEEDED' }
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