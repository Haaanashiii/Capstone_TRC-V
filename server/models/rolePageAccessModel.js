const mongoose = require('mongoose');

const rolePageAccessSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['sb-admin', 'bplo-admin', 'super-admin'],
    required: true,
    unique: true
  },
  allowedPages: [{
    type: String,
    enum: [
      'dashboard',
      'franchisee-list',
      'franchise-management',
      'certificate',
      'fare-reports',
      'analytics',
      'announcements',
      'audit-trail',
      'user-management',
      'settings'
    ]
  }],
  updatedBy: {
    type: String,
    ref: 'AdminAccount'
  }
}, { 
  timestamps: true 
});

// Indexes
rolePageAccessSchema.index({ role: 1 });

module.exports = mongoose.model('RolePageAccess', rolePageAccessSchema);
