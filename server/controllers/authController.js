// OTP/2FA and Forgot Password
const { generateOTP, setOTP, verifyOTP, checkRateLimit, DEFAULT_EXPIRES_MS } = require('../middlewares/otpMiddleware');
const { sendOTPEmail } = require('../services/emailService');
const { auditLogService } = require('../services/auditLogService');
const { getClientIp } = require('../utils/ipHelper');
const { sendOTPNotification } = require('../services/notificationQueueService');

const userAccountRepository = require('../repositories/userAccountRepository');
const sessionRepository = require('../repositories/sessionRepository');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fetch = require('node-fetch');

async function handleOtpRequest(email, phoneNumber, userId, res, next, message, deliveryMethod = null) {
  try {
    if (!email) return res.status(400).json({ error: 'Email is required' });
    
    // Check rate limiting FIRST (max 10 requests per 5 minutes, 1 minute cooldown between requests)
    const rateLimitCheck = checkRateLimit(email);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({ 
        error: rateLimitCheck.message,
        retryAfter: rateLimitCheck.retryAfter
      });
    }
    
    // Always respond with success to prevent email enumeration
    let user;
    try {
      user = await userAccountRepository.findAccountByEmail(email);
    } catch (e) {}

    // For pre-signup flows we want to be able to send an OTP even when the
    // account doesn't exist yet. Generate and store an OTP regardless. The
    // response stays generic to avoid leaking whether the account exists.
    try {
      const otp = generateOTP();
      setOTP(email, otp); // OTP will expire in 5 minutes (DEFAULT_EXPIRES_MS)
      
      // Use notification queue for smart SMS + Email delivery
      // SMS: Max 2 attempts (initial + resend), Email: Always
      await sendOTPNotification(
        userId || email,
        phoneNumber || (user && user.phoneNumber),
        email,
        otp,
        deliveryMethod
      );
      
      console.log(`[OTP] Generated and sent OTP for ${email} - Valid for 5 minutes`);
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
  const { email, phoneNumber, deliveryMethod } = req.body;
  return handleOtpRequest(email, phoneNumber, null, res, next, 'If the email exists, an OTP has been sent.', deliveryMethod);
};

// Forgot password: send OTP
exports.forgotPassword = async (req, res, next) => {
  const { email, phoneNumber } = req.body;
  return handleOtpRequest(email, phoneNumber, null, res, next, 'If the email exists, an OTP has been sent for password reset.');
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
    ip: getClientIp(req)
  };
};

const generateAccessToken = (user, isAdmin = false) => {
  const logInfo = { 
    _id: user._id, 
    userId: user.userId, 
    adminId: user.adminId,
    role: user.role, 
    name: user.name, 
    isAdmin
  };
  
  // Only include franchise info for non-admin users
  if (!isAdmin) {
    logInfo.hasFranchiseApplications = !!(user.franchiseApplications && user.franchiseApplications.length > 0);
    logInfo.hasFranchiseInformation = !!(user.franchiseInformation && user.franchiseInformation.length > 0);
  }
  
  console.log('Generating access token for user:', logInfo);
  
  // MINIMAL JWT PAYLOAD - Only include non-sensitive, essential data
  // SECURITY: Email removed from JWT to prevent privacy/security risks
  const payload = { 
    id: isAdmin ? (user.adminId || user._id.toString()) : (user.userId || user._id.toString()),
    _id: user._id.toString(), // Keep _id for backward compatibility
    role: user.role,
    name: user.name,
    accountType: isAdmin ? 'admin' : 'user'
  };
  
  // Add user-specific claims (operators)
  if (!isAdmin) {
    payload.userId = user.userId || user._id.toString();
    payload.hasFranchiseApplications = !!(user.franchiseApplications && user.franchiseApplications.length > 0);
    payload.hasFranchiseInformation = !!(user.franchiseInformation && user.franchiseInformation.length > 0);
    payload.franchiseApplicationsCount = user.franchiseApplications ? user.franchiseApplications.length : 0;
    payload.franchiseInformationCount = user.franchiseInformation ? user.franchiseInformation.length : 0;
  }
  
  // Add admin-specific claims
  if (isAdmin) {
    payload.adminId = user.adminId || user._id.toString();
    payload.permissions = user.permissions || [];
    console.log('[JWT] Admin claims added:', { adminId: payload.adminId, role: user.role, permissions: payload.permissions });
  }
  
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
    
    if (!user) {
      // Log failed login attempt
      await auditLogService.logLogin(
        { id: identifier, userId: identifier, username: identifier, name: identifier, role: 'unknown', accountType: 'user', email: identifier },
        req,
        false,
        'Invalid credentials - user not found'
      ).catch(err => console.error('Audit log error:', err));
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Defensive bcrypt compare (ensure we don't pass undefined and crash)
    let validPassword = false;
    try {
      validPassword = await bcrypt.compare(password, user.password);
    } catch (e) {
      console.error('bcrypt.compare error for user', user && user._id, e && e.message ? e.message : e);
      // Log the error
      await auditLogService.logLogin(
        { 
          id: user._id || user.userId, 
          userId: user.userId,
          username: user.username || user.email, 
          name: user.name,
          role: user.role, 
          accountType: isAdmin ? 'admin' : 'user', 
          email: user.email 
        },
        req,
        false,
        'Password comparison error'
      ).catch(err => console.error('Audit log error:', err));
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!validPassword) {
      // Log failed password attempt
      await auditLogService.logLogin(
        { 
          id: user._id || user.userId, 
          userId: user.userId,
          username: user.username || user.email, 
          name: user.name,
          role: user.role, 
          accountType: isAdmin ? 'admin' : 'user', 
          email: user.email 
        },
        req,
        false,
        'Invalid credentials - incorrect password'
      ).catch(err => console.error('Audit log error:', err));
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Populate franchise data for regular users (not admins)
    if (!isAdmin && user._id) {
      try {
        const User = require('../models/userAccountModel');
        const populatedUser = await User.findById(user._id)
          .populate('franchiseApplications')
          .populate('franchiseInformation')
          .select('+password'); // Keep password for validation
        
        if (populatedUser) {
          user = populatedUser;
          console.log('[Login] Populated franchise data:', {
            applications: user.franchiseApplications?.length || 0,
            franchises: user.franchiseInformation?.length || 0
          });
        }
      } catch (e) {
        console.error('[Login] Failed to populate franchise data:', e);
        // Continue without franchise data in token
      }
    }
    
    // Generate tokens
    const accessToken = generateAccessToken(user, isAdmin);
    const accountType = isAdmin ? 'admin' : 'user';
     
    // Enforce SINGLE session per user - revoke all previous sessions before creating new one
    try {
      const existingSessions = await sessionRepository.getUserSessions(user._id);
      if (existingSessions.length > 0) {
        console.log(`[Login] User has ${existingSessions.length} active session(s), revoking all previous sessions`);
        // Revoke all existing sessions - user can only have ONE active session
        await sessionRepository.revokeAllUserSessions(user._id);
      }
    } catch (e) {
      console.error('[Login] Failed to revoke previous sessions:', e);
    }
    
    // Now create the NEW single session
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
        userId: isAdmin ? (user.adminId || user._id) : (user.userId || user._id),
        name: user.name,
        role: user.role,
        email: user.email,
        accountType: isAdmin ? 'admin' : 'user'
      }
    };
    
    // Include admin-specific info if this is an admin account
    if (isAdmin) {
      responseData.user.adminId = user.adminId || user._id;
      responseData.user.permissions = user.permissions || [];
    } else {
      // Include franchise info for regular users
      responseData.user.hasFranchiseApplications = !!(user.franchiseApplications && user.franchiseApplications.length > 0);
      responseData.user.hasFranchiseInformation = !!(user.franchiseInformation && user.franchiseInformation.length > 0);
    }
    
    // Log successful login
    await auditLogService.logLogin(
      {
        id: user._id || user.userId,
        userId: user.userId,
        username: user.username || user.email,
        name: user.name,
        email: user.email,
        role: user.role,
        accountType: isAdmin ? 'admin' : 'user',
        adminId: isAdmin ? (user.adminId || user._id) : null,
        department: isAdmin ? user.department : null,
        position: isAdmin ? user.position : null
      },
      req,
      true
    ).catch(err => console.error('Audit log error:', err));
    
    res.json(responseData);
  } catch (err) {
    next(err);
  }
};

// Local signup (create account with username/email/password)
exports.signup = async (req, res, next) => {
  try {
    const { name, username, email, password, phoneNumber } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });

    // Prevent accidental overwrites
    const existingByEmail = await userAccountRepository.findAccountByEmail(email).catch(() => null);
    if (existingByEmail) return res.status(409).json({ error: 'Account with this email already exists' });

    const existingByUsername = username ? await userAccountRepository.findAccountByUsername(username).catch(() => null) : null;
    if (existingByUsername) return res.status(409).json({ error: 'Username already taken' });

    // Create local account with phone number if provided
    const user = await userAccountRepository.createUserAccount({ 
      name, 
      username, 
      email, 
      password,
      phoneNumber: phoneNumber || undefined  // Include phone number if provided
    });
    res.status(201).json({ message: 'Account created', user: { id: user._id, name: user.name, email: user.email, phoneNumber: user.phoneNumber } });
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
    
    if (session.accountType === 'admin') {
      const Admin = require('../models/adminAccountModel');
      user = await Admin.findById(session.userId);
      isAdmin = true;
    } else {
      const User = require('../models/userAccountModel');
      user = await User.findById(session.userId)
        .populate('franchiseApplications')
        .populate('franchiseInformation');
    }
    
    if (!user) {
      // User deleted but session exists, clean up
      await sessionRepository.deleteSession(session._id);
      return res.status(403).json({ error: 'User not found' });
    }
    
    // Generate new access token
    const accessToken = generateAccessToken(user, isAdmin);
    
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

    // Log successful logout
    if (req.user) {
      await auditLogService.logLogout(req.user, req).catch(err => console.error('Audit log error:', err));
    }

    // Clear refresh token cookie with all possible configurations
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/' // Ensure path matches cookie creation
    });

    console.log('[Logout] Cookies cleared');
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
    
    // Fetch full user details from database with franchise info
    const User = require('../models/userAccountModel');
    const mongoose = require('mongoose');
    
    // Handle both ObjectId and UUID-based user lookup
    let user;
    if (mongoose.Types.ObjectId.isValid(req.user.id)) {
      user = await User.findById(req.user.id)
        .populate('franchiseApplications')
        .populate('franchiseInformation');
    }
    if (!user) {
      // Fallback: try finding by userId field (for UUID tokens)
      user = await User.findOne({ userId: req.user.id })
        .populate('franchiseApplications')
        .populate('franchiseInformation');
    }
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Return comprehensive user info (excluding sensitive data)
    const userInfo = {
      id: user._id,
      userId: user.userId,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      phoneNumber: user.phoneNumber,
      dateCreated: user.createdAt,
      lastLogin: user.lastLogin,
      hasFranchiseApplications: !!(user.franchiseApplications && user.franchiseApplications.length > 0),
      hasFranchiseInformation: !!(user.franchiseInformation && user.franchiseInformation.length > 0),
      franchiseApplicationsCount: user.franchiseApplications ? user.franchiseApplications.length : 0,
      franchiseInformationCount: user.franchiseInformation ? user.franchiseInformation.length : 0
    };
    
    res.json({ user: userInfo });
  } catch (err) {
    next(err);
  }
};
