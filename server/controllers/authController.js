// OTP/2FA and Forgot Password
const { generateOTP, setOTP, verifyOTP } = require('../middlewares/otpMiddleware');
const { sendOTPEmail } = require('../services/emailService');


const userRepository = require('../repositories/userRepository');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');


// Helper for DRY OTP logic
async function handleOtpRequest(email, res, next, message) {
  try {
    if (!email) return res.status(400).json({ error: 'Email is required' });
    // Always respond with success to prevent email enumeration
    let user;
    try {
      user = await userRepository.findByEmail(email);
    } catch (e) {}
    if (user) {
      const otp = generateOTP();
      setOTP(email, otp);
      try { await sendOTPEmail(email, otp); } catch (e) {/* log error */}
    }
    res.json({ message });
  } catch (err) {
    next(err);
  }
}

// Request OTP for 2FA
exports.requestOtp = async (req, res, next) => {
  const { email } = req.body;
  return handleOtpRequest(email, res, next, 'If the email exists, an OTP has been sent.');
};

// Forgot password: send OTP
exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;
  return handleOtpRequest(email, res, next, 'If the email exists, an OTP has been sent for password reset.');
};

// Constant-time OTP verification
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Secure OTP verification for 2FA or forgot password
exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });
    // Get stored OTP (do not reveal if email exists)
    let valid = false;
    try {
      const entry = require('../middlewares/otpMiddleware').otpStore?.get?.(email);
      if (entry && Date.now() <= entry.expiresAt && constantTimeCompare(entry.otp, otp)) {
        valid = true;
        require('../middlewares/otpMiddleware').otpStore.delete(email);
      }
    } catch (e) {}
    if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP' });
    res.json({ message: 'OTP verified' });
  } catch (err) {
    next(err);
  }
};

// Reset password using OTP (constant-time, generic error)
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    let valid = false;
    let user;
    try {
      const entry = require('../middlewares/otpMiddleware').otpStore?.get?.(email);
      if (entry && Date.now() <= entry.expiresAt && constantTimeCompare(entry.otp, otp)) {
        valid = true;
        require('../middlewares/otpMiddleware').otpStore.delete(email);
      }
      user = await userRepository.findByEmail(email);
    } catch (e) {}
    if (!valid || !user) return res.status(400).json({ error: 'Invalid or expired OTP' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await userRepository.updateUser(user._id, { password: hashed });
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
};


// Store refresh tokens (in production, use Redis or a database)
const refreshTokens = new Map();

// Generate access token
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role }, 
    process.env.JWT_SECRET, 
    { expiresIn: '1h' }
  );
};

// Generate refresh token
const generateRefreshToken = (user) => {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  refreshTokens.set(refreshToken, {
    userId: user._id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
  return refreshToken;
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const user = await userRepository.findByUsername(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    
    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.json({ 
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }
    
    const tokenData = refreshTokens.get(refreshToken);
    if (!tokenData) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }
    
    // Check if token is expired
    if (new Date() > new Date(tokenData.expiresAt)) {
      refreshTokens.delete(refreshToken);
      return res.status(403).json({ error: 'Refresh token expired' });
    }
    
    // Get user and generate new access token
    const user = await userRepository.findById(tokenData.userId);
    if (!user) {
      refreshTokens.delete(refreshToken);
      return res.status(403).json({ error: 'User not found' });
    }
    
    const accessToken = generateAccessToken(user);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    refreshTokens.delete(refreshToken);
    res.clearCookie('refreshToken');
  }
  res.status(200).json({ message: 'Logged out successfully' });
};
