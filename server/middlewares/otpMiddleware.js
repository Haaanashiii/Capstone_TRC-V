const crypto = require('crypto');

// Use a small wrapper so callers can use otpStore.get(email) even if they pass
// an unnormalized email. This keeps callers (controllers/tests) simple while
// ensuring keys are stored in a normalized form.
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
  // Expose for diagnostics if needed
  entries() {
    return Array.from(this._map.entries());
  }
}

const otpStore = new OTPStore(); // For production, replace this with Redis or DB-backed store

// Configurable limits
const DEFAULT_OTP_LENGTH = 6;
const DEFAULT_EXPIRES_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

function generateOTP(length = DEFAULT_OTP_LENGTH) {
  if (!Number.isInteger(length) || length < 4 || length > 14) {
    throw new RangeError('OTP length must be an integer between 4 and 14');
  }
  const maxExclusive = 10 ** length; // safe for lengths up to 14
  // crypto.randomInt is exclusive of the max value
  return crypto.randomInt(0, maxExclusive).toString().padStart(length, '0');
}

function setOTP(email, otp, nowOrExpiresIn = DEFAULT_EXPIRES_MS) {
  let expiresIn = DEFAULT_EXPIRES_MS;
  let lastRequestedAt = undefined;
  if (typeof nowOrExpiresIn === 'number' && nowOrExpiresIn > 1000000000000) {
    // If a timestamp (ms since epoch) is passed, treat as lastRequestedAt
    lastRequestedAt = nowOrExpiresIn;
  } else if (typeof nowOrExpiresIn === 'number') {
    expiresIn = nowOrExpiresIn;
  }
  const value = {
    otp: String(otp),
    expiresAt: Date.now() + expiresIn,
    attempts: 0,
    ...(lastRequestedAt ? { lastRequestedAt } : {})
  };
  otpStore.set(email, value);
  // Optional: proactively remove after TTL so entries don't linger in memory
  const t = setTimeout(() => otpStore.delete(email), expiresIn);
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
    if (entry.attempts >= MAX_ATTEMPTS) otpStore.delete(email);
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
    // One-time use
    otpStore.delete(email);
    return true;
  }
  entry.attempts = (entry.attempts || 0) + 1;
  if (entry.attempts >= MAX_ATTEMPTS) otpStore.delete(email);
  return false;
}

module.exports = { generateOTP, setOTP, verifyOTP, otpStore, DEFAULT_EXPIRES_MS, MAX_ATTEMPTS };
