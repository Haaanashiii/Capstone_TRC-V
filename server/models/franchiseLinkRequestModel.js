const mongoose = require('mongoose');

/**
 * Franchise Link Request Model
 * 
 * Stores pending requests from operators wanting to link their account
 * to an existing franchise. Admins review and approve/reject these requests.
 */

const LINK_REQUEST_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
});

const franchiseLinkRequestSchema = new mongoose.Schema({
  // Reference to the user/operator making the request (UUID string)
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // Franchise number they want to link to
  franchiseNumber: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Supporting document (OR/MTOP document)
  supportingDocument: {
    type: String,
    required: false // gridfs:// URL or file path
  },
  
  // Original filename for display
  documentFilename: {
    type: String,
    required: false
  },
  
  // Request status
  status: {
    type: String,
    enum: Object.values(LINK_REQUEST_STATUS),
    default: LINK_REQUEST_STATUS.PENDING,
    index: true
  },
  
  // Admin who reviewed the request (UUID string, not ObjectId)
  reviewedBy: {
    type: String,
    required: false
  },
  
  // Admin's name (denormalized for display)
  reviewedByName: {
    type: String,
    required: false
  },
  
  // Review timestamp
  reviewedAt: {
    type: Date,
    required: false
  },
  
  // Reason for rejection (if rejected)
  rejectionReason: {
    type: String,
    required: false
  },
  
  // Admin notes (internal)
  adminNotes: {
    type: String,
    required: false
  },
  
  // User's email at time of request (for notification)
  userEmail: {
    type: String,
    required: false,
    lowercase: true,
    trim: true
  },
  
  // User's name at time of request (denormalized for display)
  userName: {
    type: String,
    required: false
  },
  
  // User's contact number
  userContact: {
    type: String,
    required: false
  }
  
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'franchise_link_requests'
});

// Compound index for efficient queries
franchiseLinkRequestSchema.index({ status: 1, createdAt: -1 });
franchiseLinkRequestSchema.index({ userId: 1, franchiseNumber: 1 });

// Prevent duplicate pending requests from same user for same franchise
franchiseLinkRequestSchema.index(
  { userId: 1, franchiseNumber: 1, status: 1 },
  { 
    unique: true,
    partialFilterExpression: { status: 'pending' }
  }
);

// Virtual for request age
franchiseLinkRequestSchema.virtual('requestAge').get(function() {
  if (!this.createdAt) return null;
  const now = new Date();
  const diffMs = now - this.createdAt;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (diffDays > 0) return `${diffDays}d ${diffHours}h`;
  if (diffHours > 0) return `${diffHours}h`;
  return 'Just now';
});

// Ensure virtuals are included in JSON
franchiseLinkRequestSchema.set('toJSON', { virtuals: true });
franchiseLinkRequestSchema.set('toObject', { virtuals: true });

// Static method to get pending count
franchiseLinkRequestSchema.statics.getPendingCount = async function() {
  return this.countDocuments({ status: LINK_REQUEST_STATUS.PENDING });
};

// Static method to check if user has pending request for franchise
franchiseLinkRequestSchema.statics.hasPendingRequest = async function(userId, franchiseNumber) {
  const count = await this.countDocuments({
    userId,
    franchiseNumber,
    status: LINK_REQUEST_STATUS.PENDING
  });
  return count > 0;
};

const FranchiseLinkRequest = mongoose.model('FranchiseLinkRequest', franchiseLinkRequestSchema);

module.exports = {
  FranchiseLinkRequest,
  LINK_REQUEST_STATUS
};
