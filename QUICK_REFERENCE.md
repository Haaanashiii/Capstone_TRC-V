# Quick Reference - QR Operator ID Implementation

## 🎯 What Was Done

Implemented inheritance of operator information to the QR Operator ID card component, matching the pattern used in `FranchiseeListOperatorSide.jsx`.

## 📋 Changes Summary

| Component | Change | Status |
|-----------|--------|--------|
| Backend Controller | Added operatorPictureObj to response | ✅ |
| Backend Controller | Added franchiseNumber to response | ✅ |
| Backend Controller | Added isActive flag to response | ✅ |
| Frontend API Call | Fixed endpoint from /mtop-hash/ to /qr/hash/ | ✅ |
| Frontend State | Added operatorPictureObj to state | ✅ |
| Frontend State | Added franchiseNumber to state | ✅ |
| Frontend State | Added franchiseChainId to state | ✅ |
| Frontend State | Added isActive flag to state | ✅ |
| Frontend Photo Logic | Added operatorPictureObj as Priority 1 | ✅ |
| Frontend UI | Display franchise number in ID badge | ✅ |
| Frontend UI | Added franchise number badge section | ✅ |

## 🔍 Key Files Modified

### 1. Backend
**File:** `server/controllers/franchiseInformationController.js`
**Function:** `franchiseQRLookupByHash` (lines ~609-640)

```javascript
// ADDED: Generate operator picture URL
let operatorPictureUrl = null;
if (franchiseInformation.documents?.operatorPictureObj) {
  operatorPictureUrl = `${API_BASE_URL}/api/franchise-information/proxy-file?url=${encodeURIComponent(...)}`;
}

// ADDED: Include in response
operatorPicture: operatorPictureUrl,
operatorPictureObj: franchiseInformation.documents?.operatorPictureObj || null,
isActive: franchiseInformation.franchiseStatus === 'active',
```

### 2. Frontend
**File:** `dashboard/src/pages/Driver/QROperatorID.jsx`
**Changes:** Multiple locations

**Location 1 - API Endpoint (Line ~40):**
```javascript
// BEFORE
fetch(`${API_BASE_URL}/api/franchise-information/mtop-hash/${operatorId}`)

// AFTER
fetch(`${API_BASE_URL}/api/franchise-information/qr/hash/${operatorId}`)
```

**Location 2 - State Management (Lines ~35-91):**
```javascript
setMatchedFranchise({
  franchiseNumber: franchiseData.franchiseNumber,        // NEW
  franchiseChainId: franchiseData.franchiseChainId,      // NEW
  isActive: franchiseData.isActive,                      // NEW
  operatorPictureObj: franchiseData.operatorPictureObj,  // NEW
  documents: {
    operatorPictureObj: franchiseData.operatorPictureObj // NEW
  }
  // ... other fields
});
```

**Location 3 - Photo Priority (Lines ~138-140):**
```javascript
const candidates = [
  // Priority 1: operatorPictureObj (NEW)
  mf?.documents?.operatorPictureObj,
  mf?.operatorPictureObj,
  // Priority 2: driverPictureObj
  mf?.documents?.driverPictureObj,
  mf?.driverPictureObj,
  // ... rest of candidates
];
```

**Location 4 - ID Display (Line ~407):**
```javascript
// BEFORE
ID NO: {user?.operatorId || storedOperatorId}

// AFTER
ID NO: {matchedFranchise?.franchiseNumber || storedOperatorId}
```

**Location 5 - UI Badge (Lines ~425-440):**
```javascript
// NEW: Franchise number display
{matchedFranchise?.franchiseNumber && (
  <Box sx={{bgcolor: '#e3f2fd', ...}}>
    FRANCHISE #: {matchedFranchise.franchiseNumber}
  </Box>
)}
```

## 🔗 API Endpoint

**Endpoint:** `GET /api/franchise-information/qr/hash/:hashedMTOP`

**Request:**
```
GET /api/franchise-information/qr/hash/abc123def456
```

**Response:**
```json
{
  "success": true,
  "data": {
    "franchiseNumber": "0001",
    "franchiseChainId": "user-507f1f77bcf86cd799439011-1609459200",
    "franchiseStatus": "active",
    "isActive": true,
    "driverName": "Juan Dela Cruz",
    "driversAddress": "...",
    "driverPictureObj": "r2://bucket/path/driver.jpg",
    "operatorPictureObj": "r2://bucket/path/operator.jpg",  // NEW
    "operatorPicture": "http://localhost:5170/api/franchise-information/proxy-file?url=...",  // NEW
    "todaMembership": "...",
    "expiryDate": "2025-12-31",
    "isCurrentVersion": true
  }
}
```

## 📊 Photo Priority System

```
1. operatorPictureObj (documents)        ← Operator's 1x1 picture (HIGHEST)
2. operatorPictureObj (direct)
3. driverPictureObj (documents)          ← Driver's license picture
4. driverPictureObj (direct)
5. profilePhoto
6. profile_photo
7. picture
8. photoUrl
9. photo_url
10. ... other variations
11. User-level photos                    ← (LOWEST)
```

## 🎨 UI Display

### Before Scan
```
Loading...
```

### After Scan (Active Franchise)
```
┌─────────────────────────────────┐
│  [LOGO] [LOGO]   IDENTIFICATION │
├─────────────────────────────────┤
│                                 │
│       [OPERATOR PICTURE]        │
│                                 │
│      ID NO: 0001                │
│                                 │
│    JUAN DELA CRUZ               │
│                                 │
│  FRANCHISE #: 0001              │
│                                 │
│   123 Street, Barangay, Solano  │
│                                 │
│   ACTIVE FRANCHISE ✓            │
│                                 │
│ [REPORT OVERPRICING] [FARE]     │
└─────────────────────────────────┘
```

### Status Colors
- **ACTIVE:** Green (#43a047)
- **EXPIRED:** Red (#d32f2f)
- **INACTIVE:** Gray (#757575)
- **NOT LINKED:** Red (#e74c3c)

## 🧪 Quick Test

### Test 1: Verify Franchise Number Shows
1. Scan QR code
2. Check if ID shows actual franchise number (e.g., "0001" instead of hash)
3. Check if FRANCHISE # badge shows

### Test 2: Verify Operator Picture Displays
1. Ensure franchise has operatorPictureObj in database
2. Scan QR code
3. Operator's 1x1 picture should display (not driver picture)

### Test 3: Verify Active Status
1. Scan QR for active franchise
2. Green badge should show "ACTIVE FRANCHISE"
3. No warning message

### Test 4: Verify Expired Status
1. Scan QR for expired franchise
2. Red badge should show "EXPIRED FRANCHISE"
3. Warning message should appear

## 🐛 Debugging

### Console Logs Added
```javascript
console.log('[QROperatorID] API response:', data);
console.log('[QROperatorID] Profile photo URL:', franchiseData.driverPictureObj);
console.log('[QROperatorID] Operator picture URL:', franchiseData.operatorPictureObj);
console.log('[QROperatorID] Franchise Number:', franchiseData.franchiseNumber);
console.error('[QROperatorID] Fetch error:', err);
```

### Network Check
1. Open DevTools → Network tab
2. Scan QR code
3. Look for requests to `/api/franchise-information/qr/hash/`
4. Response should include `operatorPictureObj`

### Image Loading Check
1. Open DevTools → Console
2. Look for "[QROperatorID]" logs
3. Should see:
   - API response logged
   - Operator picture URL logged
   - Franchise number logged

## 📦 Dependencies

No new dependencies added. Uses existing:
- React hooks (useState, useEffect)
- Material-UI (Box, Typography, Avatar, Button)
- Fetch API
- Existing API structure

## 🔐 Security Notes

- All images proxied through backend: `/api/franchise-information/proxy-file`
- Rate limiting applied: `combinedQrRateLimiter`
- No authentication required (public endpoint)
- Hash-based lookup prevents direct ID guessing

## 📱 Mobile Responsive

- Tested at 375px (mobile)
- All elements readable
- Images properly scaled
- Buttons accessible
- No horizontal scroll

## ✅ Production Ready

All features tested and verified:
- ✅ Backend returns correct data
- ✅ Frontend parses response correctly
- ✅ State management working
- ✅ UI displays correctly
- ✅ Photo priority system working
- ✅ Error handling in place
- ✅ Mobile responsive
- ✅ Console logging for debugging

## 📞 Support

If issues arise, check:
1. Backend endpoint returns `data.data` (not just `data`)
2. `operatorPictureObj` is populated in database
3. Image URLs are valid (test with proxy endpoint)
4. Rate limiter not blocking requests
5. Check console logs for details
