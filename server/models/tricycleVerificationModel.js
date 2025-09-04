const mongoose = require('mongoose');

const verificationSlipSchema = new mongoose.Schema({
  operatorName:      { type: String, required: true, trim: true },
  address:           { type: String, required: true, trim: true },
  motorModel:        { type: String, required: true, trim: true },
  color:             { type: String, required: true, trim: true },
  sideCar:           { type: String, required: true, trim: true },
  status:            { type: String, required: true, trim: true },
  scNumber:          { type: String, required: true, trim: true, unique: true },

  franchiseNumber:   { type: String, required: true, trim: true, unique: true },
  franchiseStatus:   { type: String, required: true, trim: true },
  dateIssued:        { type: Date,   required: true },
  expirationDate:    {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return !this.dateIssued || v > this.dateIssued;
      },
      message: 'expirationDate must be after dateIssued'
    }
  },
  remarks:           { type: String, trim: true },
  mayorPermitStatus: { type: String, required: true, trim: true },
}, {
  timestamps:      { createdAt: 'submittedAt', updatedAt: 'updatedAt' },
  versionKey:      false,
  strict:          true,
});   

const VerificationSlip = mongoose.model('VerificationSlip', verificationSlipSchema);
module.exports = VerificationSlip

