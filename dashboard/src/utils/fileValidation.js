/**
 * File validation utilities for franchise application uploads
 * Validates file size and type before uploading to ensure Cloudflare compression works properly
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB - server will compress to 300KB
const TARGET_SIZE = 300 * 1024; // 300KB target after compression

const ALLOWED_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf']
};

/**
 * Validate if file type is allowed
 * @param {File} file - File object from input
 * @returns {boolean} True if file type is allowed
 */
export function isValidFileType(file) {
  if (!file) return false;
  
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  const fileExt = '.' + fileName.split('.').pop();
  
  // Check if MIME type is in allowed list
  const allowedExtensions = ALLOWED_FILE_TYPES[fileType];
  if (!allowedExtensions) return false;
  
  // Verify extension matches MIME type
  return allowedExtensions.includes(fileExt);
}

/**
 * Validate if file size is within limits
 * @param {File} file - File object from input
 * @returns {boolean} True if file size is acceptable
 */
export function isValidFileSize(file) {
  if (!file) return false;
  return file.size <= MAX_FILE_SIZE;
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate file before upload
 * @param {File} file - File object from input
 * @param {Object} options - Validation options
 * @param {boolean} options.imageOnly - If true, only allow image files (no PDFs)
 * @returns {Object} Validation result with success flag and message
 */
export function validateFile(file, options = {}) {
  const { imageOnly = false } = options;
  
  if (!file) {
    return {
      success: false,
      message: 'No file selected'
    };
  }
  
  // Check if image-only and file is PDF
  if (imageOnly && file.type === 'application/pdf') {
    return {
      success: false,
      message: 'Invalid file type. Only JPG and PNG image files are allowed for this field.'
    };
  }
  
  // Check file type
  if (!isValidFileType(file)) {
    return {
      success: false,
      message: imageOnly 
        ? 'Invalid file type. Only JPG and PNG image files are allowed.'
        : 'Invalid file type. Only JPG, PNG, and PDF files are allowed.'
    };
  }
  
  // Check file size
  if (!isValidFileSize(file)) {
    return {
      success: false,
      message: `File is too large (${formatFileSize(file.size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`
    };
  }
  
  // Warn if file is already small (no compression needed)
  if (file.size <= TARGET_SIZE) {
    return {
      success: true,
      message: `File is ready for upload (${formatFileSize(file.size)})`,
      warning: false
    };
  }
  
  // File will be compressed on server
  return {
    success: true,
    message: `File will be compressed from ${formatFileSize(file.size)} to ~${formatFileSize(TARGET_SIZE)}`,
    warning: false
  };
}

/**
 * Get file extension from filename
 * @param {string} filename - Filename
 * @returns {string} File extension
 */
export function getFileExtension(filename) {
  if (!filename) return '';
  return filename.toLowerCase().split('.').pop();
}

/**
 * Check if file is an image
 * @param {File} file - File object
 * @returns {boolean} True if file is an image
 */
export function isImage(file) {
  if (!file) return false;
  return file.type.startsWith('image/');
}

/**
 * Check if file is a PDF
 * @param {File} file - File object
 * @returns {boolean} True if file is a PDF
 */
export function isPDF(file) {
  if (!file) return false;
  return file.type === 'application/pdf';
}

export default {
  validateFile,
  isValidFileType,
  isValidFileSize,
  formatFileSize,
  getFileExtension,
  isImage,
  isPDF,
  MAX_FILE_SIZE,
  TARGET_SIZE,
  ALLOWED_FILE_TYPES
};
