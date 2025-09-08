const crypto = require('crypto');
const otpStore = new Map(); // For production, use Redis or DB

function generateOTP(length = 6) {
  return crypto.randomInt(0, 10 ** length).toString().padStart(length, '0');
}

function setOTP(email, otp, expiresIn = 5 * 60 * 1000) {
  otpStore.set(email, { otp, expiresAt: Date.now() + expiresIn });
}

function verifyOTP(email, otp) {
  const entry = otpStore.get(email);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email);
    return false;
  }
  const valid = entry.otp === otp;
  if (valid) otpStore.delete(email);
  return valid;
}

module.exports = { generateOTP, setOTP, verifyOTP };
