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
  driverPictureObj: { type: String, required: false },
  qrCodeObj: { type: String, required: false }
});

const franchiseInformationSchema = new mongoose.Schema({

  mtopNumber: { type: String, unique: true },
  mtofNumber: { type: String, unique: true },
  // operator details
  operatorId: { type: String, required: true },
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
  email: { type: String, required: false, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'] }, 
  
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
  
  
  profilePhoto: { type: String },
  qrCode: { type: String }, 

  approvedAt: { type: Date },
  expiryDate: { type: Date },

  documents: DocumentReferenceSchema,

  franchiseStatus: { type: String, enum: ['active', 'expired' , 'temporarily'], required: true },
  
  linkedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operator Information',
    required: false,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Franchise Information', franchiseInformationSchema);
