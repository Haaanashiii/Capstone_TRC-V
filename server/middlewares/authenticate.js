const jwt = require('jsonwebtoken');

module.exports = async function authenticateToken(req, res, next) {
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
    
    // For admin accounts, verify the account is still active
    if (decoded.accountType === 'admin' && decoded.adminId) {
      try {
        const adminAccountRepository = require('../repositories/adminAccountRepository');
        const admin = await adminAccountRepository.findAdminById(decoded.adminId, { lean: true });
        
        if (!admin) {
          return res.status(401).json({ 
            error: 'Account not found', 
            code: 'ACCOUNT_NOT_FOUND'
          });
        }
        
        if (admin.isActive === false) {
          return res.status(403).json({ 
            error: 'Your account has been deactivated. Please contact a super admin to reactivate your account.',
            code: 'ACCOUNT_DEACTIVATED'
          });
        }
      } catch (dbErr) {
        console.error('Error checking admin status:', dbErr);
        // Continue with authentication if DB check fails - don't block legitimate requests
      }
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
