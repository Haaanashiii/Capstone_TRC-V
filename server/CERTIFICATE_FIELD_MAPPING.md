# Certificate Generation System - Field Mapping Guide

## Overview
The certificate generation system automatically fills PDF forms with franchise data. This document maps database fields to PDF form fields.

## Database Schema Fields (from franchiseInformationModel.js)

### Core Franchise Information
- `franchiseNumber` - Franchise identification number
- `sessionNumber` - SB session number (used as resolution number)
- `operatorName` - Operator's full name
- `operatorAddress` - Complete address
- `operatorBarangay` - Barangay name
- `operatorContactNumber` - Contact number

### Vehicle Information
- `unitModel` - Tricycle unit model
- `mvPlateNo` - Motor vehicle plate number
- `motorEngineNo` - Engine number ⚠️ (database field name)
- `chasisNo` - Chassis number ⚠️ (typo in schema, but this is the actual field)
- `colorMotor` - Motor color
- `sideCarColor` - Sidecar color
- `sideCarPlateNumber` - Sidecar plate

### Approval Information
- `approvedAt` - Date when franchise was approved
- `expiryDate` - Franchise expiry date
- `franchiseStatus` - Active, Expired, or Revoked

## PDF Form Fields

### Certificate of Approval (C.001 - CERT APPROVED - FILLABLE.pdf)
Total Fields: 12

1. `operatorName` ← operatorName
2. `barangay` ← operatorBarangay
3. `sbApprovedAt` ← approvedAt (formatted)
4. `sbResolutionNumber` ← sessionNumber
5. `unitModel` ← unitModel
6. `motorEngineNo` ← motorEngineNo
7. `chasisNo` ← chasisNo
8. `mvPlateNo` ← mvPlateNo
9. `operatorName_2` ← operatorName (duplicate)
10. `dateGenerated` ← current date
11. `dateGenerated_2` ← current date (duplicate)
12. `officialReceipNumber` ← officialReceiptNumber (if available)

### Certificate of Cancellation (C.001 - CERT CANCELLED - FILLABLE.pdf)
Total Fields: 9

1. `operatorName` ← operatorName
2. `barangay` ← operatorBarangay
3. `officialReceiptNumber` ← officialReceiptNumber
4. `unitModel` ← unitModel
5. `motorEngineNo` ← motorEngineNo
6. `chasisNo` ← chasisNo
7. `mvPlateNo` ← mvPlateNo
8. `operatorName_2` ← operatorName (duplicate)
9. `dateGenerated` ← current date

### Certificate of Existing Franchise (F.008 - CERT EXISTING - FILLABLE.pdf)
Total Fields: 11

1. `operatorName` ← operatorName
2. `operatorName_2` ← operatorName (duplicate)
3. `unitModel` ← unitModel
4. `motorEngineNo` ← motorEngineNo
5. `chasisNo` ← chasisNo
6. `mvPlateNo` ← mvPlateNo
7. `sbApprovedAt` ← approvedAt (formatted)
8. `user.name` ← generatedBy (administrator name)
9. `dateGenerated` ← current date
10. `franchiseNumber` ← franchiseNumber
11. `operatorAddress` ← operatorAddress

## Important Notes

### Field Name Discrepancies
⚠️ **Database uses `motorEngineNo`, NOT `engineNumber`**
⚠️ **Database uses `chasisNo`, NOT `chassisNumber`** (typo in original schema)

### Session Number vs Resolution Number
- The database stores `sessionNumber` from SB approval
- PDFs use field name `sbResolutionNumber`
- System maps: `sessionNumber` → `sbResolutionNumber`

### Date Formatting
All dates are formatted as: `Month Day, Year` (e.g., "January 15, 2025")

### Barangay Extraction
If `operatorBarangay` is not available, the system can extract it from `operatorAddress` using pattern matching for "Brgy." or "Barangay".

## Testing

Run the PDF field inspector:
```bash
node inspectPDFTemplates.js
```

Test PDF generation with sample data:
```bash
node testPDFGeneration.js
```

Generated test PDFs will be saved to `uploads/` folder.

## Troubleshooting

### Issue: Fields showing "N/A" or blank
**Cause**: Franchise data missing required fields
**Solution**: 
1. Check database record has the fields
2. Verify field names match database schema
3. Use inspector script to see what PDF expects: `node inspectPDFTemplates.js`

### Issue: PDF not downloading
**Cause**: Server endpoint not accessible
**Solution**: 
1. Ensure server is running on correct port
2. Check `API_BASE_URL` in frontend environment
3. Verify authentication token is valid

### Issue: Some fields filled, others not
**Cause**: Field name mismatch between database and PDF
**Solution**: 
1. Run `node inspectPDFTemplates.js` to see exact PDF field names
2. Check `pdfFieldMapper.js` dataMap for correct mappings
3. Ensure franchise query includes all needed fields

## API Endpoints

### Generate Certificate
`POST /api/reports/generate-certificate`

**Payload:**
```json
{
  "certificateType": "C.001-APPROVAL",
  "franchiseData": {
    "franchiseNumber": "FR-2025-001",
    "operatorName": "Juan Dela Cruz",
    "operatorBarangay": "Poblacion",
    "motorEngineNo": "ENG123456789",
    "chasisNo": "CHS987654321",
    ...
  },
  "format": "pdf",
  "generatedBy": "Administrator",
  "generatedDate": "2025-11-25T00:00:00.000Z"
}
```

### Inspect PDF Template (Debug)
`GET /api/reports/inspect-pdf-template/:templateName`

Template names: `approval`, `cancellation`, `existing`

Returns all form field names and types in the PDF template.
