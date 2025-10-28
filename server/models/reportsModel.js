const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reportID: { type: String, required: true, unique: true },
    franchiseeName: { type: String, required: true },
    dateReported: { type: Date, required: true, default: Date.now },
    timeReported: { type: String, required: true },
    amountCharged: { type: Number, required: true },
    expectedFare: { type: Number, required: true },
    description: { type: String, required: true },
    reporterContact: { type: String, required: true }, // Combined email and phone
    status: { 
      type: String, 
      enum: ['pending', 'investigating', 'resolved', 'dismissed'], 
      default: 'pending' 
    }
}, { timestamps: true });

// Pre-save middleware to auto-generate RPT-XXXX format ID
reportSchema.pre('save', async function(next) {
  if (this.isNew && !this.reportID) {
    try {
      // Get the count of existing documents + 1
      const count = await mongoose.model('Report').countDocuments();
      const nextNumber = count + 1;
      
      // Format as RPT-XXXX (4 digits with leading zeros)
      this.reportID = `RPT-${nextNumber.toString().padStart(4, '0')}`;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('Report', reportSchema);