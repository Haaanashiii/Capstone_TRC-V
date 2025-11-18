const mongoose = require('mongoose');

// Documents are now stored as Cloudflare R2 URLs (compressed to ~300KB)
const documentSchema = new mongoose.Schema({
  motorRegistration: { type: String, required: true }, 
  barangayClearance: { type: String, required: true }, 
  cedula: { type: String, required: true }, 
  driversLicense: { type: String, required: true }, 
  votersAffidavit: { type: String, required: true }, 
  motorChassisStencil: { type: String, required: false },
  picture: { type: String, required: true } 
});

const franchiseApplicationSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: false 
  },
  
  operatorName: { type: String, required: true },
  operatorContact: { type: String, required: true },
  operatorEmail: { type: String, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'] },
  actionType: { type: String, enum: ['NEW', 'RENEWAL', 'AMMENDMENTS'], required: true, uppercase: true ,trim: true},
  operatorAddress: { type: String, required: true },
  operatorBarangay: { type: String, required: false }, // Temporarily optional

  driversID: { type: String, required: true },
  birthPlace: { type: String, required: true },
  birthDate: { type: Date, required: true },
  civilStatus: { type: String, required: true },
  citizenship: { type: String, required: true },
  todaMembership: { type: String, required: true },

  unitModel: { type: String, required: true },
  colorMotor: { type: String, required: true },
  sidecarPlateNumber: { type: String, required: true },
  sidecarColor: { type: String, required: true },
  mvPlateNo: { type: String, required: true },

  motorEngineNo: { type: String, required: true },
  chasisNo: { type: String, required: true },

  actionTaken: { type: String },
  remarks: { type: String },

  approvedAt: { type: Date },
  submittedAt: { type: Date, default: Date.now },

  documents: documentSchema,
}, { collection: 'franchiseapplications' });


module.exports = mongoose.model('FranchiseApplication', franchiseApplicationSchema);
