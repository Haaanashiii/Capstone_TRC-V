const franchiseInformationRepository = require('../repositories/franchiseInformationRepository');
const { generateOperatorQRCode, deleteQRCode } = require('../services/qrCodeService');
const storage = require('../services/storageAdapter');
const { getClientIp } = require('../utils/ipHelper');
const { generateHashedFranchiseNo, findFranchiseNumberByHash } = require('../utils/franchiseHelpers');
const { TTL } = require('../utils/cache');

// Helper to convert all gridfs:// URLs in data to HTTP URLs for frontend
const convertToHttpUrls = (data) => storage.convertGridFSUrls(data);

/**
 * Enrich franchise data with proper document metadata
 * Converts gridfs:// URLs and adds sanitized display names
 * @param {Object} franchise - Franchise object (from DB or lean)
 * @returns {Object} Enriched franchise with proper document metadata
 */
const enrichFranchiseData = async (franchise) => {
  if (!franchise) return franchise;
  
  const franchiseObj = franchise.toObject ? franchise.toObject() : { ...franchise };
  const converted = convertToHttpUrls(franchiseObj);
  
  // Enrich documents with metadata if they exist
  if (converted.documents) {
    converted.documents = await storage.enrichDocumentsWithMetadata(franchiseObj.documents, {
      operatorName: franchiseObj.operatorName,
      submittedAt: franchiseObj.approvedAt || franchiseObj.createdAt
    });
  }
  
  return converted;
};

// Get all franchises with pagination
exports.getAllFranchiseInformation = async (req, res, next) => {
  try {
    const FranchiseInformation = require('../models/franchiseInformationModel');
    const cacheManager = require('../utils/cache');
    
    // Parse query parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;
    const { status, barangay, search } = req.query;
    
    // Build query
    const query = { isCurrentVersion: true };
    if (status) query.franchiseStatus = status;
    if (barangay) query.operatorBarangay = barangay;
    if (search) {
      query.$or = [
        { franchiseNumber: { $regex: search, $options: 'i' } },
        { operatorName: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Create cache key for this specific query
    const cacheKey = `franchises-${page}-${limit}-${status || 'all'}-${barangay || 'all'}-${search || 'none'}`;
    const cached = cacheManager.get(cacheKey);
    
    if (cached) {
      return res.status(200).json({
        success: true,
        ...cached,
        cached: true
      });
    }
    
    // Execute query with pagination
    const [franchises, total] = await Promise.all([
      FranchiseInformation.find(query)
        .select('-documents') // Exclude heavy document references for list view
        .populate('linkedUser', 'username email')
        .sort({ franchiseNumber: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FranchiseInformation.countDocuments(query)
    ]);
    
    const result = {
      count: franchises.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      data: franchises
    };
    
    // Cache for 2 minutes (franchise list)
    cacheManager.set(cacheKey, result, TTL.FRANCHISE_LIST);
    
    // Notify admins about updated franchise list (only if no filters applied)
    if (!status && !barangay && !search && page === 1 && req.app.get('io')) {
      req.app.get('io').to('bplo-admins').emit('franchises-list-updated', {
        count: total,
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      ...result
    });
  } catch (error) {
    console.error('[getAllFranchiseInformation] Error:', error);
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
    
    // Enrich franchise data with proper document metadata
    const enrichedFranchises = await Promise.all(
      franchises.map(f => enrichFranchiseData(f))
    );
    
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
      data: enrichedFranchises
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

// Get all versions of a franchise chain (one owner only)
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
    
    // Convert gridfs:// URLs to HTTP URLs for frontend
    const franchiseData = convertToHttpUrls(franchiseInformation.toObject());
    
    return res.status(200).json({ 
      success: true, 
      data: franchiseData 
    });
  } catch (error) {
    if (error?.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid id format' });
    }
    return next(error);
  }
};

// ========================================
// UPDATE FRANCHISE INFORMATION
// ========================================

/**
 * PUT /franchise-information/:id
 * Update franchise information (admin only)
 * 
 * Purpose: Allow admins to update franchise details
 * Params: id - Franchise document ID
 * Body: Updated franchise fields
 * Returns: Updated franchise information
 */
exports.updateFranchiseInformation = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: 'Franchise ID is required' 
      });
    }
    
    const FranchiseInformation = require('../models/franchiseInformationModel');
    
    // Find the franchise
    const franchise = await FranchiseInformation.findById(id);
    
    if (!franchise) {
      return res.status(404).json({ 
        success: false,
        error: 'Franchise not found' 
      });
    }
    
    // Define allowed fields for update (security - prevent updating sensitive fields)
    const allowedFields = [
      'operatorName',
      'operatorAddress',
      'operatorBarangay',
      'operatorContactNumber',
      'operatorEmail',
      'operatorBirthPlace',
      'operatorBirthDate',
      'operatorCivilStatus',
      'operatorCitizenship',
      'todaMembership',
      'coOwnerName',
      'coOwnerAddress',
      'driverName',
      'driversAddress',
      'driversID',
      'franchiseStatus',
      'rate',
      'resolutionNumber',
      'sbResolutionNumber',
      'officialReceiptNumber',
      'unitModel',
      'colorMotor',
      'sideCarColor',
      'mvPlateNo',
      'motorEngineNo',
      'chasisNo'
    ];
    
    // Update only allowed fields
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }
    
    // Track who made the change
    updateData.changedBy = req.user?.username || 'admin';
    updateData.changedAt = new Date();
    
    // Update the franchise
    const updatedFranchise = await FranchiseInformation.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
    .populate('linkedUser', 'username email _id')
    .populate('previousVersion', 'version changeType changedAt franchiseStatus');
    
    console.log('[updateFranchiseInformation] Updated franchise:', id, 'by:', updateData.changedBy);
    
    // Notify via WebSocket if available
    if (req.app.get('io')) {
      req.app.get('io').to('sb-admins').emit('franchisee-updated', {
        franchiseId: id,
        franchiseNumber: updatedFranchise.franchiseNumber,
        updatedBy: updateData.changedBy,
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Franchise information updated successfully',
      data: updatedFranchise
    });
    
  } catch (error) {
    console.error('[updateFranchiseInformation] Error:', error);
    if (error?.name === 'CastError') {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid franchise ID format' 
      });
    }
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        error: 'Validation failed',
        message: error.message 
      });
    }
    return next(error);
  }
};


// Get available franchise numbers for new applications (optimized gap detection)
exports.getAvailableFranchiseNumbers = async (req, res, next) => {
  try {
    const FranchiseInformation = require('../models/franchiseInformationModel');
    const FranchiseApplication = require('../models/franchiseApplicationModel');
    const cacheManager = require('../utils/cache');
    
    // This data doesn't change frequently - cache for 5 minutes
    const cacheKey = 'available-franchise-numbers';
    const cached = cacheManager.get(cacheKey);
    
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
        cached: true
      });
    }

    // Get all current version franchises with their status
    const allCurrentFranchises = await FranchiseInformation.find({
      isCurrentVersion: true
    }).select('franchiseNumber franchiseStatus').lean().exec();
    
    // CRITICAL: Also check pending applications to avoid showing numbers that are being processed
    const allPendingApplications = await FranchiseApplication.find({
      applicationType: 'new',
      franchiseNumber: { $exists: true, $ne: null },
      statusOfBPLO: { $in: ['bplo-approved', 'awaiting-sb', 'sb-approved'] }
    }).select('franchiseNumber').lean().exec();
    
    // Build a map of franchise numbers with their availability status
    const franchiseMap = new Map();
    let maxNumber = 0;
    let activeCount = 0;
    let expiredCount = 0;
    let revokedCount = 0;
    
    // Process completed franchises
    for (const franchise of allCurrentFranchises) {
      const numberMatch = franchise.franchiseNumber?.match(/^(\d{1,4})$/);
      if (!numberMatch) continue;
      
      const franchiseNum = parseInt(numberMatch[1], 10);
      maxNumber = Math.max(maxNumber, franchiseNum);
      
      // Count by status
      const status = franchise.franchiseStatus?.toLowerCase();
      if (status === 'active') activeCount++;
      else if (status === 'expired') expiredCount++;
      else if (status === 'revoked') revokedCount++;
      
      // A franchise number is AVAILABLE for recycling if status is 'Revoked'
      const isRevoked = status === 'revoked';
      franchiseMap.set(franchiseNum, { 
        available: isRevoked, 
        reserved: false,
        status: franchise.franchiseStatus,
        isRevoked
      });
    }
    
    // Mark pending application numbers as RESERVED (not available)
    for (const pendingApp of allPendingApplications) {
      const numberMatch = pendingApp.franchiseNumber?.match(/^(\d{1,4})$/);
      if (!numberMatch) continue;
      
      const franchiseNum = parseInt(numberMatch[1], 10);
      maxNumber = Math.max(maxNumber, franchiseNum);
      
      // Mark as reserved - overrides any "available" status
      franchiseMap.set(franchiseNum, { available: false, reserved: true, status: 'Pending' });
    }
    
    // Find available numbers: (1) gaps (never assigned), OR (2) revoked franchises
    const availableNumbers = [];
    const revokedNumbers = [];
    const gapNumbers = [];
    
    for (let i = 1; i <= maxNumber && availableNumbers.length < 100; i++) {
      const franchise = franchiseMap.get(i);
      
      if (!franchise) {
        // Number was never assigned - it's a gap
        const numStr = String(i).padStart(4, '0');
        availableNumbers.push(numStr);
        gapNumbers.push(numStr);
      } else if (franchise.available && !franchise.reserved) {
        // Number exists but franchise is revoked - can be reused
        const numStr = String(i).padStart(4, '0');
        availableNumbers.push(numStr);
        revokedNumbers.push(numStr);
      }
    }
    
    const nextNum = maxNumber + 1;
    const nextFranchiseNumber = String(nextNum).padStart(4, '0');
    const totalFranchises = allCurrentFranchises.length;

    const responseData = {
      availableNumbers: availableNumbers.slice(0, 100), // Limit to 100
      revokedNumbers: revokedNumbers.slice(0, 50), // Numbers from revoked franchises
      gapNumbers: gapNumbers.slice(0, 50), // Numbers that were never assigned
      hasMore: availableNumbers.length > 100,
      totalAvailable: availableNumbers.length,
      nextNumber: nextFranchiseNumber,
      recommendation: availableNumbers.length > 0
        ? `${availableNumbers.length} available number${availableNumbers.length > 1 ? 's' : ''} (${revokedNumbers.length} from revoked, ${gapNumbers.length} gaps)`
        : `Use next number: ${nextFranchiseNumber}`,
      statistics: {
        totalFranchises,
        totalActive: activeCount,
        totalExpired: expiredCount,
        totalRevoked: revokedCount,
        gaps: gapNumbers.length,
        revokedAvailable: revokedNumbers.length, // Field name expected by frontend
        recyclable: revokedNumbers.length, // Alias for clarity
        latestNumber: maxNumber,
        nextNumber: nextNum
      }
    };
    
    // Cache for 5 minutes (reference data)
    cacheManager.set(cacheKey, responseData, TTL.ANNOUNCEMENTS);

    return res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('[Franchise Info] Error:', error.message);
    return next(error);
  }
};

// Get all active franchises for a specific user
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
    const UserAccount = require('../models/userAccountModel');
    
    // First, find the user by their UUID userId to get their MongoDB _id
    const user = await UserAccount.findOne({ userId: userId.trim() });
    
    if (!user) {
      console.log('[getFranchisesByUser] User not found for userId:', userId);
      return res.status(200).json({
        success: true,
        userId: userId.trim(),
        count: 0,
        data: [],
        message: 'No user found with this ID'
      });
    }
    
    console.log('[getFranchisesByUser] Found user with _id:', user._id);
    
    // Fetch all current franchises for this user using their MongoDB _id
    const franchises = await FranchiseInformation.find({
      linkedUser: user._id,
      isCurrentVersion: true
    })
      .populate('linkedUser', 'username email _id userId')
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
    
    // Enrich franchise data with proper document metadata
    const enrichedFranchises = await Promise.all(
      franchises.map(f => enrichFranchiseData(f))
    );
    
    return res.status(200).json({
      success: true,
      userId: userId.trim(),
      count: franchises.length,
      data: enrichedFranchises
    });
    
  } catch (error) {
    console.error('[getFranchisesByUser] Error:', error);
    return next(error);
  }
};

// Link existing franchise to operator account
exports.linkFranchise = async (req, res, next) => {
  try {
    const { franchiseNumber } = req.body;
    const userId = req.user.id; // From authenticate middleware
    
    console.log('[linkFranchise] Request to link franchise:', franchiseNumber, 'to user:', userId);
    
    if (!franchiseNumber || franchiseNumber.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Franchise number is required',
        message: 'Please provide a valid franchise number' 
      });
    }
    
    const FranchiseInformation = require('../models/franchiseInformationModel');
    const UserAccount = require('../models/userAccountModel');
    
    // Find the franchise by franchise number (current version only, active status)
    const franchise = await FranchiseInformation.findOne({
      franchiseNumber: franchiseNumber.trim(),
      isCurrentVersion: true,
      franchiseStatus: 'Active'
    });
    
    if (!franchise) {
      return res.status(404).json({ 
        success: false,
        error: 'Franchise not found',
        message: 'No active franchise found with this number. Please verify your franchise number.' 
      });
    }
    
    // Check if franchise is already linked to another user
    if (franchise.linkedUser && franchise.linkedUser.toString() !== userId) {
      return res.status(400).json({ 
        success: false,
        error: 'Franchise already linked',
        message: 'This franchise is already linked to another account.' 
      });
    }
    
    // Check if franchise is already linked to this user
    if (franchise.linkedUser && franchise.linkedUser.toString() === userId) {
      return res.status(200).json({ 
        success: true,
        message: 'Franchise is already linked to your account',
        data: franchise
      });
    }
    
    // Link the franchise to the user
    franchise.linkedUser = userId;
    await franchise.save();
    
    // Update user's franchiseChainIds array if not already present
    const user = await UserAccount.findById(userId);
    if (user && !user.franchiseChainIds.includes(franchise.franchiseChainId)) {
      user.franchiseChainIds.push(franchise.franchiseChainId);
      await user.save();
      console.log('[linkFranchise] Franchise chain ID added to user:', franchise.franchiseChainId);
    }
    
    console.log('[linkFranchise] Successfully linked franchise:', franchiseNumber, 'to user:', userId);
    
    // Populate linked user data before returning
    await franchise.populate('linkedUser', 'username email _id');
    
    return res.status(200).json({
      success: true,
      message: 'Franchise successfully linked to your account',
      data: franchise
    });
    
  } catch (error) {
    console.error('[linkFranchise] Error:', error);
    return next(error);
  }
};

// QR code verification - returns driver details (uses hash cache for O(1) lookup)
exports.franchiseQRLookupByHash = async (req, res, next) => {
  try {
    const { hashedMTOP } = req.params;
    
    if (!hashedMTOP) {
      return res.status(400).json({ error: 'Invalid QR code' });
    }
    
    // Use cached reverse lookup (O(1) instead of full collection scan)
    const franchiseNumber = await findFranchiseNumberByHash(hashedMTOP);
    
    if (!franchiseNumber) {
      return res.status(404).json({ 
        error: 'Franchise not found',
        message: 'This QR code is invalid or the franchise has been revoked' 
      });
    }
    
    // Direct indexed lookup by franchise number (very fast)
    const FranchiseInformation = require('../models/franchiseInformationModel');
    const franchiseInformation = await FranchiseInformation.findOne({
      franchiseNumber: franchiseNumber,
      isCurrentVersion: true
    })
    .select('franchiseNumber franchiseChainId franchiseStatus operatorName operatorAddress operatorBarangay todaMembership expiryDate version isCurrentVersion documents.operatorPictureObj')
    .lean();
    
    if (!franchiseInformation) {
      return res.status(404).json({ 
        error: 'Franchise not found',
        message: 'This QR code is invalid or the franchise has been revoked' 
      });
    }
    
    // Log QR scan
    const ipAddress = getClientIp(req);
    console.log(`[QR Scan] Franchise: ${franchiseInformation.franchiseNumber}, Operator: ${franchiseInformation.operatorName}`);
    
    // Get operator picture URL (proxy for image access)
    let operatorPictureUrl = null;
    if (franchiseInformation.documents?.operatorPictureObj) {
      // Convert gridfs:// URL to HTTP URL
      operatorPictureUrl = storage.toHttpUrl(franchiseInformation.documents.operatorPictureObj);
    }

    // Build response with operator information
    const publicData = {
      franchiseNumber: franchiseInformation.franchiseNumber,
      franchiseChainId: franchiseInformation.franchiseChainId,
      franchiseVersion: franchiseInformation.version,
      franchiseStatus: franchiseInformation.franchiseStatus,
      operatorName: franchiseInformation.operatorName,
      operatorAddress: franchiseInformation.operatorAddress,
      operatorBarangay: franchiseInformation.operatorBarangay,
      operatorPicture: operatorPictureUrl,
      operatorPictureObj: operatorPictureUrl, // Use HTTP URL for frontend
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



// Proxy file from GridFS storage
exports.proxyFile = async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });
    
    const { buffer, contentType } = await storage.getFile(url);
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

