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
        
        // Get client IP for tracking (DDoS/fraud prevention)
        const clientIp = getClientIp(req);
        
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
        if (!/^(\+63|0)?9\d{9}$/.test(contactNumber.replace(/[\s-]/g, ''))) {
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

        // Get franchise information to validate it exists and is still active
        const FranchiseInformation = require('../models/franchiseInformationModel');
        
        // The operatorId is actually the hashed franchise number from QR code
        // We need to find the franchise that matches this hash
        const { generateHashedFranchiseNo } = require('../utils/franchiseHelpers');
        
        // Find franchise with matching hash
        let franchise = null;
        const allCurrentFranchises = await FranchiseInformation.find({ 
          isCurrentVersion: true 
        }).lean();
        
        for (const f of allCurrentFranchises) {
          const computedHash = generateHashedFranchiseNo(f.franchiseNumber);
          if (computedHash === operatorId) {
            franchise = f;
            break;
          }
        }
        
        if (!franchise) {
            console.warn(`[FRAUD] Report for non-existent franchiseNumber hash: ${operatorId}, IP: ${clientIp}`);
            return res.status(404).json({ error: 'Operator not found' });
        }

        // SECURITY: Verify franchise is still active and not expired/inactive
        // This prevents reporting on recycled franchise numbers that no longer belong to the original operator
        if (franchise.franchiseStatus === 'expired' || franchise.franchiseStatus === 'inactive') {
            console.warn(`[FRAUD] Report for inactive franchise: ${operatorId} (${franchise.franchiseStatus}), IP: ${clientIp}`);
            return res.status(403).json({ 
                error: 'Cannot report on expired or inactive franchises. Please ensure you scanned an active operator\'s QR code.' 
            });
        }

        // ANTI-DDoS: Check if same IP has reported same franchise multiple times recently (within 24 hours)
        // This prevents rapid-fire attacks on the same operator
        const Report = require('../models/reportsModel');
        const recentReportsFromIp = await Report.countDocuments({
            franchiseNumber: operatorId,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            reporterIp: clientIp
        });

        if (recentReportsFromIp >= 3) {
            console.warn(`[DDoS] Same IP reported same operator 3+ times in 24h: ${operatorId}, IP: ${clientIp}`);
            return res.status(429).json({ 
                error: 'Too many reports on this operator from your network. Please contact support if this is an error.' 
            });
        }

        const reportData = {
            franchiseNumber: franchise.franchiseNumber,
            franchiseeName: franchise.operatorName,
            dateReported: new Date(),
            timeReported: new Date().toLocaleTimeString('en-PH', { 
                timeZone: 'Asia/Manila',
                hour12: true 
            }),
            amountCharged: chargedAmount,
            expectedFare: expectedAmount,
            description: description.trim(),
            reporterContact: `${fullName} - ${contactNumber}`,
            reporterIp: clientIp, // Track IP for abuse detection
            franchiseStatusAtTime: franchise.franchiseStatus, // Store status for audit trail
            status: 'pending'
        };

        // Create a new Report document and trigger pre-save hook
        const newReportDoc = new Report(reportData);
        const newReport = await newReportDoc.save();
        
        // Log for audit trail
        console.log(`[PUBLIC REPORT] Operator: ${franchise.franchiseNumber}, Reporter: ${fullName}, IP: ${clientIp}, Report ID: ${newReport.reportID}`);
        
        // Emit WebSocket event for real-time updates
        if (req.app.get('io')) {
            req.app.get('io').to('general').emit('fare-reports', {
                action: 'created',
                reportID: newReport.reportID,
                franchiseeName: newReport.franchiseeName
            });
            req.app.get('io').to('bplo-admins').emit('fare-reports', {
                action: 'created',
                reportID: newReport.reportID,
                franchiseeName: newReport.franchiseeName
            });
            req.app.get('io').to('sb-admins').emit('fare-reports', {
                action: 'created',
                reportID: newReport.reportID,
                franchiseeName: newReport.franchiseeName
            });
        }
        
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
        
        // Emit WebSocket event for real-time updates
        if (req.app.get('io')) {
            req.app.get('io').to('general').emit('report-updated', {
                reportID: updatedReport.reportID,
                status: updatedReport.status,
                timestamp: new Date().toISOString()
            });
            // Also emit to admin rooms
            req.app.get('io').to('bplo-admins').emit('fare-reports', {
                action: 'updated',
                reportID: updatedReport.reportID,
                status: updatedReport.status
            });
            req.app.get('io').to('sb-admins').emit('fare-reports', {
                action: 'updated',
                reportID: updatedReport.reportID,
                status: updatedReport.status
            });
            console.log(`[WebSocket] Report ${updatedReport.reportID} status updated to ${updatedReport.status}`);
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
 * Note: Certificate generation functionality has been moved to certificateController.js
 * All certificate-related endpoints are now available under /api/certificates/*
 * 
 * Available certificate endpoints:
 * - POST /api/certificates/generate - Generate certificates (PDF or DOCX)
 * - GET /api/certificates/inspect-pdf/:templateName - Inspect PDF template fields
 * - GET /api/certificates/templates - Get list of available certificate templates
 */
