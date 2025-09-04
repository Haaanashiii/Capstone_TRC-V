const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter } = require('../middlewares/rateLimiter');

// Login route
router.post('/login', authLimiter, authController.login);

// Refresh token route
router.post('/refresh-token', authController.refreshToken);

// Logout route
router.post('/logout', authController.logout);

module.exports = router;