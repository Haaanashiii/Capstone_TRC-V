const reportsRepository = require('../repositories/reportsRepository');
const { getClientIp } = require('../utils/ipHelper');
const { INCIDENT_CATEGORIES, CATEGORY_LABELS } = require('../models/reportsModel');

/**
 * Get available incident categories
 * Returns list of categories with their labels and examples
 */
exports.getCategories = async (req, res, next) => {
    try {
        const { CATEGORY_EXAMPLES } = require('../models/reportsModel');
        
        const categories = Object.entries(INCIDENT_CATEGORIES).map(([key, value]) => ({
            key: value,
            label: CATEGORY_LABELS[value],
            examples: CATEGORY_EXAMPLES[value]
        }));
        
        res.status(200).json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('Error getting categories:', error);
        next(error);
    }
};

/**
 * Create a public incident report (no authentication required)
 * For use by citizens scanning QR codes
 */
exports.createPublicReport = async (req, res, next) => {
    try {
        const { 
            operatorId,
            fullName, 
            contactNumber,
            category = 'fare-related', // Default to fare-related for backward compatibility
            amountCharged, 
            expectedFare, 
            description 
        } = req.body;
        
        // Get client IP for tracking (DDoS/fraud prevention)
        const clientIp = getClientIp(req);
        
        // Validate required fields
        const requiredFields = ['operatorId', 'fullName', 'contactNumber', 'description'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                error: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }

        // Validate category
        if (!Object.values(INCIDENT_CATEGORIES).includes(category)) {
            return res.status(400).json({ 
                error: `Invalid category. Valid categories: ${Object.values(INCIDENT_CATEGORIES).join(', ')}` 
            });
        }

        // For fare-related issues, amount fields are required
        if (category === INCIDENT_CATEGORIES.FARE_RELATED) {
            if (!amountCharged || !expectedFare) {
                return res.status(400).json({ 
                    error: 'For fare-related issues, amountCharged and expectedFare are required' 
                });
            }
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

        // Validate amounts if provided (for fare-related category)
        let chargedAmount = null;
        let expectedAmount = null;
        
        if (amountCharged !== undefined && amountCharged !== null) {
            chargedAmount = parseFloat(amountCharged);
            if (isNaN(chargedAmount) || chargedAmount <= 0 || chargedAmount > 10000) {
                return res.status(400).json({ error: 'Invalid amount charged (must be between 1-10000)' });
            }
        }
        
        if (expectedFare !== undefined && expectedFare !== null) {
            expectedAmount = parseFloat(expectedFare);
            if (isNaN(expectedAmount) || expectedAmount <= 0 || expectedAmount > 10000) {
                return res.status(400).json({ error: 'Invalid expected fare (must be between 1-10000)' });
            }
        }

        // For fare-related, validate that charged amount is higher than expected
        if (category === INCIDENT_CATEGORIES.FARE_RELATED && chargedAmount && expectedAmount) {
            if (chargedAmount <= expectedAmount) {
                return res.status(400).json({ error: 'Amount charged must be higher than expected fare to report overpricing' });
            }
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
        if (franchise.franchiseStatus === 'expired' || franchise.franchiseStatus === 'inactive') {
            console.warn(`[FRAUD] Report for inactive franchise: ${operatorId} (${franchise.franchiseStatus}), IP: ${clientIp}`);
            return res.status(403).json({ 
                error: 'Cannot report on expired or inactive franchises. Please ensure you scanned an active operator\'s QR code.' 
            });
        }

        // ANTI-DDoS: Check if same IP has reported same franchise multiple times recently (within 24 hours)
        const IncidentReport = require('../models/reportsModel');
        const recentReportsFromIp = await IncidentReport.countDocuments({
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
            category: category,
            amountCharged: chargedAmount,
            expectedFare: expectedAmount,
            description: description.trim(),
            reporterContact: `${fullName} - ${contactNumber}`,
            reporterIp: clientIp,
            franchiseStatusAtTime: franchise.franchiseStatus,
            status: 'pending'
        };

        // Create a new IncidentReport document and trigger pre-save hook
        const newReportDoc = new IncidentReport(reportData);
        const newReport = await newReportDoc.save();
        
        // Log for audit trail
        console.log(`[INCIDENT REPORT] Category: ${category}, Operator: ${franchise.franchiseNumber}, Reporter: ${fullName}, IP: ${clientIp}, Report ID: ${newReport.reportID}`);
        
        // Emit WebSocket event for real-time updates
        if (req.app.get('io')) {
            req.app.get('io').to('general').emit('incident-reports', {
                action: 'created',
                reportID: newReport.reportID,
                franchiseeName: newReport.franchiseeName,
                category: newReport.category
            });
            req.app.get('io').to('bplo-admins').emit('incident-reports', {
                action: 'created',
                reportID: newReport.reportID,
                franchiseeName: newReport.franchiseeName,
                category: newReport.category
            });
            req.app.get('io').to('sb-admins').emit('incident-reports', {
                action: 'created',
                reportID: newReport.reportID,
                franchiseeName: newReport.franchiseeName,
                category: newReport.category
            });
        }
        
        res.status(201).json({ 
            success: true,
            message: 'Incident report submitted successfully. Thank you for helping maintain safe tricycle services.',
            reportId: newReport.reportID
        });
    } catch (error) {
        console.error('Error creating public incident report:', error);
        next(error);
    }   
};

/**
 * Create a new incident report (authenticated)
 */
exports.createReport = async (req, res, next) => {
    try {
        const { 
            franchiseeName, 
            category = 'fare-related',
            amountCharged, 
            expectedFare, 
            description, 
            reporterContact 
        } = req.body;
        
        // Validate required fields
        if (!franchiseeName || !description || !reporterContact) {
            return res.status(400).json({ 
                error: 'Missing required fields: franchiseeName, description, reporterContact' 
            });
        }

        // Validate category
        if (!Object.values(INCIDENT_CATEGORIES).includes(category)) {
            return res.status(400).json({ 
                error: `Invalid category. Valid categories: ${Object.values(INCIDENT_CATEGORIES).join(', ')}` 
            });
        }

        const reportData = {
            franchiseeName,
            category,
            dateReported: new Date(),
            timeReported: new Date().toLocaleTimeString(),
            amountCharged: amountCharged ? parseFloat(amountCharged) : null,
            expectedFare: expectedFare ? parseFloat(expectedFare) : null,
            description,
            reporterContact
        };

        const newReport = await reportsRepository.createReport(reportData);
        res.status(201).json({ 
            message: 'Incident report created successfully', 
            report: newReport 
        });
    } catch (error) {
        console.error('Error creating incident report:', error);
        next(error);
    }   
};

/**
 * Get all incident reports with pagination and filtering
 */
exports.getAllReports = async (req, res, next) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            search = '', 
            status = '',
            category = '',
            sortBy = 'dateReported',
            sortOrder = 'desc'
        } = req.query;
        
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            search,
            status,
            category,
            sortBy,
            sortOrder
        };

        const result = await reportsRepository.getAllReports(options);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error getting incident reports:', error);
        next(error);
    }
};

/**
 * Get a single incident report by ID
 */
exports.getReportById = async (req, res, next) => {
    try {
        const reportId = req.params.id;
        const report = await reportsRepository.getReportById(reportId);
        
        if (!report) {
            return res.status(404).json({ error: 'Incident report not found' });
        }
        
        res.status(200).json(report);
    } catch (error) {
        console.error('Error getting incident report by ID:', error);
        next(error);
    }
};

/**
 * Update an incident report
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
            return res.status(404).json({ error: 'Incident report not found' });
        }
        
        // Emit WebSocket event for real-time updates
        if (req.app.get('io')) {
            req.app.get('io').to('general').emit('incident-report-updated', {
                reportID: updatedReport.reportID,
                status: updatedReport.status,
                category: updatedReport.category,
                timestamp: new Date().toISOString()
            });
            // Also emit to admin rooms
            req.app.get('io').to('bplo-admins').emit('incident-reports', {
                action: 'updated',
                reportID: updatedReport.reportID,
                status: updatedReport.status
            });
            req.app.get('io').to('sb-admins').emit('incident-reports', {
                action: 'updated',
                reportID: updatedReport.reportID,
                status: updatedReport.status
            });
            console.log(`[WebSocket] Incident report ${updatedReport.reportID} status updated to ${updatedReport.status}`);
        }
        
        res.status(200).json({ 
            message: 'Incident report updated successfully', 
            report: updatedReport 
        });
    } catch (error) {
        console.error('Error updating incident report:', error);
        next(error);
    }
};

/**
 * Delete an incident report
 */
exports.deleteReport = async (req, res, next) => {
    try {
        const reportId = req.params.id;
        const deletedReport = await reportsRepository.deleteReport(reportId);
        
        if (!deletedReport) {
            return res.status(404).json({ error: 'Incident report not found' });
        }
        
        res.status(200).json({ 
            message: 'Incident report deleted successfully', 
            report: deletedReport 
        });
    } catch (error) {
        console.error('Error deleting incident report:', error);
        next(error);
    }
};

/**
 * Get monthly incident reports and optionally export as CSV
 */
exports.getMonthlyReports = async (req, res, next) => {
    try {
        const { month, year, format = 'json', category = '', status = '' } = req.query;
        
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

        const filters = {};
        if (category) filters.category = category;
        if (status) filters.status = status;

        const reports = await reportsRepository.getMonthlyReports(monthNum, yearNum, filters);
        
        if (format === 'csv') {
            // Generate CSV content with category column
            const csvHeader = 'Report ID,Category,Franchisee Name,Date Reported,Time Reported,Amount Charged,Expected Fare,Description,Reporter Contact,Status\n';
            const csvContent = reports.map(report => {
                return [
                    report.reportID,
                    `"${CATEGORY_LABELS[report.category] || report.category}"`,
                    `"${report.franchiseeName}"`,
                    report.dateReported.toISOString().split('T')[0],
                    report.timeReported,
                    report.amountCharged || 'N/A',
                    report.expectedFare || 'N/A',
                    `"${report.description.replace(/"/g, '""')}"`,
                    `"${report.reporterContact}"`,
                    report.status
                ].join(',');
            }).join('\n');
            
            const csv = csvHeader + csvContent;
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="incident_reports_${year}_${month.toString().padStart(2, '0')}.csv"`);
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
        console.error('Error getting monthly incident reports:', error);
        next(error);
    }
};

/**
 * Get incident reports statistics
 */
exports.getReportsStatistics = async (req, res, next) => {
    try {
        const statistics = await reportsRepository.getReportsStatistics();
        res.status(200).json(statistics);
    } catch (error) {
        console.error('Error getting incident reports statistics:', error);
        next(error);
    }
};

/**
 * Get incident reports by date range with optional CSV export
 */
exports.getReportsByDateRange = async (req, res, next) => {
    try {
        const { startDate, endDate, format = 'json', category = '', status = '' } = req.query;
        
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

        const filters = {};
        if (category) filters.category = category;
        if (status) filters.status = status;

        const reports = await reportsRepository.getReportsByDateRange(start, end, filters);
        
        if (format === 'csv') {
            // Generate CSV content with category column
            const csvHeader = 'Report ID,Category,Franchisee Name,Date Reported,Time Reported,Amount Charged,Expected Fare,Description,Reporter Contact,Status\n';
            const csvContent = reports.map(report => {
                return [
                    report.reportID,
                    `"${CATEGORY_LABELS[report.category] || report.category}"`,
                    `"${report.franchiseeName}"`,
                    report.dateReported.toISOString().split('T')[0],
                    report.timeReported,
                    report.amountCharged || 'N/A',
                    report.expectedFare || 'N/A',
                    `"${report.description.replace(/"/g, '""')}"`,
                    `"${report.reporterContact}"`,
                    report.status
                ].join(',');
            }).join('\n');
            
            const csv = csvHeader + csvContent;
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="incident_reports_${startDate}_to_${endDate}.csv"`);
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
        console.error('Error getting incident reports by date range:', error);
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
