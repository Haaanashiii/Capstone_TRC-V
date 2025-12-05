const { rateLimit } = require('express-rate-limit');

const RATE_LIMITER_ENABLED = true;

function createRateLimiter(options = {}) {
  if (!RATE_LIMITER_ENABLED) return (req, res, next) => next();

  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.', code: 'RATE_LIMIT_EXCEEDED' },
    ...options,
  });
}

const otpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many OTP requests, please try again after 15 minutes', code: 'OTP_RATE_LIMIT_EXCEEDED' }
});

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts from this network, please try again after 15 minutes', code: 'AUTH_RATE_LIMIT_EXCEEDED' }
});

const accountLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts, please try again after 15 minutes', code: 'ACCOUNT_RATE_LIMIT_EXCEEDED' }
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
});

const qrVerificationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
});

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