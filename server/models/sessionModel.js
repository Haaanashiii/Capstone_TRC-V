const mongoose = require('mongoose');

/**
 * Session Model - Stores active user sessions/refresh tokens
 * Supports multiple devices per user
 */
const sessionSchema = new mongoose.Schema({
  // Reference to user (can be from User or Admin collection)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  // Account type (user or admin)
  accountType: {
    type: String,
    enum: ['user', 'admin'],
    required: true
  },
  
  // Refresh token (hashed for security)
  refreshToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Device information
  deviceInfo: {
    userAgent: String,
    browser: String,
    os: String,
    device: String,
    ip: String
  },
  
  // Session metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  lastUsed: {
    type: Date,
    default: Date.now
  },
  
  expiresAt: {
    type: Date,
    required: true
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
sessionSchema.index({ userId: 1, isActive: 1 });

// TTL index - MongoDB automatically deletes expired documents
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);
