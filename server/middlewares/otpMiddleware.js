const crypto = require('crypto');
const otpStore = new Map(); // For production, use Redis or DB

function generateOTP(length = 6) {
  if (!Number.isInteger(length) || length < 4 || length > 14) {
    throw new RangeError('OTP length must be an integer between 4 and 14');
  }
  const maxExclusive = 10 ** length; // safe < 2^48
  return crypto.randomInt(0, maxExclusive).toString().padStart(length, '0');
}
function setOTP(email, otp, expiresIn = 5 * 60 * 1000) {
  const key = String(email).trim().toLowerCase();
  const value = { otp: String(otp), expiresAt: Date.now() + expiresIn, attempts: 0 };
  otpStore.set(key, value);
  // Optional: proactively remove after TTL so entries don't linger in memory
  setTimeout(() => otpStore.delete(key), expiresIn).unref?.();
}
function verifyOTP(email, otp) {
    const key = String(email).trim().toLowerCase();
  const entry = otpStore.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    return false;
  }
  const submitted = String(otp);
  // Optional: early reject on length mismatch without leaking timing across characters
  if (submitted.length !== entry.otp.length) {
    entry.attempts = (entry.attempts || 0) + 1;
    if (entry.attempts >= MAX_ATTEMPTS) otpStore.delete(key);
    return false;
    }
     const valid = crypto.timingSafeEqual(Buffer.from(entry.otp), Buffer.from(submitted));
     if(valid) {
        otpStore.delete(key);//one time user
     }else{
        entry.attempts = (entry.attempts || 0) + 1;
        if (entry.attempts >= MAX_ATTEMPTS) otpStore.delete(key);
        }
        return valid;

}

module.exports = { generateOTP, setOTP, verifyOTP };
