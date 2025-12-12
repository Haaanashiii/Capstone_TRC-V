/**
 * useFormValidation Hook
 * React hook for form validation with real-time feedback
 * 
 * Usage:
 * ```jsx
 * import { useFormValidation } from '../hooks/useFormValidation';
 * import { VALIDATION_SCHEMAS } from '../utils/inputValidation';
 * 
 * function LoginForm() {
 *   const {
 *     values,
 *     errors,
 *     touched,
 *     handleChange,
 *     handleBlur,
 *     handleSubmit,
 *     isValid,
 *     isSubmitting
 *   } = useFormValidation({
 *     initialValues: { email: '', password: '' },
 *     validationSchema: VALIDATION_SCHEMAS.login,
 *     onSubmit: async (values) => {
 *       await api.login(values);
 *     }
 *   });
 * 
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input
 *         name="email"
 *         value={values.email}
 *         onChange={handleChange}
 *         onBlur={handleBlur}
 *       />
 *       {touched.email && errors.email && <span>{errors.email}</span>}
 *     </form>
 *   );
 * }
 * ```
 */

import { useState, useCallback, useMemo } from 'react';
import { 
  createFormValidator, 
  sanitize as sanitizeInput,
  sanitizeFormData
} from '../utils/inputValidation';
import { debounce } from '../utils/rateLimiter';
import logger from '../utils/logger';

/**
 * Form validation hook with sanitization support
 * @param {object} options - Hook configuration
 * @param {object} options.initialValues - Initial form values
 * @param {object} options.validationSchema - Validation schema from inputValidation
 * @param {Function} options.onSubmit - Submit handler (receives sanitized values)
 * @param {boolean} options.validateOnChange - Validate on each change (default: true)
 * @param {boolean} options.validateOnBlur - Validate on blur (default: true)
 * @param {boolean} options.sanitizeOnSubmit - Sanitize values before submit (default: true)
 * @param {number} options.debounceMs - Debounce validation (default: 300ms)
 * @returns {object} Form state and handlers
 */
export function useFormValidation({
  initialValues = {},
  validationSchema = {},
  onSubmit,
  validateOnChange = true,
  validateOnBlur = true,
  sanitizeOnSubmit = true,
  debounceMs = 300
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);
  const [submitError, setSubmitError] = useState(null);

  // Create validator instance
  const validator = useMemo(() => 
    createFormValidator(validationSchema), 
    [validationSchema]
  );

  // Debounced validation for real-time feedback
  const debouncedValidateField = useMemo(
    () => debounce((field, value, formValues) => {
      const result = validator.validateField(field, value, formValues);
      setErrors(prev => ({
        ...prev,
        [field]: result.isValid ? '' : result.message
      }));
    }, debounceMs),
    [validator, debounceMs]
  );

  /**
   * Validate a single field
   */
  const validateField = useCallback((field, value = values[field]) => {
    const result = validator.validateField(field, value, values);
    setErrors(prev => ({
      ...prev,
      [field]: result.isValid ? '' : result.message
    }));
    return result.isValid;
  }, [validator, values]);

  /**
   * Validate all fields
   */
  const validateAll = useCallback(() => {
    const { isValid, errors: validationErrors } = validator.validate(values);
    setErrors(validationErrors);
    return isValid;
  }, [validator, values]);

  /**
   * Handle input change
   */
  const handleChange = useCallback((e) => {
    const { name, value, type, checked, files } = e.target;
    
    // Determine the actual value based on input type
    let newValue;
    if (type === 'checkbox') {
      newValue = checked;
    } else if (type === 'file') {
      newValue = files?.[0] || null;
    } else {
      newValue = value;
    }

    setValues(prev => {
      const updated = { ...prev, [name]: newValue };
      
      // Validate on change if enabled
      if (validateOnChange) {
        debouncedValidateField(name, newValue, updated);
      }
      
      return updated;
    });
  }, [validateOnChange, debouncedValidateField]);

  /**
   * Handle input blur
   */
  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    
    setTouched(prev => ({ ...prev, [name]: true }));
    
    if (validateOnBlur) {
      validateField(name, value);
    }
  }, [validateOnBlur, validateField]);

  /**
   * Set a specific field value programmatically
   */
  const setFieldValue = useCallback((field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    if (validateOnChange) {
      setTimeout(() => validateField(field, value), 0);
    }
  }, [validateOnChange, validateField]);

  /**
   * Set a specific field error programmatically
   */
  const setFieldError = useCallback((field, error) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  /**
   * Set a specific field as touched
   */
  const setFieldTouched = useCallback((field, isTouched = true) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));
  }, []);

  /**
   * Reset form to initial values
   */
  const resetForm = useCallback((newInitialValues = initialValues) => {
    setValues(newInitialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setSubmitError(null);
  }, [initialValues]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setSubmitCount(prev => prev + 1);
    setSubmitError(null);

    // Mark all fields as touched
    const allTouched = Object.keys(validationSchema).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
    setTouched(allTouched);

    // Validate all fields
    const isValid = validateAll();

    if (!isValid) {
      logger.log('[useFormValidation] Validation failed:', errors);
      return false;
    }

    if (!onSubmit) {
      logger.warn('[useFormValidation] No onSubmit handler provided');
      return false;
    }

    setIsSubmitting(true);

    try {
      // Sanitize values if enabled
      const submissionValues = sanitizeOnSubmit 
        ? sanitizeFormData(values) 
        : values;

      await onSubmit(submissionValues);
      return true;
    } catch (error) {
      logger.error('[useFormValidation] Submit error:', error);
      setSubmitError(error.message || 'An error occurred');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [values, errors, validationSchema, validateAll, onSubmit, sanitizeOnSubmit]);

  /**
   * Get field props helper (for spreading onto inputs)
   */
  const getFieldProps = useCallback((field) => ({
    name: field,
    value: values[field] || '',
    onChange: handleChange,
    onBlur: handleBlur,
    error: touched[field] && Boolean(errors[field]),
    helperText: touched[field] ? errors[field] : ''
  }), [values, errors, touched, handleChange, handleBlur]);

  /**
   * Check if form is valid (no errors)
   */
  const isValid = useMemo(() => {
    return Object.values(errors).every(error => !error);
  }, [errors]);

  /**
   * Check if form has been modified
   */
  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues);
  }, [values, initialValues]);

  return {
    // State
    values,
    errors,
    touched,
    isValid,
    isDirty,
    isSubmitting,
    submitCount,
    submitError,
    
    // Handlers
    handleChange,
    handleBlur,
    handleSubmit,
    
    // Field helpers
    setFieldValue,
    setFieldError,
    setFieldTouched,
    getFieldProps,
    
    // Validation
    validateField,
    validateAll,
    
    // Utilities
    resetForm,
    setValues,
    setErrors,
    setTouched
  };
}

/**
 * Hook for sanitizing input values in real-time
 * @param {any} value - Value to sanitize
 * @param {object} options - Sanitization options
 * @returns {any} Sanitized value
 */
export function useSanitizedValue(value, options = {}) {
  return useMemo(() => sanitizeInput(value, options), [value, options]);
}

export default useFormValidation;
