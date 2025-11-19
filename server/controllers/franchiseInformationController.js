const franchiseInformationRepository = require('../repositories/franchiseInformationRepository');
const { generateOperatorQRCode, deleteQRCode } = require('../services/qrCodeService');
const { getFileFromR2 } = require('../services/cloudflareService');

exports.createFranchiseInformation = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'Request body is required' });
    }
    
    // Prevent id injection and prototype pollution
    const { id, _id, ...body } = req.body;
    for (const k of ['__proto__', 'prototype', 'constructor']) delete body[k];
    
    // Handle file uploads from multer
    if (req.files) {
   
      if (req.files.profilePhoto && req.files.profilePhoto[0]) {
        body.profilePhoto = `/uploads/operators/profiles/${req.files.profilePhoto[0].filename}`;
      }
      
      // Documents
      const documentFields = [
        'motorRegistration',
        'barangayClearance',
        'cedula',
        'driversLicense',
        'votersAffidavit',
        'motorChassisStencil',
        'picture'
      ];
      
      body.documents = {};
      documentFields.forEach(field => {
        if (req.files[field] && req.files[field][0]) {
          body.documents[field] = `/uploads/operators/documents/${req.files[field][0].filename}`;
        }
      });
    }
    
    const franchiseInformation = await franchiseInformationRepository.createFranchiseInformation(body);
    
    // Generate QR code for the franchise
    try {
      const qrCodeData = await generateOperatorQRCode(franchiseInformation._id, { saveToFile: true });
      
      franchiseInformation.qrCode = qrCodeData.filePath;
      await franchiseInformation.save();
      
      console.log(`[QR GENERATED] Franchise: ${franchiseInformation._id}, File: ${qrCodeData.filePath}`);
    } catch (qrError) {
      console.error('QR Code generation failed:', qrError);
      // Continue without QR code - can be generated later
    }

    return res.status(201).json({
      success: true,
      message: 'Franchise information created successfully',
      data: franchiseInformation
    });
  }
  catch (error) {
    if (error?.name === 'SequelizeUniqueConstraintError' || error?.code === 11000) {
      return res.status(409).json({ error: 'Duplicate franchise information' });
    }
    return next(error);
  }
};

exports.getAllFranchiseInformation = async (req, res, next) => {
  try {
    const franchises = await franchiseInformationRepository.getAllFranchiseInformation();
    return res.status(200).json(franchises || []);
  } catch (error) {
    return next(error);
  }
};

exports.getFranchiseInformation = async (req, res, next) => {
  try {
    if (!req.params?.id) {
      return res.status(400).json({ error: 'id param is required' });
    }
    const franchiseInformation = await franchiseInformationRepository.getFranchiseInformationById(req.params.id);
    if (!franchiseInformation) {
      return res.status(404).json({ error: 'Franchise information not found' });
    }
    return res.status(200).json(franchiseInformation);
  } catch (error) {
    if (error?.name === 'CastError' || /invalid input syntax.*uuid/i.test(error?.message || '')) {
      return res.status(400).json({ error: 'Invalid id format' });
    }
    return next(error);
  }
};

exports.updateFranchiseInformation = async (req, res, next) => {
  try {
    const franchiseInformation = await franchiseInformationRepository.updateFranchiseInformation(req.params.id, req.body);
    if (!franchiseInformation) {
      return res.status(404).json({ error: 'Franchise information not found' });
    }
    res.status(200).json(franchiseInformation);
  } catch (error) {
    next(error);
  }
};

exports.deleteFranchiseInformation = async (req, res, next) => {
  try {
    const franchiseInformation = await franchiseInformationRepository.deleteFranchiseInformation(req.params.id);
    if (!franchiseInformation) {
      return res.status(404).json({ error: 'Franchise information not found' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Lookup franchise by hashed MTOP (from QR code scan)
 * This is the PUBLIC endpoint that QR codes link to
 */
exports.franchiseQRLookupByHash = async (req, res, next) => {
  try {
    const { hashedMTOP } = req.params;
    
    if (!hashedMTOP) {
      return res.status(400).json({ error: 'Invalid QR code' });
    }
    
    // Find franchise by operatorId (which stores the hashed MTOP)
    const FranchiseInformation = require('../models/franchiseInformationModel');
    const franchiseInformation = await FranchiseInformation.findOne({ 
      operatorId: hashedMTOP 
    });
    
    if (!franchiseInformation) {
      return res.status(404).json({ error: 'Franchise not found' });
    }
    
    // Log QR scan for audit trail
    const ipAddress = req.ip || req.socket.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
    console.log(`[QR SCAN] HashedMTOP: ${hashedMTOP}, IP: ${ipAddress}, Time: ${new Date().toISOString()}`);
    
    // Extract name parts for display
    const nameParts = franchiseInformation.operatorName.split(' ');
    const lastName = nameParts.pop() || '';
    const firstName = nameParts.shift() || '';
    const middleName = nameParts.join(' ') || '';
    
    // Return only public information for QR code display
    const publicData = {
      driversID: franchiseInformation.driversID,
      firstName: firstName,
      middleName: middleName,
      lastName: lastName,
      suffix: '', // Add if stored separately
      address: franchiseInformation.address,
      barangay: franchiseInformation.barangay,
      profilePhoto: franchiseInformation.profilePhoto || null,
      franchiseStatus: franchiseInformation.franchiseStatus,
      expiryDate: franchiseInformation.expiryDate,
      approvedAt: franchiseInformation.approvedAt
    };
    
    return res.status(200).json(publicData);
  } catch (error) {
    console.error('[QR SCAN ERROR]', error);
    return next(error);
  }
};

/**
 * Legacy: Lookup franchise by MongoDB _id (backward compatibility)
 */
exports.franchiseQRIDLookup = async (req, res, next) => {
  try {
    if (!req.params?.franchiseId) {
      return res.status(400).json({ error: 'franchiseId param is required' });
    }
    
    const franchiseInformation = await franchiseInformationRepository.getFranchiseInformationById(req.params.franchiseId);
    
    if (!franchiseInformation) {
      return res.status(404).json({ error: 'Franchise information not found' });
    }
    
    // Log QR scan for audit trail
    const ipAddress = req.ip || req.socket.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
    console.log(`[QR SCAN] Franchise: ${req.params.franchiseId}, IP: ${ipAddress}, Time: ${new Date().toISOString()}`);
    
    // Return only public information for QR code display
    const publicData = {
      driversID: franchiseInformation.driversID,
      operatorName: franchiseInformation.operatorName,
      address: franchiseInformation.address,
      barangay: franchiseInformation.barangay,
      profilePhoto: franchiseInformation.profilePhoto || null,
      franchiseStatus: franchiseInformation.franchiseStatus
    };
    
    return res.status(200).json(publicData);
  } catch (error) {
    if (error?.name === 'CastError' || /invalid input syntax.*uuid/i.test(error?.message || '')) {
      return res.status(400).json({ error: 'Invalid franchiseId format' });
    }
    return next(error);
  }
};

exports.regenerateQRCode = async (req, res, next) => {
  try {
    const { franchiseId } = req.params;
    
    if (!franchiseId) {
      return res.status(400).json({ error: 'franchiseId param is required' });
    }
    
    const franchiseInformation = await franchiseInformationRepository.getFranchiseInformationById(franchiseId);
    
    if (!franchiseInformation) {
      return res.status(404).json({ error: 'Franchise information not found' });
    }
    
    // Delete old QR code if it exists
    if (franchiseInformation.qrCode) {
      await deleteQRCode(franchiseInformation.qrCode);
    }
    
    // Generate new QR code
    const qrCodeData = await generateOperatorQRCode(franchiseId, { saveToFile: true });
    
    // Update franchise with new QR code path
    franchiseInformation.qrCode = qrCodeData.filePath;
    await franchiseInformation.save();
    
    console.log(`[QR REGENERATED] Franchise: ${franchiseId}, File: ${qrCodeData.filePath}`);
    
    return res.status(200).json({
      success: true,
      message: 'QR code regenerated successfully',
      data: {
        qrCode: qrCodeData.filePath,
        dataURL: qrCodeData.dataURL,
        verificationUrl: qrCodeData.verificationUrl
      }
    });
  } catch (error) {
    console.error('QR code regeneration error:', error);
    return next(error);
  }
};

/**
 * Proxy endpoint to fetch files from Cloudflare R2 and serve them through backend
 * This bypasses CORS restrictions and allows frontend to preview/download files
 * Uses presigned URLs for secure access without enabling public bucket access
 */
exports.proxyCloudflareFile = async (req, res, next) => {
    try {
        const { url } = req.query;

        console.log('[PROXY-FI] Received request for URL:', url);

        if (!url) {
            console.error('[PROXY-FI] No URL parameter provided');
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        let key;
        
        // Handle new format: r2://path/to/file
        if (url.startsWith('r2://')) {
            key = url.substring(5); // Remove 'r2://' prefix
            console.log('[PROXY-FI] New R2 format detected, key:', key);
        }
        // Handle old format: https://pub-xxx.r2.dev/path/to/file (for backward compatibility)
        else if (url.includes('.r2.dev')) {
            const r2Domain = process.env.CLOUDFLARE_R2_PUBLIC_URL;
            console.log('[PROXY-FI] Old R2 public URL format detected');
            
            if (!url.startsWith(r2Domain)) {
                console.error('[PROXY-FI] Invalid file URL - does not match R2 domain');
                return res.status(403).json({ error: 'Invalid file URL' });
            }
            
            const urlObj = new URL(url);
            key = urlObj.pathname.substring(1); // Remove leading slash
        }
        // Handle direct key path
        else {
            key = url;
            console.log('[PROXY-FI] Direct key path provided:', key);
        }

        console.log('[PROXY-FI] Extracted key:', key);
        console.log('[PROXY-FI] Fetching file directly from R2 using API credentials...');

        // Fetch the file directly from R2 using API credentials
        const { buffer, contentType } = await getFileFromR2(key);

        console.log('[PROXY-FI] File retrieved successfully:', contentType, buffer.length, 'bytes');
        
        // Set permissive CORS headers for public access
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Extract filename from URL
        const filename = key.split('/').pop();
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

        // Send the file buffer
        res.send(buffer);

        console.log('[PROXY-FI] ✅ File served successfully:', filename, contentType, buffer.length, 'bytes');
    } catch (error) {
        console.error('[PROXY-FI] ❌ Error proxying file:', error.message);
        console.error('[PROXY-FI] Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to proxy file',
            message: error.message
        });
    }
};

/**
 * GET /franchise-information/mtop/:mtopNumber
 * Returns franchise info by unhashed MTOP number
 * Includes: name, address, 1x1 R2 picture, unhashed mtopNumber, franchise status
 * If not linked to operator, returns Franchise not linked
 */
exports.getFranchiseByMtopNumber = async (req, res, next) => {
  try {
    const { mtopNumber } = req.params;
    if (!mtopNumber) {
      return res.status(400).json({ error: 'MTOP number is required' });
    }
    const FranchiseInformation = require('../models/franchiseInformationModel');
    const franchise = await FranchiseInformation.findOne({ mtopNumber });
    if (!franchise) {
      return res.status(404).json({ error: 'Franchise not found', status: 'Franchise not linked', linked: false, message: 'Franchise not linked' });
    }
    // Compose name
    const name = franchise.operatorName || '';
    // Compose 1x1 R2 picture URL
    let pictureUrl = franchise.profilePhoto || null;
    if (pictureUrl && pictureUrl.startsWith('r2://')) {
      const API_BASE_URL = process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || '';
      pictureUrl = API_BASE_URL.replace(/\/$/, '') + '/api/franchise-applications/proxy-file?url=' + encodeURIComponent(pictureUrl);
    }
    // Franchise status color
    let statusColor = 'blue';
    if (franchise.franchiseStatus === 'active') statusColor = 'blue';
    if (franchise.franchiseStatus === 'expired') statusColor = 'red';
    // Determine linked status
    const isLinked = franchise.linkedUser !== null && typeof franchise.linkedUser !== 'undefined';
    // Compose response
    return res.status(200).json({
      name,
      address: franchise.address,
      mtopNumber: franchise.mtopNumber,
      profilePhoto: pictureUrl,
      franchiseStatus: franchise.franchiseStatus,
      statusColor,
      linked: isLinked,
      message: isLinked ? undefined : 'Franchise not linked'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /franchise-information/mtop-hash/:hashedMTOP
 * Returns franchise info by hashed MTOP (operatorId)
 * Same response as unhashed endpoint, but uses operatorId for lookup
 */
exports.getFranchiseByHashedMtop = async (req, res, next) => {
  try {
    const { hashedMTOP } = req.params;
    if (!hashedMTOP) {
      return res.status(400).json({ error: 'Hashed MTOP is required' });
    }
    const FranchiseInformation = require('../models/franchiseInformationModel');
    const franchise = await FranchiseInformation.findOne({ operatorId: hashedMTOP });
    if (!franchise) {
      return res.status(404).json({ error: 'Franchise not found', status: 'Franchise not linked', linked: false, message: 'Franchise not linked' });
    }
    // Compose name
    const name = franchise.operatorName || '';
    // Compose 1x1 R2 picture URL (prefer documents.picture if available)
    let pictureUrl = null;
    if (franchise.documents && franchise.documents.picture) {
      pictureUrl = franchise.documents.picture;
    } else if (franchise.profilePhoto) {
      pictureUrl = franchise.profilePhoto;
    }
    if (pictureUrl && pictureUrl.startsWith('r2://')) {
      const API_BASE_URL = process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || '';
      pictureUrl = API_BASE_URL.replace(/\/$/, '') + '/api/franchise-applications/proxy-file?url=' + encodeURIComponent(pictureUrl);
    }
    // Franchise status color
    let statusColor = 'blue';
    if (franchise.franchiseStatus === 'active') statusColor = 'blue';
    if (franchise.franchiseStatus === 'expired') statusColor = 'red';
    // Determine linked status
    const isLinked = franchise.linkedUser !== null && typeof franchise.linkedUser !== 'undefined';
    // Compose response
    return res.status(200).json({
      name,
      address: franchise.address,
      mtopNumber: franchise.mtopNumber,
      profilePhoto: pictureUrl,
      franchiseStatus: franchise.franchiseStatus,
      statusColor,
      linked: isLinked,
      message: isLinked ? undefined : 'Franchise not linked'
    });
  } catch (error) {
    return next(error);
  }
};