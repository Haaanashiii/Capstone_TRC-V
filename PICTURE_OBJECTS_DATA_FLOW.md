# operatorPictureObj & driverPictureObj - Data Flow & Inheritance

## Overview
Both `operatorPictureObj` and `driverPictureObj` are stored as **Cloudflare R2 URLs** (strings) in the database and flow through the system in a multi-stage process.

---

## 1. **Frontend Data Collection** (`FranchiseApplication.jsx`)

### Upload Points:
```javascript
// Line 1218-1227: Sending to backend
formDataToSend.append('driverPictureObj', uploads.picture);
formDataToSend.append('operatorPictureObj', fields.operatorPicture);
```

### State Management:
```javascript
// Line 372-376: Fields state
const [fields, setFields] = useState({
  operatorPicture: null,     // File object during editing
  driverPicture: null,       // File object during editing
  // ... other fields
});

// Line 397-401: Uploads state  
const [uploads, setUploads] = useState({
  picture: null,             // Driver picture upload via modal
  // ... other documents
});
```

### Pre-submission Handling (Lines 194-195):
When resubmitting a disapproved application, existing pictures are loaded:
```javascript
driverPicture: app.documents.driverPictureObj || null,
operatorPicture: app.documents.operatorPictureObj || null,
```

---

## 2. **Backend - Middleware Setup** (`server/middlewares/upload.js`)

### File Field Definitions (Lines 92, 94):
```javascript
const franchiseAppFields = [
  // ... other fields
  { name: 'driverPictureObj', maxCount: 1 },    // Line 92
  // ... other fields
  { name: 'operatorPictureObj', maxCount: 1 },  // Line 94
];
```

These are processed by `multer` before reaching the controller.

---

## 3. **Backend - Database Models**

### FranchiseApplication Model (`server/models/franchiseApplicationModel.js`)
```javascript
// Lines 12-13: DocumentReferenceSchema
const DocumentReferenceSchema = new mongoose.Schema({
  operatorPictureObj: { type: String, required: false },  // Line 13
  driverPictureObj: { type: String, required: false },    // Line 12
  // ... other document fields
});

// Main schema includes documents
documents: {
  type: DocumentReferenceSchema,
  default: {}
}
```

### FranchiseInformation Model (`server/models/franchiseInformationModel.js`)
```javascript
// Lines 11-12: DocumentReferenceSchema (INHERITED from application)
const DocumentReferenceSchema = new mongoose.Schema({
  operatorPictureObj: { type: String, required: false },  // Line 11
  driverPictureObj: { type: String, required: false },    // Line 12
  // ... other document fields
});

// Main schema includes documents
documents: {
  type: DocumentReferenceSchema,
  default: {}
}
```

**Key Note**: Both models use the **same DocumentReferenceSchema**, so picture data structure is consistent.

---

## 4. **Backend - Controller Upload Pipeline** 

### franchiseApplicationController.js

#### **Create/Update Flow (Lines 115-135)**:

```javascript
// Line 115: All files are uploaded in parallel
const [motorReg, barangay, cedula, license, affidavit, stencil, driverPic, operatorPic, orLTO, crLTO] = await Promise.all([
  uploadHelper('motorRegistrationObj', 'Documentations'),
  uploadHelper('barangayClearanceObj', 'Documentations'),
  uploadHelper('cedulaObj', 'Documentations'),
  uploadHelper('driversLicenseObj', 'Documentations'),
  uploadHelper('votersAffidavitObj', 'Documentations'),
  uploadHelper('motorChassisStencilObj', 'Documentations'),
  uploadHelper('driverPictureObj', 'ProfilePictures'),      // Line 121
  uploadHelper('operatorPictureObj', 'ProfilePictures'),    // Line 122
  uploadHelper('oRLTOObj', 'Documentations'),
  uploadHelper('cRLTOObj', 'Documentations')
]);

// Lines 127-135: Store Cloudflare URLs in updateData object
const updateData = {};
if (motorReg) updateData['documents.motorRegistrationObj'] = motorReg;
// ... other documents
if (driverPic) updateData['documents.driverPictureObj'] = driverPic;        // Line 134
if (operatorPic) updateData['documents.operatorPictureObj'] = operatorPic;  // Line 135

// Line 137: Save to FranchiseApplication database
if (Object.keys(updateData).length > 0) {
  await franchiseApplicationRepository.updateFranchiseApplication(appId, updateData);
}
```

**uploadHelper Function**:
- Extracts file from `req.files[fieldName]`
- Uploads to Cloudflare R2
- Returns **R2 URL as a string** (not file path)
- Returns `null` if file not provided

---

## 5. **Data Inheritance: Application → Information**

When an application is **approved**, pictures are inherited in this flow:

### FranchiseInformationController (Lines 614-628):

```javascript
// When creating FranchiseInformation from approved FranchiseApplication
if (franchiseInformation.documents?.operatorPictureObj) {
  operatorPictureUrl = `${API_BASE_URL.replace(/\/$/, '')}/api/franchise-information/proxy-file?url=${encodeURIComponent(franchiseInformation.documents.operatorPictureObj)}`;
}

// Response includes both original and proxy URLs
{
  operatorPictureObj: franchiseInformation.documents?.operatorPictureObj || null,  // R2 URL
  driverPictureObj: franchiseInformation.documents?.driverPictureObj || null,      // R2 URL
  // ... other fields
}
```

---

## 6. **Frontend - Data Consumption**

### QROperatorID.jsx (Lines 71-89):

```javascript
// Picture data from franchise information
const qrData = {
  profilePhoto: franchiseData.operatorPictureObj,    // Line 71 - R2 URL
  operatorPictureObj: franchiseData.operatorPictureObj  // Line 72 - R2 URL
};

// Used for QR code generation
console.log('[QROperatorID] Operator picture URL:', franchiseData.operatorPictureObj);
```

### QRCodeController.js (Line 66):

```javascript
// Backend retrieves picture URL from latest franchise
{
  pictureUrl: latestFranchise.documents?.driverPictureObj || null  // R2 URL
}
```

---

## 7. **Complete Data Flow Diagram**

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (FranchiseApplication.jsx)            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  User uploads files:                                                │
│  - fields.operatorPicture (File object)                            │
│  - uploads.picture / fields.driverPicture (File object)            │
│                                                                       │
│  FormData created with:                                             │
│  - 'operatorPictureObj': fields.operatorPicture                    │
│  - 'driverPictureObj': uploads.picture OR fields.driverPicture     │
│                                                                       │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│            BACKEND - Middleware (upload.js)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Multer processes:                                                  │
│  - 'operatorPictureObj' → req.files['operatorPictureObj']          │
│  - 'driverPictureObj' → req.files['driverPictureObj']              │
│                                                                       │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│     BACKEND - Controller (franchiseApplicationController.js)        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  uploadHelper() processes each file:                                │
│  - Extracts file from req.files                                    │
│  - Uploads to Cloudflare R2                                        │
│  - Returns R2 URL (string)                                         │
│                                                                       │
│  Result:                                                            │
│  - driverPic = "https://r2-bucket.../file123.jpg"                 │
│  - operatorPic = "https://r2-bucket.../file456.jpg"               │
│                                                                       │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND - Database (FranchiseApplication Model)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  documents: {                                                       │
│    operatorPictureObj: "https://r2-bucket.../file456.jpg" (String)│
│    driverPictureObj: "https://r2-bucket.../file123.jpg" (String) │
│  }                                                                  │
│                                                                       │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼ (On Application Approval)
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND - Database (FranchiseInformation Model)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  documents: {                                                       │
│    operatorPictureObj: "https://r2-bucket.../file456.jpg" (String)│
│    driverPictureObj: "https://r2-bucket.../file123.jpg" (String) │
│  }  ◄─── INHERITED from FranchiseApplication                      │
│                                                                       │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│              FRONTEND - QROperatorID.jsx                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  franchiseData.operatorPictureObj                                  │
│  → Used for QR code generation                                     │
│  → Displayed in ID card                                            │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. **Key Points Summary**

| Aspect | Details |
|--------|---------|
| **Data Type** | String (Cloudflare R2 URL) |
| **Storage Location** | `documents.operatorPictureObj` and `documents.driverPictureObj` |
| **Collection Points** | FranchiseApplication form (frontend) |
| **Processing** | Uploaded via FormData → Cloudflare R2 via uploadHelper() |
| **Models** | Same DocumentReferenceSchema in both Application & Information |
| **Inheritance** | Application → Information on approval |
| **Frontend Consumption** | QROperatorID.jsx, QR Code generation, ID card display |
| **Backend Consumption** | QRCodeController, franchiseInformationController |
| **File Size** | Compressed before upload (~300KB max) |
| **Access** | Via R2 direct URL or proxy endpoint |

---

## 9. **File Locations Reference**

| File | Purpose | Picture Fields |
|------|---------|-----------------|
| `dashboard/src/pages/Driver/FranchiseApplication.jsx` | Upload form | Collects and sends |
| `server/middlewares/upload.js` | Multer config | Accepts fields |
| `server/models/franchiseApplicationModel.js` | Schema definition | Stores as String |
| `server/models/franchiseInformationModel.js` | Schema definition | Stores as String |
| `server/controllers/franchiseApplicationController.js` | Upload & store | Processes with uploadHelper() |
| `server/controllers/franchiseInformationController.js` | Retrieval & usage | Returns URLs |
| `server/controllers/qrCodeController.js` | QR generation | Uses driverPictureObj |
| `dashboard/src/pages/Driver/QROperatorID.jsx` | Display | Uses operatorPictureObj |
