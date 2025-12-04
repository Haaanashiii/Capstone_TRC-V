const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { triggerManualExpiryCheck } = require('../services/franchiseExpiryScheduler');

/**
 * Manual trigger for franchise expiry check
 * Only admins can trigger this
 * Useful for testing the scheduler without waiting for cron schedule
 */
router.post('/trigger-expiry-check', authenticate, authorize(['super-admin', 'sb-admin']), async (req, res, next) => {
  try {
    console.log('[Scheduler] Manual check triggered');
    
    // Run the check asynchronously
    triggerManualExpiryCheck()
      .then(() => {
        console.log('[Scheduler] Check completed');
      })
      .catch((error) => {
        console.error('[Scheduler] Check error:', error.message);
      });
    
    // Respond immediately
    res.status(200).json({
      success: true,
      message: 'Franchise expiry check initiated. Check server logs for results.',
      triggeredBy: req.user.name || 'Admin',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
