const mongoose = require('mongoose');

const DocumentReferenceSchema = new mongoose.Schema({
  motorRegistrationObj: { type: String, required: true },
  barangayClearanceObj: { type: String, required: true },
  cedulaObj: { type: String, required: true },
  driversLicenseObj: { type: String, required: true },
  votersAffidavitObj: { type: String, required: false },
  motorChassisStencilObj: { type: String, required: true }, 
  oRLTOObj: { type: String, required: true }, //
  cRLTOObj: { type: String, required: true }, // 
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
  sideCarColor: { type: String, required: true },
  sideCarPlateNumber: { type: String, required: false }, // 3months for bplo
  mvPlateNo: { type: String, required: true, unique: true },
  motorEngineNo: { type: String, required: true, unique: true },
  chasisNo: { type: String, required: true, unique: true },

  statusOfBPLO: {type: String, enum: ['approved', 'pending' , 'rejected'], required: true ,default: 'pending' },
  officialRecieptNumber: { type: String, required: false },
  approvedAt: { type: Date },
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
