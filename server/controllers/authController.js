// OTP/2FA and Forgot Password
const { generateOTP, setOTP, verifyOTP } = require('../middlewares/otpMiddleware');
const { sendOTPEmail } = require('../services/emailService');


const userAccountRepository = require('../repositories/userAccountRepository');
const sessionRepository = require('../repositories/sessionRepository');
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

    // OTP resend cooldown logic
    const otpStore = require('../middlewares/otpMiddleware').otpStore;
    const entry = otpStore?.get?.(email);
    const now = Date.now();
    if (entry && entry.lastRequestedAt && now - entry.lastRequestedAt < 60 * 1000) {
      // Less than 1 minute since last request
      return res.status(429).json({ error: 'Please wait before requesting another OTP.' });
    }

    // For pre-signup flows we want to be able to send an OTP even when the
    // account doesn't exist yet. Generate and store an OTP regardless. The
    // response stays generic to avoid leaking whether the account exists.
    try {
      const otp = generateOTP();
      setOTP(email, otp, now); // Pass now for lastRequestedAt
      await sendOTPEmail(email, otp);
    } catch (e) {
      // Log the error for server operators (do not expose to client)
      console.error('Failed to generate/send OTP for', email, e && e.message ? e.message : e);
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
    const { email, otp, rememberMe } = req.body;
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
    
    // If rememberMe was checked, create a trusted device token
    if (rememberMe) {
      try {
        // Find user to get their ID for trusted device token
        const userAccountRepository = require('../repositories/userAccountRepository');
        const adminAccountRepository = require('../repositories/adminAccountRepository');
        
        let user = await userAccountRepository.findAccountByEmail(email).catch(() => null);
        if (!user) {
          user = await adminAccountRepository.findAdminByEmail(email).catch(() => null);
        }
        
        if (user) {
          const crypto = require('crypto');
          const secret = process.env.JWT_SECRET || 'default-secret';
          const timestamp = Date.now();
          const signature = crypto
            .createHmac('sha256', secret)
            .update(`${user._id}.${timestamp}`)
            .digest('hex');
          
          const trustedDeviceToken = `${user._id}.${timestamp}.${signature}`;
          
          // Set trusted device cookie (30 days)
          res.cookie('trustedDevice', trustedDeviceToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
          });
          
          console.log('[OTP] Trusted device token created for user:', email);
        }
      } catch (e) {
        console.error('[OTP] Failed to create trusted device token:', e.message);
        // Don't fail the OTP verification if this fails
      }
    }
    
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


// Helper function to extract device info from request
const getDeviceInfo = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  
  // Simple browser detection
  let browser = 'Unknown';
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  
  // Simple OS detection
  let os = 'Unknown';
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS')) os = 'iOS';
  
  // Simple device detection
  let device = 'Desktop';
  if (userAgent.includes('Mobile')) device = 'Mobile';
  else if (userAgent.includes('Tablet')) device = 'Tablet';
  
  return {
    userAgent,
    browser,
    os,
    device,
    ip: req.ip || req.connection.remoteAddress || 'Unknown'
  };
};

const generateAccessToken = (user, franchiseInfo = null, isAdmin = false) => {
  console.log('Generating access token for user:', { 
    _id: user._id, 
    userId: user.userId, 
    role: user.role, 
    name: user.name, 
    isAdmin, 
    hasFranchise: !!franchiseInfo 
  });
  
  // MINIMAL JWT PAYLOAD - Only include non-sensitive, essential data
  // Use custom userId field (UUID) instead of MongoDB _id for better consistency
  const payload = { 
    id: user.userId || user._id.toString(), // Prefer userId (UUID), fallback to _id
    _id: user._id.toString(), // Keep _id for backward compatibility
    role: user.role,
    name: user.name,
    accountType: isAdmin ? 'admin' : 'user',
    // Boolean flag to indicate if user has linked franchise info (for UX decisions)
    hasFranchise: !!franchiseInfo,
    franchiseStatus: user.franchiseStatus || 'inactive'
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }); // Temporary:limit to 1hr
};

// Generate refresh token and store in database
const generateRefreshToken = async (user, accountType, req, expiresInDays = 7) => {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const deviceInfo = getDeviceInfo(req);
  
  // Store in database with custom expiry (7 days default, 30 days if "Remember Me")
  await sessionRepository.createSession(
    user._id,
    accountType,
    refreshToken,
    deviceInfo,
    expiresInDays
  );
  
  console.log('[Auth] Refresh token created and stored in database with', expiresInDays, 'days expiry');
  return refreshToken;
};

exports.login = async (req, res, next) => {
  try {
    // Allow logging in with either username or email; support legacy frontends that send 'email' or 'identifier'
    let { identifier, email, username, password, rememberMe } = req.body;
    identifier = identifier || email || username;
    if (!identifier || !password) return res.status(400).json({ error: 'Identifier and password are required' });
    
    // rememberMe flag extends refresh token expiry from 7 days to 30 days
    const refreshTokenDays = rememberMe ? 30 : 7;
    console.log('[Login] Remember Me:', rememberMe, '- Refresh token expiry:', refreshTokenDays, 'days');

    let user = null;
    let isAdmin = false;
    
    // Step 1: Try to find in User accounts (operators)
    try { user = await userAccountRepository.findAccountByUsername(identifier, { projection: '+password' }); } catch (e) {}
    if (!user) {
      try {
        // Request password field explicitly because schema marks it select:false.
        const accounts = await userAccountRepository.findAccountsByEmail(identifier, { projection: '+password' }).catch(() => []);
        if (accounts && accounts.length > 0) {
          // Prefer an account that has a password (local account)
          user = accounts.find(a => a.password) || accounts[0];
        } else {
          user = await userAccountRepository.findAccountByEmail(identifier, { projection: '+password' }).catch(() => null);
        }
      } catch (e) {
        // swallow and continue to check admin accounts
      }
    }
    
    // Step 2: If not found in User accounts, try Admin accounts
    if (!user) {
      const adminAccountRepository = require('../repositories/adminAccountRepository');
      
      try {
        user = await adminAccountRepository.findAdminByUsername(identifier, { projection: '+password' });
        if (user) isAdmin = true;
      } catch (e) {}
      
      if (!user) {
        try {
          user = await adminAccountRepository.findAdminByEmail(identifier, { projection: '+password' });
          if (user) isAdmin = true;
        } catch (e) {}
      }
    }
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // If the account was created via OAuth (no local password), reject password login
    if (!user.password) {
      const provider = user.oauthProvider || 'OAuth provider';
      return res.status(400).json({ error: `This account was registered via ${provider}. Please sign in with ${provider}.` });
    }

    // Defensive bcrypt compare (ensure we don't pass undefined and crash)
    let validPassword = false;
    try {
      validPassword = await bcrypt.compare(password, user.password);
    } catch (e) {
      console.error('bcrypt.compare error for user', user && user._id, e && e.message ? e.message : e);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    
    // Populate franchise information if available (only for regular users, not admins)
    let franchiseInfo = null;
    if (!isAdmin && user.franchiseInfo) {
      try {
        const User = require('../models/userAccountModel');
        const populatedUser = await User.findById(user._id).populate('franchiseInfo');
        if (populatedUser && populatedUser.franchiseInfo) {
          franchiseInfo = populatedUser.franchiseInfo;
          console.log('[Login] User has active franchise:', { operatorId: franchiseInfo.operatorId, status: franchiseInfo.franchiseStatus });
        }
      } catch (e) {
        console.error('Error populating franchise info:', e && e.message);
      }
    }
    
    // Generate tokens (include franchise info for users, admin info for admins)
    const accessToken = generateAccessToken(user, franchiseInfo, isAdmin);
    const accountType = isAdmin ? 'admin' : 'user';
     
    // Enforce max 2 active sessions per user BEFORE creating new session
    try {
      const sessions = await sessionRepository.getUserSessions(user._id);
      if (sessions.length >= 2) {
        // Sort by lastUsed (oldest first)
        const sorted = sessions.sort((a, b) => new Date(a.lastUsed) - new Date(b.lastUsed));
        // Delete the oldest session(s) to make room for the new one
        const toDelete = sorted.slice(0, sessions.length - 1); // Keep only 1, delete the rest
        console.log(`[Login] User has ${sessions.length} sessions, removing ${toDelete.length} oldest session(s)`);
        for (const s of toDelete) {
          await sessionRepository.deleteSession(s._id);
        }
      }
    } catch (e) {
      console.error('[Login] Failed to enforce session limit:', e);
    }
    
    // Now create the new session (this will be the 2nd one)
    const refreshToken = await generateRefreshToken(user, accountType, req, refreshTokenDays);

    // Check if this is a trusted device (Remember Me feature)
    const trustedDeviceToken = req.cookies.trustedDevice;
    let skipOTP = false;
    
    if (trustedDeviceToken && rememberMe) {
      try {
        // Verify trusted device token (simple HMAC verification)
        const crypto = require('crypto');
        const secret = process.env.JWT_SECRET || 'default-secret';
        const [userId, timestamp, signature] = trustedDeviceToken.split('.');
        
        if (userId === String(user._id)) {
          const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(`${userId}.${timestamp}`)
            .digest('hex');
          
          if (signature === expectedSignature) {
            const tokenAge = Date.now() - parseInt(timestamp);
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;
            
            if (tokenAge < thirtyDays) {
              skipOTP = true;
              console.log('[Login] Trusted device recognized - skipping OTP for user:', user.email);
            } else {
              console.log('[Login] Trusted device token expired');
            }
          }
        }
      } catch (e) {
        console.error('[Login] Error validating trusted device token:', e.message);
      }
    }
    
    // Attempt to generate & send OTP for second-factor/account verification (unless trusted device)
    // This should not block login on email/send failure; we log errors and
    // still return successful login response. OTP is stored server-side via setOTP.
    if (!skipOTP) {
      try {
        const otp = generateOTP();
        setOTP(user.email || user.username || identifier, otp);
        // send to the canonical email on file
        if (user.email) {
          // fire-and-forget
          sendOTPEmail(user.email, otp).catch((e) => console.error('sendOTPEmail error:', e && e.message ? e.message : e));
        }
      } catch (e) {
        console.error('Failed to generate/send OTP during login for', user && user.email, e && e.message ? e.message : e);
      }
    }

    // Set refresh token in HTTP-only cookie (duration based on rememberMe flag)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // 'lax' for development (different ports)
      maxAge: refreshTokenDays * 24 * 60 * 60 * 1000 // 7 days (default) or 30 days (remember me)
    });


    const responseData = { 
      accessToken,
      skipOTP, // Tell frontend whether to skip OTP verification (trusted device)
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        email: user.email,
        accountType: isAdmin ? 'admin' : 'user' // Indicate account type
      }
    };
    
    // Include franchise info in response if available (for regular users)
    if (franchiseInfo) {
      responseData.user.franchise = {
        operatorId: franchiseInfo.operatorId,
        operatorName: franchiseInfo.operatorName,
        franchiseStatus: franchiseInfo.franchiseStatus,
        qrCode: franchiseInfo.qrCode,
        profilePhoto: franchiseInfo.profilePhoto,
        contactNumber: franchiseInfo.contactNumber,
        address: franchiseInfo.address,
        barangay: franchiseInfo.barangay,
        mtopNumber: franchiseInfo.mtopNumber,
        approvedAt: franchiseInfo.approvedAt,
        expiryDate: franchiseInfo.expiryDate
      };
    }
    
    // Include admin-specific info if this is an admin account
    if (isAdmin) {
      responseData.user.admin = {
        adminId: user.adminId,
        department: user.department,
        position: user.position,
        permissions: user.permissions || []
      };
    }
    
    res.json(responseData);
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

    // Create local account - omit oauthProvider field entirely (not null)
    const user = await userAccountRepository.createUserAccount({ name, username, email, password });
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
    
    // Find session in database
    const session = await sessionRepository.findSessionByToken(refreshToken);
    
    if (!session) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }
    
    // Session exists and is active, update last used
    await sessionRepository.updateSessionLastUsed(session._id);
    
    // Get user based on account type
    let user = null;
    let isAdmin = false;
    let operatorInfo = null;
    
    if (session.accountType === 'admin') {
      const Admin = require('../models/adminAccountModel');
      user = await Admin.findById(session.userId);
      isAdmin = true;
    } else {
      const User = require('../models/userAccountModel');
      user = await User.findById(session.userId).populate('franchiseInfo');
      if (user && user.franchiseInfo) {
        operatorInfo = user.franchiseInfo;
      }
    }
    
    if (!user) {
      // User deleted but session exists, clean up
      await sessionRepository.deleteSession(session._id);
      return res.status(403).json({ error: 'User not found' });
    }
    
    // Generate new access token
    const accessToken = generateAccessToken(user, operatorInfo, isAdmin);
    
    console.log('[RefreshToken] Token refreshed for user:', user._id, 'Type:', session.accountType);
    res.json({ accessToken });
  } catch (err) {
    console.error('[RefreshToken] Error:', err);
    next(err);
  }
};

exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      // Revoke only the current session in database
      await sessionRepository.revokeSession(refreshToken);
      console.log('[Logout] Session revoked in database');
    }

    // Clear refresh token cookie with all possible configurations
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/' // Ensure path matches cookie creation
    });

    // Also clear any OAuth state cookies
    res.clearCookie('oauth_state', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
    });

    console.log('[Logout] All cookies cleared');
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('[Logout] Error during logout:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

// Return the current authenticated user (detailed info)
exports.getCurrentUser = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    
    // Fetch full user details from database and populate operator info
    const User = require('../models/userAccountModel');
    const mongoose = require('mongoose');
    
    // Handle both ObjectId and UUID-based user lookup
    let user;
    if (mongoose.Types.ObjectId.isValid(req.user.id)) {
      user = await User.findById(req.user.id).populate('franchiseInfo');
    }
    if (!user) {
      // Fallback: try finding by userId field (for UUID tokens)
      user = await User.findOne({ userId: req.user.id }).populate('franchiseInfo');
    }
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Debug log for franchise info
    if (user.franchiseInfo) {
      console.log('[getCurrentUser] Franchise info found:', {
        hasQrCode: !!user.franchiseInfo.qrCode,
        qrCode: user.franchiseInfo.qrCode,
        hasProfilePhoto: !!user.franchiseInfo.profilePhoto,
        profilePhoto: user.franchiseInfo.profilePhoto
      });
    }
    
    // Return comprehensive user info (excluding sensitive data)
    const userInfo = {
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      profilePicture: user.profilePicture,
      // Add user-level fields
      address: user.address,
      phoneNumber: user.phoneNumber,
      operatorId: user.operatorId,
      franchiseStatus: user.franchiseStatus,
      dateCreated: user.createdAt,
      lastLogin: user.lastLogin,
      hasFranchise: !!user.franchiseInfo
    };
    
    // Add franchise information if populated
    if (user.franchiseInfo) {
      userInfo.franchise = {
        operatorId: user.franchiseInfo.operatorId,
        operatorName: user.franchiseInfo.operatorName,
        contactNumber: user.franchiseInfo.contactNumber,
        email: user.franchiseInfo.email,
        address: user.franchiseInfo.address,
        barangay: user.franchiseInfo.barangay,
        civilStatus: user.franchiseInfo.civilStatus,
        driversID: user.franchiseInfo.driversID,
        profilePhoto: user.franchiseInfo.profilePhoto,
        qrCode: user.franchiseInfo.qrCode,
        franchiseStatus: user.franchiseInfo.franchiseStatus,
        mtopNumber: user.franchiseInfo.mtopNumber,
        approvedAt: user.franchiseInfo.approvedAt,
        expiryDate: user.franchiseInfo.expiryDate,
        documents: user.franchiseInfo.documents ? {
          motorRegistration: user.franchiseInfo.documents.motorRegistration,
          barangayClearance: user.franchiseInfo.documents.barangayClearance,
          cedula: user.franchiseInfo.documents.cedula,
          driversLicense: user.franchiseInfo.documents.driversLicense,
          votersAffidavit: user.franchiseInfo.documents.votersAffidavit,
          motorChassisStencil: user.franchiseInfo.documents.motorChassisStencil,
          picture: user.franchiseInfo.documents.picture
        } : null
      };
    }
    
    res.json({ user: userInfo });
  } catch (err) {
    next(err);
  }
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

    // Check if email belongs to an admin account first
    const adminAccountRepository = require('../repositories/adminAccountRepository');
    let admin = null;
    try {
      admin = await adminAccountRepository.findAdminByEmail(profile.email);
    } catch (e) {}
    
    if (admin) {
      // This email belongs to an admin - don't allow OAuth login for admins
      // Redirect back with error message
      const clientRedirect = process.env.CLIENT_REDIRECT || 'http://localhost:5173';
      return res.redirect(`${clientRedirect}/login?error=admin_oauth_not_allowed&message=${encodeURIComponent('Admin accounts cannot use Google Sign-In. Please use your admin credentials.')}`);
    }
    
    // Upsert user by email (only for non-admin accounts)
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
        console.log('Google OAuth: user role assigned:', user.role); // Debug log
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

    // Populate operator information if available and valid
    let operatorInfo = null;
    if (user.operatorInfo) {
      try {
        const mongoose = require('mongoose');
        if (mongoose.Types.ObjectId.isValid(user.operatorInfo)) {
          const User = require('../models/userAccountModel');
          const populatedUser = await User.findById(user._id).populate('operatorInfo');
          if (populatedUser && populatedUser.operatorInfo) {
            operatorInfo = populatedUser.operatorInfo;
          }
        } else {
          // operatorInfo is not a valid ObjectId, skip population
          operatorInfo = null;
        }
      } catch (e) {
        console.error('Error populating operator info in OAuth:', e && e.message);
      }
    }

    // Issue tokens (reuse existing helpers, include operator info)
    const accessToken = generateAccessToken(user, operatorInfo);
    
    // Enforce max 2 active sessions per user BEFORE creating new session
    try {
      const sessions = await sessionRepository.getUserSessions(user._id);
      if (sessions.length >= 2) {
        const sorted = sessions.sort((a, b) => new Date(a.lastUsed) - new Date(b.lastUsed));
        const toDelete = sorted.slice(0, sessions.length - 1);
        console.log(`[OAuth] User has ${sessions.length} sessions, removing ${toDelete.length} oldest session(s)`);
        for (const s of toDelete) {
          await sessionRepository.deleteSession(s._id);
        }
      }
    } catch (e) {
      console.error('[OAuth] Failed to enforce session limit:', e);
    }
    
    const refreshToken = await generateRefreshToken(user, 'user', req);

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // 'lax' for development (different ports)
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

  // Redirect to the client OAuth callback route and include access token in fragment so SPA can read it
  const clientRedirect = process.env.CLIENT_REDIRECT || 'http://localhost:5173';
  // include accessToken in fragment for client-side apps to read
  res.redirect(`${clientRedirect}/oauth-callback#access_token=${accessToken}`);
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
