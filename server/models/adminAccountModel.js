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
    unique: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
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
  phoneNumber: { 
    type: String, 
    trim: true,
    match: [/^\+?[0-9]{10,15}$/, 'Invalid phone number']
  },
  profilePicture: { 
    type: String  
  },
  department: {
    type: String,
    trim: true
  },
  position: {
    type: String,
    trim: true
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastLogin: { 
    type: Date 
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

// Index for faster queries
adminAccountSchema.index({ email: 1 });
adminAccountSchema.index({ username: 1 });
adminAccountSchema.index({ role: 1 });
adminAccountSchema.index({ isActive: 1 });

module.exports = mongoose.model('AdminAccount', adminAccountSchema);
