const mongoose = require('mongoose');
const { uuidv7 } = require('uuidv7');

const fareMatrixSchema = new mongoose.Schema({
  // Unique identifier (UUID)
  fareMatrixId: { 
    type: String, 
    default: uuidv7, 
    unique: true,
    index: true
  },

  // Image URL (stored on Cloudflare R2)
  imageUrl: { 
    type: String, 
    required: true,
    trim: true
  },

  // R2 file path (for deletion/replacement)
  r2FilePath: {
    type: String,
    required: false,
    trim: true
  },

  // Metadata
  fileName: {
    type: String,
    required: true,
    trim: true
  },

  fileSize: {
    type: Number,
    required: false
  },

  mimeType: {
    type: String,
    required: false,
    default: 'image/jpeg'
  },

  // Upload information
  uploadedBy: {
    type: String, // Admin UUID or adminId
    required: true,
    index: true
  },

  uploadedByName: {
    type: String,
    required: false
  },

  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Soft delete tracking
  deletedAt: {
    type: Date,
    default: null
  },

  deletedBy: {
    type: String,
    default: null
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'Fare Matrix',
  timestamps: true
});

// Indexes for efficient querying
fareMatrixSchema.index({ isActive: 1, createdAt: -1 });
fareMatrixSchema.index({ uploadedBy: 1, createdAt: -1 });
fareMatrixSchema.index({ fareMatrixId: 1, isActive: 1 });

module.exports = mongoose.model('Fare Matrix', fareMatrixSchema);
