
const Reports = require('../models/reportsModel');

exports.createReport = async (reportData) => {
    const report = new Reports(reportData);
    return await report.save();
};

exports.getAllReports = async () => {
    return await Reports.find();
};
exports.getReportById = async (id) => {
    return await Reports.findById(id);
};

exports.updateReport = async (id, reportData) => {
    return await Reports.findByIdAndUpdate(id, reportData, { new: true });
};

exports.deleteReport = async (id) => {
    return await Reports.findByIdAndDelete(id);
};

