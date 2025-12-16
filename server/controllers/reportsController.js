const reportsRepository = require('../repositories/reportsRepository');
const { getClientIp } = require('../utils/ipHelper');
const { REPORT_CATEGORIES } = require('../models/reportsModel');
const { findFranchiseNumberByHash } = require('../utils/franchiseHelpers');

const CATEGORY_LABELS = {
  overpricing: 'Fare Overpricing',
  rude_behavior: 'Rude Behavior',
  unsafe_driving: 'Unsafe Driving',
  vehicle_condition: 'Poor Vehicle Condition',
  refusal_of_service: 'Refusal of Service',
  route_deviation: 'Route Deviation',
  other: 'Other'
};

exports.createPublicReport = async (req, res, next) => {
    try {
        const { 
            operatorId,
            fullName, 
            contactNumber,
            category,
            amountCharged, 
            expectedFare,
            description 
        } = req.body;
        
        const clientIp = getClientIp(req);
        const reportCategory = category || 'overpricing';
        
        if (!Object.values(REPORT_CATEGORIES).includes(reportCategory)) {
            return res.status(400).json({ 
                error: 'Invalid report category',
                validCategories: Object.values(REPORT_CATEGORIES)
            });
        }
        
        if (!operatorId || !contactNumber || !description) {
            return res.status(400).json({ 
                error: 'Required fields: operatorId, contactNumber, description' 
            });
        }

        if (fullName && fullName.length > 100) {
            return res.status(400).json({ error: 'Name exceeds maximum length (100 characters)' });
        }
        
        if (contactNumber.length > 20 || description.length > 1000) {
            return res.status(400).json({ error: 'Input exceeds maximum length' });
        }

        if (fullName && !/^[a-zA-Z\s\-.']+$/.test(fullName)) {
            return res.status(400).json({ error: 'Invalid name format' });
        }

        if (!/^(\+63|0)?9\d{9}$/.test(contactNumber.replace(/[\s-]/g, ''))) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }

        let chargedAmount = null;
        let expectedAmount = null;
        
        if (reportCategory === 'overpricing') {
            if (!amountCharged || !expectedFare) {
                return res.status(400).json({ 
                    error: 'Overpricing reports require amountCharged and expectedFare' 
                });
            }
            
            chargedAmount = parseFloat(amountCharged);
            expectedAmount = parseFloat(expectedFare);
            
            if (isNaN(chargedAmount) || chargedAmount <= 0 || chargedAmount > 10000) {
                return res.status(400).json({ error: 'Invalid amount charged (must be between 1-10000)' });
            }
            
            if (isNaN(expectedAmount) || expectedAmount <= 0 || expectedAmount > 10000) {
                return res.status(400).json({ error: 'Invalid expected fare (must be between 1-10000)' });
            }

            if (chargedAmount <= expectedAmount) {
                return res.status(400).json({ error: 'Amount charged must be higher than expected fare' });
            }
        }

        const FranchiseInformation = require('../models/franchiseInformationModel');
        
        // OPTIMIZED: Use cached hash lookup instead of full collection scan
        const franchiseNumber = await findFranchiseNumberByHash(operatorId);
        
        if (!franchiseNumber) {
            console.warn(`[REPORT] Non-existent franchise hash: ${operatorId}, IP: ${clientIp}`);
            return res.status(404).json({ error: 'Operator not found' });
        }
        
        // Direct indexed lookup (very fast)
        console.log(`[REPORT] Looking up franchise: ${franchiseNumber}`);
        const franchise = await FranchiseInformation.findOne({
          franchiseNumber: franchiseNumber,
          isCurrentVersion: true
        })
        .select('franchiseNumber operatorName operatorBarangay barangay franchiseStatus')
        .lean();
        
        console.log(`[REPORT] Found franchise:`, franchise ? JSON.stringify(franchise) : 'null');
        
        if (!franchise) {
            console.warn(`[REPORT] Non-existent franchise hash: ${operatorId}, IP: ${clientIp}`);
            return res.status(404).json({ error: 'Operator not found' });
        }

        if (franchise.franchiseStatus === 'expired' || franchise.franchiseStatus === 'inactive') {
            console.warn(`[REPORT] Inactive franchise: ${operatorId} (${franchise.franchiseStatus}), IP: ${clientIp}`);
            return res.status(403).json({ 
                error: 'Cannot report on expired or inactive franchises' 
            });
        }

        const Report = require('../models/reportsModel');
        const recentReportsFromIp = await Report.countDocuments({
            franchiseNumber: franchise.franchiseNumber,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            reporterIp: clientIp
        });

        if (recentReportsFromIp >= 3) {
            console.warn(`[REPORT] Rate limit: ${operatorId}, IP: ${clientIp}`);
            return res.status(429).json({ 
                error: 'Too many reports from your network. Please try again later.' 
            });
        }

        // Log franchise data for debugging
        console.log(`[REPORT] Franchise data:`, {
            franchiseNumber: franchise.franchiseNumber,
            operatorName: franchise.operatorName,
            operatorBarangay: franchise.operatorBarangay
        });

        const reportData = {
            franchiseNumber: franchise.franchiseNumber,
            operatorName: franchise.operatorName || 'Unknown Operator',
            operatorBarangay: franchise.operatorBarangay || franchise.barangay,
            category: reportCategory,
            amountCharged: chargedAmount,
            expectedFare: expectedAmount,
            dateReported: new Date(),
            timeReported: new Date().toLocaleTimeString('en-PH', { 
                timeZone: 'Asia/Manila',
                hour12: true 
            }),
            description: description.trim(),
            reporterName: fullName ? fullName.trim() : '',
            reporterContact: contactNumber,
            franchiseStatusAtTime: franchise.franchiseStatus,
            status: 'pending'
        };

        const newReportDoc = new Report(reportData);
        const newReport = await newReportDoc.save();
        
        console.log(`[REPORT] ${reportCategory}: ${franchise.franchiseNumber}, Reporter: ${fullName}, ID: ${newReport.reportID}`);
        
        if (req.app.get('io')) {
            const eventData = {
                action: 'created',
                reportID: newReport.reportID,
                operatorName: newReport.operatorName,
                category: newReport.category,
                categoryLabel: CATEGORY_LABELS[newReport.category]
            };
            req.app.get('io').to('general').emit('incident-reports', eventData);
            req.app.get('io').to('bplo-admins').emit('incident-reports', eventData);
            req.app.get('io').to('sb-admins').emit('incident-reports', eventData);
        }
        
        res.status(201).json({ 
            success: true,
            message: 'Report submitted successfully. Thank you for your feedback.',
            reportId: newReport.reportID,
            category: newReport.category
        });
    } catch (error) {
        console.error('Error creating public incident report:', error);
        next(error);
    }   
};

exports.createReport = async (req, res, next) => {
    try {
        const { 
            operatorName,
            operatorBarangay,
            franchiseNumber,
            category,
            amountCharged, 
            expectedFare, 
            description, 
            reporterName,
            reporterContact 
        } = req.body;
        
        const reportCategory = category || 'overpricing';
        
        if (!operatorName || !description || !reporterContact) {
            return res.status(400).json({ 
                error: 'Required: operatorName, description, reporterContact' 
            });
        }

        const reportData = {
            franchiseNumber: franchiseNumber || null,
            operatorName,
            operatorBarangay: operatorBarangay || null,
            category: reportCategory,
            dateReported: new Date(),
            timeReported: new Date().toLocaleTimeString(),
            amountCharged: amountCharged ? parseFloat(amountCharged) : null,
            expectedFare: expectedFare ? parseFloat(expectedFare) : null,
            description,
            reporterName: reporterName || null,
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

exports.getAllReports = async (req, res, next) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            search = '', 
            status = '',
            category = '',
            barangay = '',
            sortBy = 'dateReported',
            sortOrder = 'desc'
        } = req.query;
        
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            search,
            status,
            category,
            barangay,
            sortBy,
            sortOrder
        };

        const result = await reportsRepository.getAllReports(options);
        result.categories = CATEGORY_LABELS;
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error getting incident reports:', error);
        next(error);
    }
};

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

exports.updateReport = async (req, res, next) => {
    try {
        const reportId = req.params.id;
        const updateData = req.body;
        
        delete updateData.reportID;
        delete updateData.createdAt;
        delete updateData.updatedAt;

        if (updateData.status === 'resolved' && !updateData.resolvedAt) {
            updateData.resolvedAt = new Date();
            updateData.resolvedBy = req.user?.adminId || req.user?.id || 'admin';
        }

        const updatedReport = await reportsRepository.updateReport(reportId, updateData);
        
        if (!updatedReport) {
            return res.status(404).json({ error: 'Incident report not found' });
        }
        
        if (req.app.get('io')) {
            const eventData = {
                action: 'updated',
                reportID: updatedReport.reportID,
                status: updatedReport.status,
                category: updatedReport.category,
                categoryLabel: CATEGORY_LABELS[updatedReport.category],
                timestamp: new Date().toISOString()
            };
            req.app.get('io').to('general').emit('incident-report-updated', eventData);
            req.app.get('io').to('bplo-admins').emit('incident-report-updated', eventData);
            req.app.get('io').to('sb-admins').emit('incident-report-updated', eventData);
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

exports.getMonthlyReports = async (req, res, next) => {
    try {
        const { month, year, format = 'json', category = '', barangay = '' } = req.query;
        
        if (!month || !year) {
            return res.status(400).json({ error: 'Month and year parameters are required' });
        }

        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        
        if (monthNum < 1 || monthNum > 12) {
            return res.status(400).json({ error: 'Month must be between 1 and 12' });
        }

        // Pass filters to repository for database-level filtering (efficient for 10K+ docs)
        const reports = await reportsRepository.getMonthlyReports(monthNum, yearNum, {
            category,
            barangay
        });
        
        if (format === 'csv') {
            const csvHeader = 'Report ID,Category,Operator Name,Barangay,Date Reported,Time Reported,Amount Charged,Expected Fare,Description,Reporter,Contact,Status\n';
            const csvContent = reports.map(report => {
                return [
                    report.reportID,
                    CATEGORY_LABELS[report.category] || report.category,
                    `"${report.operatorName || ''}"`,
                    `"${report.operatorBarangay || ''}"`,
                    report.dateReported.toISOString().split('T')[0],
                    report.timeReported,
                    report.amountCharged || '',
                    report.expectedFare || '',
                    `"${report.description.replace(/"/g, '""')}"`,
                    `"${report.reporterName || ''}"`,
                    `"${report.reporterContact}"`,
                    report.status
                ].join(',');
            }).join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="reports_${year}_${month.toString().padStart(2, '0')}.csv"`);
            res.send(csvHeader + csvContent);
        } else {
            res.status(200).json({ month: monthNum, year: yearNum, total: reports.length, reports });
        }
    } catch (error) {
        console.error('Error getting monthly incident reports:', error);
        next(error);
    }
};

exports.getReportsStatistics = async (req, res, next) => {
    try {
        const statistics = await reportsRepository.getReportsStatistics();
        statistics.categoryLabels = CATEGORY_LABELS;
        res.status(200).json(statistics);
    } catch (error) {
        console.error('Error getting incident reports statistics:', error);
        next(error);
    }
};

exports.getReportCategories = async (req, res, next) => {
    try {
        res.status(200).json({
            categories: Object.values(REPORT_CATEGORIES),
            labels: CATEGORY_LABELS
        });
    } catch (error) {
        next(error);
    }
};

exports.getReportsByDateRange = async (req, res, next) => {
    try {
        const { startDate, endDate, format = 'json', category = '', barangay = '' } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate parameters are required' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }

        end.setHours(23, 59, 59, 999);

        // Use database-level filtering for efficiency
        const reports = await reportsRepository.getReportsByDateRange(start, end, {
            category,
            barangay
        });
        
        if (format === 'csv') {
            const csvHeader = 'Report ID,Category,Operator Name,Barangay,Date Reported,Time Reported,Amount Charged,Expected Fare,Description,Reporter,Contact,Status\n';
            const csvContent = reports.map(report => {
                return [
                    report.reportID,
                    CATEGORY_LABELS[report.category] || report.category,
                    `"${report.operatorName || ''}"`,
                    `"${report.operatorBarangay || ''}"`,
                    report.dateReported.toISOString().split('T')[0],
                    report.timeReported,
                    report.amountCharged || '',
                    report.expectedFare || '',
                    `"${report.description.replace(/"/g, '""')}"`,
                    `"${report.reporterName || ''}"`,
                    `"${report.reporterContact}"`,
                    report.status
                ].join(',');
            }).join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="reports_${startDate}_to_${endDate}.csv"`);
            res.send(csvHeader + csvContent);
        } else {
            res.status(200).json({ startDate, endDate, total: reports.length, reports });
        }
    } catch (error) {
        console.error('Error getting incident reports by date range:', error);
        next(error);
    }
};

exports.getReportsByBarangay = async (req, res, next) => {
    try {
        const { barangay } = req.params;
        const { page = 1, limit = 20, status, category } = req.query;
        
        if (!barangay) {
            return res.status(400).json({ error: 'Barangay parameter is required' });
        }

        const result = await reportsRepository.getReportsByBarangay(barangay, {
            page: parseInt(page),
            limit: parseInt(limit),
            status,
            category
        });
        
        res.status(200).json({
            barangay,
            ...result,
            categoryLabels: CATEGORY_LABELS
        });
    } catch (error) {
        console.error('Error getting reports by barangay:', error);
        next(error);
    }
};

exports.getReportsByCategory = async (req, res, next) => {
    try {
        const { category } = req.params;
        const { page = 1, limit = 20, status } = req.query;
        
        if (!category || !Object.values(REPORT_CATEGORIES).includes(category)) {
            return res.status(400).json({ 
                error: 'Valid category parameter is required',
                validCategories: Object.values(REPORT_CATEGORIES)
            });
        }

        const result = await reportsRepository.getReportsByCategory(category, {
            page: parseInt(page),
            limit: parseInt(limit),
            status
        });
        
        res.status(200).json({
            category,
            categoryLabel: CATEGORY_LABELS[category],
            ...result
        });
    } catch (error) {
        console.error('Error getting reports by category:', error);
        next(error);
    }
};

exports.getReportsByOperator = async (req, res, next) => {
    try {
        const { operatorName } = req.params;
        const { page = 1, limit = 20, status, category } = req.query;
        
        if (!operatorName) {
            return res.status(400).json({ error: 'Operator name parameter is required' });
        }

        const result = await reportsRepository.getReportsByOperator(operatorName, {
            page: parseInt(page),
            limit: parseInt(limit),
            status,
            category
        });
        
        res.status(200).json({
            operatorName,
            ...result,
            categoryLabels: CATEGORY_LABELS
        });
    } catch (error) {
        console.error('Error getting reports by operator:', error);
        next(error);
    }
};

exports.getBarangaySummary = async (req, res, next) => {
    try {
        const summary = await reportsRepository.getBarangaySummary();
        res.status(200).json({ summary, total: summary.length });
    } catch (error) {
        console.error('Error getting barangay summary:', error);
        next(error);
    }
};

exports.getCategorySummary = async (req, res, next) => {
    try {
        const summary = await reportsRepository.getCategorySummary();
        res.status(200).json({ 
            summary: summary.map(s => ({
                ...s,
                categoryLabel: CATEGORY_LABELS[s.category] || s.category
            })),
            categoryLabels: CATEGORY_LABELS
        });
    } catch (error) {
        console.error('Error getting category summary:', error);
        next(error);
    }
};

exports.getOperatorSummary = async (req, res, next) => {
    try {
        const { limit = 20 } = req.query;
        const summary = await reportsRepository.getOperatorSummary({ limit: parseInt(limit) });
        res.status(200).json({ summary, total: summary.length });
    } catch (error) {
        console.error('Error getting operator summary:', error);
        next(error);
    }
};
