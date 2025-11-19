# Profile Photo Implementation - FranchiseInformation Integration

## Overview
The DriverID page now properly fetches profile photos from the **FranchiseInformation** database using the established MongoDB relationships and best practices.

## Profile Photo Source Priority

1. **FranchiseInformation.profilePhoto** (Primary - via `User.franchiseInfo` reference)
2. **FranchiseApplication.documents.picture** (Fallback)
3. **User.profilePicture** (Last resort)

## Implementation Details

### Backend Changes

#### Controller: `franchiseApplicationController.js`

**Updated `normalizeApplicationResponse()`**
- Added `profilePhoto` field to response
- Pulls from `it.profilePhoto` or `it.documents.picture`

**Updated `getMyFranchiseApplication()`**
```javascript
// After finding franchise application by userId:
// 1. Fetch User document and populate franchiseInfo reference
const userDoc = await User.findOne({ userId: user.id }).populate('franchiseInfo');

// 2. Extract profilePhoto from FranchiseInformation
if (userDoc && userDoc.franchiseInfo && userDoc.franchiseInfo.profilePhoto) {
    normalized.profilePhoto = userDoc.franchiseInfo.profilePhoto;
}
```

This approach:
- ✅ Uses proper MongoDB relationships (populate)
- ✅ Fetches from FranchiseInformation (authoritative source)
- ✅ Follows repository pattern
- ✅ Works for both userId lookup and fallback paths

#### Controller: `authController.js`

**`getCurrentUser()` already implements this correctly**
```javascript
user = await User.findOne({ userId: req.user.id }).populate('franchiseInfo');

// Returns user.franchise.profilePhoto from FranchiseInformation
userInfo.franchise = {
    profilePhoto: user.franchiseInfo.profilePhoto,
    // ... other fields
};
```

### Frontend Changes

#### DriverID.jsx

**Updated `pickCandidate()` priority**
```javascript
const candidates = [
  // Priority 1: FranchiseInformation (via /auth/me)
  user?.franchise?.profilePhoto,
  
  // Priority 2: FranchiseInformation (via /mine)
  matchedFranchise?.profilePhoto,
  
  // Priority 3: FranchiseApplication documents
  matchedFranchise?.documents?.picture,
  
  // Priority 4: User-level fallback
  user?.profilePicture
];
```

**Updated Avatar src**
```javascript
<Avatar
  src={
    idBlobUrl ||
    resolveServerUrl(
      user?.franchise?.profilePhoto ||           // From /auth/me
      matchedFranchise?.profilePhoto ||          // From /mine
      matchedFranchise?.documents?.picture ||    // Fallback
      user?.profilePicture ||                    // Last resort
      '/public/Logos/clipboard.gif'
    )
  }
/>
```

## Data Flow Diagram

```
Login
  ↓
JWT Token (contains userId)
  ↓
DriverID Page
  ↓
┌─────────────────────────────────────┐
│ Fetch /auth/me                      │
│ → User.findOne({ userId })          │
│ → .populate('franchiseInfo')        │
│ → Returns user.franchise.profilePhoto│
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ Fetch /api/franchise-applications/mine│
│ → Find application by userId         │
│ → Fetch User.franchiseInfo          │
│ → Merge profilePhoto into response  │
│ → Returns matchedFranchise.profilePhoto│
└─────────────────────────────────────┘
  ↓
Display profile photo
  (Priority: user.franchise > matched.profilePhoto > documents.picture)
```

## Database Relationships

```
User Collection
├── userId: "uuid-1234"
└── franchiseInfo: ObjectId("abc123") ──┐
                                        │
FranchiseInformation Collection         │
├── _id: ObjectId("abc123") ◄───────────┘
├── profilePhoto: "r2://operators/uuid/profile.jpg" ⭐
├── qrCode: "r2://operators/uuid/qr.png"
├── operatorId: "OP-001"
└── ... (vehicle details)

FranchiseApplication Collection
├── userId: "uuid-1234"
└── documents
    └── picture: "r2://path/picture.jpg" (fallback)
```

## Best Practices Followed

1. ✅ **Use MongoDB Relationships** - `.populate('franchiseInfo')` instead of manual lookups
2. ✅ **Single Source of Truth** - FranchiseInformation is authoritative
3. ✅ **Repository Pattern** - Data access through repositories
4. ✅ **Fallback Strategy** - Graceful degradation to FranchiseApplication
5. ✅ **Separation of Concerns** - Normalize response in helper function
6. ✅ **Consistent Priority** - Frontend matches backend data priority

## Testing

### Backend
```bash
# Test /auth/me returns profilePhoto
curl -H "Authorization: Bearer <token>" http://localhost:5170/auth/me

# Expected: user.franchise.profilePhoto exists

# Test /mine returns profilePhoto
curl -H "Authorization: Bearer <token>" http://localhost:5170/api/franchise-applications/mine

# Expected: profilePhoto field in response
```

### Frontend
Check browser console for:
```
[DriverID] pickCandidate selected string path from r2://operators/...
[DriverID] candidate rawPath -> r2://... resolved -> http://localhost:5170/api/...
```

## Summary

The implementation now correctly:
- Fetches profile photos from **FranchiseInformation** database
- Uses existing models and controllers properly
- Follows MongoDB relationship best practices (populate)
- Maintains proper fallback hierarchy
- Keeps code maintainable and consistent
