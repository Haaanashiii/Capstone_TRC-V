const franchiseInformationRepository = require('../repositories/franchiseInformationRepository');
const { generateOperatorQRCode, deleteQRCode } = require('../services/qrCodeService');
const { getFileFromR2 } = require('../services/cloudflareService');
const { getClientIp } = require('../utils/ipHelper');
const { generateHashedFranchiseNo } = require('../utils/franchiseHelpers');



// ========================================
// READ FRANCHISES
// ========================================

// Get all franchises (latest version per owner, real-time updates)
exports.getAllFranchiseInformation = async (req, res, next) => {
  try {
    const FranchiseInformation = require('../models/franchiseInformationModel');
    
    // Get all franchises and group by owner, keep latest version per owner
    const allFranchises = await FranchiseInformation.find()
      .populate('linkedUser', 'username email')
      .populate('previousVersion', 'version changeType changedAt')
      .sort({ franchiseChainId: 1, version: -1 });
    
    const franchiseMap = new Map();
    for (const franchise of allFranchises) {
      const chainId = franchise.franchiseChainId;
      if (!franchiseMap.has(chainId)) {
        franchiseMap.set(chainId, franchise);
      }
    }
    
    // Sort by franchise number
    const franchises = Array.from(franchiseMap.values())
      .sort((a, b) => {
        const numA = parseInt(a.franchiseNumber.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.franchiseNumber.match(/\d+/)?.[0] || 0);
        return numA - numB;
      });
    
    // Notify admins about updated franchise list
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

// Search franchises by name, number, or owner chain ID
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
    
    // Detect search type: owner chain, operator name, or franchise number
    const isChainId = searchTerm.startsWith('user-');
    const hasNumbers = /\d/.test(searchTerm);
    const isPureLetters = /^[a-zA-Z\s]+$/.test(searchTerm);
    
    let franchises = [];
    let searchType = '';
    
    if (isChainId) {
      // Search by owner chain ID
      searchType = 'chainId';
      franchises = await FranchiseInformation.find({
        franchiseChainId: searchTerm
      })
      .populate('linkedUser', 'username email _id')
      .populate('previousVersion', 'version changeType changedAt franchiseStatus')
      .sort({ version: 1 });
      
    } else if (isPureLetters) {
      // Search by operator name
      searchType = 'name';
      franchises = await FranchiseInformation.find({
        operatorName: { $regex: searchTerm, $options: 'i' }
      })
      .populate('linkedUser', 'username email _id')
      .populate('previousVersion', 'version changeType changedAt franchiseStatus')
      .sort({ franchiseNumber: 1, version: -1 });
      
    } else if (hasNumbers) {
      // Search by franchise number
      searchType = 'franchiseNumber';
      franchises = await FranchiseInformation.find({
        franchiseNumber: { $regex: searchTerm, $options: 'i' }
      })
      .populate('linkedUser', 'username email _id')
      .populate('previousVersion', 'version changeType changedAt franchiseStatus')
      .sort({ franchiseNumber: 1, franchiseChainId: 1, version: -1 });
      
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

// Get all versions of a franchise number (shows all past and current owners)
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
    
    // Get all versions of this franchise number (all owners)
    const franchiseHistory = await FranchiseInformation.find({
      franchiseNumber: franchiseNumber.trim()
    })
      .populate('linkedUser', 'username email _id')
      .populate('previousVersion', 'version changeType changedAt franchiseStatus')
      .sort({ changedAt: 1 });
    
    if (!franchiseHistory || franchiseHistory.length === 0) {
      return res.status(404).json({ 
        error: 'Franchise not found',
        message: `No franchise found with number: ${franchiseNumber}` 
      });
    }
    
    // Group by owner to show ownership history
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

// Get a specific franchise by ID
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


// Get available franchise numbers for new applications (optimized gap detection)
exports.getAvailableFranchiseNumbers = async (req, res, next) => {
  try {
    const FranchiseInformation = require('../models/franchiseInformationModel');

    // Get latest version of each franchise
    const allFranchises = await FranchiseInformation.find({
      isCurrentVersion: true
    })
      .select('franchiseChainId franchiseNumber franchiseStatus expiryDate')
      .lean()
      .sort({ franchiseChainId: 1, version: -1 })
      .exec();

    // Group by owner, keep latest version per owner
    const chainMap = new Map();
    for (const franchise of allFranchises) {
      if (!chainMap.has(franchise.franchiseChainId)) {
        chainMap.set(franchise.franchiseChainId, franchise);
      }
    }

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
    console.error('[Franchise Info] Error:', error.message);
    return next(error);
  }
};



/**
 * GET /franchise-information/by-user/:userId
 * Get all active franchises for a specific user
 * 
 * Purpose: Fetch franchises linked to a specific user ID
 * Returns only current versions (isCurrentVersion: true)
 * Used by: Operator home page to display their active franchises
 */
exports.getFranchisesByUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    console.log('[getFranchisesByUser] Request for userId:', userId);
    
    if (!userId || userId.trim().length === 0) {
      return res.status(400).json({ 
        error: 'userId param is required',
        message: 'Provide a valid user ID' 
      });
    }
    
    const FranchiseInformation = require('../models/franchiseInformationModel');
    
    // Fetch all current franchises for this user
    const franchises = await FranchiseInformation.find({
      linkedUser: userId.trim(),
      isCurrentVersion: true
    })
      .populate('linkedUser', 'username email _id')
      .populate('previousVersion', 'version changeType changedAt franchiseStatus')
      .sort({ franchiseNumber: 1 }); // Sort by franchise number
    
    console.log('[getFranchisesByUser] Found', franchises.length, 'franchises for user:', userId);
    if (franchises.length > 0) {
      console.log('[getFranchisesByUser] First franchise:', {
        id: franchises[0]._id,
        franchiseNumber: franchises[0].franchiseNumber,
        linkedUserId: franchises[0].linkedUser?._id
      });
    }
    
    return res.status(200).json({
      success: true,
      userId: userId.trim(),
      count: franchises.length,
      data: franchises
    });
    
  } catch (error) {
    console.error('[getFranchisesByUser] Error:', error);
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
    
    // Get current version franchises and find matching QR code
    const FranchiseInformation = require('../models/franchiseInformationModel');
    const allCurrentFranchises = await FranchiseInformation.find({ 
      isCurrentVersion: true 
    })
    .sort({ franchiseChainId: 1, version: -1 });
    
    // Find franchise with matching hash
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
    
    // Log QR scan
    const ipAddress = getClientIp(req);
    console.log(`[QR Scan] Franchise: ${franchiseInformation.franchiseNumber}, Driver: ${franchiseInformation.driverName}`);
    
    // Get driver picture URL (proxy for image access)
    let driverPictureUrl = null;
    if (franchiseInformation.documents?.driverPictureObj) {
      const API_BASE_URL = process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || '';
      driverPictureUrl = `${API_BASE_URL.replace(/\/$/, '')}/api/franchise-information/proxy-file?url=${encodeURIComponent(franchiseInformation.documents.driverPictureObj)}`;
    }
    
    // Build response with driver information
    const publicData = {
      franchiseNumber: franchiseInformation.franchiseNumber,
      franchiseChainId: franchiseInformation.franchiseChainId,
      franchiseVersion: franchiseInformation.version,
      franchiseStatus: franchiseInformation.franchiseStatus,
      driverName: franchiseInformation.driverName,
      driversAddress: franchiseInformation.driversAddress,
      driverPicture: driverPictureUrl,
      driverPictureObj: franchiseInformation.documents?.driverPictureObj || null,
      todaMembership: franchiseInformation.todaMembership,
      isCurrentVersion: franchiseInformation.isCurrentVersion,
      expiryDate: franchiseInformation.expiryDate
    };
    
    return res.status(200).json({ 
      success: true, 
      data: publicData 
    });
  } catch (error) {
    console.error('[QR Scan] Error:', error.message);
    return next(error);
  }
};



// Proxy Cloudflare R2 files (bypass image access restrictions)
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

