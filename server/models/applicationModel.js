const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  operatorName: { type: String, required: true },
  operatorContact: { type: String, required: true },
  operatorEmail: { type: String, required: true },
  actionType: { type: String, enum: ['NEW', 'RENEWAL', 'AMMENDMENTS'], required: true },
  operatorAddress: { type: String, required: true },

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
  submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Application', applicationSchema);
