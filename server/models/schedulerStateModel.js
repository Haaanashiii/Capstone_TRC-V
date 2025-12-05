const mongoose = require('mongoose');

/**
 * Scheduler State Model
 * 
 * Tracks the last successful run of scheduled tasks.
 * Used to catch up on missed runs after server downtime.
 */
const schedulerStateSchema = new mongoose.Schema({
  schedulerName: {
    type: String,
    required: true,
    unique: true,
    enum: ['franchise-expiry', 'backup', 'health-monitor']
  },
  lastSuccessfulRun: {
    type: Date,
    required: true
  },
  lastRunStatus: {
    type: String,
    enum: ['success', 'failed', 'partial'],
    default: 'success'
  },
  lastRunDetails: {
    processedCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    missedDaysCaughtUp: { type: Number, default: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
schedulerStateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get or create scheduler state
schedulerStateSchema.statics.getOrCreate = async function(schedulerName) {
  let state = await this.findOne({ schedulerName });
  
  if (!state) {
    // First time - assume we're starting fresh (no catch-up needed)
    state = await this.create({
      schedulerName,
      lastSuccessfulRun: new Date()
    });
  }
  
  return state;
};

// Static method to update last run
schedulerStateSchema.statics.updateLastRun = async function(schedulerName, status, details = {}) {
  return this.findOneAndUpdate(
    { schedulerName },
    {
      lastSuccessfulRun: new Date(),
      lastRunStatus: status,
      lastRunDetails: details,
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );
};

// Static method to get days since last run
schedulerStateSchema.statics.getDaysSinceLastRun = async function(schedulerName) {
  const state = await this.findOne({ schedulerName });
  
  if (!state) return 0;
  
  const now = new Date();
  const lastRun = new Date(state.lastSuccessfulRun);
  const diffTime = Math.abs(now - lastRun);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

const SchedulerState = mongoose.model('SchedulerState', schedulerStateSchema);

module.exports = SchedulerState;
