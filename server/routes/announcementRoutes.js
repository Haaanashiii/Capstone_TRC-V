const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { apiLimiter } = require('../middlewares/rateLimiter');

// Public route (no authentication required)
router.get('/published', apiLimiter, announcementController.getPublishedAnnouncements);

// Apply authentication to all other routes
router.use(authenticate);

// Public routes (all authenticated users can access)
router.get('/', apiLimiter, announcementController.getAllAnnouncements);
router.get('/recent', apiLimiter, announcementController.getRecentAnnouncements);
router.get('/:id', apiLimiter, announcementController.getAnnouncementById);

// Admin-only routes (create, update, delete)
router.post(
  '/',
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  apiLimiter,
  announcementController.createAnnouncement
);

router.put(
  '/:id',
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  apiLimiter,
  announcementController.updateAnnouncement
);

router.delete(
  '/:id',
  authorize(['sb-admin', 'bplo-admin', 'super-admin']),
  apiLimiter,
  announcementController.deleteAnnouncement
);

module.exports = router;
