const mongoose = require('mongoose');

/**
 * Incident Report Categories
 * Used to categorize different types of tricycle-related incidents
 */
const INCIDENT_CATEGORIES = {
  FARE_RELATED: 'fare-related',
  DRIVER_CONDUCT: 'driver-conduct',
  VEHICLE_CONDITION: 'vehicle-condition',
  FRANCHISE_VIOLATIONS: 'franchise-violations',
  SAFETY_VIOLATIONS: 'safety-violations',
  OTHER: 'other'
};

/**
 * Category labels for display purposes
 */
const CATEGORY_LABELS = {
  [INCIDENT_CATEGORIES.FARE_RELATED]: 'Fare-Related Issues',
  [INCIDENT_CATEGORIES.DRIVER_CONDUCT]: 'Driver Conduct & Behavior',
  [INCIDENT_CATEGORIES.VEHICLE_CONDITION]: 'Vehicle Condition & Roadworthiness',
  [INCIDENT_CATEGORIES.FRANCHISE_VIOLATIONS]: 'Franchise & Permit Violations',
  [INCIDENT_CATEGORIES.SAFETY_VIOLATIONS]: 'Safety Violations',
  [INCIDENT_CATEGORIES.OTHER]: 'Other Concerns'
};

/**
 * Category examples for user guidance
 */
const CATEGORY_EXAMPLES = {
  [INCIDENT_CATEGORIES.FARE_RELATED]: 'fare overpricing, refusal to give change',
  [INCIDENT_CATEGORIES.DRIVER_CONDUCT]: 'rude behavior, refusal to convey, harassment',
  [INCIDENT_CATEGORIES.VEHICLE_CONDITION]: 'smoke belching, defective brakes, no lights',
  [INCIDENT_CATEGORIES.FRANCHISE_VIOLATIONS]: 'colorum, expired franchise, unauthorized driver',
  [INCIDENT_CATEGORIES.SAFETY_VIOLATIONS]: 'overloading, traffic violation, reckless driving',
  [INCIDENT_CATEGORIES.OTHER]: 'lost item, route deviation, other concerns'
};

const incidentReportSchema = new mongoose.Schema({
    reportID: { type: String, unique: true },
    franchiseNumber: { type: String }, // Store franchise number for validation
    franchiseeName: { type: String, required: true },
    dateReported: { type: Date, required: true, default: Date.now },
    timeReported: { type: String, required: true },
    // Category for incident classification
    category: { 
      type: String, 
      enum: Object.values(INCIDENT_CATEGORIES),
      default: INCIDENT_CATEGORIES.FARE_RELATED,
      required: true
    },
    // Fare-related fields (optional - only required for fare-related category)
    amountCharged: { type: Number }, // Made optional for non-fare categories
    expectedFare: { type: Number }, // Made optional for non-fare categories
    description: { type: String, required: true },
    reporterContact: { type: String, required: true }, // Combined email and phone
    reporterIp: { type: String }, // Track IP for DDoS/fraud detection
    franchiseStatusAtTime: { type: String }, // Status when report was submitted (for audit)
    status: { 
      type: String, 
      enum: ['pending', 'investigating', 'resolved', 'dismissed'], 
      default: 'pending' 
    }
}, { timestamps: true });

// Indexes for performance optimization
incidentReportSchema.index({ status: 1 }); // Query reports by status
incidentReportSchema.index({ category: 1 }); // Query reports by category
incidentReportSchema.index({ franchiseeName: 1 }); // Query reports by franchise name
incidentReportSchema.index({ franchiseNumber: 1 }); // Query reports by franchise number
incidentReportSchema.index({ dateReported: -1 }); // Sort by date reported
incidentReportSchema.index({ reporterIp: 1, franchiseNumber: 1, dateReported: -1 }); // DDoS detection compound index
incidentReportSchema.index({ status: 1, dateReported: -1 }); // Compound index for common queries
incidentReportSchema.index({ category: 1, status: 1, dateReported: -1 }); // Compound index for category + status filtering

// Pre-save hook to generate report ID
incidentReportSchema.pre('save', async function(next) {
  if (this.isNew && !this.reportID) {
    try {
      // Get the count of existing documents + 1
      const count = await mongoose.model('IncidentReport').countDocuments();
      const nextNumber = count + 1;
      
      // Format as INC-XXXX (4 digits with leading zeros) - Changed from RPT to INC for Incident
      this.reportID = `INC-${nextNumber.toString().padStart(4, '0')}`;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Export model and constants
const IncidentReport = mongoose.model('IncidentReport', incidentReportSchema);

module.exports = IncidentReport;
module.exports.INCIDENT_CATEGORIES = INCIDENT_CATEGORIES;
module.exports.CATEGORY_LABELS = CATEGORY_LABELS;
module.exports.CATEGORY_EXAMPLES = CATEGORY_EXAMPLES;