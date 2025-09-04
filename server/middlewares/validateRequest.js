const { validationResult } = require('express-validator');

/**
 * Middleware to validate request data using express-validator
 * Checks for validation errors and returns a standardized error response
 */
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

/**
 * Creates validation schemas for different request types
 */
const validationSchemas = {
  // Login validation
  login: [
    { field: 'username', rules: 'required|string|min:3|max:50' },
    { field: 'password', rules: 'required|string|min:8' }
  ],
  
  // Application submission validation
  applicationSubmit: [
    { field: 'plateNumber', rules: 'required|string|regex:/^[A-Z0-9]{6,8}$/' },
    { field: 'ssn', rules: 'required|string|min:9|max:12' }
  ],
  
  // QR code verification validation
  qrVerification: [
    { field: 'data', rules: 'required|string' }
  ]
};

/**
 * Sanitizes user input to prevent XSS and injection attacks
 * @param {string} input - The user input to sanitize
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // Replace potentially dangerous characters
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#96;');
}

/**
 * Middleware to sanitize request body, query and params
 */
function sanitizeRequest(req, res, next) {
  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    });
  }
  
  // Sanitize query parameters
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