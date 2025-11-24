const reportsRepository = require('../repositories/reportsRepository');
const { getClientIp } = require('../utils/ipHelper');

/**
 * Create a public report (no authentication required)
 * For use by citizens scanning QR codes
 */
exports.createPublicReport = async (req, res, next) => {
    try {
        const { 
            operatorId,
            fullName, 
            contactNumber,
            amountCharged, 
            expectedFare, 
            description 
        } = req.body;
        
        // Validate required fields
        if (!operatorId || !fullName || !contactNumber || !amountCharged || !expectedFare || !description) {
            return res.status(400).json({ 
                error: 'All fields are required: operatorId, fullName, contactNumber, amountCharged, expectedFare, description' 
            });
        }

        // Additional validation for spam prevention
        // Validate string lengths to prevent abuse
        if (fullName.length > 100 || contactNumber.length > 20 || description.length > 1000) {
            return res.status(400).json({ error: 'Input exceeds maximum length' });
        }

        // Validate name contains only letters, spaces, and common name characters
        if (!/^[a-zA-Z\s\-.']+$/.test(fullName)) {
            return res.status(400).json({ error: 'Invalid name format' });
        }

        // Validate phone number format (Philippine format)
        if (!/^(\+63|0)?9\d{9}$/.test(contactNumber.replace(/[\s\-]/g, ''))) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }

        // Validate amounts are positive numbers
        const chargedAmount = parseFloat(amountCharged);
        const expectedAmount = parseFloat(expectedFare);
        
        if (isNaN(chargedAmount) || chargedAmount <= 0 || chargedAmount > 10000) {
            return res.status(400).json({ error: 'Invalid amount charged (must be between 1-10000)' });
        }
        
        if (isNaN(expectedAmount) || expectedAmount <= 0 || expectedAmount > 10000) {
            return res.status(400).json({ error: 'Invalid expected fare (must be between 1-10000)' });
        }

        // Validate that charged amount is higher than expected (otherwise not overpricing)
        if (chargedAmount <= expectedAmount) {
            return res.status(400).json({ error: 'Amount charged must be higher than expected fare to report overpricing' });
        }

        // Get franchise information to get operator name
        const FranchiseInformation = require('../models/franchiseInformationModel');
        const franchise = await FranchiseInformation.findOne({ operatorId });
        
        if (!franchise) {
            return res.status(404).json({ error: 'Operator not found' });
        }

        const reportData = {
            franchiseeName: franchise.operatorName,
            dateReported: new Date(),
            timeReported: new Date().toLocaleTimeString('en-PH', { 
                timeZone: 'Asia/Manila',
                hour12: true 
            }),
            amountCharged: chargedAmount,
            expectedFare: expectedAmount,
            description: description.trim(),
            reporterContact: `${fullName} - ${contactNumber}`
        };

        const newReport = await reportsRepository.createReport(reportData);
        
        // Log for audit trail
        const ipAddress = getClientIp(req);
        console.log(`[PUBLIC REPORT] Operator: ${operatorId}, Reporter: ${fullName}, IP: ${ipAddress}`);
        
        res.status(201).json({ 
            success: true,
            message: 'Report submitted successfully. Thank you for helping maintain fair fare practices.',
            reportId: newReport.reportID
        });
    } catch (error) {
        console.error('Error creating public report:', error);
        next(error);
    }   
};

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

/**
 * Generate certificate documents (PDF or Word)
 * Supports various certificate types for franchise management
 */
exports.generateCertificate = async (req, res, next) => {
    try {
        const { certificateType, data, format } = req.body;

        if (!certificateType || !data) {
            return res.status(400).json({ error: 'Certificate type and data are required' });
        }

        console.log(`[Certificate Generation] Type: ${certificateType}, Format: ${format}`);

        // For now, return a placeholder response
        // TODO: Implement actual PDF/Word generation using libraries like pdfkit, puppeteer, or docx
        
        // Validate certificate type
        const validTypes = [
            'C.001-APPROVAL',
            'C.001-CANCELLATION', 
            'F.008-PROVISIONAL',
            'F.008-MTOF-DATE',
            'F.008-MTOF-SUMMARY'
        ];

        if (!validTypes.includes(certificateType)) {
            return res.status(400).json({ error: 'Invalid certificate type' });
        }

        // Log certificate generation for audit trail
        console.log('[Certificate Generation] Generated by:', req.user?.username || 'Unknown');
        console.log('[Certificate Generation] Data:', JSON.stringify(data, null, 2));

        // Prepare response based on format
        if (format === 'pdf') {
            // TODO: Implement PDF generation
            // For now, return a placeholder PDF response
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="certificate_${Date.now()}.pdf"`);
            
            // Placeholder: Return success message
            return res.status(200).json({
                success: true,
                message: 'PDF generation endpoint ready. Actual PDF generation to be implemented.',
                certificateType,
                timestamp: new Date().toISOString()
            });
        } else if (format === 'docx') {
            // TODO: Implement Word document generation
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="certificate_${Date.now()}.docx"`);
            
            // Placeholder: Return success message
            return res.status(200).json({
                success: true,
                message: 'Word document generation endpoint ready. Actual DOCX generation to be implemented.',
                certificateType,
                timestamp: new Date().toISOString()
            });
        } else {
            return res.status(400).json({ error: 'Invalid format. Must be pdf or docx' });
        }
    } catch (error) {
        console.error('Error generating certificate:', error);
        next(error);
    }
};