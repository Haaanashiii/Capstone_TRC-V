# QR Operator ID Card - Before & After Comparison

## Visual Card Layout

### BEFORE
```
┌─────────────────────────────────┐
│  [SB Logo] [TRC-V Logo]   TEXT  │ ← Header
├─────────────────────────────────┤
│                                 │
│         [PHOTO PLACEHOLDER]     │
│                                 │
│     ┌─────────────────────┐     │
│     │ ID NO: 6b3b9a6ddb  │     │ ❌ Shows stored operatorId (hashed MTOP)
│     └─────────────────────┘     │
│                                 │
│      DRIVER NAME (uppercase)    │
│      Address line               │
│                                 │
│    ┌────────────────────────┐   │
│    │  FRANCHISE NOT LINKED  │   │ ⚠️ No franchise number shown
│    └────────────────────────┘   │ ⚠️ Cannot verify franchise
│                                 │
│  [REPORT OVERPRICING] [FARE]    │
└─────────────────────────────────┘
```

### AFTER
```
┌─────────────────────────────────┐
│  [SB Logo] [TRC-V Logo]   TEXT  │ ← Header
├─────────────────────────────────┤
│                                 │
│    [OPERATOR 1x1 PICTURE]       │ ✅ Operator picture (if available)
│                                 │
│     ┌─────────────────────┐     │
│     │ ID NO: 0001         │     │ ✅ Shows actual franchise number
│     └─────────────────────┘     │
│                                 │
│      DRIVER NAME (uppercase)    │
│    ┌──────────────────────┐     │
│    │ FRANCHISE #: 0001    │     │ ✨ NEW: Franchise number badge
│    └──────────────────────┘     │
│      Address line               │
│                                 │
│    ┌────────────────────────┐   │
│    │  ACTIVE FRANCHISE      │   │ ✅ Status verified
│    └────────────────────────┘   │ ✅ Shows franchise is active
│                                 │
│  [REPORT OVERPRICING] [FARE]    │
└─────────────────────────────────┘
```

## Data Inheritance Comparison

### Picture Inheritance

**BEFORE:**
```javascript
// Only checked basic fields
candidates = [
  profilePhoto,
  profile_photo,
  picture,
  photoUrl,
  // ... other variations
];
// ❌ operatorPictureObj was NOT included
```

**AFTER:**
```javascript
// Priority-based photo selection
candidates = [
  // Priority 1: Operator picture (highest)
  documents?.operatorPictureObj,      ✨ NEW
  operatorPictureObj,                 ✨ NEW
  
  // Priority 2: Driver picture
  documents?.driverPictureObj,
  driverPictureObj,
  
  // Priority 3-4: Other variations and user photos
  profilePhoto,
  // ... other variations
];
// ✅ operatorPictureObj now has highest priority
```

### State Management

**BEFORE:**
```javascript
setMatchedFranchise({
  address: data.address,
  expiryDate: '',
  status: data.franchiseStatus,
  statusColor: data.statusColor,
  notLinked: !data.linked,
  message: data.message,
  profilePhoto: data.profilePhoto
  // ❌ No franchiseNumber stored
  // ❌ No franchiseChainId stored
  // ❌ No operatorPictureObj stored
  // ❌ No isActive flag
});
```

**AFTER:**
```javascript
setMatchedFranchise({
  franchiseNumber: franchiseData.franchiseNumber,    ✨ NEW
  franchiseChainId: franchiseData.franchiseChainId,  ✨ NEW
  address: franchiseData.driversAddress,
  expiryDate: franchiseData.expiryDate || '',
  status: franchiseData.franchiseStatus,
  isActive: franchiseData.isActive,                  ✨ NEW
  notLinked: !franchiseData.franchiseNumber,
  message: !franchiseData.franchiseNumber ? 'Franchise not linked' : '',
  profilePhoto: franchiseData.driverPictureObj,
  driverPictureObj: franchiseData.driverPictureObj,
  operatorPictureObj: franchiseData.operatorPictureObj,  ✨ NEW
  documents: {
    driverPictureObj: franchiseData.driverPictureObj,
    operatorPictureObj: franchiseData.operatorPictureObj  ✨ NEW
  }
});
```

## API Endpoint Changes

**BEFORE:**
```
GET /api/franchise-information/mtop-hash/{operatorId}
    ❌ Endpoint doesn't exist
    ❌ Returns incomplete data
    ❌ Cannot verify franchise status
```

**AFTER:**
```
GET /api/franchise-information/qr/hash/{operatorId}
    ✅ Correct endpoint (exists in routes)
    ✅ Returns complete franchise data
    ✅ Includes operatorPictureObj
    ✅ Includes franchiseNumber
    ✅ Includes isActive flag
    ✅ Includes franchiseStatus
```

## Response Structure

**BEFORE:**
```javascript
{
  error: "...",
  name: "driver name",
  mtopNumber: "...",
  address: "...",
  franchiseStatus: "...",
  profilePhoto: "...",
  linked: true
}
// ❌ Incomplete, inconsistent structure
```

**AFTER:**
```javascript
{
  success: true,
  data: {
    franchiseNumber: "0001",              ✨ NEW
    franchiseChainId: "...",              ✨ NEW
    franchiseVersion: 1,
    franchiseStatus: "active",
    driverName: "Juan Dela Cruz",
    driversAddress: "...",
    driverPicture: "...",
    driverPictureObj: "r2://path/to/pic",
    operatorPicture: "...",               ✨ NEW
    operatorPictureObj: "r2://path/pic",  ✨ NEW
    todaMembership: "...",
    isCurrentVersion: true,
    isActive: true,                       ✨ NEW
    expiryDate: "2025-12-31"
  }
}
// ✅ Complete, consistent structure
```

## UI Display Changes

### ID Number Badge

**BEFORE:**
```
ID NO: 6b3b9a6ddb739ea6
(Shows hashed MTOP - not useful for verification)
```

**AFTER:**
```
ID NO: 0001
(Shows actual franchise number - matches tricycle documents)
```

### Franchise Information

**BEFORE:**
```
(No franchise number displayed)
(Cannot verify which franchise this QR belongs to)
```

**AFTER:**
```
┌────────────────────────┐
│ FRANCHISE #: 0001      │
└────────────────────────┘
(Clear franchise identification)
```

### Photo Display

**BEFORE:**
```
[Photo Priority]
1. profilePhoto
2. Various other paths
❌ Never checks operatorPictureObj
Result: Wrong person displayed
```

**AFTER:**
```
[Photo Priority]
1. operatorPictureObj          ✨ Operator's 1x1 pic
2. driverPictureObj            
3. Other franchise photos
4. User photos
Result: Correct person displayed
```

## Status Verification

**BEFORE:**
```
Status Display:
- ACTIVE FRANCHISE (green)
- EXPIRED FRANCHISE (red)
- INACTIVE FRANCHISE (gray)
- FRANCHISE NOT LINKED (red)

❌ Cannot quickly check if active
❌ No isActive flag available
```

**AFTER:**
```
Status Display:
- ACTIVE FRANCHISE (green)
- EXPIRED FRANCHISE (red)
- INACTIVE FRANCHISE (gray)
- FRANCHISE NOT LINKED (red)

✅ Can quickly check with isActive flag
✅ Frontend has both franchiseStatus and isActive
✅ Better for logic decisions
```

## Data Consistency

**BEFORE:**
```javascript
// Inconsistent with other components
// Different field names and structure
// FranchiseeListOperatorSide uses different approach
```

**AFTER:**
```javascript
// Consistent with FranchiseeListOperatorSide.jsx
// Uses same priority logic for photo selection
// Uses same state structure for documents
// Follows established patterns in codebase
```

## Security & Performance

### Image Loading

**BEFORE:**
```javascript
// Direct image access
const url = getProfilePhotoUrl();
// Potential CORS issues with R2
// No proxy
```

**AFTER:**
```javascript
// Proxied through backend
const url = `${API_BASE_URL}/api/franchise-information/proxy-file?url=${encodeURIComponent(path)}`;
// Secure, CORS-safe
// Backend validates request
// Rate limited
```

## Console Logging for Debugging

**NEW:** Three debug logs added:
```javascript
console.log('[QROperatorID] Profile photo URL:', franchiseData.driverPictureObj);
console.log('[QROperatorID] Operator picture URL:', franchiseData.operatorPictureObj);
console.log('[QROperatorID] Franchise Number:', franchiseData.franchiseNumber);
```

## Summary Table

| Feature | Before | After |
|---------|--------|-------|
| API Endpoint | mtop-hash | qr/hash ✅ |
| Franchise Number Display | ❌ | ✅ |
| Operator Picture | ❌ | ✅ |
| franchiseNumber Field | ❌ | ✅ |
| franchiseChainId Field | ❌ | ✅ |
| isActive Flag | ❌ | ✅ |
| operatorPictureObj | ❌ | ✅ |
| Photo Priority System | Basic | Advanced ✅ |
| Data Structure | Inconsistent | Consistent ✅ |
| Error Handling | Basic | Enhanced ✅ |
| Debug Logging | Minimal | Enhanced ✅ |

## Benefits

1. **Better Identification** - Shows actual franchise number, not hash
2. **Correct Picture** - Operator's 1x1 picture displayed (if available)
3. **Franchise Tracking** - Can verify which franchise is being scanned
4. **Status Verification** - Clear active/inactive status
5. **Code Consistency** - Follows patterns used in other components
6. **Better Debugging** - Console logs show what data was received
7. **Security** - All images proxied through backend
8. **Reliability** - Proper error handling and fallbacks
