const jwt = require('jsonwebtoken');

module.exports = function authenticateToken(req, res, next) {
  // Get token from Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Access denied. No token provided.',
      code: 'NO_TOKEN'
    });
  }
  
  try {
    // Verify token with synchronous verification for better error handling
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check token expiration explicitly
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTimestamp) {
      return res.status(401).json({ 
        error: 'Token expired', 
        code: 'TOKEN_EXPIRED'
      });
    }
    
    // Set user info in request object
    req.user = decoded;
    next();
  } catch (err) {
    // Handle different JWT errors with specific messages
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        error: 'Invalid token', 
        code: 'INVALID_TOKEN'
      });
    } else if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired', 
        code: 'TOKEN_EXPIRED'
      });
    } else {
      return res.status(403).json({ 
        error: 'Token verification failed', 
        code: 'TOKEN_VERIFICATION_FAILED'
      });
    }
  }
};
