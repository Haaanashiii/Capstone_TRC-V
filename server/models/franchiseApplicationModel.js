const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  motorRegistration: { type: String, required: true },
  barangayClearance: { type: String, required: true },
  cedula: { type: String, required: true },
  driversLicense: { type: String, required: true },
  votersAffidavit: { type: String, required: true },
  motorChassisStencil: { type: String, required: true },
  picture: { type: String, required: true }
});

const franchiseApplicationSchema = new mongoose.Schema({
  operatorName: { type: String, required: true },
  operatorContact: { type: String, required: true },
  operatorEmail: { type: String, required: true , lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'] , unique: true , index: true },
  actionType: { type: String, enum: ['NEW', 'RENEWAL', 'AMMENDMENTS'], required: true, uppercase: true ,trim: true},
  operatorAddress: { type: String, required: true },
  profilePhoto: { type: String },
  
  qrCode: { type: String }, // Path to QR code image (generated when franchise is approved)

  driversID: { type: String, required: true },
  birthPlace: { type: String, required: true },
  birthDate: { type: Date, required: true },
  civilStatus: { type: String, required: true },
  citizenship: { type: String, required: true },
  todaMembership: { type: String, required: true },

  unitModel: { type: String, required: true },
  colorMotor: { type: String, required: true },
  sideCar: { type: String, required: true },
  mvPlateNo: { type: String, required: true },

  motorEngineNo: { type: String, required: true },
  chasisNo: { type: String, required: true },
  driversAddress: { type: String, required: true },

  actionTaken: { type: String },
  remarks: { type: String },
  franchiseNumber: { type: String },
  approvedAt: { type: Date },
  expiryDate: { type: Date },
  submittedAt: { type: Date, default: Date.now },
  documents: documentSchema,
}, { collection: 'franchiseapplications' });


module.exports = mongoose.model('FranchiseApplication', franchiseApplicationSchema);
