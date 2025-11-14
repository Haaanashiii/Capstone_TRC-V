const mongoose = require('mongoose');

// Documents are now stored as Cloudflare R2 URLs (compressed to ~300KB)
const documentSchema = new mongoose.Schema({
  motorRegistration: { type: String, required: true }, // Cloudflare R2 URL
  barangayClearance: { type: String, required: true }, // Cloudflare R2 URL
  cedula: { type: String, required: true }, // Cloudflare R2 URL
  driversLicense: { type: String, required: true }, // Cloudflare R2 URL
  votersAffidavit: { type: String, required: true }, // Cloudflare R2 URL
  motorChassisStencil: { type: String, required: true }, // Cloudflare R2 URL
  picture: { type: String, required: true } // Cloudflare R2 URL
});

const franchiseApplicationSchema = new mongoose.Schema({
  operatorName: { type: String, required: true },
  operatorContact: { type: String, required: true },
  operatorEmail: { type: String, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'] },
  actionType: { type: String, enum: ['NEW', 'RENEWAL', 'AMMENDMENTS'], required: true, uppercase: true ,trim: true},
  operatorAddress: { type: String, required: true },
  profilePhoto: { type: String }, // Cloudflare R2 URL
  documentRegistration: { type: String }, // Cloudflare R2 URL
  documentBarangayClearance: { type: String }, // Cloudflare R2 URL
  documentCedula: { type: String }, // Cloudflare R2 URL
  documentDriversLicense: { type: String }, // Cloudflare R2 URL
  documentVotersAffidavit: { type: String }, // Cloudflare R2 URL
  documentChassisStencil: { type: String }, // Cloudflare R2 URL
  documentPicture: { type: String }, // Cloudflare R2 URL

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
