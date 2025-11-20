const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const adminAccountSchema = new mongoose.Schema({
  adminId: { 
    type: String, 
    default: uuidv4, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  username: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    lowercase: true, 
    trim: true, 
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'] 
  },
  password: { 
    type: String, 
    required: true, 
    minlength: 8, 
    select: false 
  },
  role: { 
    type: String, 
    enum: ['sb-admin', 'bplo-admin', 'super-admin'], 
    default: 'sb-admin',
    required: true 
  },
  permissions: [{
    type: String,
    enum: [
      'manage-users',
      'manage-operators', 
      'manage-franchises',
      'view-reports',
      'approve-franchise-applications',
      'manage-announcements',
      'system-settings'
    ]
  }]
}, { timestamps: true });

module.exports = mongoose.model('AdminAccount', adminAccountSchema);
