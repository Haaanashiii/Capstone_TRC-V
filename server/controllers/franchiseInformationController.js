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

