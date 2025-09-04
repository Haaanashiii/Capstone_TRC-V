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
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  middleName: { type: String, required: true },
  suffix: { type: String },
  contactNumber: { type: String, required: true },
  address: { type: String, required: true },
  barangay: { type: String, required: true },
  contactNumber: { type: String, required: true },
  civilStatus: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  documents: documentSchema,
  applications: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Application' }]
}, { timestamps: true });

module.exports = mongoose.model('Operator', operatorSchema);
