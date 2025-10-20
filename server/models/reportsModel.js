const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reportID: { type: String, required: true, unique: true },
    franchiseeName: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    amountCharged: { type: Number, required: true },
    expectedAmountCharged: { type: Number, required: true },
    description: { type: String, required: true },
    reporterContactNumber: { type: String, required: true },
    }, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);