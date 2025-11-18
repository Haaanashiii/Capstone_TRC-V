const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  motorRegistration: { type: String, required: true },
  barangayClearance: { type: String, required: true },
  cedula: { type: String, required: true },
  driversLicense: { type: String, required: true },
  votersAffidavit: { type: String, required: true },
  motorChassisStencil: { type: String, required: false }, // Temporarily optional
  picture: { type: String, required: true }
});

const franchiseInformationSchema = new mongoose.Schema({
  operatorId: { type: String, required: true, unique: true },
  mtopNumber: { type: String, required: true, unique: true },
  operatorName: { type: String, required: true },
  contactNumber: { type: String, required: true, trim: true }, // Removed strict regex
  address: { type: String, required: true },
  barangay: { type: String, required: false }, // Temporarily optional
  civilStatus: { type: String, required: true },
  email: { type: String, required: false, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'] }, // Optional - user can have multiple franchises
  
  driversID: { type: String, required: true, unique: true },
  birthPlace: { type: String, required: true },
  birthDate: { type: Date, required: true },
  citizenship: { type: String, required: true },
  todaMembership: { type: String, required: true },

  unitModel: { type: String, required: true },
  colorMotor: { type: String, required: true },
  sideCarColor: { type: String, required: true },
  sideCarPlateNumber: { type: String, required: true },
  mvPlateNo: { type: String, required: true, unique: true },
  motorEngineNo: { type: String, required: true, unique: true },
  chasisNo: { type: String, required: true, unique: true },
  driversAddress: { type: String, required: true },
  
  profilePhoto: { type: String },
  qrCode: { type: String }, 

  approvedAt: { type: Date },
  expiryDate: { type: Date },

  documents: documentSchema,

  franchiseStatus: { type: String, enum: ['active', 'expired'], required: true },
  
  // Reference back to user account (optional but useful for bidirectional relationship)
  linkedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User Accounts',
    required: false,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Franchise Information', franchiseInformationSchema);
