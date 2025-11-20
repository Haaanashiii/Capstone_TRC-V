const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter, accountLimiter } = require('../middlewares/rateLimiter');
const authenticate = require('../middlewares/authenticate');


// Login route (identifier can be username or email)
// Use both IP-based and account-based rate limiting
router.post('/login', authLimiter, accountLimiter, authController.login);

// Signup (local) - create a username/email/password account
router.post('/signup', authController.signup);

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

// Get current user info
router.get('/me', authenticate, authController.getCurrentUser);


module.exports = router;