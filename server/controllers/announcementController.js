const announcementRepository = require('../repositories/announcementRepository');
const { auditLogService } = require('../services/auditLogService');

class AnnouncementController {
  /**
   * Create a new announcement (Admin only)
   */
  async createAnnouncement(req, res) {
    try {
      const { title, description, date, published } = req.body;
      const userId = req.user?.userId || 'system';
      const name = req.user?.name || 'System Admin';

      // Validation
      if (!title || !description) {
        return res.status(400).json({
          success: false,
          message: 'Title and description are required'
        });
      }

      const announcementData = {
        title,
        description,
        date: date || new Date(),
        published: published || false,
        createdBy: {
          userId,
          name
        }
      };

      const announcement = await announcementRepository.create(announcementData);

      // Log announcement creation
      if (req.user) {
        await auditLogService.logAnnouncementCreation(announcement, req.user, req).catch(err =>
          console.error('[Announcement] Audit log error:', err)
        );
      }

      // Broadcast to all connected clients (announcement room)
      const io = req.app.get('io');
      if (io) {
        io.to('announcements').emit('announcement-created', announcement);
        console.log(`[AnnouncementController] Broadcast announcement-created to all users`);
      }

      res.status(201).json({
        success: true,
        message: 'Announcement created successfully',
        announcement
      });
    } catch (error) {
      console.error('Error creating announcement:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create announcement',
        error: error.message
      });
    }
  }

  /**
   * Get all announcements with pagination
   */
  async getAllAnnouncements(req, res) {
    try {
      const { page, limit, search, sortBy, sortOrder } = req.query;

      const result = await announcementRepository.getAll({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        search,
        sortBy,
        sortOrder
      });

      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error getting announcements:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get announcements',
        error: error.message
      });
    }
  }

  /**
   * Get a single announcement by ID
   */
  async getAnnouncementById(req, res) {
    try {
      const { id } = req.params;

      const announcement = await announcementRepository.getById(id);

      res.status(200).json({
        success: true,
        announcement
      });
    } catch (error) {
      console.error('Error getting announcement:', error);
      res.status(404).json({
        success: false,
        message: 'Announcement not found',
        error: error.message
      });
    }
  }

  /**
   * Update an announcement (Admin only)
   */
  async updateAnnouncement(req, res) {
    try {
      const { id } = req.params;
      const { title, description, date, published } = req.body;

      const updateData = {}
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (date !== undefined) updateData.date = date;
      if (published !== undefined) updateData.published = published;

      const announcement = await announcementRepository.update(id, updateData);

      // Log announcement update
      if (req.user) {
        await auditLogService.logAnnouncementUpdate(announcement, req.user, req, updateData).catch(err =>
          console.error('[Announcement] Audit log error:', err)
        );
      }

      // Broadcast update to all connected clients (announcement room)
      const io = req.app.get('io');
      if (io) {
        io.to('announcements').emit('announcement-updated', announcement);
        console.log(`[AnnouncementController] Broadcast announcement-updated to all users`);
      }

      res.status(200).json({
        success: true,
        message: 'Announcement updated successfully',
        announcement
      });
    } catch (error) {
      console.error('Error updating announcement:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update announcement',
        error: error.message
      });
    }
  }

  /**
   * Delete an announcement (Admin only)
   */
  async deleteAnnouncement(req, res) {
    try {
      const { id } = req.params;

      // Get announcement before deleting for audit log
      const announcement = await announcementRepository.getById(id);

      await announcementRepository.delete(id);

      // Log announcement deletion
      if (req.user) {
        await auditLogService.logAnnouncementDeletion(announcement, req.user, req).catch(err =>
          console.error('[Announcement] Audit log error:', err)
        );
      }

      // Broadcast deletion to all connected clients (announcement room)
      const io = req.app.get('io');
      if (io) {
        io.to('announcements').emit('announcement-deleted', { _id: id });
        console.log(`[AnnouncementController] Broadcast announcement-deleted to all users`);
      }

      res.status(200).json({
        success: true,
        message: 'Announcement deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting announcement:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete announcement',
        error: error.message
      });
    }
  }

  /**
   * Get recent announcements
   */
  async getRecentAnnouncements(req, res) {
    try {
      const { limit } = req.query;

      const announcements = await announcementRepository.getRecent(
        parseInt(limit) || 5
      );

      res.status(200).json({
        success: true,
        announcements
      });
    } catch (error) {
      console.error('Error getting recent announcements:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get recent announcements',
        error: error.message
      });
    }
  }

  /**
   * Get published announcements (Public)
   */
  async getPublishedAnnouncements(req, res) {
    try {
      const announcements = await announcementRepository.getPublished();

      res.status(200).json({
        success: true,
        announcements
      });
    } catch (error) {
      console.error('Error getting published announcements:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get published announcements',
        error: error.message
      });
    }
  }
}

module.exports = new AnnouncementController();
