const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reportID: { type: String, unique: true },
    franchiseNumber: { type: String }, // Store franchise number for validation
    franchiseeName: { type: String, required: true },
    dateReported: { type: Date, required: true, default: Date.now },
    timeReported: { type: String, required: true },
    amountCharged: { type: Number, required: true },
    expectedFare: { type: Number, required: true },
    description: { type: String, required: true },
    reporterContact: { type: String, required: true }, // Combined email and phone
    reporterIp: { type: String }, // Track IP for DDoS/fraud detection
    franchiseStatusAtTime: { type: String }, // Status when report was submitted (for audit)
    status: { 
      type: String, 
      enum: ['new', 'pending', 'investigating', 'resolved', 'dismissed'], 
      default: 'new' 
    }
}, { timestamps: true });

// Indexes for performance optimization
reportSchema.index({ status: 1 }); // Query reports by status
reportSchema.index({ franchiseeName: 1 }); // Query reports by franchise name
reportSchema.index({ franchiseNumber: 1 }); // Query reports by franchise number
reportSchema.index({ dateReported: -1 }); // Sort by date reported
reportSchema.index({ reporterIp: 1, franchiseNumber: 1, dateReported: -1 }); // DDoS detection compound index
reportSchema.index({ status: 1, dateReported: -1 }); // Compound index for common queries

// Pre-save hook to generate report ID
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