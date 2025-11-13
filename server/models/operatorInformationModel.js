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

const operatorSchema = new mongoose.Schema({
  operatorId: { type: String, required: true, unique: true },
  operatorName: { type: String, required: true },
  contactNumber: { type: String, required: true, trim: true, match: [/^\+?[0-9]{10,15}$/, 'Invalid contact number'] },
  address: { type: String, required: true },
  barangay: { type: String, required: true },
  civilStatus: { type: String, required: true },

  contactNumber: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'] },
  
  driversID: { type: String, required: true, unique: true },

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

module.exports = mongoose.model('Operator Information', operatorSchema);
