const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter } = require('../middlewares/rateLimiter');


// Login route
router.post('/login', authLimiter, authController.login);

// OTP for 2FA and forgot password
const { otpLimiter } = require('../middlewares/rateLimiter');
router.post('/request-otp', otpLimiter, authController.requestOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Refresh token route
router.post('/refresh-token', authController.refreshToken);

// Logout route
router.post('/logout', authController.logout);

module.exports = router;