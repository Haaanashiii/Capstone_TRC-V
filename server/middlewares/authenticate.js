const jwt = require('jsonwebtoken');

module.exports = function authenticateToken(req, res, next) {
  // Get login token from request header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Access denied. No token provided.',
      code: 'NO_TOKEN'
    });
  }
  
  try {
    // Verify login token is valid
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token has expired
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTimestamp) {
      return res.status(401).json({ 
        error: 'Token expired', 
        code: 'TOKEN_EXPIRED'
      });
    }
    
    // Save user info to request for use in route handlers
    req.user = decoded;
    next();
  } catch (err) {
    // Handle different token errors
    if (err.name === 'JsonWebTokenError') {
      res.set('WWW-Authenticate', 'Bearer realm="api", error="invalid_token", error_description="Invalid token."');
      return res.status(401).json({ 
        error: 'Invalid token', 
        code: 'INVALID_TOKEN'
      });
    } else if (err.name === 'TokenExpiredError') {
      res.set('WWW-Authenticate', 'Bearer realm="api", error="invalid_token", error_description="Invalid token."');
      return res.status(401).json({ 
        error: 'Token expired', 
        code: 'TOKEN_EXPIRED'
      });
    } else {
      res.set('WWW-Authenticate', 'Bearer realm="api", error="invalid_token", error_description="Invalid token."');
      return res.status(500).json({ 
        error: 'Token verification failed', 
        code: 'TOKEN_VERIFICATION_FAILED'
      });
    }
  }
};
