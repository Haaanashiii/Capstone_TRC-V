const crypto = require('crypto');

// Store OTP codes with automatic case/space normalization
class OTPStore {
  constructor() {
    this._map = new Map();
  }
  _key(k) {
    return String(k || '').trim().toLowerCase();
  }
  set(k, v) {
    return this._map.set(this._key(k), v);
  }
  get(k) {
    return this._map.get(this._key(k));
  }
  delete(k) {
    return this._map.delete(this._key(k));
  }
  has(k) {
    return this._map.has(this._key(k));
  }
  // Get all stored OTP entries
  entries() {
    return Array.from(this._map.entries());
  }
}

const otpStore = new OTPStore(); // For production, use Redis or database

// Track OTP request limits per email address
class RateLimitStore {
  constructor() {
    this._map = new Map();
  }
  _key(k) {
    return String(k || '').trim().toLowerCase();
  }
  get(k) {
    return this._map.get(this._key(k));
  }
  set(k, v) {
    return this._map.set(this._key(k), v);
  }
  delete(k) {
    return this._map.delete(this._key(k));
  }
}

const rateLimitStore = new RateLimitStore();

// Configuration values
const DEFAULT_OTP_LENGTH = 6;
const DEFAULT_EXPIRES_MS = 5 * 60 * 1000; // OTP valid for 5 minutes
const MAX_VERIFICATION_ATTEMPTS = 5; // Attempts to verify OTP
const MAX_REQUEST_ATTEMPTS = 10; // Max OTP requests per 5 minutes
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minute time window
const COOLDOWN_BETWEEN_REQUESTS_MS = 60 * 1000; // Wait 1 minute between requests

function generateOTP(length = DEFAULT_OTP_LENGTH) {
  if (!Number.isInteger(length) || length < 4 || length > 14) {
    throw new RangeError('OTP length must be an integer between 4 and 14');
  }
  const maxExclusive = 10 ** length;
  // Generate random number and pad with zeros
  return crypto.randomInt(0, maxExclusive).toString().padStart(length, '0');
}

function setOTP(email, otp, expiresIn = DEFAULT_EXPIRES_MS) {
  // Save OTP with expiration time
  const otpExpiresIn = DEFAULT_EXPIRES_MS;
  
  const value = {
    otp: String(otp),
    expiresAt: Date.now() + otpExpiresIn,
    createdAt: Date.now(),
    attempts: 0
  };
  otpStore.set(email, value);
  // Optional: proactively remove after TTL so entries don't linger in memory
  const t = setTimeout(() => otpStore.delete(email), otpExpiresIn);
  if (t && typeof t.unref === 'function') t.unref();
}

function verifyOTP(email, otp) {
  const entry = otpStore.get(email);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email);
    return false;
  }
  const submitted = String(otp);
  // Early reject on length mismatch and increment attempt counter
  if (submitted.length !== String(entry.otp).length) {
    entry.attempts = (entry.attempts || 0) + 1;
    if (entry.attempts >= MAX_VERIFICATION_ATTEMPTS) otpStore.delete(email);
    return false;
  }
  // Use timingSafeEqual for constant-time comparison
  let valid = false;
  try {
    const a = Buffer.from(String(entry.otp));
    const b = Buffer.from(submitted);
    if (a.length === b.length) valid = crypto.timingSafeEqual(a, b);
  } catch (e) {
    valid = false;
  }
  if (valid) {
    // One-time use - clear OTP and rate limit data
    otpStore.delete(email);
    rateLimitStore.delete(email);
    return true;
  }
  entry.attempts = (entry.attempts || 0) + 1;
  if (entry.attempts >= MAX_VERIFICATION_ATTEMPTS) otpStore.delete(email);
  return false;
}

// Check if OTP request should be rate limited
function checkRateLimit(email) {
  const now = Date.now();
  const rateData = rateLimitStore.get(email);
  
  if (!rateData) {
    // First request - initialize rate limit tracking
    rateLimitStore.set(email, {
      attempts: 1,
      firstAttemptAt: now,
      lastAttemptAt: now
    });
    return { allowed: true };
  }
  
  // Check if window has expired (5 minutes)
  if (now - rateData.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    // Reset the window
    rateLimitStore.set(email, {
      attempts: 1,
      firstAttemptAt: now,
      lastAttemptAt: now
    });
    return { allowed: true };
  }
  
  // Check cooldown between requests (1 minute)
  if (now - rateData.lastAttemptAt < COOLDOWN_BETWEEN_REQUESTS_MS) {
    const waitTime = Math.ceil((COOLDOWN_BETWEEN_REQUESTS_MS - (now - rateData.lastAttemptAt)) / 1000);
    return { 
      allowed: false, 
      reason: 'cooldown',
      message: `Please wait ${waitTime} seconds before requesting another OTP.`,
      retryAfter: waitTime
    };
  }
  
  // Check max attempts within window
  if (rateData.attempts >= MAX_REQUEST_ATTEMPTS) {
    const windowTimeLeft = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - rateData.firstAttemptAt)) / 60000);
    return { 
      allowed: false, 
      reason: 'max_attempts',
      message: `Too many OTP requests. Please try again in ${windowTimeLeft} minute${windowTimeLeft !== 1 ? 's' : ''}.`,
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - rateData.firstAttemptAt)) / 1000)
    };
  }
  
  // Update rate limit data
  rateData.attempts += 1;
  rateData.lastAttemptAt = now;
  rateLimitStore.set(email, rateData);
  
  return { allowed: true };
}

module.exports = { 
  generateOTP, 
  setOTP, 
  verifyOTP, 
  checkRateLimit,
  otpStore, 
  rateLimitStore,
  DEFAULT_EXPIRES_MS, 
  MAX_VERIFICATION_ATTEMPTS,
  MAX_REQUEST_ATTEMPTS,
  RATE_LIMIT_WINDOW_MS,
  COOLDOWN_BETWEEN_REQUESTS_MS
};
