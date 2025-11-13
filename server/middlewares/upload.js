const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Create upload directories if they don't exist
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

// Storage configuration for profile photos
const profilePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.profilePhotos);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: operator-{timestamp}-{random}.{ext}
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `operator-${uniqueSuffix}${ext}`);
  }
});

// Storage configuration for documents
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.documents);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: doc-{fieldname}-{timestamp}-{random}.{ext}
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname);
    const fieldName = file.fieldname;
    cb(null, `doc-${fieldName}-${uniqueSuffix}${ext}`);
  }
});

// File filter for images (profile photos)
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

// File filter for documents (images and PDFs)
const documentFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'application/pdf',
    // Microsoft Word
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (JPEG, PNG, WebP) and PDF files are allowed.'), false);
  }
};

// Profile photo upload (single file)
const uploadProfilePhoto = multer({
  storage: profilePhotoStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
}).single('profilePhoto');

// Document upload (multiple fields)
const uploadOperatorDocuments = multer({
  storage: documentStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  }
}).fields([
  // Field names matching the dashboard form inputs
  { name: 'documentRegistration', maxCount: 1 },
  { name: 'documentBarangayClearance', maxCount: 1 },
  { name: 'documentCedula', maxCount: 1 },
  { name: 'documentDriversLicense', maxCount: 1 },
  { name: 'documentVotersAffidavit', maxCount: 1 },
  { name: 'documentPicture', maxCount: 1 }
]);

// Combined upload for operator creation (profile + documents)
const uploadOperatorComplete = multer({
  storage: documentStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  }
}).fields([
  { name: 'profilePhoto', maxCount: 1 },
  // Accept both legacy and current frontend field names
  { name: 'documentRegistration', maxCount: 1 },
  { name: 'documentBarangayClearance', maxCount: 1 },
  { name: 'documentCedula', maxCount: 1 },
  { name: 'documentDriversLicense', maxCount: 1 },
  { name: 'documentVotersAffidavit', maxCount: 1 },
  { name: 'documentPicture', maxCount: 1 }
]);

// Error handler middleware for multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'File size exceeds the maximum limit of 10MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        message: 'Maximum file count exceeded'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected field',
        message: `Unexpected file field: ${err.field}`
      });
    }
    return res.status(400).json({
      error: 'Upload error',
      message: err.message
    });
  }
  
  if (err) {
    return res.status(400).json({
      error: 'File upload error',
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
