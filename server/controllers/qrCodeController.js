const qrCodeService = require('../services/qrCodeService');
const qrCodeRepository = require('../repositories/qrCodeRepository');
const cacheManager = require('../utils/cache');
const crypto = require('crypto');

/**
 * QR Scan - Returns the LATEST ACTIVE franchise for a given franchise number
 * 
 * IMPORTANT: The QR code contains a HASHED franchise number (e.g., hash of "0001")
 * This means when franchise 0001 is recycled from gabatino-0001 to gonzales-0001,
 * the SAME QR code now shows gonzales-0001's data (the new active owner).
 * 
 * Cache is invalidated when:
 * - Franchise status changes (revoke, expire)
 * - New franchise created with same number (recycle)
 * - Amendment/renewal updates the current version
 */
exports.scanQRCode = async (req, res, next) => {
  try {
    const { hashedFranchiseNo } = req.params;
    
    if (!hashedFranchiseNo) {
      return res.status(400).json({ error: 'Hashed franchise number is required' });
    }
    
    // Check cache first (2 min TTL - balance between performance and data freshness)
    const cacheKey = `qr-scan-${hashedFranchiseNo}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, data: cached, cached: true });
    }
    
    const FranchiseInformation = require('../models/franchiseInformationModel');
    
    // Find ALL current versions (isCurrentVersion: true) to match against hash
    // This includes Active, Expired, and even recently Revoked franchises
    const currentFranchises = await FranchiseInformation.find({
      isCurrentVersion: true
    })
    .select('franchiseNumber franchiseChainId driverName driversAddress franchiseStatus expiryDate approvedAt documents.driverPictureObj operatorName operatorContactNumber version')
    .lean();
    
    // Match the hashed franchise number
    const matchedFranchise = currentFranchises.find(f => {
      const hash = crypto.createHash('sha256').update(f.franchiseNumber).digest('hex').substring(0, 16);
      return hash === hashedFranchiseNo;
    });
    
    if (!matchedFranchise) {
      return res.status(404).json({ 
        error: 'Franchise not found',
        message: 'This QR code does not match any registered franchise'
      });
    }
    
    // Build response with status-aware messaging
    const isActive = matchedFranchise.franchiseStatus === 'Active';
    const isExpired = matchedFranchise.franchiseStatus === 'Expired' || 
                      (matchedFranchise.expiryDate && new Date(matchedFranchise.expiryDate) < new Date());
    const isRevoked = matchedFranchise.franchiseStatus === 'Revoked';
    
    const response = {
      franchiseNumber: matchedFranchise.franchiseNumber,
      franchiseChainId: matchedFranchise.franchiseChainId,
      franchiseStatus: matchedFranchise.franchiseStatus,
      version: matchedFranchise.version,
      expiryDate: matchedFranchise.expiryDate,
      approvedAt: matchedFranchise.approvedAt,
      driver: {
        name: matchedFranchise.driverName,
        address: matchedFranchise.driversAddress,
        pictureUrl: matchedFranchise.documents?.driverPictureObj || null
      },
      operator: {
        name: matchedFranchise.operatorName,
        contactNumber: matchedFranchise.operatorContactNumber
      },
      // Status flags for frontend display
      isValid: isActive,
      statusMessage: isActive ? 'Valid and Active Franchise' :
                     isExpired ? 'Franchise has expired - renewal required' :
                     isRevoked ? 'Franchise has been revoked' : 
                     `Franchise status: ${matchedFranchise.franchiseStatus}`
    };
    
    // Only cache active franchises (expired/revoked may change soon)
    if (isActive) {
      cacheManager.set(cacheKey, response, 120); // 2 minutes
    }
    
    res.status(200).json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
};

/**
 * Invalidate QR cache when franchise data changes
 * Call this after: status change, amendment, renewal, recycle
 */
exports.invalidateQRCache = (franchiseNumber) => {
  if (!franchiseNumber) return;
  const hash = crypto.createHash('sha256').update(franchiseNumber).digest('hex').substring(0, 16);
  const cacheKey = `qr-scan-${hash}`;
  cacheManager.delete(cacheKey);
};

exports.generateOperatorQRCode = async (req, res, next) => {
  try {
    const { operatorId } = req.params;
    const { saveToFile = true } = req.body;
    
    if (!operatorId) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }
    
    const qrCodeData = await qrCodeService.generateOperatorQRCode(operatorId, { saveToFile });
    
    if (qrCodeData.filePath) {
      await qrCodeRepository.storeOperatorQRCode(operatorId, qrCodeData.filePath, qrCodeData.dataURL);
    }
    
    res.status(200).json({
      success: true,
      message: 'QR code generated successfully',
      data: {
        qrCode: qrCodeData.dataURL,
        filePath: qrCodeData.filePath,
        verificationUrl: qrCodeData.verificationUrl,
        operatorId
      }
    });
  } catch (error) {
    if (error.message === 'Operator not found') {
      return res.status(404).json({ error: 'Operator not found' });
    }
    next(error);
  }
};

exports.getOperatorQRCode = async (req, res, next) => {
  try {
    const { operatorId } = req.params;
    const operator = await qrCodeRepository.getOperatorQRCode(operatorId);
    
    if (!operator) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    
    if (!operator.qrCode) {
      return res.status(404).json({ 
        error: 'QR code not found for this operator',
        message: 'Generate a QR code first using POST /api/qr/generate/operator/:operatorId'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        operatorId: operator.userId,
        franchiseNo: operator.franchiseNumber,
        name: `${operator.firstName} ${operator.lastName}`,
        qrCodePath: operator.qrCode,
        qrCodeDataURL: operator.qrCodeDataURL,
        generatedAt: operator.qrCodeGeneratedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.regenerateOperatorQRCode = async (req, res, next) => {
  try {
    const { operatorId } = req.params;
    const operator = await qrCodeRepository.getOperatorQRCode(operatorId);
    
    if (!operator) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    
    if (operator.qrCode) {
      try {
        await qrCodeService.deleteQRCode(operator.qrCode);
      } catch (delError) {
        console.warn('[QR] Failed to delete old QR code file:', delError.message);
      }
    }
    
    const qrCodeData = await qrCodeService.generateOperatorQRCode(operatorId, { saveToFile: true });
    await qrCodeRepository.storeOperatorQRCode(operatorId, qrCodeData.filePath, qrCodeData.dataURL);
    
    res.status(200).json({
      success: true,
      message: 'QR code regenerated successfully',
      data: {
        qrCode: qrCodeData.dataURL,
        filePath: qrCodeData.filePath,
        verificationUrl: qrCodeData.verificationUrl,
        operatorId
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteOperatorQRCode = async (req, res, next) => {
  try {
    const { operatorId } = req.params;
    const { operator, oldQRPath } = await qrCodeRepository.deleteOperatorQRCode(operatorId);
    
    if (oldQRPath) {
      await qrCodeService.deleteQRCode(oldQRPath).catch(() => {});
    }
    
    res.status(200).json({
      success: true,
      message: 'QR code deleted successfully',
      data: { operatorId, deletedPath: oldQRPath }
    });
  } catch (error) {
    if (error.message === 'Operator not found') {
      return res.status(404).json({ error: 'Operator not found' });
    }
    next(error);
  }
};

exports.getAllOperatorsWithQR = async (req, res, next) => {
  try {
    const operators = await qrCodeRepository.getAllOperatorsWithQR();
    
    res.status(200).json({
      success: true,
      count: operators.length,
      data: operators.map(op => ({
        operatorId: op.userId,
        driversID: op.driversID,
        name: `${op.firstName} ${op.lastName}`,
        qrCodePath: op.qrCode,
        generatedAt: op.qrCodeGeneratedAt
      }))
    });
  } catch (error) {
    next(error);
  }
};

exports.generateFranchiseQRCode = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    
    const qrCodeData = await qrCodeService.generateOperatorQRCode(applicationId, { saveToFile: true });
    await qrCodeRepository.storeFranchiseQRCode(applicationId, qrCodeData.filePath);
    
    res.status(200).json({
      success: true,
      message: 'QR code generated for franchise application',
      data: {
        qrCode: qrCodeData.dataURL,
        filePath: qrCodeData.filePath,
        verificationUrl: qrCodeData.verificationUrl,
        applicationId
      }
    });
  } catch (error) {
    if (error.message === 'Franchise application not found') {
      return res.status(404).json({ error: 'Franchise application not found' });
    }
    next(error);
  }
};

exports.downloadOperatorQRCode = async (req, res, next) => {
  try {
    const { operatorId } = req.params;
    const operator = await qrCodeRepository.getOperatorQRCode(operatorId);
    
    if (!operator || !operator.qrCode) {
      return res.status(404).json({ error: 'QR code not found' });
    }
    
    const filePath = operator.qrCode.replace(/^\//, '');
    const absolutePath = require('path').join(process.cwd(), filePath);
    
    if (!require('fs').existsSync(absolutePath)) {
      return res.status(404).json({ 
        error: 'QR code file not found on server',
        message: 'File may have been deleted. Try regenerating the QR code.'
      });
    }
    
    res.download(absolutePath, `operator-${operator.driversID}-qr.png`, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Failed to download QR code' });
      }
    });
  } catch (error) {
    next(error);
  }
};
