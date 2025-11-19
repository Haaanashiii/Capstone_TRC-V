const mongoose = require('mongoose');
const operatorInformationModel = require('./operatorInformationModel');

// Documents are now stored as Cloudflare R2 URLs (compressed to ~300KB)
const DocumentReferenceSchema = new mongoose.Schema({
  motorRegistrationObj: { type: String, required: true },
  barangayClearanceObj: { type: String, required: true },
  cedulaObj: { type: String, required: true },
  driversLicenseObj: { type: String, required: true },
  votersAffidavitObj: { type: String, required: true },
  motorChassisStencilObj: { type: String, required: true }, 
  oRTreasurerOfficeObj: { type: String, required: false },
  oRLTOObj: { type: String, required: false },
  cRLTOObj: { type: String, required: false },
  driverPictureObj: { type: String, required: true },
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
  sideCarPlateNumber: { type: String, required: true },
  mvPlateNo: { type: String, required: true, unique: true },
  motorEngineNo: { type: String, required: true, unique: true },
  chasisNo: { type: String, required: true, unique: true },


  approvedByBplo: {type: String, enum: ['approved', 'pending' , 'temporarily', 'rejected'], required: true ,default: 'temporarily' },
  bploRemarks: { type: String },

  approvedAt: { type: Date },
  submittedAt: { type: Date, default: Date.now },

  documents: DocumentReferenceSchema,

  operatorInformationModel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operator Information',
    required: false,
    default: null
  }
}, { collection: 'Franchise Applications' });


module.exports = mongoose.model('Franchise Application', franchiseApplicationSchema);
