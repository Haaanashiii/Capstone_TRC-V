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
 * Get all CURRENT VERSION franchises with WebSocket notification
 * 
 * Features:
 * - Returns only isCurrentVersion = true franchises
 * - Emits to WebSocket room 'franchise-admins' for real-time updates
 * - Populated with linked user and previous version info
 * 
 * Used by: Admin dashboards, franchise management pages
 */
exports.getAllFranchiseInformation = async (req, res, next) => {
  try {
    const FranchiseInformation = require('../models/franchiseInformationModel');
    const franchises = await FranchiseInformation.find({ isCurrentVersion: true })
      .populate('linkedUser', 'username email')
      .populate('previousVersion', 'version changeType changedAt')
      .sort({ franchiseNumber: 1 });
    
    // Emit to WebSocket for real-time updates
    if (req.app.get('io')) {
      req.app.get('io').to('franchise-admins').emit('franchises-list-updated', {
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
 * Search franchises by name OR franchise number (all versions)
 * 
 * Smart Search Logic:
 * - Pure letters (A-Z, spaces) → Search by operator name (case-insensitive)
 * - Contains numbers → Search by franchise number (includes all versions)
 * 
 * Examples:
 * - "Juan Dela Cruz" → Searches operatorName
 * - "F-2024-001" → Searches franchiseNumber (all versions)
 * - "2024" → Searches franchiseNumber containing "2024"
 * 
 * Returns: All matching franchises (current and previous versions)
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
    const hasNumbers = /\d/.test(searchTerm);
    const isPureLetters = /^[a-zA-Z\s]+$/.test(searchTerm);
    
    let franchises = [];
    let searchType = '';
    
    if (isPureLetters) {
      // Search by OPERATOR NAME (case-insensitive, partial match)
      searchType = 'name';
      franchises = await FranchiseInformation.find({
        operatorName: { $regex: searchTerm, $options: 'i' }
      })
      .populate('linkedUser', 'username email')
      .populate('previousVersion', 'version changeType')
      .sort({ operatorName: 1, version: -1 });
      
    } else if (hasNumbers) {
      // Search by FRANCHISE NUMBER (exact or partial match, all versions)
      searchType = 'franchiseNumber';
      franchises = await FranchiseInformation.find({
        franchiseNumber: { $regex: searchTerm, $options: 'i' }
      })
      .populate('linkedUser', 'username email')
      .populate('previousVersion', 'version changeType')
      .sort({ franchiseNumber: 1, version: -1 });
      
    } else {
      return res.status(400).json({
        error: 'Invalid search query',
        message: 'Search must contain letters (for name) or numbers (for franchise number)'
      });
    }
    
    return res.status(200).json({
      success: true,
      searchType: searchType,
      query: searchTerm,
      count: franchises.length,
      data: franchises
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
 * - Single pass through franchises O(n)
 * - Gap detection in O(n) instead of O(n²)
 */
exports.getAvailableFranchiseNumbers = async (req, res, next) => {
  try {
    const FranchiseInformation = require('../models/franchiseInformationModel');

    // Fetch only what is needed
    const allCurrentFranchises = await FranchiseInformation.find({
      isCurrentVersion: true
    })
      .select('franchiseNumber franchiseStatus expiryDate') // Only required fields
      .lean()
      .exec();

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
    });
    
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
    console.log(`[QR SCAN] Hashed: ${hashedMTOP}, Franchise#: ${franchiseInformation.franchiseNumber}, Driver: ${franchiseInformation.driverName}, Status: ${franchiseInformation.franchiseStatus}, IP: ${ipAddress}, Time: ${new Date().toISOString()}`);
    
    // Get driver picture URL (with proxy for CORS bypass)
    let driverPictureUrl = null;
    if (franchiseInformation.documents?.driverPictureObj) {
      const API_BASE_URL = process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || '';
      driverPictureUrl = `${API_BASE_URL.replace(/\/$/, '')}/api/franchise-information/proxy-file?url=${encodeURIComponent(franchiseInformation.documents.driverPictureObj)}`;
    }
    
    // Return DRIVER-focused public information for QR code verification
    const publicData = {
      // Driver Information (PRIMARY)
      driversID: franchiseInformation.driversID,
      driverName: franchiseInformation.driverName,
      driversAddress: franchiseInformation.driversAddress,
      driverPicture: driverPictureUrl,
      driverPictureObj: franchiseInformation.documents?.driverPictureObj || null,
      
      todaMembership: franchiseInformation.todaMembership
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

