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
 * Generate certificate documents (PDF or Word)
 * Supports various certificate types for franchise management
 * Uses pdf-lib to fill pre-existing fillable PDF forms
 */
exports.generateCertificate = async (req, res, next) => {
    try {
        const { certificateType, franchiseData, format, generatedBy, generatedDate } = req.body;

        if (!certificateType || !franchiseData) {
            return res.status(400).json({ error: 'Certificate type and franchise data are required' });
        }

        console.log(`[Certificate Generation] Type: ${certificateType}, Format: ${format}`);
        console.log(`[Certificate Generation] Franchise: ${franchiseData.franchiseNumber}`);

        // Validate certificate type
        const validTypes = [
            'C.001-APPROVAL',
            'C.001-CANCELLATION', 
            'F.008-EXISTING',
            'F.008-MTOF-DATE',
            'F.008-MTOF-SUMMARY'
        ];

        if (!validTypes.includes(certificateType)) {
            return res.status(400).json({ error: 'Invalid certificate type' });
        }

        // Log certificate generation for audit trail
        console.log('[Certificate Generation] Generated by:', generatedBy || req.user?.username || 'Unknown');

        // Generate PDF using pdf-lib to fill form fields
        if (format === 'pdf') {
            const fs = require('fs').promises;
            const path = require('path');
            const { fillPDFForm, inspectPDFFields } = require('../utils/pdfFieldMapper');

            // Map certificate types to template files
            const templateMap = {
                'C.001-APPROVAL': 'C.001 - CERT APPROVED - FILLABLE.pdf',
                'C.001-CANCELLATION': 'C.001 - CERT CANCELLED - FILLABLE.pdf',
                'F.008-EXISTING': 'F.008 - CERT EXISTING - FILLABLE.pdf'
            };

            const templateFile = templateMap[certificateType];
            if (!templateFile) {
                return res.status(400).json({ error: 'PDF template not available for this certificate type' });
            }

            // Path to template
            const templatePath = path.join(__dirname, '../templates', templateFile);
            
            try {
                // Check if template exists
                await fs.access(templatePath);
            } catch (err) {
                console.error(`[Certificate] Template not found: ${templatePath}`);
                return res.status(500).json({ 
                    error: 'Certificate template not found. Please ensure PDF templates are in the server/templates folder.' 
                });
            }

            // Inspect PDF fields for debugging (optional - can be removed in production)
            try {
                const fieldInfo = await inspectPDFFields(templatePath);
                console.log(`[Certificate] Template has ${fieldInfo.totalFields} form fields`);
                fieldInfo.fields.forEach(f => console.log(`  - ${f.name} (${f.type})`));
            } catch (inspectError) {
                console.warn('[Certificate] Could not inspect PDF fields:', inspectError.message);
            }

            // Prepare complete franchise data for PDF filling
            const completeFranchiseData = {
                ...franchiseData,
                generatedBy: generatedBy || 'Administrator',
                generatedByRole: franchiseData.generatedByRole || req.user?.role || 'Municipal Administrator',
                dateGenerated: generatedDate || new Date().toISOString(),
                municipalityName: franchiseData.municipalityName || 'Municipality of Solano, Nueva Vizcaya'
            };

            // Fill the PDF form using the smart field mapper
            const pdfBytes = await fillPDFForm(templatePath, completeFranchiseData);

            // Send the PDF
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${certificateType}_${franchiseData.franchiseNumber}_${Date.now()}.pdf"`);
            res.setHeader('Content-Length', pdfBytes.length);
            
            return res.send(Buffer.from(pdfBytes));

        } else if (format === 'docx') {
            // Word document generation using existing templates with headers/footers
            const fs = require('fs').promises;
            const path = require('path');
            const PizZip = require('pizzip');
            const Docxtemplater = require('docxtemplater');
            
            // Map certificate types to template files
            const templateMap = {
                'F.008-MTOF-DATE': 'F.008 - MTOF - DATE.docx',
                'F.008-MTOF-SUMMARY': 'F.008 - MTOF DATE SUMMARY.docx'
            };

            const templateFile = templateMap[certificateType];
            
            if (!templateFile) {
                // Fallback to programmatic generation if no template exists
                console.log('[Certificate] No Word template found, generating programmatically');
                const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');
                
                const children = [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'MUNICIPALITY OF SOLANO, NUEVA VIZCAYA',
                                bold: true,
                                size: 32
                            })
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: certificateType.includes('SUMMARY') ? 'MOTORIZED TRICYCLE-FOR-HIRE (MTOF) SUMMARY' : 'Certificate Report',
                                bold: true,
                                size: 28
                            })
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: franchiseData.summaryText || `Total Franchises: ${franchiseData.statistics?.total || 0}`,
                                size: 24
                            })
                        ],
                        spacing: { after: 400 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Generated by: ${generatedBy || 'Administrator'}`,
                                size: 20
                            })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Date: ${generatedDate ? new Date(generatedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
                                size: 20
                            })
                        ]
                    })
                ];
                
                const doc = new Document({
                    sections: [{
                        properties: {
                            page: {
                                margin: {
                                    top: 1440,
                                    right: 1440,
                                    bottom: 1440,
                                    left: 1440
                                }
                            }
                        },
                        children: children
                    }]
                });

                const buffer = await Packer.toBuffer(doc);
                
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                res.setHeader('Content-Disposition', `attachment; filename="${certificateType}_${franchiseData.franchiseNumber || 'Summary'}_${Date.now()}.docx"`);
                
                return res.send(buffer);
            }

            // Use existing template with headers and footers
            const templatePath = path.join(__dirname, '../templates', templateFile);
            
            try {
                await fs.access(templatePath);
            } catch (err) {
                console.error(`[Certificate] Template not found: ${templatePath}`);
                return res.status(500).json({ 
                    error: `Word template not found: ${templateFile}. Please ensure the template is in the server/templates folder.` 
                });
            }

            try {
                // Load the Word template
                const content = await fs.readFile(templatePath, 'binary');
                const zip = new PizZip(content);
                const doc = new Docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true,
                    nullGetter: () => 'N/A'
                });

                // Prepare data for template
                const templateData = {
                    municipalityName: franchiseData.municipalityName || 'Municipality of Solano, Nueva Vizcaya',
                    franchiseNumber: franchiseData.franchiseNumber || 'N/A',
                    operatorName: franchiseData.operatorName || 'N/A',
                    operatorAddress: franchiseData.operatorAddress || 'N/A',
                    plateNumber: franchiseData.mvPlateNo || 'N/A',
                    unitModel: franchiseData.unitModel || 'N/A',
                    resolutionNumber: franchiseData.resolutionNumber || franchiseData.sbResolutionNumber || 'N/A',
                    dateApproved: franchiseData.dateApproved ? new Date(franchiseData.dateApproved).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A',
                    summaryText: franchiseData.summaryText || '',
                    totalFranchises: franchiseData.statistics?.total || 0,
                    newFranchises: franchiseData.statistics?.newCount || 0,
                    renewalFranchises: franchiseData.statistics?.renewalCount || 0,
                    generatedBy: generatedBy || 'Administrator',
                    generatedByRole: franchiseData.generatedByRole || 'Municipal Administrator',
                    dateGenerated: generatedDate ? new Date(generatedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                    year: new Date().getFullYear()
                };

                // Render the document (replace placeholders)
                doc.render(templateData);

                // Get the filled document as a buffer
                const buffer = doc.getZip().generate({
                    type: 'nodebuffer',
                    compression: 'DEFLATE'
                });

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                res.setHeader('Content-Disposition', `attachment; filename="${certificateType}_${franchiseData.franchiseNumber || 'Summary'}_${Date.now()}.docx"`);
                
                return res.send(buffer);

            } catch (fillError) {
                console.error('[Certificate] Error filling Word template:', fillError);
                return res.status(500).json({ 
                    error: 'Failed to fill Word template. Please check template field names.' 
                });
            }
        } else {
            return res.status(400).json({ error: 'Invalid format. Must be pdf or docx' });
        }
    } catch (error) {
        console.error('Error generating certificate:', error);
        return res.status(500).json({ error: error.message || 'Failed to generate certificate' });
    }
};

/**
 * Inspect PDF template fields (for debugging)
 * GET /api/reports/inspect-pdf-template/:templateName
 */
exports.inspectPDFTemplate = async (req, res, next) => {
    try {
        const { templateName } = req.params;
        const { inspectPDFFields } = require('../utils/pdfFieldMapper');
        const path = require('path');
        
        const templateMap = {
            'approval': 'C.001 - CERT APPROVED - FILLABLE.pdf',
            'cancellation': 'C.001 - CERT CANCELLED - FILLABLE.pdf',
            'existing': 'F.008 - CERT EXISTING - FILLABLE.pdf'
        };
        
        const templateFile = templateMap[templateName];
        if (!templateFile) {
            return res.status(400).json({ 
                error: 'Invalid template name. Use: approval, cancellation, or existing' 
            });
        }
        
        const templatePath = path.join(__dirname, '../templates', templateFile);
        const fieldInfo = await inspectPDFFields(templatePath);
        
        res.json({
            template: templateFile,
            ...fieldInfo
        });
    } catch (error) {
        console.error('[PDF Inspector] Error:', error);
        res.status(500).json({ error: error.message });
    }
};