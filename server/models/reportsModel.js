const mongoose = require('mongoose');

const REPORT_CATEGORIES = {
  OVERPRICING: 'overpricing',
  RUDE_BEHAVIOR: 'rude_behavior',
  UNSAFE_DRIVING: 'unsafe_driving',
  VEHICLE_CONDITION: 'vehicle_condition',
  REFUSAL_OF_SERVICE: 'refusal_of_service',
  ROUTE_DEVIATION: 'route_deviation',
  OTHER: 'other'
};

const reportSchema = new mongoose.Schema({
    reportID: { type: String, unique: true },
    franchiseNumber: { type: String },
    operatorName: { type: String },
    operatorBarangay: { type: String },

    category: { 
      type: String, 
      enum: Object.values(REPORT_CATEGORIES),
      default: REPORT_CATEGORIES.OVERPRICING,
      required: true
    },
    
    // Overpricing-specific fields
    amountCharged: { type: Number },
    expectedFare: { type: Number },
    
    // General report fields
    dateReported: { type: Date, required: true, default: Date.now },
    timeReported: { type: String, required: true },
    description: { type: String, required: true },
    
    // Reporter info
    reporterName: { type: String },
    reporterContact: { type: String, required: true },

    // Tracking
    franchiseStatusAtTime: { type: String },
    status: { 
      type: String, 
      enum: ['pending', 'investigating', 'resolved', 'dismissed'], 
      default: 'pending' 
    },
    
    // Admin actions
    resolvedBy: { type: String },
    resolvedAt: { type: Date },
    resolutionNotes: { type: String },
    actionTaken: { type: String }
}, { timestamps: true });

// Essential indexes for filtering and sorting
reportSchema.index({ status: 1 });
reportSchema.index({ category: 1 });
reportSchema.index({ operatorName: 1 });
reportSchema.index({ operatorBarangay: 1 });
reportSchema.index({ franchiseNumber: 1 });
reportSchema.index({ dateReported: -1 });

// Compound indexes for common query patterns (10K+ optimization)
reportSchema.index({ status: 1, dateReported: -1 });
reportSchema.index({ category: 1, status: 1 });
reportSchema.index({ operatorBarangay: 1, status: 1 });
reportSchema.index({ operatorBarangay: 1, dateReported: -1 }); // For barangay reports over time

// Text index for efficient search (replaces slow regex searches)
reportSchema.index({
  reportID: 'text',
  operatorName: 'text',
  franchiseNumber: 'text',
  description: 'text',
  reporterName: 'text',
  operatorBarangay: 'text'
}, {
  weights: {
    reportID: 10,         // Highest priority for exact ID matches
    franchiseNumber: 8,
    operatorName: 5,
    operatorBarangay: 3,
    reporterName: 2,
    description: 1
  },
  name: 'reports_text_search'
});

// Counter schema for atomic ID generation
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

async function getNextReportId() {
  // Check if counter exists
  let counter = await Counter.findById('reportId');
  
  if (!counter) {
    // First time: sync with existing reports
    const Report = mongoose.model('Report');
    const lastReport = await Report.findOne({ reportID: { $regex: /^RPT-\d+$/ } })
      .sort({ reportID: -1 })
      .select('reportID')
      .lean();
    
    let startSeq = 0;
    if (lastReport && lastReport.reportID) {
      const match = lastReport.reportID.match(/^RPT-(\d+)$/);
      if (match) {
        startSeq = parseInt(match[1], 10);
      }
    }
    
    // Create counter starting from highest existing ID
    counter = await Counter.findByIdAndUpdate(
      'reportId',
      { $setOnInsert: { seq: startSeq } },
      { new: true, upsert: true }
    );
  }
  
  // Atomic increment
  counter = await Counter.findByIdAndUpdate(
    'reportId',
    { $inc: { seq: 1 } },
    { new: true }
  );
  
  return `RPT-${counter.seq.toString().padStart(4, '0')}`;
}

reportSchema.pre('save', async function(next) {
  if (this.isNew && !this.reportID) {
    try {
      this.reportID = await getNextReportId();
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('Report', reportSchema);
module.exports.REPORT_CATEGORIES = REPORT_CATEGORIES;