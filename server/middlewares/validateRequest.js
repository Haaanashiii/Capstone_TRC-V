const { validationResult } = require('express-validator');

// Check if request data has errors
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  
  next();
}

// Rules for different types of form submissions
const validationSchemas = {
  // Login form
  login: [
    { field: 'username', rules: 'required|string|min:3|max:50' },
    { field: 'password', rules: 'required|string|min:8' }
  ],
  
  // Application form
  applicationSubmit: [
    { field: 'plateNumber', rules: 'required|string|regex:/^[A-Z0-9]{6,8}$/' },
    { field: 'ssn', rules: 'required|string|min:9|max:12' }
  ],
  
  // QR scanning
  qrVerification: [
    { field: 'data', rules: 'required|string' }
  ]
};

// Clean user input to prevent harmful code
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // Convert dangerous characters to safe versions
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#96;');
}

// Clean all user input before processing
function sanitizeRequest(req, res, next) {
  // Clean form data
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    });
  }
  
  // Clean URL parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeInput(req.query[key]);
      }
    });
  }
  
  // Sanitize URL parameters
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeInput(req.params[key]);
      }
    });
  }
  
  next();
}

module.exports = {
  validateRequest,
  validationSchemas,
  sanitizeRequest
};