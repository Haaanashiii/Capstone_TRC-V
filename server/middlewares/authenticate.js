const jwt = require('jsonwebtoken');

// SECURITY: Fail early if JWT_SECRET is not configured
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.');
  process.exit(1);
}

module.exports = function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.', code: 'NO_TOKEN' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    if (decoded.exp && decoded.exp < currentTimestamp) {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    res.set('WWW-Authenticate', 'Bearer realm="api", error="invalid_token"');
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }
    return res.status(500).json({ error: 'Token verification failed', code: 'TOKEN_VERIFICATION_FAILED' });
  }
};
