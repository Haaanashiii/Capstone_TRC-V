const mongoose = require('mongoose');

const DocumentReferenceSchema = new mongoose.Schema({
  motorRegistrationObj: { type: String, required: false }, // Required for initial submission
  barangayClearanceObj: { type: String, required: false }, // Required for initial submission
  cedulaObj: { type: String, required: false }, // Required for initial submission
  driversLicenseObj: { type: String, required: false }, // Required for initial submission
  votersAffidavitObj: { type: String, required: false },
  motorChassisStencilObj: { type: String, required: false }, // Required for initial submission
  oRLTOObj: { type: String, required: false }, // Added after BPLO approval
  cRLTOObj: { type: String, required: false }, // Added after BPLO approval
  driverPictureObj: { type: String, required: false },
  operatorPictureObj: { type: String, required: false },
  oRTreasurerOfficeObj: { type: String, required: false }, // after bplo checks
});

const franchiseApplicationSchema = new mongoose.Schema({

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
  driversID: { type: String, required: true },
  driverName: { type: String, required: true },
  driversAddress: { type: String, required: true },
  todaMembership: { type: String, required: false },

// motor details
  unitModel: { type: String, required: true },
  colorMotor: { type: String, required: true },
  sideCarColor: { type: String, required: true }, // Default Blue, user can edit to Yellow or other
  sideCarPlateNumber: { type: String, required: false }, // 3months for bplo
  mvPlateNo: { type: String, required: true, unique: true },
  motorEngineNo: { type: String, required: true, unique: true },
  chasisNo: { type: String, required: true, unique: true },

  // Two-stage approval workflow
  statusOfBPLO: {
    type: String, 
    enum: [
      'pending',              // Initial state - waiting for BPLO review
      'bplo-approved',        // BPLO approved - awaiting OR submission
      'bplo-disapproved',     // BPLO disapproved - needs inspection/revision
      'awaiting-sb',          // OR submitted - ready for SB review
      'sb-approved',          // Final approval by SB - ready for certificate
      'rejected'              // Permanently rejected
    ], 
    required: true,
    default: 'pending' 
  },
  
  // BPLO Approval Stage
  bploApprovedBy: { type: String, required: false },        // Admin username who approved/disapproved
  bploApprovedAt: { type: Date, required: false },           // Timestamp of BPLO action
  bploDisapprovedReason: { type: String, required: false },  // Reason for disapproval
  bploInspectionRequired: { type: Boolean, default: false }, // Flag for inspection requirement
  
  // OR Number Stage (submitted by user after BPLO approval)
  officialReceiptNumber: { type: String, required: false },
  officialReceiptDocument: { type: String, required: false }, // URL to OR document
  orSubmittedAt: { type: Date, required: false },
  
  // SB Approval Stage (final)
  sbApprovedBy: { type: String, required: false },           // SB admin username
  sbApprovedAt: { type: Date, required: false },             // Final approval timestamp
  sbResolutionNumber: { type: String, required: false },     // Resolution number for certificate
  sbResolutionDocument: { type: String, required: false },   // URL to resolution document uploaded by SB admin
  
  // Legacy fields
  approvedAt: { type: Date },                                // Kept for backward compatibility
  submittedAt: { type: Date, default: Date.now },

  documents: DocumentReferenceSchema,

  // Application type - determines what happens when approved
  applicationType: { 
    type: String, 
    enum: [
      'new',              // New franchise application (creates initial franchise)
      'renewal',          // Renew existing franchise (same franchise number, new 3-year period)
      'update_ownership', // Transfer ownership (same franchise number, different operator)
      'change_unit'       // Change motor unit (same franchise number, different vehicle)
    ],
    default: 'new'
  },
  // Link to existing franchise (required for renewal/update_ownership/change_unit)
  relatedFranchise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise Information',
    required: function() { 
      return this.applicationType !== 'new'; 
    }
  },
  // Link to User Account (optional - can submit without user account)
  operatorInfo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User Accounts',
    required: false,
    default: null
  }
}, { collection: 'Franchise Applications' });

// Indexes for performance optimization
franchiseApplicationSchema.index({ statusOfBPLO: 1 });
franchiseApplicationSchema.index({ operatorInfo: 1 });
franchiseApplicationSchema.index({ applicationType: 1 });
franchiseApplicationSchema.index({ relatedFranchise: 1 });
franchiseApplicationSchema.index({ submittedAt: -1 });
franchiseApplicationSchema.index({ approvedAt: -1 });
// Compound index for common queries
franchiseApplicationSchema.index({ operatorInfo: 1, statusOfBPLO: 1 });


module.exports = mongoose.model('Franchise Application', franchiseApplicationSchema);
