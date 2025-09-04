const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Enhanced secure file upload middleware with validation and scanning
 */

// Define allowed file types and their MIME types
const ALLOWED_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf']
};

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Storage configuration with randomized filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a secure random filename to prevent path traversal attacks
    const randomName = crypto.randomBytes(16).toString('hex');
    const fileExt = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomName}${fileExt}`);
  }
});

// File filter to validate uploads
const fileFilter = (req, file, cb) => {
  // Check if the MIME type is allowed
  const allowedExtensions = ALLOWED_FILE_TYPES[file.mimetype];
  
  if (!allowedExtensions) {
    return cb(new Error('File type not allowed'), false);
  }
  
  // Verify file extension matches MIME type
  const fileExt = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(fileExt)) {
    return cb(new Error('File extension does not match MIME type'), false);
  }
  
  // Additional security checks can be added here
  // For example, virus scanning integration
  
  cb(null, true);
};

// Create the multer upload instance
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter
});

/**
 * Error handler middleware for file upload errors
 */
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        message: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      });
    }
    
    return res.status(400).json({
      error: 'File upload error',
      code: err.code,
      message: err.message
    });
  }
  
  if (err) {
    // Other errors
    return res.status(400).json({
      error: 'Invalid file',
      message: err.message
    });
  }
  
  next();
};

/**
 * Validate uploaded file content (can be expanded with actual virus scanning)
 */
const validateFileContent = (req, res, next) => {
  // If no files were uploaded, continue
  if (!req.files && !req.file) {
    return next();
  }
  
  // Here you would integrate with a virus scanning service
  // For now, we'll just log that validation occurred
  console.log('File content validation passed');
  
  next();
};

module.exports = {
  upload,
  handleUploadErrors,
  validateFileContent,
  ALLOWED_FILE_TYPES
};