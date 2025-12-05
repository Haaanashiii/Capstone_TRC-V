const { validationResult } = require('express-validator');

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

function getPaginationParams(req, maxLimit = 50) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), maxLimit);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function sanitizeQuery(query) {
  if (!query || typeof query !== 'string') return '';
  return query.replace(/[\$\{\}]/g, '').trim().substring(0, 200);
}

const validationSchemas = {
  login: [
    { field: 'username', rules: 'required|string|min:3|max:50' },
    { field: 'password', rules: 'required|string|min:8' }
  ],
  applicationSubmit: [
    { field: 'plateNumber', rules: 'required|string|regex:/^[A-Z0-9]{6,8}$/' },
    { field: 'ssn', rules: 'required|string|min:9|max:12' }
  ],
  qrVerification: [
    { field: 'data', rules: 'required|string' }
  ]
};

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#96;');
}

function sanitizeRequest(req, res, next) {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    }
  }
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeInput(req.query[key]);
      }
    }
  }
  if (req.params) {
    for (const key in req.params) {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeInput(req.params[key]);
      }
    }
  }
  next();
}

module.exports = {
  validateRequest,
  validationSchemas,
  sanitizeRequest,
  getPaginationParams,
  sanitizeQuery
};