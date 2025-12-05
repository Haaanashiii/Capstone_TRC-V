const mongoose = require('mongoose');

const DocumentReferenceSchema = new mongoose.Schema({
  motorRegistrationObj: { type: String, required: false },
  barangayClearanceObj: { type: String, required: false },
  cedulaObj: { type: String, required: false },
  driversLicenseObj: { type: String, required: false },
  votersAffidavitObj: { type: String, required: false },
  motorChassisStencilObj: { type: String, required: false }, 
  oRTreasurerOfficeObj: { type: String, required: false },
  oRLTOObj: { type: String, required: false },
  cRLTOObj: { type: String, required: false },
  operatorPictureObj: { type: String, required: false },
  driverPictureObj: { type: String, required: false },
  qrCodeObj: { type: String, required: false },
  oRTreasurerOfficeObj: { type: String, required: false },
  //added of sb
  resolutionDocumentObj: { type: String, required: false },
});

const franchiseInformationSchema = new mongoose.Schema({

  franchiseNumber: { type: String, required: true }, // Can be reused after revoke
  officialReceiptNumber: { type: String, required: false }, // OR number after BPLO approval
  // CRITICAL: Tracks the lineage/chain of this franchise
  // When franchise #001 expires and is given to another user, they get a NEW franchiseChainId
  // This prevents data mixing between User A's history and User B's history
  // Format: franchiseNumber-operatorName (e.g., "0012-Juan-dela-Cruz", "0012-Maria-Santos")
  // SB/BPLO admins can see this to identify different owners of reused franchise numbers
  franchiseChainId: { type: String, required: true },

  // operator details
  operatorName: { type: String, required: true },
  operatorContactNumber: { type: String, required: true, trim: true },
  coOwnerName: { type: String, required: false },
  coOwnerAddress: { type: String, required: false }, 
  operatorAddress: { type: String, required: true },
  operatorBarangay: { type: String, required: true }, 
  operatorCivilStatus: { type: String, required: true },
  operatorBirthPlace: { type: String, required: true },
  operatorBirthDate: { type: Date, required: true },
  operatorCitizenship: { type: String, required: true },
  operatorEmail: { type: String, required: false, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'] }, 
  
  // driver details
  driverName: { type: String, required: true },
  driversAddress: { type: String, required: true },
  todaMembership: { type: String, required: false },

// motor details
  unitModel: { type: String, required: true },
  colorMotor: { type: String, required: true },
  sideCarColor: { type: String, required: true }, // User can specify Blue, Yellow, or other colors
  mvPlateNo: { type: String, required: true },
  motorEngineNo: { type: String, required: true },
  chasisNo: { type: String, required: true},
  
  
  profilePhoto: { type: String },
  qrCode: { type: String }, // Static QR code based on franchise number (same across all versions) 

  approvedAt: { type: Date },
  expiryDate: { type: Date },

  // SB Resolution Information
  resolutionNumber: { type: String, required: false },
  resolutionDocument: { type: String, required: false },
  sbApprovedAt: { type: Date, required: false },
  
  // Official Receipt Information
  officialReceiptNumber: { type: String, required: false },
  officialReceiptDocument: { type: String, required: false },

  //rate
  rate:{type: String, enum: ['Old Rate', 'New Rate',], required: true , default: 'New Rate' },
  franchiseStatus: { type: String, enum: ['Active', 'Expired' , 'Revoked'], required: true },
  documents: DocumentReferenceSchema,

  // Version History System
  // Each version is a COMPLETE SNAPSHOT of the entire franchise record at that point in time
  version: { type: Number, default: 1 },
  isCurrentVersion: { type: Boolean, default: true, index: true },
  previousVersion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise Information'
  },
  // changeType describes WHY this new version was created
  changeType: { 
    type: String, 
    enum: [
      'new',              // Initial franchise application approved (first time)
      'renewal',          // Operator submitted renewal application → Admin approved
      'update_ownership', // Operator submitted ownership transfer → Admin approved
      'change_unit',      // Operator submitted unit change → Admin approved
      'auto_expired',     // System/cron auto-marked as expired after 3 years
      'auto_revoked'      // System/cron auto-revoked (e.g., expired too long)
    ],
    default: 'new'
  },
  changeReason: { type: String }, // Human-readable reason for this change
  changedBy: { type: String }, // Admin username who approved, or 'system' for auto changes
  changedAt: { type: Date, default: Date.now }, // When this version was created
  
  linkedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User Accounts',
    required: false,
    default: null
  }
}, { timestamps: true });

// Compound index: franchiseNumber can be reused, but each chain is unique
// When franchise #001 is active (User A), no other active franchise #001 can exist
// When User A's franchise #001 is revoked, a new franchiseChainId for #001 (User B) is created
franchiseInformationSchema.index(
  { franchiseNumber: 1, isCurrentVersion: 1 },
  { 
    unique: true,
    partialFilterExpression: { isCurrentVersion: true }
  }
);

// Index for finding all versions in a franchise chain (all users who ever had this franchise number)
franchiseInformationSchema.index({ franchiseChainId: 1 });

// Index for finding a specific user's franchise chain
franchiseInformationSchema.index({ franchiseChainId: 1, linkedUser: 1 });

// Additional indexes for performance
franchiseInformationSchema.index({ linkedUser: 1 });
franchiseInformationSchema.index({ franchiseStatus: 1 });
franchiseInformationSchema.index({ expiryDate: 1 });
franchiseInformationSchema.index({ operatorBarangay: 1 });
franchiseInformationSchema.index({ changeType: 1 });

// Compound indexes for common queries
franchiseInformationSchema.index({ isCurrentVersion: 1, franchiseStatus: 1 });
franchiseInformationSchema.index({ linkedUser: 1, isCurrentVersion: 1 });

// NEW: Indexes for year-based and date-range queries (10K+ optimization)
franchiseInformationSchema.index({ approvedAt: -1 });
franchiseInformationSchema.index({ createdAt: -1 });
franchiseInformationSchema.index({ isCurrentVersion: 1, approvedAt: -1 });
franchiseInformationSchema.index({ operatorBarangay: 1, isCurrentVersion: 1, franchiseStatus: 1 });

// Text index for search functionality
franchiseInformationSchema.index({
  operatorName: 'text',
  franchiseNumber: 'text',
  operatorAddress: 'text',
  driverName: 'text'
}, {
  weights: {
    franchiseNumber: 10,
    operatorName: 5,
    driverName: 3,
    operatorAddress: 1
  },
  name: 'franchise_text_search'
});

module.exports = mongoose.model('Franchise Information', franchiseInformationSchema);
