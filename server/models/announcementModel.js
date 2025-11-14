const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Announcement title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Announcement description is required'],
    trim: true,
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  date: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  published: {
    type: Boolean,
    default: false,
    index: true
  },
  createdBy: {
    userId: {
      type: String,
      required: false
    },
    name: {
      type: String,
      required: false
    }
  }
}, {
  timestamps: true,
  collection: 'announcements'
});

// Index for sorting by date
announcementSchema.index({ date: -1 });
announcementSchema.index({ published: 1, date: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
