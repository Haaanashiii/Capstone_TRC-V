import { PDFDocument, PDFTextField, PDFCheckBox, rgb, StandardFonts } from 'pdf-lib';
import logger from './logger';

/**
 * Get all field names from PDF for debugging
 * @param {ArrayBuffer} pdfBytes - The PDF bytes
 * @returns {Promise<Array>} - Array of field names
 */
export async function getPdfFieldNames() {
  try {
    const templateUrl = '/src/assets/MTOF - FILLABLE.pdf';
    const existingPdfBytes = await fetch(templateUrl).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    const fieldInfo = fields.map(field => ({
      name: field.getName(),
      type: field.constructor.name
    }));
    
    logger.log('[PDFFiller] PDF Field Names:', fieldInfo);
    return fieldInfo;
  } catch (error) {
    logger.error('[PDFFiller] Error reading PDF fields:', error);
    return [];
  }
}

/**
 * Fill PDF form fields with franchise application data
 * @param {Object} applicationData - The franchise application data
 * @returns {Promise<Uint8Array>} - The filled PDF as bytes
 */
export async function fillFranchiseApplicationPDF(applicationData) {
  try {
    // Load the blank PDF template
    const templateUrl = '/src/assets/MTOF - FILLABLE.pdf';
    const existingPdfBytes = await fetch(templateUrl).then(res => res.arrayBuffer());
    
    // Load PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Embed a standard font for consistent rendering
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Get the form from the PDF
    const form = pdfDoc.getForm();
    
    // Get all field names for debugging
    const fields = form.getFields();
    const fieldNames = fields.map(f => ({
      name: f.getName(),
      type: f.constructor.name
    }));
    
    logger.log('[PDFFiller] Available PDF fields:', fieldNames);
    logger.log('[PDFFiller] Application data:', applicationData);
    
    // Helper function to safely set checkbox field
    const setCheckBox = (possibleFieldNames, shouldCheck) => {
      const fieldNamesToTry = Array.isArray(possibleFieldNames) ? possibleFieldNames : [possibleFieldNames];
      
      for (const fieldName of fieldNamesToTry) {
        try {
          const field = form.getCheckBox(fieldName);
          if (field) {
            if (shouldCheck) {
              field.check();
              logger.log(`[PDFFiller] ✓ Checked checkbox "${fieldName}"`);
            } else {
              field.uncheck();
              logger.log(`[PDFFiller] ○ Unchecked checkbox "${fieldName}"`);
            }
            return true;
          }
        } catch (error) {
          // Try next field name or it might be a text field
          try {
            // Some PDFs use text fields for checkboxes - use simple X instead of ✓
            const textField = form.getTextField(fieldName);
            if (textField) {
              textField.setText(shouldCheck ? 'X' : '');
              // Don't update appearances for checkbox text fields to avoid encoding issues
              textField.setFontSize(12);
              logger.log(`[PDFFiller] ✓ Set text checkbox "${fieldName}" = "${shouldCheck ? 'X' : ''}"`);
              return true;
            }
          } catch (e) {
            continue;
          }
        }
      }
      logger.warn(`[PDFFiller] ✗ Could not find checkbox:`, fieldNamesToTry);
      return false;
    };
    
    // Helper function to safely set text field with optimal properties
    const setTextField = (possibleFieldNames, value, options = {}) => {
      if (!value && value !== 0) return;
      
      const fieldNamesToTry = Array.isArray(possibleFieldNames) ? possibleFieldNames : [possibleFieldNames];
      
      for (const fieldName of fieldNamesToTry) {
        try {
          const field = form.getTextField(fieldName);
          if (field) {
            const textValue = String(value).trim();
            
            // Set text first
            field.setText(textValue);
            
            // Set text size based on content length and field type - SMALLER SIZES to prevent cutoff
            let fontSize = options.fontSize;
            if (!fontSize) {
              if (textValue.length > 80) fontSize = 7;
              else if (textValue.length > 50) fontSize = 8;
              else if (textValue.length > 30) fontSize = 9;
              else fontSize = 10;
            }
            field.setFontSize(fontSize);
            
            // Enable multi-line for long text fields
            if (textValue.length > 35 || options.multiline) {
              field.enableMultiline();
            }
            
            // Set text alignment
            const alignment = options.alignment || 'left';
            if (alignment === 'center') {
              field.setAlignment(1); // 0=left, 1=center, 2=right
            } else if (alignment === 'right') {
              field.setAlignment(2);
            } else {
              field.setAlignment(0);
            }
            
            // Enable scrolling for overflow
            field.enableScrolling();
            
            // Set max length if specified
            if (options.maxLength) {
              field.setMaxLength(options.maxLength);
            }
            
            // Try to update appearances - skip if encoding issues
            try {
              field.updateAppearances(font);
            } catch (appearanceError) {
              logger.warn(`[PDFFiller] ⚠ Could not update appearance for "${fieldName}": ${appearanceError.message}`);
              // Field is still set, just without custom appearance
            }
            
            logger.log(`[PDFFiller] ✓ Set field "${fieldName}" = "${textValue}" (size: ${fontSize})`);
            return true;
          }
        } catch (error) {
          // Try next field name
          continue;
        }
      }
      logger.warn(`[PDFFiller] ✗ Could not find any of these fields:`, fieldNamesToTry);
      return false;
    };
    
    // Helper function to format date
    const formatDate = (dateValue) => {
      if (!dateValue) return '';
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return String(dateValue);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };
    
    // === APPLICATION TYPE CHECKBOXES ===
    const appType = (applicationData.applicationType || 'new').toLowerCase();
    
    // Check the appropriate application type checkbox
    setCheckBox(
      ['new', 'New', 'NEW', 'chk_new', 'checkbox_new', 'applicationType_new'], 
      appType === 'new'
    );
    
    setCheckBox(
      ['renewal', 'Renewal', 'RENEWAL', 'chk_renewal', 'checkbox_renewal', 'applicationType_renewal'], 
      appType === 'renewal'
    );
    
    setCheckBox(
      ['amendment', 'Amendment', 'AMENDMENT', 'chk_amendment', 'checkbox_amendment', 'applicationType_amendment', 'update_ownership', 'change_unit'], 
      appType === 'amendment' || appType === 'update_ownership' || appType === 'change_unit'
    );
    
    // Fill form fields with optimal configurations
    // Date field - shorter, centered
    setTextField(
      ['date', 'Date', 'DATE', 'applicationDate', 'Date_af_date'], 
      formatDate(applicationData.date || new Date()),
      { fontSize: 9, alignment: 'center' }
    );
    
    // Personal Information - Reduced font sizes to prevent cutoff
    setTextField(
      ['operatorName', 'name', 'Name', 'operator_name', 'NAME_OF_OPERATOR', 'nameOfOperator'], 
      applicationData.name || applicationData.operatorName,
      { fontSize: 9 }
    );
    
    setTextField(
      ['contact', 'contactNumber', 'Contact', 'CONTACT_NUMBER', 'contact_number', 'phoneNumber'], 
      applicationData.contactNumber || applicationData.contact,
      { fontSize: 9, maxLength: 15 }
    );
    
    setTextField(
      ['birthPlace', 'placeOfBirth', 'PLACE_OF_BIRTH', 'birth_place', 'PlaceOfBirth'], 
      applicationData.birthPlace,
      { fontSize: 8, multiline: true }
    );
    
    setTextField(
      ['birthDate', 'dateOfBirth', 'DATE_OF_BIRTH', 'birth_date', 'DateOfBirth'], 
      formatDate(applicationData.birthDate),
      { fontSize: 9, alignment: 'center' }
    );
    
    setTextField(
      ['civilStatus', 'CIVIL_STATUS', 'civil_status', 'CivilStatus'], 
      applicationData.civilStatus,
      { fontSize: 9 }
    );
    
    setTextField(
      ['citizenship', 'CITIZENSHIP', 'Citizenship'], 
      applicationData.citizenship,
      { fontSize: 9 }
    );
    
    setTextField(
      ['todaMembership', 'TODA_MEMBERSHIP', 'toda_membership', 'TODAMembership'], 
      applicationData.todaMembership,
      { fontSize: 8 }
    );
    
    // Address fields - smaller font and multiline for long addresses
    setTextField(
      ['operatorAddress', 'address', 'Address', 'OPERATOR_ADDRESS', 'operator_address'], 
      applicationData.address || applicationData.operatorAddress,
      { fontSize: 7, multiline: true }
    );
    
    setTextField(
      ['barangay', 'Barangay', 'BARANGAY'], 
      applicationData.barangay,
      { fontSize: 8 }
    );
    
    // Co-Owner Information - with multiline support
    if (applicationData.hasCoOwner === 'Yes' || applicationData.coOwnerName) {
      setTextField(
        ['coOwnerName', 'co_owner_name', 'CO_OWNER_NAME', 'CoOwnerName'], 
        applicationData.coOwnerName,
        { fontSize: 8 }
      );
      
      setTextField(
        ['coOwnerAddress', 'co_owner_address', 'CO_OWNER_ADDRESS', 'CoOwnerAddress'], 
        applicationData.coOwnerAddress,
        { fontSize: 7, multiline: true }
      );
    }
    
    // Driver Information
    setTextField(
      ['driverName', 'driver_name', 'DRIVER_NAME', 'DriverName', 'nameOfDriver'], 
      applicationData.driverName,
      { fontSize: 9 }
    );
    
    setTextField(
      ['driverAddress', 'driver_address', 'DRIVER_ADDRESS', 'DriverAddress', 'addressOfDriver'], 
      applicationData.driverAddress,
      { fontSize: 7, multiline: true }
    );
    
    // Motorcycle Information - Technical details with smaller fonts
    setTextField(
      ['unitModel', 'unit_model', 'UNIT_MODEL', 'UnitModel', 'model'], 
      applicationData.unitModel || applicationData.make,
      { fontSize: 8 }
    );
    
    setTextField(
      ['colorMotor', 'color_motor', 'COLOR_MOTOR', 'ColorMotor', 'motorColor'], 
      applicationData.colorMotor,
      { fontSize: 8 }
    );
    
    setTextField(
      ['colorSidecar', 'color_sidecar', 'COLOR_SIDECAR', 'ColorSidecar', 'sidecarColor'], 
      applicationData.colorSidecar,
      { fontSize: 8 }
    );
    
    setTextField(
      ['mvPlateNo', 'mvPlate', 'MV_PLATE', 'mv_plate', 'MVPlate', 'plateNumber'], 
      applicationData.mvPlate || applicationData.plateNumber || applicationData.mvPlateNo,
      { fontSize: 9, maxLength: 20 }
    );
    
    setTextField(
      ['motorEngineNumber', 'motor_engine_number', 'MOTOR_ENGINE_NUMBER', 'MotorEngineNumber', 'engineNumber'], 
      applicationData.motorEngineNumber,
      { fontSize: 7, maxLength: 30 }
    );
    
    setTextField(
      ['chassisNumber', 'chassis_number', 'CHASSIS_NUMBER', 'ChassisNumber'], 
      applicationData.chassisNumber,
      { fontSize: 7, maxLength: 30 }
    );
    
    setTextField(
      ['sidecarPlateNumber', 'sidecar_plate_number', 'SIDECAR_PLATE_NUMBER', 'SidecarPlateNumber'], 
      applicationData.sidecarPlateNumber,
      { fontSize: 8, maxLength: 20 }
    );
    
    // Email field if available
    setTextField(
      ['email', 'Email', 'EMAIL', 'operatorEmail', 'operator_email'], 
      applicationData.email || applicationData.operatorEmail,
      { fontSize: 7 }
    );
    
    // Additional fields that might be in the PDF
    setTextField(
      ['driversID', 'driver_id', 'DRIVER_ID', 'DriverID'], 
      applicationData.driversID,
      { fontSize: 8 }
    );
    
    setTextField(
      ['franchiseNumber', 'franchise_number', 'FRANCHISE_NUMBER', 'FranchiseNumber'], 
      applicationData.franchiseNumber,
      { fontSize: 9 }
    );
    
    setTextField(
      ['applicationType', 'application_type', 'APPLICATION_TYPE', 'ApplicationType'], 
      applicationData.applicationType,
      { fontSize: 8 }
    );
    
    // Don't flatten - keep fields editable for corrections
    // form.flatten();
    
    // Serialize the PDF to bytes
    const pdfBytes = await pdfDoc.save();
    
    logger.log('[PDFFiller] ✓ PDF filled successfully with optimized field properties');
    return pdfBytes;
    
  } catch (error) {
    logger.error('[PDFFiller] ✗ Error filling PDF:', error);
    throw error;
  }
}

/**
 * Download filled PDF
 * @param {Object} applicationData - The franchise application data
 * @param {string} filename - The filename for download
 */
export async function downloadFilledPDF(applicationData, filename = 'franchise-application.pdf') {
  try {
    const pdfBytes = await fillFranchiseApplicationPDF(applicationData);
    
    // Create blob and download
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
    
    logger.log('[PDFFiller] PDF downloaded successfully');
  } catch (error) {
    logger.error('[PDFFiller] Error downloading PDF:', error);
    throw error;
  }
}

/**
 * Preview filled PDF in new window
 * @param {Object} applicationData - The franchise application data
 * @returns {Promise<string>} - Blob URL for the PDF
 */
export async function previewFilledPDF(applicationData) {
  try {
    const pdfBytes = await fillFranchiseApplicationPDF(applicationData);
    
    // Create blob URL
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    logger.log('[PDFFiller] PDF preview URL created');
    return url;
    
  } catch (error) {
    logger.error('[PDFFiller] Error previewing PDF:', error);
    throw error;
  }
}
