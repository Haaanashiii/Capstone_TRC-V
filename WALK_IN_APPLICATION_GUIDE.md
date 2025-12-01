# Walk-In Franchise Application Guide

## Overview
The walk-in franchise application feature allows BPLO and SB admins to submit franchise applications on behalf of operators who visit the office in person. This ensures that operators without online access can still apply for franchises.

## Key Features

### 1. **Admin-Submitted Applications**
- When an admin clicks "Add New Franchise," they can enter the applicant's information
- The system marks the application as `isWalkIn: true` in the database
- The application goes through the same approval workflow as online applications

### 2. **OR (Official Receipt) Entry During Submission**
- Admins can optionally enter the OR number during walk-in submission
- Admins can upload the OR document if the applicant provides it
- If OR is not provided during walk-in, the applicant can submit it later

### 3. **Email/Phone Notifications**
- The system automatically sends a notification to the applicant via:
  - **Email** (if `operatorEmail` is provided) - Primary method
  - **SMS** (if `operatorContactNumber` is provided) - Backup or primary if no email
- Notification includes:
  - Confirmation of application submission
  - OR number (if provided)
  - Current status
  - Next steps

### 4. **Franchise Number Linking**
- **Important:** The franchise number is NOT assigned during walk-in submission
- The franchise number is generated when:
  - The SB admin approves the application with a resolution number
  - The application is accepted and moved to the Franchise List
- This ensures the franchise number is only created after all approvals are complete

## Workflow

### Walk-In Application Process

```
1. Operator visits office (walk-in)
   ↓
2. Admin opens "Add New Franchise" modal
   ↓
3. Admin enters operator details:
   - Name, contact number, email
   - Address, barangay, birth info
   - Vehicle details (MV plate, engine, chassis)
   - Driver information
   ↓
4. Admin uploads required documents
   ↓
5. [OPTIONAL] Admin enters OR number and uploads OR document
   ↓
6. Admin clicks "Submit Walk-in Application"
   ↓
7. Backend processes:
   - Saves application with isWalkIn=true
   - Uploads documents to Cloudflare
   - Sends notification to operator (email/SMS)
   ↓
8. Application enters normal approval workflow:
   - BPLO Review → Approve/Disapprove
   - Operator submits OR (if not done during walk-in)
   - SB Review → Final Approval with Resolution
   ↓
9. SB Admin accepts application
   ↓
10. Franchise number is generated and linked
    ↓
11. Franchise is active in the system
```

## Technical Implementation

### Frontend Changes (`FranchiseMgmt.jsx`)

#### 1. **Form State**
```javascript
const [formData, setFormData] = useState({
  // ... existing fields ...
  
  // Walk-in specific fields
  officialReceiptNumber: '',
  documentOfficialReceipt: null,
});
```

#### 2. **Form UI**
- Added OR number input field (optional)
- Added OR document upload field (optional)
- Updated submit button text to "Submit Walk-in Application"
- Added informational text about walk-in process

#### 3. **Submission Logic**
```javascript
// Mark as walk-in application
formDataToSend.append('isWalkIn', 'true');

// Add OR number if provided
if (formData.officialReceiptNumber?.trim()) {
  formDataToSend.append('officialReceiptNumber', formData.officialReceiptNumber.trim());
  formDataToSend.append('orSubmittedAt', new Date().toISOString());
}

// Add OR document if provided
if (formData.documentOfficialReceipt?.file) {
  formDataToSend.append('oRTreasurerOfficeObj', formData.documentOfficialReceipt.file);
}
```

### Backend Changes

#### 1. **Database Model** (`franchiseApplicationModel.js`)
```javascript
isWalkIn: { type: Boolean, default: false }, // True if submitted by admin on behalf of operator
```

#### 2. **Controller** (`franchiseApplicationController.js`)
```javascript
// Accept walk-in flag and OR data
applicationData = {
  // ... existing fields ...
  isWalkIn: body.isWalkIn === 'true' || body.isWalkIn === true,
  officialReceiptNumber: body.officialReceiptNumber || '',
  orSubmittedAt: body.orSubmittedAt ? new Date(body.orSubmittedAt) : null
};

// Upload OR document if provided
uploadHelper('oRTreasurerOfficeObj', 'Documentations')

// Send notification after creation
if (finalApplication.isWalkIn) {
  await sendWalkInApplicationNotification(finalApplication);
}
```

#### 3. **Notification Service** (`notificationQueueService.js`)
```javascript
async function sendWalkInApplicationNotification(application) {
  // Try email first
  if (operatorEmail) {
    await emailService.sendEmail(operatorEmail, subject, text);
  }
  
  // Send SMS as backup or primary
  if (operatorContactNumber) {
    await smsService.sendSMS(operatorContactNumber, message);
  }
}
```

## Best Practices

### For Admins

1. **Verify Applicant Information**
   - Double-check spelling of names
   - Confirm email and phone number accuracy
   - Verify vehicle details match documents

2. **Document Upload**
   - Ensure all required documents are uploaded
   - Check document quality and readability
   - Upload OR document if applicant provides it

3. **OR Entry**
   - Enter OR number if applicant has already paid
   - Upload OR document for record-keeping
   - If no OR yet, inform applicant to submit later

4. **Communication**
   - Inform applicant they will receive notification
   - Explain next steps in the approval process
   - Provide contact information for follow-up

### For System Administrators

1. **Email/SMS Configuration**
   - Ensure email service is properly configured
   - Verify SMS service credentials are active
   - Monitor notification delivery rates

2. **File Storage**
   - Verify Cloudflare storage is working
   - Check file upload size limits
   - Monitor storage usage

3. **Database**
   - Ensure `isWalkIn` field is properly indexed
   - Monitor application creation rates
   - Back up database regularly

## Troubleshooting

### Issue: Notification not sent
**Solution:** Check:
- Email/phone number is valid and properly formatted
- Email service credentials are configured
- SMS service is active and has credits
- Check server logs for notification errors

### Issue: OR document not uploading
**Solution:** Check:
- File size is under 5MB
- File format is accepted (JPG, PNG, PDF)
- Cloudflare credentials are valid
- Check server logs for upload errors

### Issue: Franchise number not assigned
**Solution:** 
- This is expected! Franchise number is only assigned after SB approval
- Walk-in applications follow the same approval workflow
- Franchise number is generated when SB admin accepts the application

## Security Considerations

1. **Admin-Only Access**
   - Only BPLO and SB admins can submit walk-in applications
   - Regular users cannot access this feature
   - Role-based access control enforced

2. **Data Validation**
   - All input fields are validated on backend
   - File uploads are scanned and validated
   - OR number format is checked

3. **Audit Trail**
   - All walk-in applications are logged
   - Admin who submitted is recorded
   - Notification delivery is tracked

## Future Enhancements

1. **Bulk Walk-in Submission**
   - Allow admins to submit multiple applications at once
   - CSV import functionality

2. **Walk-in Dashboard**
   - Separate view for walk-in applications
   - Statistics on walk-in vs online submissions

3. **QR Code Generation**
   - Generate QR code during walk-in submission
   - Applicant can scan to track application status

4. **SMS Confirmation Code**
   - Send confirmation code via SMS
   - Applicant can use code to track application online

## Support

For issues or questions:
- Check server logs: `server/logs/`
- Review notification queue: `/api/notifications/stats`
- Contact system administrator

---

**Last Updated:** December 1, 2025
**Version:** 1.0.0
