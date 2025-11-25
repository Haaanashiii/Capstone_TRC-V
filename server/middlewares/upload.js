const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * CONSOLIDATED SECURE UPLOAD MIDDLEWARE
 * 
 * This middleware handles all file uploads with:
 * - Memory storage (for Cloudflare R2 upload)
 * - File type validation (MIME type + extension matching)
 * - File size limits (10MB max, compressed to ~300KB on server)
 * - Security checks (prevents file spoofing)
 * 
 * Files are organized in Cloudflare R2 as:
 * TRC-V/
 *   └── franchise-applications/
 *       └── {applicationId}/
 *           ├── profile/
 *           │   └── 1x1-picture.jpg
 *           └── documents/
 *               ├── registration.pdf
 *               ├── barangay-clearance.pdf
 *               └── ... (other documents)
 */

// Create upload directories if they don't exist (for backward compatibility/local backups)
const uploadDirs = {
  profilePhotos: 'uploads/operators/profiles',
  documents: 'uploads/operators/documents',
  qrCodes: 'uploads/operators/qrcodes'
};

Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Use memory storage for Cloudflare R2 uploads
// Files will be stored in memory temporarily and uploaded to Cloudflare
const memoryStorage = multer.memoryStorage();

// File filter for images (profile photos)
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

// File filter for documents (images and PDFs) - STRICT for security
const documentFileFilter = (req, file, cb) => {
  // Only allow specific MIME types for franchise documents
  const allowedMimes = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'application/pdf': ['.pdf']
  };
  
  const allowedExtensions = allowedMimes[file.mimetype];
  
  if (!allowedExtensions) {
    return cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
  }
  
  // Verify file extension matches MIME type (prevent spoofing)
  const fileExt = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(fileExt)) {
    return cb(new Error('File extension does not match file type. Possible file spoofing detected.'), false);
  }
  
  cb(null, true);
};

// Profile photo upload (single file)
const uploadProfilePhoto = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (will be compressed to 300KB)
  }
}).single('profilePhoto');

// Document upload (multiple fields)
// These files will be compressed to under 300KB and uploaded to Cloudflare R2
const uploadOperatorDocuments = multer({
  storage: memoryStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file (will be compressed to 300KB)
  }
}).fields([
  // Legacy field names (for backward compatibility)
  { name: 'documentRegistration', maxCount: 1 },
  { name: 'documentBarangayClearance', maxCount: 1 },
  { name: 'documentCedula', maxCount: 1 },
  { name: 'documentDriversLicense', maxCount: 1 },
  { name: 'documentVotersAffidavit', maxCount: 1 },
  { name: 'documentPicture', maxCount: 1 },
  { name: 'documentChassisStencil', maxCount: 1 },
  { name: 'profilePhoto', maxCount: 1 },
  // New field names (matching controller expectations with 'Obj' suffix)
  { name: 'motorRegistrationObj', maxCount: 1 },
  { name: 'barangayClearanceObj', maxCount: 1 },
  { name: 'cedulaObj', maxCount: 1 },
  { name: 'driversLicenseObj', maxCount: 1 },
  { name: 'votersAffidavitObj', maxCount: 1 },
  { name: 'driverPictureObj', maxCount: 1 },
  { name: 'motorChassisStencilObj', maxCount: 1 },
  { name: 'operatorPictureObj', maxCount: 1 },
  { name: 'oRLTOObj', maxCount: 1 },
  { name: 'cRLTOObj', maxCount: 1 },
  { name: 'oRTreasurerOfficeObj', maxCount: 1 },
  // SB Admin documents
  { name: 'resolutionDocument', maxCount: 1 }
]);

// Combined upload for operator creation (profile + documents)
const uploadOperatorComplete = multer({
  storage: memoryStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file (will be compressed to 300KB)
  }
}).fields([
  { name: 'profilePhoto', maxCount: 1 },
  // Accept both legacy and current frontend field names
  { name: 'documentRegistration', maxCount: 1 },
  { name: 'documentBarangayClearance', maxCount: 1 },
  { name: 'documentCedula', maxCount: 1 },
  { name: 'documentDriversLicense', maxCount: 1 },
  { name: 'documentVotersAffidavit', maxCount: 1 },
  { name: 'documentPicture', maxCount: 1 },
  { name: 'documentChassisStencil', maxCount: 1 }
]);

// Error handler middleware for multer errors
// This provides user-friendly error messages for file upload issues
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds the maximum limit of 10MB. Files will be compressed to ~300KB on the server.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        code: 'TOO_MANY_FILES',
        message: 'Maximum file count exceeded'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected field',
        code: 'UNEXPECTED_FIELD',
        message: `Unexpected file field: ${err.field}`
      });
    }
    return res.status(400).json({
      error: 'Upload error',
      code: err.code,
      message: err.message
    });
  }
  
  // Handle file type/validation errors
  if (err) {
    // Check if it's our custom validation error
    if (err.message.includes('file type') || err.message.includes('extension')) {
      return res.status(400).json({
        error: 'Invalid file',
        code: 'INVALID_FILE_TYPE',
        message: err.message
      });
    }
    
    return res.status(400).json({
      error: 'File upload error',
      code: 'UPLOAD_ERROR',
      message: err.message
    });
  }
  
  next();
};

module.exports = {
  uploadProfilePhoto,
  uploadOperatorDocuments,
  uploadOperatorComplete,
  handleMulterError,
  uploadDirs
};
