/**
 * PDF Field Mapper Utility
 * Maps franchise data to PDF form fields dynamically
 * Handles various naming conventions in fillable PDF forms
 */

const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

/**
 * Get all form fields from a PDF template
 * Useful for debugging and understanding template structure
 */
async function inspectPDFFields(templatePath) {
    try {
        const existingPdfBytes = await fs.readFile(templatePath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        const fieldInfo = fields.map(field => {
            const name = field.getName();
            const type = field.constructor.name;
            return { name, type };
        });

        return {
            totalFields: fields.length,
            fields: fieldInfo
        };
    } catch (error) {
        console.error('[PDF Inspector] Error:', error);
        throw error;
    }
}

/**
 * Smart field matching - tries multiple strategies to match data to form fields
 */
function findMatchingField(fieldName, dataMap) {
    // Try exact match first (including special characters like dots)
    if (dataMap.hasOwnProperty(fieldName)) {
        return dataMap[fieldName];
    }
    
    const normalizedFieldName = fieldName.toLowerCase().replace(/[_\-\s\.]/g, '');
    
    // Try exact match with normalized name
    for (const [key, value] of Object.entries(dataMap)) {
        if (key.toLowerCase() === fieldName.toLowerCase()) {
            return value;
        }
    }
    
    // Try normalized match (remove spaces, underscores, hyphens, dots)
    for (const [key, value] of Object.entries(dataMap)) {
        const normalizedKey = key.toLowerCase().replace(/[_\-\s\.]/g, '');
        if (normalizedKey === normalizedFieldName) {
            return value;
        }
    }
    
    // Try partial match (field name contains key or key contains field name)
    for (const [key, value] of Object.entries(dataMap)) {
        const normalizedKey = key.toLowerCase().replace(/[_\-\s\.]/g, '');
        if (normalizedFieldName.includes(normalizedKey) || normalizedKey.includes(normalizedFieldName)) {
            return value;
        }
    }
    
    // Try keyword matching for common patterns
    const keywordMap = {
        'operator': ['operatorName', 'operatorName_2', 'name', 'owner'],
        'barangay': ['barangay', 'address', 'operatorAddress'],
        'sbapproved': ['sbApprovedAt', 'dateApproved', 'approvalDate'],
        'resolution': ['sbResolutionNumber', 'resolutionNumber', 'resolution'],
        'unit': ['unitModel', 'model', 'vehicleModel'],
        'motor': ['motorEngineNo', 'engineNumber', 'engine'],
        'chasis': ['chasisNo', 'chassisNumber', 'chassis'],
        'plate': ['mvPlateNo', 'plateNumber', 'platenumber'],
        'franchise': ['franchiseNumber', 'franchiseNo'],
        'address': ['operatorAddress', 'address', 'barangay'],
        'generated': ['dateGenerated', 'dateGenerated_2', 'currentDate'],
        'receipt': ['officialReceipNumber', 'officialReceiptNumber'],
        'user': ['user.name', 'generatedBy', 'preparedBy']
    };
    
    for (const [keyword, possibleKeys] of Object.entries(keywordMap)) {
        if (normalizedFieldName.includes(keyword)) {
            for (const possibleKey of possibleKeys) {
                if (dataMap[possibleKey] !== undefined && dataMap[possibleKey] !== null && dataMap[possibleKey] !== '') {
                    return dataMap[possibleKey];
                }
            }
        }
    }
    
    return null;
}

/**
 * Fill PDF form with franchise data
 */
async function fillPDFForm(templatePath, franchiseData) {
    try {
        // Load the PDF template
        const existingPdfBytes = await fs.readFile(templatePath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        
        console.log(`[PDF Filler] Processing template with ${fields.length} fields`);
        
        // Embed standard fonts for consistent appearance
        const { StandardFonts } = require('pdf-lib');
        const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
        
        // Set default appearance for all text fields
        form.getFields().forEach(field => {
            const fieldType = field.constructor.name;
            if (fieldType === 'PDFTextField') {
                try {
                    const textField = form.getTextField(field.getName());
                    // Set font and size for consistent appearance
                    textField.defaultUpdateAppearances(timesRomanFont);
                } catch (err) {
                    // Field might not support this operation, skip silently
                }
            }
        });
        
        // Prepare comprehensive data map with all possible field variations
        const dataMap = {
            // Exact matches from PDF templates (matching database schema)
            operatorName: franchiseData.operatorName || '',
            operatorName_2: franchiseData.operatorName || '', // Duplicate field in some templates
            operatorAddress: franchiseData.operatorAddress || '',
            barangay: franchiseData.operatorBarangay || franchiseData.barangay || extractBarangay(franchiseData.operatorAddress) || '',
            
            // Approval information (from session/resolution or approval timestamps)
            sbApprovedAt: franchiseData.sbApprovedAt || franchiseData.approvedAt || franchiseData.dateApproved 
                ? formatDate(franchiseData.sbApprovedAt || franchiseData.approvedAt || franchiseData.dateApproved) 
                : '',
            sbResolutionNumber: franchiseData.resolutionNumber || franchiseData.sbResolutionNumber || '',
            
            // Vehicle information (using correct database field names)
            unitModel: franchiseData.unitModel || '',
            motorEngineNo: franchiseData.motorEngineNo || franchiseData.engineNumber || '', // Database uses motorEngineNo
            chasisNo: franchiseData.chasisNo || franchiseData.chassisNumber || '', // Database uses chasisNo (typo in schema)
            mvPlateNo: franchiseData.mvPlateNo || '',
            
            // Generated date
            dateGenerated: franchiseData.dateGenerated ? formatDate(franchiseData.dateGenerated) : formatDate(new Date()),
            dateGenerated_2: franchiseData.dateGenerated ? formatDate(franchiseData.dateGenerated) : formatDate(new Date()),
            
            // Receipt information
            officialReceipNumber: franchiseData.officialReceiptNumber || franchiseData.officialReceipNumber || '',
            officialReceiptNumber: franchiseData.officialReceiptNumber || franchiseData.officialReceipNumber || '',
            
            // Franchise number
            franchiseNumber: franchiseData.franchiseNumber || '',
            
            // Generated by
            'user.name': franchiseData.generatedBy || 'Administrator',
            
            // Additional common field names
            name: franchiseData.operatorName,
            address: franchiseData.operatorAddress,
            plateNumber: franchiseData.mvPlateNo,
            platenumber: franchiseData.mvPlateNo,
            model: franchiseData.unitModel,
            vehicleModel: franchiseData.unitModel,
            resolutionNumber: franchiseData.resolutionNumber || franchiseData.sbResolutionNumber || 'N/A',
            resolution: franchiseData.resolutionNumber || franchiseData.sbResolutionNumber || 'N/A',
            dateApproved: franchiseData.dateApproved ? formatDate(franchiseData.dateApproved) : '',
            approvalDate: franchiseData.dateApproved ? formatDate(franchiseData.dateApproved) : '',
            dateIssued: franchiseData.dateApproved ? formatDate(franchiseData.dateApproved) : '',
            chassisNumber: franchiseData.chassisNumber || 'N/A',
            chassis: franchiseData.chassisNumber || 'N/A',
            engineNumber: franchiseData.engineNumber || 'N/A',
            engine: franchiseData.engineNumber || 'N/A',
            makeModel: franchiseData.makeModel || franchiseData.unitModel || 'N/A',
            make: franchiseData.makeModel || franchiseData.unitModel || 'N/A',
            manufacturer: franchiseData.makeModel || franchiseData.unitModel || 'N/A',
            
            // Administrative data
            generatedBy: franchiseData.generatedBy || 'Administrator',
            preparedBy: franchiseData.generatedBy || 'Administrator',
            issuedBy: franchiseData.generatedBy || 'Administrator',
            generatedByRole: franchiseData.generatedByRole || 'Municipal Administrator',
            position: franchiseData.generatedByRole || 'Municipal Administrator',
            designation: franchiseData.generatedByRole || 'Municipal Administrator',
            municipalityName: franchiseData.municipalityName || 'Municipality of Solano, Nueva Vizcaya',
            municipality: 'Municipality of Solano, Nueva Vizcaya',
            
            // Additional fields
            year: new Date().getFullYear().toString(),
            currentDate: formatDate(new Date())
        };
        
        let filledCount = 0;
        let failedCount = 0;
        
        // Iterate through all form fields and attempt to fill them
        fields.forEach(field => {
            const fieldName = field.getName();
            const fieldType = field.constructor.name;
            
            // Find matching value for this field
            const value = findMatchingField(fieldName, dataMap);
            
            if (value !== null && value !== undefined && value !== '') {
                try {
                    if (fieldType === 'PDFTextField') {
                        const textField = form.getTextField(fieldName);
                        textField.setText(String(value));
                        console.log(`[PDF Filler] ✓ Filled "${fieldName}" = "${value}"`);
                        filledCount++;
                    } else if (fieldType === 'PDFCheckBox' && typeof value === 'boolean') {
                        const checkBox = form.getCheckBox(fieldName);
                        if (value) {
                            checkBox.check();
                        } else {
                            checkBox.uncheck();
                        }
                        console.log(`[PDF Filler] ✓ Set checkbox "${fieldName}" = ${value}`);
                        filledCount++;
                    } else if (fieldType === 'PDFDropdown') {
                        const dropdown = form.getDropdown(fieldName);
                        dropdown.select(String(value));
                        console.log(`[PDF Filler] ✓ Selected dropdown "${fieldName}" = "${value}"`);
                        filledCount++;
                    }
                } catch (err) {
                    console.warn(`[PDF Filler] ✗ Failed to fill "${fieldName}":`, err.message);
                    failedCount++;
                }
            } else {
                console.log(`[PDF Filler] ○ No match found for field "${fieldName}"`);
            }
        });
        
        console.log(`[PDF Filler] Summary: ${filledCount} filled, ${failedCount} failed, ${fields.length - filledCount - failedCount} skipped`);
        
        // Flatten the form to prevent further editing
        form.flatten();
        
        // Return the filled PDF as bytes
        const pdfBytes = await pdfDoc.save();
        return pdfBytes;
        
    } catch (error) {
        console.error('[PDF Filler] Error:', error);
        throw error;
    }
}

/**
 * Format date consistently
 */
function formatDate(dateInput) {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

/**
 * Extract barangay from address string
 */
function extractBarangay(address) {
    if (!address) return '';
    const match = address.match(/(?:Brgy\.?|Barangay)\s+([^,]+)/i);
    return match ? match[1].trim() : '';
}

module.exports = {
    inspectPDFFields,
    fillPDFForm,
    findMatchingField
};
