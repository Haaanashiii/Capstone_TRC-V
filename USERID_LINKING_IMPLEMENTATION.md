# User ID-Based Franchise Linking Implementation

## Overview
This document explains how the DriverID page is now properly linked to franchise applications using the JWT token's userId field.

## How It Works

### 1. JWT Token Structure
When a user logs in, the JWT token contains:
```javascript
{
  id: user.userId,          // UUID - primary identifier
  _id: user._id.toString(), // MongoDB _id - for backward compatibility
  role: user.role,
  name: user.name,
  accountType: 'user' or 'admin',
  hasFranchise: boolean,
  franchiseStatus: 'active' or 'inactive'
}
```

### 2. Database Schema Updates

#### FranchiseApplication Model
- Added `userId` field (String, indexed) to link franchise applications to users
- Added optional fields: `franchiseNumber`, `orNumber`, `expiryDate`, `qrCode`
- Index on `userId` for faster queries

### 3. Backend API Changes

#### Repository Layer (`franchiseApplicationRepository.js`)
- **New Method**: `findByUserId(userId)` - Find franchise application by userId field

#### Controller Layer (`franchiseApplicationController.js`)

**New Helper Function**: `normalizeApplicationResponse(application)`
- Centralizes response normalization
- Maps all field aliases (e.g., `chasisNo` → `chassisNumber`)
- Returns consistent structure to frontend

**Updated**: `getMyFranchiseApplication` endpoint (`/api/franchise-applications/mine`)
- **Priority 1**: Look up by `userId` from JWT token (most reliable)
- **Priority 2**: Fallback to email/driversID matching (for legacy data)
- Returns normalized response with all fields needed by frontend

**Updated**: `getCurrentUser` endpoint (`/auth/me`)
- Added vehicle information fields to franchise object:
  - `unitModel`, `colorMotor`, `sidecarColor`
  - `sidecarPlateNumber`, `mvPlateNo`, `plateNumber`
  - `motorEngineNo`, `chasisNo`, `chassisNumber`
  - `orNumber`, `franchiseNumber`

### 4. Frontend Changes (`DriverID.jsx`)

#### Data Flow
1. User logs in → JWT token stored in `sessionStorage`
2. DriverID page loads → Checks `hasFranchise` flag in token
3. If no franchise → Redirect to franchise page
4. If has franchise → Fetch data via `/api/franchise-applications/mine`
5. Backend uses `userId` from token to find franchise application
6. Frontend populates all fields from normalized response

#### Updated Field Mapping
```javascript
{
  orNumber: matched.orNumber || matched.franchiseNumber,
  franchiseNumber: matched.franchiseNumber || matched.orNumber,
  dateApproved: dayjs(matched.approvedAt),
  expiryDate: dayjs(matched.expiryDate),
  make: matched.unitModel || matched.make,
  sidecarNumber: matched.sidecarPlateNumber,
  plateNumber: matched.plateNumber || matched.mvPlateNo,
  chassisNumber: matched.chassisNumber || matched.chasisNo,
  motorNumber: matched.motorEngineNumber || matched.motorEngineNo
}
```

## Security & Data Integrity

### Profile Picture
- **NOT MODIFIED** - Profile picture loading logic remains unchanged
- Uses existing blob URL and proxy mechanism for R2/Cloudflare images
- Continues to work with matchedFranchise and user-level photo fields

### Session Storage
- JWT token stored in `sessionStorage` (auto-cleared on tab close)
- Franchise info cached in `sessionStorage` for performance
- `franchiseOwnerUserId` prevents cross-user data leakage

### Fallback Mechanism
If userId lookup fails (legacy data without userId):
1. Try email matching (case-insensitive)
2. Try driversID matching
3. Try franchiseNumber matching
4. Return 404 if no match found

## Benefits

1. **Accurate Linking**: Uses unique userId instead of fuzzy email/name matching
2. **Better Performance**: Indexed userId field enables fast lookups
3. **Future-Proof**: All new franchise applications automatically include userId
4. **Backward Compatible**: Fallback to email/driversID for existing data
5. **Consistent Data**: Normalized response structure eliminates field alias confusion

## Testing Checklist

- [ ] New franchise application creates with userId from JWT
- [ ] DriverID page loads franchise data via userId
- [ ] Profile picture still displays correctly (unchanged)
- [ ] All vehicle fields populate correctly (OR number, plate, chassis, motor)
- [ ] Date fields parse and display properly (approved date, expiry date)
- [ ] Legacy franchise applications (without userId) still accessible via email fallback
- [ ] QR code displays from franchise.qrCode field
- [ ] Session storage properly isolates data per user

## API Endpoints

### GET `/api/franchise-applications/mine`
**Authentication**: Required (JWT in Authorization header)
**Returns**: Normalized franchise application for authenticated user

```json
{
  "id": "mongodb_id",
  "userId": "uuid",
  "franchiseNumber": "FRAN-001",
  "orNumber": "OR-12345",
  "operatorName": "John Doe",
  "operatorEmail": "john@example.com",
  "approvedAt": "2024-01-15T00:00:00.000Z",
  "expiryDate": "2027-01-15T00:00:00.000Z",
  "unitModel": "Honda TMX 155",
  "plateNumber": "ABC-1234",
  "sidecarPlateNumber": "SC-5678",
  "chassisNumber": "CH123456",
  "motorEngineNumber": "ME789012",
  "qrCode": "r2://path/to/qr.png",
  "documents": { ... }
}
```

### GET `/auth/me`
**Authentication**: Required (JWT in Authorization header)
**Returns**: Complete user profile including franchise info

## Notes

- The `userId` field in franchise applications should be populated during approval process
- When creating new franchise applications, ensure `userId` is extracted from `req.user.id`
- Profile picture logic was deliberately not modified to preserve working functionality
