/**
 * Input Validation & Sanitization Utilities for CAPSTONE_TRC-V
 * Comprehensive client-side validation for all form inputs
 * 
 * Features:
 * - XSS prevention through input sanitization
 * - Common validation patterns (email, phone, etc.)
 * - Custom validator creation
 * - Form-level validation
 * - Real-time validation hooks
 */

// ====================================================================
// SANITIZATION FUNCTIONS
// ====================================================================

/**
 * Sanitize string to prevent XSS attacks
 * @param {string} input - Raw input string
 * @returns {string} Sanitized string
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#96;')
    .replace(/\\/g, '&#92;');
}

/**
 * Sanitize HTML - strip all HTML tags
 * @param {string} input - Input with potential HTML
 * @returns {string} Plain text without HTML
 */
export function stripHtml(input) {
  if (typeof input !== 'string') return input;
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize for SQL-like injection patterns (defense in depth)
 * @param {string} input - Raw input
 * @returns {string} Sanitized input
 */
export function sanitizeSqlPatterns(input) {
  if (typeof input !== 'string') return input;
  
  // Remove common SQL injection patterns
  return input
    .replace(/['";\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b/gi, '');
}

/**
 * Sanitize MongoDB operator injection
 * @param {string} input - Raw input
 * @returns {string} Sanitized input
 */
export function sanitizeMongoOperators(input) {
  if (typeof input !== 'string') return input;
  
  // Remove MongoDB operators
  return input
    .replace(/\$/g, '')
    .replace(/\{/g, '')
    .replace(/\}/g, '');
}

/**
 * Comprehensive input sanitization
 * @param {any} input - Any input value
 * @param {object} options - Sanitization options
 * @returns {any} Sanitized value
 */
export function sanitize(input, options = {}) {
  const {
    stripTags = true,
    escapeHtml = true,
    preventSqlInjection = true,
    preventNoSqlInjection = true,
    trim = true,
    maxLength = 10000,
    lowercase = false,
    uppercase = false
  } = options;
  
  if (input === null || input === undefined) return input;
  
  // Handle arrays
  if (Array.isArray(input)) {
    return input.map(item => sanitize(item, options));
  }
  
  // Handle objects
  if (typeof input === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitize(value, options);
    }
    return sanitized;
  }
  
  // Handle non-strings
  if (typeof input !== 'string') return input;
  
  let result = input;
  
  if (trim) result = result.trim();
  if (maxLength) result = result.substring(0, maxLength);
  if (stripTags) result = stripHtml(result);
  if (escapeHtml) result = sanitizeString(result);
  if (preventSqlInjection) result = sanitizeSqlPatterns(result);
  if (preventNoSqlInjection) result = sanitizeMongoOperators(result);
  if (lowercase) result = result.toLowerCase();
  if (uppercase) result = result.toUpperCase();
  
  return result;
}

/**
 * Sanitize form data object
 * @param {object} formData - Form data object
 * @param {object} fieldOptions - Per-field sanitization options
 * @returns {object} Sanitized form data
 */
export function sanitizeFormData(formData, fieldOptions = {}) {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(formData)) {
    const options = fieldOptions[key] || {};
    sanitized[key] = sanitize(value, options);
  }
  
  return sanitized;
}

// ====================================================================
// VALIDATION PATTERNS
// ====================================================================

export const PATTERNS = {
  // Basic patterns
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE_PH: /^(\+63|0)?9\d{9}$/,  // Philippine phone format
  PHONE_INTL: /^\+?[\d\s-]{10,15}$/,
  
  // Identity patterns (Philippine)
  PLATE_NUMBER: /^[A-Z]{2,3}[\s-]?\d{3,4}$/i,
  SIDECAR_NUMBER: /^[A-Z0-9]{1,10}$/i,
  CHASSIS_NUMBER: /^[A-HJ-NPR-Z0-9]{17}$/i,  // VIN/Chassis (excludes I, O, Q)
  ENGINE_NUMBER: /^[A-Z0-9]{5,20}$/i,
  
  // Name patterns
  NAME: /^[a-zA-ZÀ-ÿ\s\-'.]{2,100}$/,
  USERNAME: /^[a-zA-Z0-9_-]{3,30}$/,
  
  // Address patterns
  ADDRESS: /^[a-zA-Z0-9À-ÿ\s,.\-#()'/]{5,500}$/,
  
  // Document patterns
  FRANCHISE_NUMBER: /^\d{1,5}$/,
  
  // Security patterns
  SAFE_STRING: /^[a-zA-Z0-9\s\-_.@]+$/,
  NO_SCRIPT: /^(?!.*<script).*$/i,
  
  // Password pattern (min 8 chars, 1 upper, 1 lower, 1 number)
  PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  PASSWORD_MEDIUM: /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
};

// ====================================================================
// VALIDATION FUNCTIONS
// ====================================================================

/**
 * Create a validation result object
 * @param {boolean} isValid - Validation passed
 * @param {string} message - Error message if invalid
 * @returns {object} Validation result
 */
const result = (isValid, message = '') => ({ isValid, message });

/**
 * Validate required field
 * @param {any} value - Value to check
 * @param {string} fieldName - Field name for error message
 * @returns {object} Validation result
 */
export function required(value, fieldName = 'This field') {
  const isValid = value !== null && 
                  value !== undefined && 
                  String(value).trim() !== '';
  return result(isValid, isValid ? '' : `${fieldName} is required`);
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {object} Validation result
 */
export function isEmail(email) {
  if (!email) return result(true); // Use required() for required check
  const isValid = PATTERNS.EMAIL.test(String(email).toLowerCase());
  return result(isValid, isValid ? '' : 'Please enter a valid email address');
}

/**
 * Validate Philippine phone number
 * @param {string} phone - Phone number to validate
 * @returns {object} Validation result
 */
export function isPhoneNumberPH(phone) {
  if (!phone) return result(true);
  const cleaned = String(phone).replace(/[\s-]/g, '');
  const isValid = PATTERNS.PHONE_PH.test(cleaned);
  return result(isValid, isValid ? '' : 'Please enter a valid Philippine phone number (e.g., 09123456789)');
}

/**
 * Validate minimum length
 * @param {string} value - Value to check
 * @param {number} min - Minimum length
 * @param {string} fieldName - Field name for error message
 * @returns {object} Validation result
 */
export function minLength(value, min, fieldName = 'This field') {
  if (!value) return result(true);
  const isValid = String(value).length >= min;
  return result(isValid, isValid ? '' : `${fieldName} must be at least ${min} characters`);
}

/**
 * Validate maximum length
 * @param {string} value - Value to check
 * @param {number} max - Maximum length
 * @param {string} fieldName - Field name for error message
 * @returns {object} Validation result
 */
export function maxLength(value, max, fieldName = 'This field') {
  if (!value) return result(true);
  const isValid = String(value).length <= max;
  return result(isValid, isValid ? '' : `${fieldName} must be no more than ${max} characters`);
}

/**
 * Validate value matches pattern
 * @param {string} value - Value to check
 * @param {RegExp} pattern - Pattern to match
 * @param {string} message - Custom error message
 * @returns {object} Validation result
 */
export function matchesPattern(value, pattern, message = 'Invalid format') {
  if (!value) return result(true);
  const isValid = pattern.test(String(value));
  return result(isValid, isValid ? '' : message);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @param {string} strength - 'strong' | 'medium'
 * @returns {object} Validation result
 */
export function isStrongPassword(password, strength = 'strong') {
  if (!password) return result(true);
  
  const pattern = strength === 'strong' 
    ? PATTERNS.PASSWORD_STRONG 
    : PATTERNS.PASSWORD_MEDIUM;
  
  const isValid = pattern.test(password);
  const message = strength === 'strong'
    ? 'Password must be at least 8 characters with uppercase, lowercase, and number'
    : 'Password must be at least 8 characters with letters and numbers';
  
  return result(isValid, isValid ? '' : message);
}

/**
 * Validate passwords match
 * @param {string} password - First password
 * @param {string} confirmPassword - Confirmation password
 * @returns {object} Validation result
 */
export function passwordsMatch(password, confirmPassword) {
  const isValid = password === confirmPassword;
  return result(isValid, isValid ? '' : 'Passwords do not match');
}

/**
 * Validate plate number format
 * @param {string} plateNumber - Plate number to validate
 * @returns {object} Validation result
 */
export function isPlateNumber(plateNumber) {
  if (!plateNumber) return result(true);
  const isValid = PATTERNS.PLATE_NUMBER.test(String(plateNumber).toUpperCase());
  return result(isValid, isValid ? '' : 'Please enter a valid plate number (e.g., ABC-1234)');
}

/**
 * Validate chassis/VIN number
 * @param {string} chassisNumber - Chassis number to validate
 * @returns {object} Validation result
 */
export function isChassisNumber(chassisNumber) {
  if (!chassisNumber) return result(true);
  const isValid = PATTERNS.CHASSIS_NUMBER.test(String(chassisNumber).toUpperCase());
  return result(isValid, isValid ? '' : 'Please enter a valid 17-character chassis/VIN number');
}

/**
 * Validate engine number
 * @param {string} engineNumber - Engine number to validate
 * @returns {object} Validation result
 */
export function isEngineNumber(engineNumber) {
  if (!engineNumber) return result(true);
  const isValid = PATTERNS.ENGINE_NUMBER.test(String(engineNumber).toUpperCase());
  return result(isValid, isValid ? '' : 'Please enter a valid engine number');
}

/**
 * Validate name format
 * @param {string} name - Name to validate
 * @returns {object} Validation result
 */
export function isValidName(name) {
  if (!name) return result(true);
  const isValid = PATTERNS.NAME.test(name);
  return result(isValid, isValid ? '' : 'Please enter a valid name (letters, spaces, hyphens only)');
}

/**
 * Validate numeric value
 * @param {any} value - Value to check
 * @param {object} options - { min, max, integer }
 * @returns {object} Validation result
 */
export function isNumeric(value, options = {}) {
  if (!value && value !== 0) return result(true);
  
  const { min, max, integer = false } = options;
  const num = Number(value);
  
  if (isNaN(num)) {
    return result(false, 'Please enter a valid number');
  }
  
  if (integer && !Number.isInteger(num)) {
    return result(false, 'Please enter a whole number');
  }
  
  if (min !== undefined && num < min) {
    return result(false, `Value must be at least ${min}`);
  }
  
  if (max !== undefined && num > max) {
    return result(false, `Value must be no more than ${max}`);
  }
  
  return result(true);
}

/**
 * Validate date
 * @param {string|Date} date - Date to validate
 * @param {object} options - { minDate, maxDate, allowFuture, allowPast }
 * @returns {object} Validation result
 */
export function isValidDate(date, options = {}) {
  if (!date) return result(true);
  
  const { minDate, maxDate, allowFuture = true, allowPast = true } = options;
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return result(false, 'Please enter a valid date');
  }
  
  const now = new Date();
  
  if (!allowFuture && dateObj > now) {
    return result(false, 'Date cannot be in the future');
  }
  
  if (!allowPast && dateObj < now) {
    return result(false, 'Date cannot be in the past');
  }
  
  if (minDate && dateObj < new Date(minDate)) {
    return result(false, `Date must be after ${new Date(minDate).toLocaleDateString()}`);
  }
  
  if (maxDate && dateObj > new Date(maxDate)) {
    return result(false, `Date must be before ${new Date(maxDate).toLocaleDateString()}`);
  }
  
  return result(true);
}

// ====================================================================
// FORM VALIDATION
// ====================================================================

/**
 * Create a form validator with schema
 * @param {object} schema - Validation schema { fieldName: [validators] }
 * @returns {object} Validator with validate() method
 */
export function createFormValidator(schema) {
  return {
    /**
     * Validate form data against schema
     * @param {object} formData - Form data to validate
     * @returns {object} { isValid, errors }
     */
    validate(formData) {
      const errors = {};
      let isValid = true;
      
      for (const [field, validators] of Object.entries(schema)) {
        const value = formData[field];
        
        for (const validator of validators) {
          let validationResult;
          
          if (typeof validator === 'function') {
            validationResult = validator(value, field);
          } else if (validator.validate) {
            validationResult = validator.validate(value, formData);
          }
          
          if (validationResult && !validationResult.isValid) {
            errors[field] = validationResult.message;
            isValid = false;
            break; // Stop at first error for this field
          }
        }
      }
      
      return { isValid, errors };
    },
    
    /**
     * Validate a single field
     * @param {string} field - Field name
     * @param {any} value - Field value
     * @param {object} formData - Full form data (for cross-field validation)
     * @returns {object} { isValid, message }
     */
    validateField(field, value, formData = {}) {
      const validators = schema[field];
      if (!validators) return result(true);
      
      for (const validator of validators) {
        let validationResult;
        
        if (typeof validator === 'function') {
          validationResult = validator(value, field);
        } else if (validator.validate) {
          validationResult = validator.validate(value, formData);
        }
        
        if (validationResult && !validationResult.isValid) {
          return validationResult;
        }
      }
      
      return result(true);
    }
  };
}

// ====================================================================
// COMMON VALIDATION SCHEMAS
// ====================================================================

export const VALIDATION_SCHEMAS = {
  login: {
    email: [
      (v) => required(v, 'Email'),
      isEmail
    ],
    password: [
      (v) => required(v, 'Password'),
      (v) => minLength(v, 8, 'Password')
    ]
  },
  
  signup: {
    name: [
      (v) => required(v, 'Name'),
      isValidName,
      (v) => minLength(v, 2, 'Name'),
      (v) => maxLength(v, 100, 'Name')
    ],
    email: [
      (v) => required(v, 'Email'),
      isEmail
    ],
    phoneNumber: [
      (v) => required(v, 'Phone number'),
      isPhoneNumberPH
    ],
    password: [
      (v) => required(v, 'Password'),
      (v) => isStrongPassword(v, 'medium')
    ],
    confirmPassword: [
      (v) => required(v, 'Confirm password'),
      {
        validate: (v, form) => passwordsMatch(form.password, v)
      }
    ]
  },
  
  franchiseApplication: {
    firstName: [
      (v) => required(v, 'First name'),
      isValidName
    ],
    lastName: [
      (v) => required(v, 'Last name'),
      isValidName
    ],
    plateNumber: [
      (v) => required(v, 'Plate number'),
      isPlateNumber
    ],
    chassisNumber: [
      isChassisNumber
    ],
    engineNumber: [
      isEngineNumber
    ],
    phoneNumber: [
      isPhoneNumberPH
    ]
  }
};

// ====================================================================
// REACT HOOK HELPERS
// ====================================================================

/**
 * Create validation handlers for React forms
 * @param {object} schema - Validation schema
 * @param {Function} setErrors - State setter for errors
 * @returns {object} { validateOnChange, validateOnBlur, validateForm }
 */
export function createValidationHandlers(schema, setErrors) {
  const validator = createFormValidator(schema);
  
  return {
    /**
     * Validate field on change (debounced)
     * @param {string} field - Field name
     * @param {any} value - New value
     * @param {object} formData - Current form data
     */
    validateOnChange: (field, value, formData) => {
      const result = validator.validateField(field, value, formData);
      setErrors(prev => ({
        ...prev,
        [field]: result.isValid ? '' : result.message
      }));
      return result.isValid;
    },
    
    /**
     * Validate field on blur
     * @param {string} field - Field name
     * @param {any} value - Field value
     * @param {object} formData - Current form data
     */
    validateOnBlur: (field, value, formData) => {
      const result = validator.validateField(field, value, formData);
      setErrors(prev => ({
        ...prev,
        [field]: result.isValid ? '' : result.message
      }));
      return result.isValid;
    },
    
    /**
     * Validate entire form
     * @param {object} formData - Form data to validate
     * @returns {boolean} Form is valid
     */
    validateForm: (formData) => {
      const { isValid, errors } = validator.validate(formData);
      setErrors(errors);
      return isValid;
    }
  };
}

// ====================================================================
// EXPORTS
// ====================================================================

export default {
  // Sanitization
  sanitize,
  sanitizeString,
  sanitizeFormData,
  stripHtml,
  sanitizeSqlPatterns,
  sanitizeMongoOperators,
  
  // Validation
  required,
  isEmail,
  isPhoneNumberPH,
  minLength,
  maxLength,
  matchesPattern,
  isStrongPassword,
  passwordsMatch,
  isPlateNumber,
  isChassisNumber,
  isEngineNumber,
  isValidName,
  isNumeric,
  isValidDate,
  
  // Form validation
  createFormValidator,
  createValidationHandlers,
  
  // Constants
  PATTERNS,
  VALIDATION_SCHEMAS
};
