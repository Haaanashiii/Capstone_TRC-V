const userRepository = require('../repositories/userRepository');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

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
