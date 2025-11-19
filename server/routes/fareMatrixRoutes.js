const express = require('express');
const router = express.Router();
const multer = require('multer');
const fareMatrixController = require('../controllers/fareMatrixController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

/**
 * Fare Matrix Routes
 * 
 * Public endpoints:
 * - GET /api/fare-matrix/active - Get active fare matrix
 * 
 * Admin endpoints:
 * - GET /api/fare-matrix/all - Get all (Super Admin)
 * - GET /api/fare-matrix/:fareMatrixId - Get details (Admin)
 * - POST /api/fare-matrix/upload - Upload new (Super Admin)
 * - PUT /api/fare-matrix/:fareMatrixId/replace - Replace existing (Super Admin)
 * - DELETE /api/fare-matrix/:fareMatrixId - Soft delete (Super Admin)
 */

// Multer configuration for fare matrix image uploads
const memoryStorage = multer.memoryStorage();
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

const uploadFareMatrixImage = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
}).single('fareMatrixImage');

// Public endpoint - Get active fare matrix (no auth required for public viewing)
router.get('/active', fareMatrixController.getActiveFareMatrix);

// Protected routes - require authentication
router.use(authenticate);

// Get all fare matrices (Super Admin only) - must come before /:fareMatrixId
router.get('/all', authorize(['super-admin']), fareMatrixController.getAllFareMatrices);

// Get specific fare matrix (Admin: super-admin, sb-admin, bplo-admin)
router.get('/:fareMatrixId', authorize(['super-admin', 'sb-admin', 'bplo-admin']), fareMatrixController.getFareMatrixById);

// Upload new fare matrix (Super Admin only)
router.post(
  '/upload',
  authorize(['super-admin']),
  uploadFareMatrixImage,
  fareMatrixController.uploadFareMatrix
);

// Replace existing fare matrix (Super Admin only)
router.put(
  '/:fareMatrixId/replace',
  authorize(['super-admin']),
  uploadFareMatrixImage,
  fareMatrixController.replaceFareMatrix
);

// Soft delete fare matrix (Super Admin only)
router.delete(
  '/:fareMatrixId',
  authorize(['super-admin']),
  fareMatrixController.softDeleteFareMatrix
);

module.exports = router;
