// OTP/2FA and Forgot Password
const { generateOTP, setOTP, verifyOTP } = require('../middlewares/otpMiddleware');
const { sendOTPEmail } = require('../services/emailService');


const userAccountRepository = require('../repositories/userAccountRepository');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fetch = require('node-fetch');


// Helper for DRY OTP logic
async function handleOtpRequest(email, res, next, message) {
  try {
    if (!email) return res.status(400).json({ error: 'Email is required' });
    // Always respond with success to prevent email enumeration
    let user;
    try {
      user = await userAccountRepository.findAccountByEmail(email);
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
      user = await userAccountRepository.findAccountByEmail(email);
    } catch (e) {}
    if (!valid || !user) return res.status(400).json({ error: 'Invalid or expired OTP' });
    const hashed = await bcrypt.hash(newPassword, 10);
  await userAccountRepository.updateUserAccount(user._id, { password: hashed });
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
    // Allow logging in with either username or email; support legacy frontends that send 'email' or 'identifier'
    let { identifier, email, username, password } = req.body;
    identifier = identifier || email || username;
    if (!identifier || !password) return res.status(400).json({ error: 'Identifier and password are required' });

    // Try by username first, then by email
    let user = null;
    try { user = await userAccountRepository.findAccountByUsername(identifier); } catch (e) {}
    if (!user) {
      try { user = await userAccountRepository.findAccountByEmail(identifier); } catch (e) {}
    }
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

// Local signup (create account with username/email/password)
exports.signup = async (req, res, next) => {
  try {
    const { name, username, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });

    // Prevent accidental overwrites
    const existingByEmail = await userAccountRepository.findAccountByEmail(email).catch(() => null);
    if (existingByEmail) return res.status(409).json({ error: 'Account with this email already exists' });

    const existingByUsername = username ? await userAccountRepository.findAccountByUsername(username).catch(() => null) : null;
    if (existingByUsername) return res.status(409).json({ error: 'Username already taken' });

    const user = await userAccountRepository.createUserAccount({ name, username, email, password, oauthProvider: null });
    res.status(201).json({ message: 'Account created', user: { id: user._id, name: user.name, email: user.email } });
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

// ------------------------
// Google OAuth handlers
// ------------------------

// Redirect user to Google OAuth consent screen
exports.googleAuth = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL || 'http://localhost:5170'}/auth/google/callback`;
  const scope = encodeURIComponent('openid email profile');
  const state = crypto.randomBytes(8).toString('hex');
  // You may want to store the state in a cookie or DB to verify on callback
  res.cookie('oauth_state', state, { httpOnly: true, sameSite: 'lax' });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;
  res.redirect(url);
};

// Handle Google callback: exchange code, fetch profile, upsert user, issue tokens
exports.googleCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    const savedState = req.cookies.oauth_state;
    if (!code) return res.status(400).send('Missing code');
    if (!savedState || state !== savedState) return res.status(400).send('Invalid state');

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL || 'http://localhost:5170'}/auth/google/callback`,
        grant_type: 'authorization_code'
      })
    });
    const tokenJson = await tokenRes.json();
    if (!tokenJson.access_token) return res.status(400).send('Failed to get access token');

    // Fetch user info
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` }
    });
    const profile = await profileRes.json();
    if (!profile || !profile.email) return res.status(400).send('Failed to fetch Google profile');

    // Upsert user by email
    let user = await userAccountRepository.findAccountByEmail(profile.email);
    if (!user) {
      // Create a new user record. Mark that it's an OAuth account (no password)
      try {
        console.log('Google OAuth: creating user for', profile.email);
        user = await userAccountRepository.createUserAccount({
          email: profile.email,
          name: profile.name || profile.given_name || profile.email.split('@')[0],
          googleId: profile.id,
          oauthProvider: 'google'
        });
        console.log('Google OAuth: user created', user && user._id);
      } catch (createErr) {
        console.error('Google OAuth: createUserAccount error', createErr);
        return next(createErr);
      }
    } else {
      // If user exists but missing googleId, attach it
      if (!user.googleId) {
        try {
          console.log('Google OAuth: attaching googleId to existing user', user._id);
          user = await userAccountRepository.updateUserAccount(user._id, { googleId: profile.id, oauthProvider: 'google' });
          console.log('Google OAuth: user updated', user && user._id);
        } catch (e) {
          console.error('Google OAuth: updateUserAccount error', e);
        }
      }
    }

    // Issue tokens (reuse existing helpers)
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

  // Redirect to the client root and include access token in fragment so SPA can read it
  const clientRedirect = process.env.CLIENT_REDIRECT || 'http://localhost:5173';
  // include accessToken in fragment for client-side apps to read
  res.redirect(`${clientRedirect}/#access_token=${accessToken}`);
  } catch (err) {
    next(err);
  }
};

// Dev-only: create a test OAuth user directly (for local debugging)
exports.testCreateOAuth = async (req, res, next) => {
  try {
    const { email, name, googleId } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    const user = await userAccountRepository.createUserAccount({
      email,
      name: name || email.split('@')[0],
      googleId,
      oauthProvider: 'google'
    });
    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
};
