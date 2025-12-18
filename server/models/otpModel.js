/**
 * OTP Storage Model
 * Stores OTP codes in MongoDB for cluster-mode compatibility
 */

const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  otp: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // MongoDB TTL index - auto-deletes expired documents
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  attempts: {
    type: Number,
    default: 0
  }
}, {
  timestamps: false
});

// Index for faster lookups
otpSchema.index({ email: 1, expiresAt: 1 });

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;
