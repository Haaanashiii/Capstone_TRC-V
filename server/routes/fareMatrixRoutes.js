const express = require('express');
const router = express.Router();
const multer = require('multer');
const fareMatrixController = require('../controllers/fareMatrixController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');



// Multer configuration for fare matrix image uploads to R2
const memoryStorage = multer.memoryStorage();
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
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
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
}).single('fareMatrixImage');
router.get('/', fareMatrixController.getActiveFareMatrix);

// Super Admin only - Upload new fare matrix (replaces old one automatically)
router.post(
  '/upload',
  authenticate,
  authorize(['super-admin']),
  uploadFareMatrixImage,
  fareMatrixController.uploadFareMatrix
);

module.exports = router;
