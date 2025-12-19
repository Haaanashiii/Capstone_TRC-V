const crypto = require('crypto');
const OTP = require('../models/otpModel');

// Database-backed OTP Store (cluster-mode compatible)
class OTPStore {
  _key(k) {
    return String(k || '').trim().toLowerCase();
  }
  
  async set(k, v, purpose = 'login') {
    const email = this._key(k);
    try {
      // Upsert: update if exists, create if not (using email + purpose as unique key)
      await OTP.findOneAndUpdate(
        { email, purpose },
        { 
          email,
          purpose,
          otp: v.otp,
          expiresAt: new Date(v.expiresAt),
          createdAt: new Date(v.createdAt),
          attempts: v.attempts || 0
        },
        { upsert: true, new: true }
      );
      return true;
    } catch (error) {
      console.error('[OTP Store] Error saving OTP:', error.message);
      return false;
    }
  }
  
  async get(k, purpose = 'login') {
    const email = this._key(k);
    try {
      const doc = await OTP.findOne({ email, purpose });
      if (!doc) return null;
      
      // Check if expired
      if (Date.now() > doc.expiresAt.getTime()) {
        await this.delete(email, purpose);
        return null;
      }
      
      return {
        otp: doc.otp,
        expiresAt: doc.expiresAt.getTime(),
        createdAt: doc.createdAt.getTime(),
        attempts: doc.attempts || 0
      };
    } catch (error) {
      console.error('[OTP Store] Error getting OTP:', error.message);
      return null;
    }
  }
  
  async delete(k, purpose = 'login') {
    const email = this._key(k);
    try {
      await OTP.deleteOne({ email, purpose });
      return true;
    } catch (error) {
      console.error('[OTP Store] Error deleting OTP:', error.message);
      return false;
    }
  }
  
  async has(k, purpose = 'login') {
    const email = this._key(k);
    try {
      const count = await OTP.countDocuments({ email, purpose });
      return count > 0;
    } catch (error) {
      console.error('[OTP Store] Error checking OTP:', error.message);
      return false;
    }
  }
  
  async entries() {
    try {
      const docs = await OTP.find({});
      return docs.map(doc => [
        doc.email,
        {
          otp: doc.otp,
          purpose: doc.purpose,
          expiresAt: doc.expiresAt.getTime(),
          createdAt: doc.createdAt.getTime(),
          attempts: doc.attempts || 0
        }
      ]);
    } catch (error) {
      console.error('[OTP Store] Error getting entries:', error.message);
      return [];
    }
  }
  
  // Update attempts count
  async incrementAttempts(k, purpose = 'login') {
    const email = this._key(k);
    try {
      await OTP.findOneAndUpdate(
        { email, purpose },
        { $inc: { attempts: 1 } }
      );
      return true;
    } catch (error) {
      console.error('[OTP Store] Error incrementing attempts:', error.message);
      return false;
    }
  }
}

const otpStore = new OTPStore(); // Database-backed storage for cluster mode

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

// Configuration values - optimized for security AND usability
const DEFAULT_OTP_LENGTH = 6;
const DEFAULT_EXPIRES_MS = 5 * 60 * 1000; // OTP valid for 5 minutes
const MAX_VERIFICATION_ATTEMPTS = 5; // Attempts to verify OTP per purpose
const MAX_REQUEST_ATTEMPTS = 5; // Max OTP requests per purpose per window
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minute time window (longer window, stricter per-purpose)
const COOLDOWN_BETWEEN_REQUESTS_MS = 30 * 1000; // Wait 30 seconds between requests (reduced from 60s for better UX)

function generateOTP(length = DEFAULT_OTP_LENGTH) {
  if (!Number.isInteger(length) || length < 4 || length > 14) {
    throw new RangeError('OTP length must be an integer between 4 and 14');
  }
  const maxExclusive = 10 ** length;
  // Generate random number and pad with zeros
  return crypto.randomInt(0, maxExclusive).toString().padStart(length, '0');
}

async function setOTP(email, otp, purpose = 'login', expiresIn = DEFAULT_EXPIRES_MS) {
  // Save OTP with expiration time and purpose
  const otpExpiresIn = DEFAULT_EXPIRES_MS;
  
  const value = {
    otp: String(otp),
    expiresAt: Date.now() + otpExpiresIn,
    createdAt: Date.now(),
    attempts: 0
  };
  await otpStore.set(email, value, purpose);
  // MongoDB TTL index will auto-delete expired documents
}

async function verifyOTP(email, otp, purpose = 'login') {
  const entry = await otpStore.get(email, purpose);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    await otpStore.delete(email, purpose);
    return false;
  }
  const submitted = String(otp);
  // Early reject on length mismatch and increment attempt counter
  if (submitted.length !== String(entry.otp).length) {
    await otpStore.incrementAttempts(email, purpose);
    const updatedEntry = await otpStore.get(email, purpose);
    if (updatedEntry && updatedEntry.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await otpStore.delete(email, purpose);
    }
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
    // One-time use - clear OTP and purpose-specific rate limit data
    await otpStore.delete(email, purpose);
    clearRateLimit(email, purpose);
    return true;
  }
  await otpStore.incrementAttempts(email, purpose);
  const updatedEntry = await otpStore.get(email, purpose);
  if (updatedEntry && updatedEntry.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    await otpStore.delete(email, purpose);
  }
  return false;
}

// Check if OTP request should be rate limited (PURPOSE-AWARE)
// Each purpose (login, signup, password-reset) has its own rate limit bucket
function checkRateLimit(email, purpose = 'login') {
  const now = Date.now();
  // Use compound key: email + purpose for separate rate limiting per flow
  const rateLimitKey = `${String(email || '').trim().toLowerCase()}:${purpose}`;
  const rateData = rateLimitStore.get(rateLimitKey);
  
  if (!rateData) {
    // First request for this purpose - initialize rate limit tracking
    rateLimitStore.set(rateLimitKey, {
      attempts: 1,
      firstAttemptAt: now,
      lastAttemptAt: now
    });
    return { allowed: true, attemptsRemaining: MAX_REQUEST_ATTEMPTS - 1 };
  }
  
  // Check if window has expired
  if (now - rateData.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    // Reset the window
    rateLimitStore.set(rateLimitKey, {
      attempts: 1,
      firstAttemptAt: now,
      lastAttemptAt: now
    });
    return { allowed: true, attemptsRemaining: MAX_REQUEST_ATTEMPTS - 1 };
  }
  
  // Check cooldown between requests (30 seconds for same purpose)
  if (now - rateData.lastAttemptAt < COOLDOWN_BETWEEN_REQUESTS_MS) {
    const waitTime = Math.ceil((COOLDOWN_BETWEEN_REQUESTS_MS - (now - rateData.lastAttemptAt)) / 1000);
    return { 
      allowed: false, 
      reason: 'cooldown',
      message: `Please wait ${waitTime} seconds before requesting another OTP.`,
      retryAfter: waitTime
    };
  }
  
  // Check max attempts within window for this specific purpose
  if (rateData.attempts >= MAX_REQUEST_ATTEMPTS) {
    const windowTimeLeft = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - rateData.firstAttemptAt)) / 60000);
    return { 
      allowed: false, 
      reason: 'max_attempts',
      message: `Too many OTP requests for ${purpose}. Please try again in ${windowTimeLeft} minute${windowTimeLeft !== 1 ? 's' : ''}.`,
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - rateData.firstAttemptAt)) / 1000)
    };
  }
  
  // Update rate limit data
  rateData.attempts += 1;
  rateData.lastAttemptAt = now;
  rateLimitStore.set(rateLimitKey, rateData);
  
  return { allowed: true, attemptsRemaining: MAX_REQUEST_ATTEMPTS - rateData.attempts };
}

// Clear rate limit for a specific email and purpose (called after successful verification)
function clearRateLimit(email, purpose = 'login') {
  const rateLimitKey = `${String(email || '').trim().toLowerCase()}:${purpose}`;
  rateLimitStore.delete(rateLimitKey);
}

module.exports = { 
  generateOTP, 
  setOTP, 
  verifyOTP, 
  checkRateLimit,
  clearRateLimit,
  otpStore, 
  rateLimitStore,
  DEFAULT_EXPIRES_MS, 
  MAX_VERIFICATION_ATTEMPTS,
  MAX_REQUEST_ATTEMPTS,
  RATE_LIMIT_WINDOW_MS,
  COOLDOWN_BETWEEN_REQUESTS_MS
};
