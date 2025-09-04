const mongoose = require('mongoose');

const verificationSlipSchema = new mongoose.Schema({
  operatorName: { type: String, required: true },
  address: { type: String, required: true },
  motorModel: { type: String, required: true },
  color: { type: String, required: true },
  sideCar: { type: String, required: true },
  status: { type: String, required: true },
  scNumber: { type: String, required: true },
  
  franchiseNumber: { type: String, required: true },
  franchiseStatus: { type: String, required: true },
  dateIssued: { type: Date, required: true },
  expirationDate: { type: Date, required: true },
  remarks: { type: String },
  mayorPermitStatus: { type: String, required: true },

  submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Application', applicationSchema);
