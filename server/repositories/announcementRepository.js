const Announcement = require('../models/announcementModel');

class AnnouncementRepository {
  /**
   * Create a new announcement
   */
  async create(announcementData) {
    try {
      const announcement = new Announcement(announcementData);
      await announcement.save();
      return announcement;
    } catch (error) {
      throw new Error(`Failed to create announcement: ${error.message}`);
    }
  }

  /**
   * Get all announcements with pagination and sorting
   */
  async getAll(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        sortBy = 'date',
        sortOrder = 'desc'
      } = filters;

      const query = {};

      // Search in title and description
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Build sort object
      const sort = {};
      if (sortBy === 'date' || sortBy === 'createdAt' || sortBy === 'title') {
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      } else {
        sort.date = -1; // Default: newest first
      }

      const skip = (page - 1) * limit;

      const [announcements, total] = await Promise.all([
        Announcement.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Announcement.countDocuments(query)
      ]);

      return {
        announcements,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get announcements: ${error.message}`);
    }
  }

  /**
   * Get a single announcement by ID
   */
  async getById(id) {
    try {
      const announcement = await Announcement.findById(id).lean();
      if (!announcement) {
        throw new Error('Announcement not found');
      }
      return announcement;
    } catch (error) {
      throw new Error(`Failed to get announcement: ${error.message}`);
    }
  }

  /**
   * Update an announcement
   */
  async update(id, updateData) {
    try {
      const announcement = await Announcement.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!announcement) {
        throw new Error('Announcement not found');
      }
      
      return announcement;
    } catch (error) {
      throw new Error(`Failed to update announcement: ${error.message}`);
    }
  }

  /**
   * Delete an announcement
   */
  async delete(id) {
    try {
      const announcement = await Announcement.findByIdAndDelete(id);
      if (!announcement) {
        throw new Error('Announcement not found');
      }
      return announcement;
    } catch (error) {
      throw new Error(`Failed to delete announcement: ${error.message}`);
    }
  }

  /**
   * Get recent announcements
   */
  async getRecent(limit = 5) {
    try {
      const announcements = await Announcement.find()
        .sort({ date: -1 })
        .limit(limit)
        .lean();
      
      return announcements;
    } catch (error) {
      throw new Error(`Failed to get recent announcements: ${error.message}`);
    }
  }

  /**
   * Get published announcements (unlimited)
   */
  async getPublished() {
    try {
      const announcements = await Announcement.find({ published: true })
        .sort({ date: -1 })
        .lean();
      
      return announcements;
    } catch (error) {
      throw new Error(`Failed to get published announcements: ${error.message}`);
    }
  }

  /**
   * Count published announcements
   */
  async countPublished() {
    try {
      const count = await Announcement.countDocuments({ published: true });
      return count;
    } catch (error) {
      throw new Error(`Failed to count published announcements: ${error.message}`);
    }
  }
}

module.exports = new AnnouncementRepository();
