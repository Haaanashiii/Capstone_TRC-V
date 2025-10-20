const reportsRepository = require('../repositories/reportsRepository');

exports.createReport = async (req, res) => {
    try {
        const reportData = req.body;
        const newReport = await reportsRepository.createReport(reportData);
        res.status(201).json(newReport);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create report' });
    }   
};

exports.getAllReports = async (req, res) => {
    try {
        const reports = await reportsRepository.getAllReports();
        res.status(200).json(reports);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
};
exports.getReportById = async (req, res) => {
    try {
        const reportId = req.params.id;
        const report = await reportsRepository.getReportById(reportId);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        res.status(200).json(report);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch report' });
    }
};

exports.updateReport = async (req, res) => {
    try {
        const reportId = req.params.id;
        const reportData = req.body;
        const updatedReport = await reportsRepository.updateReport(reportId, reportData);
        if (!updatedReport) {
            return res.status(404).json({ error: 'Report not found' });
        }
        res.status(200).json(updatedReport);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update report' });
    }
};      