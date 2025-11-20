const mongoose = require('mongoose');

const DocumentReferenceSchema = new mongoose.Schema({
  motorRegistrationObj: { type: String, required: false },
  barangayClearanceObj: { type: String, required: false },
  cedulaObj: { type: String, required: false },
  driversLicenseObj: { type: String, required: false },
  votersAffidavitObj: { type: String, required: false },
  motorChassisStencilObj: { type: String, required: false }, 
  oRTreasurerOfficeObj: { type: String, required: false }, // after bplo checks
  oRLTOObj: { type: String, required: false }, //
  cRLTOObj: { type: String, required: false }, // temporarily slip?
  driverPictureObj: { type: String, required: false },
  operaorPictureObj: { type: String, required: false },
});

const franchiseApplicationSchema = new mongoose.Schema({

  operatorId: { type: String, required: true},
  operatorName: { type: String, required: true },
  operatorContactNumber: { type: String, required: true, trim: true },
  coOwnerName: { type: String, required: false },
  coOwnerAddress: { type: String, required: false }, 
  address: { type: String, required: true },
  barangay: { type: String, required: true }, 
  civilStatus: { type: String, required: true },
  birthPlace: { type: String, required: true },
  birthDate: { type: Date, required: true },
  citizenship: { type: String, required: true },
  email: { type: String, required: false, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'] }, // Optional - user can have multiple franchises
  
  // driver details
  driversID: { type: String, required: true, unique: true },
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

  approvedByBplo: {type: String, enum: ['approved', 'pending' , 'rejected'], required: true ,default: 'pending' },

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


module.exports = mongoose.model('Franchise Application', franchiseApplicationSchema);
