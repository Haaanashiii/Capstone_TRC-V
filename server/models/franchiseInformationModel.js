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

  //added of sb
  individualSessionReportObj: { type: String, required: false },
});

const franchiseInformationSchema = new mongoose.Schema({

  franchiseNumber: { type: String, unique: true }, //inputed by sb
  sessionNumber: { type: String }, // sort 

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
  driversID: { type: String, required: true, unique: true },
  driverName: { type: String, required: true },
  driversAddress: { type: String, required: true },
  todaMembership: { type: String, required: false },

// motor details
  unitModel: { type: String, required: true },
  colorMotor: { type: String, required: true },
  sideCarColor: { type: String, required: true }, // User can specify Blue, Yellow, or other colors
  sideCarPlateNumber: { type: String, required: true },
  mvPlateNo: { type: String, required: true, unique: true },
  motorEngineNo: { type: String, required: true, unique: true },
  chasisNo: { type: String, required: true, unique: true },
  
  
  profilePhoto: { type: String },
  qrCode: { type: String }, 

  approvedAt: { type: Date },
  expiryDate: { type: Date },

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

// Compound index: franchiseNumber can be reused if previous franchise is revoked (not current version)
franchiseInformationSchema.index(
  { franchiseNumber: 1, isCurrentVersion: 1 },
  { 
    unique: true,
    partialFilterExpression: { isCurrentVersion: true }
  }
);

// Additional indexes for performance
franchiseInformationSchema.index({ linkedUser: 1 });
franchiseInformationSchema.index({ franchiseStatus: 1 });
franchiseInformationSchema.index({ expiryDate: 1 });
franchiseInformationSchema.index({ operatorBarangay: 1 });
franchiseInformationSchema.index({ changeType: 1 });
// Compound indexes for common queries
franchiseInformationSchema.index({ isCurrentVersion: 1, franchiseStatus: 1 });
franchiseInformationSchema.index({ linkedUser: 1, isCurrentVersion: 1 });

module.exports = mongoose.model('Franchise Information', franchiseInformationSchema);
