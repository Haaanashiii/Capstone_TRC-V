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

// Note: 'unique: true' on role field automatically creates an index, so explicit index() is not needed

module.exports = mongoose.models['RolePageAccess'] || mongoose.model('RolePageAccess', rolePageAccessSchema);
