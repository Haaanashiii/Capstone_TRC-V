const crypto = require('crypto');
const QRCode = require('qrcode');
const FranchiseInformation = require('../models/franchiseInformationModel');

// In-memory cache for hash -> franchiseNumber mapping
// Prevents full collection scan on every QR lookup
const hashCache = new Map();
const HASH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
let lastCacheRefresh = 0;

// Generate SHA-256 hashed franchise number (first 16 chars)
function generateHashedFranchiseNo(franchiseNo) {
  const hash = crypto.createHash('sha256').update(franchiseNo).digest('hex');
  return hash.substring(0, 16);
}

/**
 * Reverse lookup: Find franchise number from hash
 * Uses cached mapping to avoid full collection scan
 * @param {string} hashedMTOP - The 16-char hash from QR code
 * @returns {Promise<string|null>} - The original franchise number or null
 */
async function findFranchiseNumberByHash(hashedMTOP) {
  // Check if cache needs refresh
  const now = Date.now();
  if (now - lastCacheRefresh > HASH_CACHE_TTL || hashCache.size === 0) {
    await refreshHashCache();
  }
  
  return hashCache.get(hashedMTOP) || null;
}

/**
 * Refresh the hash -> franchiseNumber cache
 * Only fetches franchise numbers (minimal data) for efficiency
 */
async function refreshHashCache() {
  try {
    // Only fetch franchise numbers (very lightweight query)
    const franchises = await FranchiseInformation.find({ isCurrentVersion: true })
      .select('franchiseNumber')
      .lean();
    
    hashCache.clear();
    
    for (const f of franchises) {
      const hash = generateHashedFranchiseNo(f.franchiseNumber);
      hashCache.set(hash, f.franchiseNumber);
    }
    
    lastCacheRefresh = Date.now();
    console.log(`[HashCache] Refreshed with ${hashCache.size} entries`);
  } catch (error) {
    console.error('[HashCache] Refresh error:', error.message);
  }
}

/**
 * Invalidate hash cache (call when franchise numbers change)
 */
function invalidateHashCache() {
  lastCacheRefresh = 0;
}

// Generate QR code buffer for franchise verification
// Encodes a hashed franchise number (static)
// The hash stays the same regardless of owner changes
async function generateQRCodeBuffer(hashedFranchiseNo) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
  // QR code encodes hashed franchise number (e.g., "a1b2c3d4e5f6g7h8")
  // Scanner will use /api/qr/scan/{hashedFranchiseNo} endpoint
  // Backend will unhash and find current owner
  const verifyUrl = `${baseUrl}/verify/franchise/${hashedFranchiseNo}`;
  return await QRCode.toBuffer(verifyUrl, { type: 'image/png', width: 400 });
}

// Handle franchise version control - mark previous as non-current, calculate next version
// Session parameter is optional - works with or without transactions
async function handleVersionControl(franchiseNo, changeType, session = null) {
  const query = FranchiseInformation.findOne({
    franchiseNumber: franchiseNo,
    isCurrentVersion: true
  });
  
  // Only use session if provided (for replica set environments)
  const currentFranchise = session ? await query.session(session) : await query;

  if (changeType === 'new') {
    return { version: 1, previousVersion: null };
  }

  if (!currentFranchise) {
    throw new Error(`No current franchise found for: ${franchiseNo}`);
  }

  // Mark previous version as non-current
  const updateOptions = session ? { session } : {};
  await FranchiseInformation.findByIdAndUpdate(
    currentFranchise._id, 
    { isCurrentVersion: false },
    updateOptions
  );
  
  // Invalidate cache since franchise data changed
  invalidateHashCache();

  return {
    version: (currentFranchise.version || 1) + 1,
    previousVersion: currentFranchise._id
  };
}

// Validate franchise status for renewal/amendment operations
function validateFranchiseStatus(franchise, applicationType) {
  if (!franchise) return false;

  // Renewal: Allow only Active or Expired franchises
  if (applicationType === 'renewal') {
    return ['Active', 'Expired'].includes(franchise.franchiseStatus);
  }

  // Amendment (change_unit/update_ownership/amendment): Allow only Active franchises
  if (['change_unit', 'update_ownership', 'amendment', 'amend-change_unit', 'amend-update_ownership'].includes(applicationType)) {
    return franchise.franchiseStatus === 'Active';
  }

  return false;
}

module.exports = {
  generateHashedFranchiseNo,
  findFranchiseNumberByHash,
  refreshHashCache,
  invalidateHashCache,
  generateQRCodeBuffer,
  handleVersionControl,
  validateFranchiseStatus
};
