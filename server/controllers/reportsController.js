const reportsRepository = require('../repositories/reportsRepository');

/**
 * Create a new report
 */
exports.createReport = async (req, res, next) => {
    try {
        const { franchiseeName, amountCharged, expectedFare, description, reporterContact } = req.body;
        
        // Validate required fields
        if (!franchiseeName || !amountCharged || !expectedFare || !description || !reporterContact) {
            return res.status(400).json({ 
                error: 'Missing required fields: franchiseeName, amountCharged, expectedFare, description, reporterContact' 
            });
        }

        const reportData = {
            franchiseeName,
            dateReported: new Date(),
            timeReported: new Date().toLocaleTimeString(),
            amountCharged: parseFloat(amountCharged),
            expectedFare: parseFloat(expectedFare),
            description,
            reporterContact
        };

        const newReport = await reportsRepository.createReport(reportData);
        res.status(201).json({ 
            message: 'Report created successfully', 
            report: newReport 
        });
    } catch (error) {
        console.error('Error creating report:', error);
        next(error);
    }   
};

/**
 * Get all reports with pagination and filtering
 */
exports.getAllReports = async (req, res, next) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            search = '', 
            status = '',
            sortBy = 'dateReported',
            sortOrder = 'desc'
        } = req.query;
        
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            search,
            status,
            sortBy,
            sortOrder
        };

        const result = await reportsRepository.getAllReports(options);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error getting reports:', error);
        next(error);
    }
};

/**
 * Get a single report by ID
 */
exports.getReportById = async (req, res, next) => {
    try {
        const reportId = req.params.id;
        const report = await reportsRepository.getReportById(reportId);
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        res.status(200).json(report);
    } catch (error) {
        console.error('Error getting report by ID:', error);
        next(error);
    }
};

/**
 * Update a report
 */
exports.updateReport = async (req, res, next) => {
    try {
        const reportId = req.params.id;
        const updateData = req.body;
        
        // Remove fields that shouldn't be updated
        delete updateData.reportID;
        delete updateData.createdAt;
        delete updateData.updatedAt;

        const updatedReport = await reportsRepository.updateReport(reportId, updateData);
        
        if (!updatedReport) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        res.status(200).json({ 
            message: 'Report updated successfully', 
            report: updatedReport 
        });
    } catch (error) {
        console.error('Error updating report:', error);
        next(error);
    }
};

/**
 * Delete a report
 */
exports.deleteReport = async (req, res, next) => {
    try {
        const reportId = req.params.id;
        const deletedReport = await reportsRepository.deleteReport(reportId);
        
        if (!deletedReport) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        res.status(200).json({ 
            message: 'Report deleted successfully', 
            report: deletedReport 
        });
    } catch (error) {
        console.error('Error deleting report:', error);
        next(error);
    }
};

/**
 * Get monthly reports and optionally export as CSV
 */
exports.getMonthlyReports = async (req, res, next) => {
    try {
        const { month, year, format = 'json' } = req.query;
        
        if (!month || !year) {
            return res.status(400).json({ 
                error: 'Month and year parameters are required' 
            });
        }

        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        
        if (monthNum < 1 || monthNum > 12) {
            return res.status(400).json({ 
                error: 'Month must be between 1 and 12' 
            });
        }

        const reports = await reportsRepository.getMonthlyReports(monthNum, yearNum);
        
        if (format === 'csv') {
            // Generate CSV content
            const csvHeader = 'Report ID,Franchisee Name,Date Reported,Time Reported,Amount Charged,Expected Fare,Description,Reporter Contact,Status\n';
            const csvContent = reports.map(report => {
                return [
                    report.reportID,
                    `"${report.franchiseeName}"`,
                    report.dateReported.toISOString().split('T')[0],
                    report.timeReported,
                    report.amountCharged,
                    report.expectedFare,
                    `"${report.description.replace(/"/g, '""')}"`,
                    `"${report.reporterContact}"`,
                    report.status
                ].join(',');
            }).join('\n');
            
            const csv = csvHeader + csvContent;
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="reports_${year}_${month.toString().padStart(2, '0')}.csv"`);
            res.send(csv);
        } else {
            res.status(200).json({
                month: monthNum,
                year: yearNum,
                total: reports.length,
                reports
            });
        }
    } catch (error) {
        console.error('Error getting monthly reports:', error);
        next(error);
    }
};

/**
 * Get reports statistics
 */
exports.getReportsStatistics = async (req, res, next) => {
    try {
        const statistics = await reportsRepository.getReportsStatistics();
        res.status(200).json(statistics);
    } catch (error) {
        console.error('Error getting reports statistics:', error);
        next(error);
    }
};

/**
 * Get reports by date range with optional CSV export
 */
exports.getReportsByDateRange = async (req, res, next) => {
    try {
        const { startDate, endDate, format = 'json' } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                error: 'startDate and endDate parameters are required' 
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ 
                error: 'Invalid date format. Use YYYY-MM-DD' 
            });
        }

        // Set end date to end of day
        end.setHours(23, 59, 59, 999);

        const reports = await reportsRepository.getReportsByDateRange(start, end);
        
        if (format === 'csv') {
            // Generate CSV content
            const csvHeader = 'Report ID,Franchisee Name,Date Reported,Time Reported,Amount Charged,Expected Fare,Description,Reporter Contact,Status\n';
            const csvContent = reports.map(report => {
                return [
                    report.reportID,
                    `"${report.franchiseeName}"`,
                    report.dateReported.toISOString().split('T')[0],
                    report.timeReported,
                    report.amountCharged,
                    report.expectedFare,
                    `"${report.description.replace(/"/g, '""')}"`,
                    `"${report.reporterContact}"`,
                    report.status
                ].join(',');
            }).join('\n');
            
            const csv = csvHeader + csvContent;
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="reports_${startDate}_to_${endDate}.csv"`);
            res.send(csv);
        } else {
            res.status(200).json({
                startDate,
                endDate,
                total: reports.length,
                reports
            });
        }
    } catch (error) {
        console.error('Error getting reports by date range:', error);
        next(error);
    }
};      