const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { triggerManualExpiryCheck } = require('../services/franchiseExpiryScheduler');

/**
 * Manual trigger for franchise expiry check
 * Only admins can trigger this
 * Useful for testing the scheduler without waiting for cron schedule
 */
router.post('/trigger-expiry-check', authenticate, authorize(['super-admin', 'sb-admin']), async (req, res, next) => {
  try {
    console.log('[API] Manual expiry check triggered by:', req.user.email || req.user.username);
    
    // Run the check asynchronously
    triggerManualExpiryCheck()
      .then(() => {
        console.log('[API] Manual expiry check completed');
      })
      .catch((error) => {
        console.error('[API] Manual expiry check failed:', error);
      });
    
    // Respond immediately
    res.status(200).json({
      success: true,
      message: 'Franchise expiry check initiated. Check server logs for results.',
      triggeredBy: req.user.email || req.user.username,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
