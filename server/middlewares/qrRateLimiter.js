/**
 * Advanced QR Code Rate Limiter
 * Implements dual-layer rate limiting:
 * 1. Per-IP rate limiting (prevents single IP from spamming)
 * 2. Per-QR-ID rate limiting (prevents single QR from being scanned too frequently)
 */

const rateLimit = require('express-rate-limit');

// RATE LIMITER DISABLED FOR DEVELOPMENT
const RATE_LIMITER_ENABLED = false;

// In-memory store for per-QR-ID tracking (no Redis dependency needed)
const qrScanStore = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of qrScanStore.entries()) {
    if (now - value.resetTime > 0) {
      qrScanStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Per-IP rate limiter for QR verification endpoints
 * Prevents a single IP from making too many requests
 */
const qrPerIpLimiter = (req, res, next) => {
  // Return no-op middleware if rate limiter is disabled
  if (!RATE_LIMITER_ENABLED) {
    return next();
  }

  return rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 10, // Max 10 QR scans per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many QR code scans from this device. Please wait a moment.',
      code: 'QR_IP_RATE_LIMIT_EXCEEDED'
    },
    // Skip rate limiting for local development
    skip: (req) => {
      return process.env.NODE_ENV === 'development' && 
             (req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === 'localhost');
    }
  })(req, res, next);
};

/**
 * Per-QR-ID rate limiter middleware
 * Prevents the same QR code from being scanned too frequently
 * This protects against QR code abuse/sharing
 */
const qrPerIdLimiter = (req, res, next) => {
  // Return no-op middleware if rate limiter is disabled
  if (!RATE_LIMITER_ENABLED) {
    return next();
  }

  const operatorId = req.params.operatorId;
  
  if (!operatorId) {
    return next();
  }

  const now = Date.now();
  const windowMs = 30 * 1000; // 30 seconds window
  const maxScans = 3; // Max 3 scans per 30 seconds per QR code
  
  const key = `qr:${operatorId}`;
  
  if (!qrScanStore.has(key)) {
    // First scan of this QR code
    qrScanStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
      firstSeen: now
    });
    return next();
  }
  
  const record = qrScanStore.get(key);
  
  // Reset if window has passed
  if (now > record.resetTime) {
    qrScanStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
      firstSeen: now
    });
    return next();
  }
  
  // Check if limit exceeded
  if (record.count >= maxScans) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return res.status(429).json({
      error: 'This QR code has been scanned too many times recently. Please wait before scanning again.',
      code: 'QR_ID_RATE_LIMIT_EXCEEDED',
      retryAfter: retryAfter
    });
  }
  
  // Increment count
  record.count++;
  qrScanStore.set(key, record);
  
  next();
};

/**
 * Combined QR rate limiter
 * Applies both per-IP and per-QR-ID rate limiting
 */
const combinedQrRateLimiter = [qrPerIpLimiter, qrPerIdLimiter];

/**
 * Get QR scan statistics (for monitoring/debugging)
 */
const getQrScanStats = (operatorId) => {
  const key = `qr:${operatorId}`;
  if (!qrScanStore.has(key)) {
    return null;
  }
  const record = qrScanStore.get(key);
  return {
    scanCount: record.count,
    resetTime: new Date(record.resetTime),
    firstSeen: new Date(record.firstSeen)
  };
};

/**
 * Clear rate limit for a specific QR code (admin function)
 */
const clearQrRateLimit = (operatorId) => {
  const key = `qr:${operatorId}`;
  qrScanStore.delete(key);
};

module.exports = {
  qrPerIpLimiter,
  qrPerIdLimiter,
  combinedQrRateLimiter,
  getQrScanStats,
  clearQrRateLimit
};