const franchiseInformationRepository = require('../repositories/franchiseInformationRepository');
const { generateOperatorQRCode, deleteQRCode } = require('../services/qrCodeService');
const { getFileFromR2 } = require('../services/cloudflareService');
const { getClientIp } = require('../utils/ipHelper');
const { generateHashedFranchiseNo } = require('../utils/franchiseHelpers');



// ========================================
// READ FRANCHISES
// ========================================

/**
 * GET /franchise-information
 * Get all franchises grouped by franchiseChainId, showing only the LATEST version per chain
 * 
 * Features:
 * - Returns the most recent version of each franchise chain (highest version number)
 * - Groups by franchiseChainId to ensure one franchise per chain
 * - Emits to WebSocket rooms 'bplo-admins' and 'sb-admins' for real-time updates
 * - Populated with linked user and previous version info
 * - Sorted by franchiseNumber for consistent ordering
 * 
 * Used by: Admin dashboards, franchise management pages
 */
exports.getAllFranchiseInformation = async (req, res, next) => {
  try {
    const FranchiseInformation = require('../models/franchiseInformationModel');
    
    // Get all franchises sorted by franchiseChainId and version (descending)
    // This allows us to group by chain and take the first (latest) version
    const allFranchises = await FranchiseInformation.find()
      .populate('linkedUser', 'username email')
      .populate('previousVersion', 'version changeType changedAt')
      .sort({ franchiseChainId: 1, version: -1 });
    
    // Group by franchiseChainId and keep only the latest version per chain
    const franchiseMap = new Map();
    for (const franchise of allFranchises) {
      const chainId = franchise.franchiseChainId;
      
      // Only add if we haven't seen this chain yet (first one is the latest due to sorting)
      if (!franchiseMap.has(chainId)) {
        franchiseMap.set(chainId, franchise);
      }
    }
    
    // Convert map to array and sort by franchiseNumber
    const franchises = Array.from(franchiseMap.values())
      .sort((a, b) => {
        const numA = parseInt(a.franchiseNumber.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.franchiseNumber.match(/\d+/)?.[0] || 0);
        return numA - numB;
      });
    
    // Emit to WebSocket for real-time updates to admin dashboards
    if (req.app.get('io')) {
      req.app.get('io').to('bplo-admins').emit('franchises-list-updated', {
        count: franchises.length,
        timestamp: new Date().toISOString()
      });
      req.app.get('io').to('sb-admins').emit('franchises-list-updated', {
        count: franchises.length,
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      count: franchises.length,
      data: franchises 
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /franchise-information/search?q=...
 * Search franchises by name, franchise number, OR franchise chain ID
 * 
 * Smart Search Logic:
 * - Pure letters (A-Z, spaces) → Search by operator name (case-insensitive)
 *   Returns: ALL VERSIONS of matching franchises (including revoked/previous)
 * - Contains numbers (4-digit) → Search by franchise number (all matching numbers)
 *   Returns: ALL VERSIONS of each matching franchise number (all owners)
 * - Contains "user-" prefix → Search by franchiseChainId (specific owner)
 *   Returns: ALL VERSIONS of that specific chain (revoked or active)
 * 
 * CRITICAL DIFFERENCE:
 * - Franchise Number: Can be reused when revoked + 3 years expired
 *   Example: #0001 (User A, revoked) → #0001 (User B, active)
 * - Franchise Chain: Tied to ONE user forever, never reused
 *   Example: "user-123-1609459200" = User 123's franchise chain
 * 
 * Examples:
 * - /search?q=Juan → All versions of Juan's franchises (current and past)
 * - /search?q=0001 → All versions of franchise #0001 (all owners who had it)
 * - /search?q=user-123-1609459200 → All versions of User 123's franchise chain
 */
exports.searchFranchiseInformation = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Search query is required',
        message: 'Provide ?q=searchTerm in the URL' 
      });
    }
    
    const searchTerm = q.trim();
    const FranchiseInformation = require('../models/franchiseInformationModel');
    
    // Determine search type based on query content
    const isChainId = searchTerm.startsWith('user-');
    const hasNumbers = /\d/.test(searchTerm);
    const isPureLetters = /^[a-zA-Z\s]+$/.test(searchTerm);
    
    let franchises = [];
    let searchType = '';
    
    if (isChainId) {
      // Search by FRANCHISE CHAIN ID (specific owner)
      // Returns ALL versions (active, revoked, everything)
      searchType = 'chainId';
      franchises = await FranchiseInformation.find({
        franchiseChainId: searchTerm
      })
      .populate('linkedUser', 'username email _id')
      .populate('previousVersion', 'version changeType changedAt franchiseStatus')
      .sort({ version: 1 }); // Chronological order
      
    } else if (isPureLetters) {
      // Search by OPERATOR NAME (case-insensitive, partial match)
      // Returns ALL versions (including revoked/previous franchises)
      searchType = 'name';
      franchises = await FranchiseInformation.find({
        operatorName: { $regex: searchTerm, $options: 'i' }
      })
      .populate('linkedUser', 'username email _id')
      .populate('previousVersion', 'version changeType changedAt franchiseStatus')
      .sort({ franchiseNumber: 1, version: -1 }); // Sort by number, then by version (latest first)
      
    } else if (hasNumbers) {
      // Search by FRANCHISE NUMBER (exact or partial match)
      // Returns ALL versions (including revoked/recycled numbers with different owners)
      searchType = 'franchiseNumber';
      franchises = await FranchiseInformation.find({
        franchiseNumber: { $regex: searchTerm, $options: 'i' }
      })
      .populate('linkedUser', 'username email _id')
      .populate('previousVersion', 'version changeType changedAt franchiseStatus')
      .sort({ franchiseNumber: 1, franchiseChainId: 1, version: -1 }); // Sort by number, chain, version
      
    } else {
      return res.status(400).json({
        error: 'Invalid search query',
        message: 'Search by: name (letters), franchise number (digits), or chain ID (user-xxx-xxx)'
      });
    }
    
    return res.status(200).json({
      success: true,
      searchType: searchType,
      query: searchTerm,
      count: franchises.length,
      note: searchType === 'chainId' 
        ? 'Returns ALL versions of this franchise chain (revoked or active). Chain belongs to ONE user only.'
        : searchType === 'franchiseNumber'
        ? 'Returns ALL versions of this franchise number (may include different owners if number was recycled).'
        : 'Returns ALL versions (current and previous) of matching franchises.',
      data: franchises
    });
    
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /franchise-information/history/:franchiseNumber
 * Get FULL HISTORY of a specific franchise number (ALL OWNERS)
 * 
 * Purpose: View all versions of a franchise number across all owners
 * Shows complete lineage when franchise number was reused
 * Params: franchiseNumber (4-digit number like "0001", "1234", etc.)
 * 
 * Returns:
 * - All versions of this franchise number (current and previous owners)
 * - Sorted chronologically (oldest to newest)
 * - Includes revoked franchises (important when number was recycled to new owner)
 * 
 * Example:
 * - Franchise #0001 had 3 versions under User A (now revoked)
 * - Then #0001 was recycled to User B (1 version, active)
 * - This endpoint returns ALL 4 versions grouped by owner
 */
exports.getFranchiseHistory = async (req, res, next) => {
  try {
    const { franchiseNumber } = req.params;
    
    if (!franchiseNumber || franchiseNumber.trim().length === 0) {
      return res.status(400).json({ 
        error: 'franchiseNumber param is required',
        message: 'Provide a 4-digit franchise number (e.g., 0001, 1234)' 
      });
    }
    
    const FranchiseInformation = require('../models/franchiseInformationModel');
    
    // Fetch ALL versions of this franchise number (all owners, all statuses)
    const franchiseHistory = await FranchiseInformation.find({
      franchiseNumber: franchiseNumber.trim()
    })
      .populate('linkedUser', 'username email _id')
      .populate('previousVersion', 'version changeType changedAt franchiseStatus')
      .sort({ changedAt: 1 }); // Chronological order (oldest first)
    
    if (!franchiseHistory || franchiseHistory.length === 0) {
      return res.status(404).json({ 
        error: 'Franchise not found',
        message: `No franchise found with number: ${franchiseNumber}` 
      });
    }
    
    // Group by franchiseChainId to show ownership changes
    const chainMap = new Map();
    for (const franchise of franchiseHistory) {
      if (!chainMap.has(franchise.franchiseChainId)) {
        chainMap.set(franchise.franchiseChainId, []);
      }
      chainMap.get(franchise.franchiseChainId).push(franchise);
    }
    
    return res.status(200).json({ 
      success: true,
      franchiseNumber: franchiseNumber.trim(),
      totalVersions: franchiseHistory.length,
      uniqueOwners: chainMap.size,
      ownershipHistory: Array.from(chainMap.entries()).map(([chainId, franchises]) => ({
        franchiseChainId: chainId,
        owner: franchises[0].linkedUser,
        versions: franchises.length,
        currentStatus: franchises[franchises.length - 1].franchiseStatus,
        franchises: franchises
      })),
      allVersions: franchiseHistory 
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /franchise-information/chain/:franchiseChainId
 * Get all versions of a SPECIFIC FRANCHISE CHAIN (ONE OWNER)
 * 
 * Purpose: View complete lifecycle of one operator's franchise
 * Tied to specific user/operator (not recyclable like franchise number)
 * Shows ALL versions: active, renewed, amended, and if revoked
 * Params: franchiseChainId (format: "user-${userId}-${timestamp}")
 * 
 * Returns:
 * - All versions of this specific franchise chain
 * - Sorted chronologically (oldest to newest)
 * - Includes revoked franchises (shows full lifecycle)
 * - CRITICAL: Each chain belongs to ONE user only
 * 
 * Example:
 * - User A's franchise chain: "user-507f1f77bcf86cd799439011-1609459200"
 * - Shows all versions from creation → renewals → amendments → expiry → revoke
 */
exports.getFranchiseChainHistory = async (req, res, next) => {
  try {
    const { franchiseChainId } = req.params;
    
    if (!franchiseChainId || franchiseChainId.trim().length === 0) {
      return res.status(400).json({ 
        error: 'franchiseChainId param is required',
        message: 'Provide a franchise chain ID (e.g., user-507f1f77bcf86cd799439011-1609459200)' 
      });
    }
    
    const FranchiseInformation = require('../models/franchiseInformationModel');
    
    // Fetch all versions of this franchise chain (ONE user only)
    const chainHistory = await FranchiseInformation.find({
      franchiseChainId: franchiseChainId.trim()
    })
      .populate('linkedUser', 'username email _id')
      .populate('previousVersion', 'version changeType changedAt franchiseStatus')
      .sort({ version: 1 }); // Chronological by version
    
    if (!chainHistory || chainHistory.length === 0) {
      return res.status(404).json({ 
        error: 'Franchise chain not found',
        message: `No franchise chain found with ID: ${franchiseChainId}. This chain may have been revoked.` 
      });
    }
    
    const latestVersion = chainHistory[chainHistory.length - 1];
    
    return res.status(200).json({ 
      success: true,
      franchiseChainId: franchiseChainId.trim(),
      linkedUser: latestVersion.linkedUser,
      franchiseNumber: latestVersion.franchiseNumber,
      currentStatus: latestVersion.franchiseStatus,
      totalVersions: chainHistory.length,
      isActive: latestVersion.franchiseStatus === 'Active',
      isRevoked: latestVersion.franchiseStatus === 'Revoked',
      data: chainHistory 
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /franchise-information/:id
 * Get specific franchise by MongoDB _id (any version)
 * 
 * Purpose: View detailed franchise information including version history
 * Returns: Single franchise with populated references
 */
exports.getFranchiseInformation = async (req, res, next) => {
  try {
    if (!req.params?.id) {
      return res.status(400).json({ error: 'id param is required' });
    }
    
    const FranchiseInformation = require('../models/franchiseInformationModel');
    const franchiseInformation = await FranchiseInformation.findById(req.params.id)
      .populate('linkedUser', 'username email')
      .populate('previousVersion', 'version changeType changedAt franchiseStatus');
    
    if (!franchiseInformation) {
      return res.status(404).json({ error: 'Franchise information not found' });
    }
    
    return res.status(200).json({ 
      success: true, 
      data: franchiseInformation 
    });
  } catch (error) {
    if (error?.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid id format' });
    }
    return next(error);
  }
};


/**
 * GET /franchise-information/available-numbers
 * OPTIMIZED: Get available franchise numbers for new applications
 * 
 * Algorithm Complexity: O(n) - Single pass through franchises
 * 
 * Business Rules:
 * 1. Active franchises = UNAVAILABLE
 * 2. Revoked franchises expired for 3+ years = AVAILABLE (can be reused)
 * 3. All other statuses = UNAVAILABLE
 * 4. Finds gaps in sequence efficiently using HashMap
 * 5. Returns next available number or latest + 1
 * 
 * Optimization:
 * - Uses Map for O(1) lookup instead of nested loops
 * - Groups by franchiseChainId to ensure one franchise per chain
 * - Single pass through franchises O(n)
 * - Gap detection in O(n) instead of O(n²)
 */
exports.getAvailableFranchiseNumbers = async (req, res, next) => {
  try {
    const FranchiseInformation = require('../models/franchiseInformationModel');

    // Fetch all franchises sorted to get latest version per chain
    const allFranchises = await FranchiseInformation.find({
      isCurrentVersion: true
    })
      .select('franchiseChainId franchiseNumber franchiseStatus expiryDate') // Required fields
      .lean()
      .sort({ franchiseChainId: 1, version: -1 }) // Group by chain, latest first
      .exec();

    // Group by franchiseChainId and keep only the latest version per chain
    const chainMap = new Map();
    for (const franchise of allFranchises) {
      if (!chainMap.has(franchise.franchiseChainId)) {
        chainMap.set(franchise.franchiseChainId, franchise);
      }
    }

    // Now process only the latest versions
    const allCurrentFranchises = Array.from(chainMap.values());

    const now = new Date();
    const threeYearsAgo = new Date(now);
    threeYearsAgo.setFullYear(now.getFullYear() - 3);

    // Store data efficiently
    const franchiseMap = new Map();
    let latestNumber = 0;
    let activeCount = 0;
    let revokedAvailableCount = 0;
    let revokedUnavailableCount = 0;

    // Process data in one loop
    for (const franchise of allCurrentFranchises) {
      // Extract only the digits (DB must store values like "0012", "1104"...)
      const numberMatch = franchise.franchiseNumber.match(/^(\d{1,4})$/); 
      if (!numberMatch) continue; // Skip invalid formats

      const franchiseNum = parseInt(numberMatch[1], 10);
      latestNumber = Math.max(latestNumber, franchiseNum);

      const isRevoked = franchise.franchiseStatus === 'revoked';
      const isExpired3Years =
        franchise.expiryDate && new Date(franchise.expiryDate) <= threeYearsAgo;

      // Franchise becomes available for reuse after 3 years of being revoked
      const isAvailable = isRevoked && isExpired3Years;

      franchiseMap.set(franchiseNum, {
        fullNumber: franchise.franchiseNumber,
        status: franchise.franchiseStatus,
        available: isAvailable
      });

      // Counters
      if (franchise.franchiseStatus === 'active') {
        activeCount++;
      } else if (isRevoked) {
        if (isAvailable) revokedAvailableCount++;
        else revokedUnavailableCount++;
      }
    }

    // Find gaps (numbers never used or available for reuse)
    const availableNumbers = [];
    for (let i = 1; i <= latestNumber; i++) {
      const franchise = franchiseMap.get(i);

      if (!franchise) {
        availableNumbers.push(String(i).padStart(4, '0')); // gap
      } else if (franchise.available) {
        availableNumbers.push(String(i).padStart(4, '0')); // reusable
      }
    }

    // Next available franchise number
    const nextNum = latestNumber + 1;
    const nextFranchiseNumber = String(nextNum).padStart(4, '0');

    // LIMIT DISPLAY FOR FRONTEND (faster UI)
    const displayLimit = 100;
    const displayedAvailable = availableNumbers.slice(0, displayLimit);

    // Respond
    return res.status(200).json({
      success: true,
      data: {
        availableNumbers: displayedAvailable,
        hasMore: availableNumbers.length > displayLimit,
        totalAvailable: availableNumbers.length,
        nextNumber: nextFranchiseNumber,
        recommendation:
          availableNumbers.length > 0
            ? `${availableNumbers.length} available number${availableNumbers.length > 1 ? 's' : ''} (showing first ${Math.min(displayLimit, availableNumbers.length)})`
            : `Use next number: ${nextFranchiseNumber}`,
        statistics: {
          totalFranchises: allCurrentFranchises.length,
          totalActive: activeCount,
          totalRevoked: revokedAvailableCount + revokedUnavailableCount,
          revokedAvailable: revokedAvailableCount,
          revokedUnavailable: revokedUnavailableCount,
          gaps: availableNumbers.length - revokedAvailableCount,
          latestNumber: latestNumber,
          nextNumber: nextNum
        }
      }
    });

  } catch (error) {
    console.error('[getAvailableFranchiseNumbers] Error:', error);
    return next(error);
  }
};





// ========================================
// QR CODE LOOKUP - DRIVER VERIFICATION
// ========================================


/**
 * GET /franchise-information/qr/hash/:hashedMTOP
 * QR code verification endpoint - returns DRIVER details from LATEST franchise version
 * 
 * Purpose: Verify tricycle via QR code scan
 * PUBLIC - Rate limited, returns driver info for verification
 * 
 * Logic:
 * 1. Hash is computed from franchiseNumber (4-digit: "0001", "1234", etc.)
 * 2. Finds franchise matching the hash
 * 3. Returns LATEST VERSION of that franchise chain
 * 4. Shows driver info + franchise status
 * 
 * Returns: Driver name, picture, address, TODA membership, franchise status
 */
exports.franchiseQRLookupByHash = async (req, res, next) => {
  try {
    const { hashedMTOP } = req.params;
    
    if (!hashedMTOP) {
      return res.status(400).json({ error: 'Invalid QR code' });
    }
    
    // Fetch all current version franchises
    const FranchiseInformation = require('../models/franchiseInformationModel');
    const allCurrentFranchises = await FranchiseInformation.find({ 
      isCurrentVersion: true 
    })
    .sort({ franchiseChainId: 1, version: -1 }); // Group by chain, latest first
    
    // Find the franchise whose hashed franchise number matches
    let franchiseInformation = null;
    for (const franchise of allCurrentFranchises) {
      const computedHash = generateHashedFranchiseNo(franchise.franchiseNumber);
      if (computedHash === hashedMTOP) {
        franchiseInformation = franchise;
        break;
      }
    }
    
    if (!franchiseInformation) {
      return res.status(404).json({ 
        error: 'Franchise not found',
        message: 'This QR code is invalid or the franchise has been revoked' 
      });
    }
    
    // Log QR scan for audit trail
    const ipAddress = getClientIp(req);
    console.log(`[QR SCAN] Hashed: ${hashedMTOP}, Franchise#: ${franchiseInformation.franchiseNumber}, Driver: ${franchiseInformation.driverName}, Status: ${franchiseInformation.franchiseStatus}, ChainID: ${franchiseInformation.franchiseChainId}, Version: ${franchiseInformation.version}, IP: ${ipAddress}, Time: ${new Date().toISOString()}`);
    
    // Get driver picture URL (with proxy for CORS bypass)
    let driverPictureUrl = null;
    if (franchiseInformation.documents?.driverPictureObj) {
      const API_BASE_URL = process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || '';
      driverPictureUrl = `${API_BASE_URL.replace(/\/$/, '')}/api/franchise-information/proxy-file?url=${encodeURIComponent(franchiseInformation.documents.driverPictureObj)}`;
    }
    
    // Return DRIVER-focused public information for QR code verification
    const publicData = {
      // Franchise Identification (for verification)
      franchiseNumber: franchiseInformation.franchiseNumber,
      franchiseChainId: franchiseInformation.franchiseChainId,
      franchiseVersion: franchiseInformation.version,
      franchiseStatus: franchiseInformation.franchiseStatus,
      
      // Driver Information (PRIMARY)
      driversID: franchiseInformation.driversID,
      driverName: franchiseInformation.driverName,
      driversAddress: franchiseInformation.driversAddress,
      driverPicture: driverPictureUrl,
      driverPictureObj: franchiseInformation.documents?.driverPictureObj || null,
      
      // Membership & Registration
      todaMembership: franchiseInformation.todaMembership,
      
      // Activity Status
      isCurrentVersion: franchiseInformation.isCurrentVersion,
      expiryDate: franchiseInformation.expiryDate
    };
    
    return res.status(200).json({ 
      success: true, 
      data: publicData 
    });
  } catch (error) {
    console.error('[QR SCAN ERROR]', error);
    return next(error);
  }
};



// ========================================
// FILE PROXY - CORS BYPASS
// ========================================

/**
 * GET /franchise-information/proxy-file?url=...
 * Proxy Cloudflare R2 files to bypass CORS restrictions
 * PUBLIC - Used for driver pictures in QR verification
 */
exports.proxyCloudflareFile = async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });
    
    const key = url.startsWith('r2://') ? url.substring(5) : url;
    const { buffer, contentType } = await getFileFromR2(key);
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

