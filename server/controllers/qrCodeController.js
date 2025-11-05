const qrCodeService = require('../services/qrCodeService');
const qrCodeRepository = require('../repositories/qrCodeRepository');

/**
 * Generate QR code for an operator
 * POST /api/qr/generate/operator/:operatorId
 * 
 * SIMPLE: Admin wants to create a QR code for an operator
 * INPUT: operatorId in URL
 * OUTPUT: QR code image (base64) and file path
 */
exports.generateOperatorQRCode = async (req, res, next) => {
  try {
    const { operatorId } = req.params;
    const { saveToFile = true } = req.body;
    
    if (!operatorId) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }
    
    console.log(`[QR] Generating QR code for operator: ${operatorId}`);
    
    // Generate QR code using service
    const qrCodeData = await qrCodeService.generateOperatorQRCode(operatorId, {
      saveToFile: saveToFile
    });
    
    // Save to database
    if (qrCodeData.filePath) {
      await qrCodeRepository.storeOperatorQRCode(
        operatorId,
        qrCodeData.filePath,
        qrCodeData.dataURL
      );
    }
    
    console.log(`[QR] Generated successfully: ${qrCodeData.filePath}`);
    
    res.status(200).json({
      success: true,
      message: 'QR code generated successfully',
      data: {
        qrCode: qrCodeData.dataURL,        // Base64 image to show immediately
        filePath: qrCodeData.filePath,      // Path to saved PNG file   
        verificationUrl: qrCodeData.verificationUrl,
        operatorId: operatorId
      }
    });
  } catch (error) {
    console.error('[QR] Generation error:', error);
    
    if (error.message === 'Operator not found') {
      return res.status(404).json({ error: 'Operator not found' });
    }
    
    next(error);
  }
};

/**
 * Get operator's QR code
 * GET /api/qr/operator/:operatorId
 * 
 * SIMPLE: Get the QR code that was already generated for an operator
 * INPUT: operatorId in URL
 * OUTPUT: QR code info (file path, when it was created)
 */
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
        driversID: operator.driversID,
        name: `${operator.firstName} ${operator.lastName}`,
        qrCodePath: operator.qrCode,
        qrCodeDataURL: operator.qrCodeDataURL,
        generatedAt: operator.qrCodeGeneratedAt
      }
    });
  } catch (error) {
    console.error('[QR] Get error:', error);
    next(error);
  }
};

/**
 * Regenerate QR code for an operator
 * PUT /api/qr/regenerate/operator/:operatorId
 * 
 * SIMPLE: Create a new QR code (replaces old one)
 * INPUT: operatorId in URL
 * OUTPUT: New QR code image and file path
 */
exports.regenerateOperatorQRCode = async (req, res, next) => {
  try {
    const { operatorId } = req.params;
    
    console.log(`[QR] Regenerating QR code for operator: ${operatorId}`);
    
    // Get old QR code info
    const operator = await qrCodeRepository.getOperatorQRCode(operatorId);
    
    if (!operator) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    
    // Delete old QR code file if exists
    if (operator.qrCode) {
      try {
        await qrCodeService.deleteQRCode(operator.qrCode);
        console.log(`[QR] Deleted old QR code: ${operator.qrCode}`);
      } catch (delError) {
        console.warn('[QR] Failed to delete old QR code file:', delError);
      }
    }
    
    // Generate new QR code
    const qrCodeData = await qrCodeService.generateOperatorQRCode(operatorId, {
      saveToFile: true
    });
    
    // Update database
    await qrCodeRepository.storeOperatorQRCode(
      operatorId,
      qrCodeData.filePath,
      qrCodeData.dataURL
    );
    
    console.log(`[QR] Regenerated successfully: ${qrCodeData.filePath}`);
    
    res.status(200).json({
      success: true,
      message: 'QR code regenerated successfully',
      data: {
        qrCode: qrCodeData.dataURL,
        filePath: qrCodeData.filePath,
        verificationUrl: qrCodeData.verificationUrl,
        operatorId: operatorId
      }
    });
  } catch (error) {
    console.error('[QR] Regeneration error:', error);
    next(error);
  }
};

/**
 * Delete QR code for an operator
 * DELETE /api/qr/operator/:operatorId
 * 
 * SIMPLE: Remove QR code (deletes file and database record)
 * INPUT: operatorId in URL
 * OUTPUT: Success message
 */
exports.deleteOperatorQRCode = async (req, res, next) => {
  try {
    const { operatorId } = req.params;
    
    console.log(`[QR] Deleting QR code for operator: ${operatorId}`);
    
    // Remove from database and get old file path
    const { operator, oldQRPath } = await qrCodeRepository.deleteOperatorQRCode(operatorId);
    
    // Delete physical file
    if (oldQRPath) {
      const deleted = await qrCodeService.deleteQRCode(oldQRPath);
      console.log(`[QR] File deletion ${deleted ? 'successful' : 'failed'}: ${oldQRPath}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'QR code deleted successfully',
      data: {
        operatorId: operatorId,
        deletedPath: oldQRPath
      }
    });
  } catch (error) {
    console.error('[QR] Deletion error:', error);
    
    if (error.message === 'Operator not found') {
      return res.status(404).json({ error: 'Operator not found' });
    }
    
    next(error);
  }
};

/**
 * Get all operators with QR codes
 * GET /api/qr/operators
 * 
 * SIMPLE: List all operators who have QR codes
 * INPUT: None
 * OUTPUT: Array of operators with QR codes
 */
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
    console.error('[QR] List error:', error);
    next(error);
  }
};

/**
 * Generate QR code for franchise application
 * POST /api/qr/generate/franchise/:applicationId
 * 
 * SIMPLE: Create QR code for a franchise application
 * INPUT: applicationId in URL
 * OUTPUT: QR code image and file path
 */
exports.generateFranchiseQRCode = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    
    console.log(`[QR] Generating QR code for franchise: ${applicationId}`);
    
    // Generate QR code
    const qrCodeData = await qrCodeService.generateOperatorQRCode(applicationId, {
      saveToFile: true
    });
    
    // Save to database
    await qrCodeRepository.storeFranchiseQRCode(applicationId, qrCodeData.filePath);
    
    console.log(`[QR] Franchise QR generated: ${qrCodeData.filePath}`);
    
    res.status(200).json({
      success: true,
      message: 'QR code generated for franchise application',
      data: {
        qrCode: qrCodeData.dataURL,
        filePath: qrCodeData.filePath,
        verificationUrl: qrCodeData.verificationUrl,
        applicationId: applicationId
      }
    });
  } catch (error) {
    console.error('[QR] Franchise generation error:', error);
    
    if (error.message === 'Franchise application not found') {
      return res.status(404).json({ error: 'Franchise application not found' });
    }
    
    next(error);
  }
};

/**
 * Download QR code as image
 * GET /api/qr/download/operator/:operatorId
 * 
 * SIMPLE: Download QR code PNG file
 * INPUT: operatorId in URL
 * OUTPUT: PNG file download
 */
exports.downloadOperatorQRCode = async (req, res, next) => {
  try {
    const { operatorId } = req.params;
    
    const operator = await qrCodeRepository.getOperatorQRCode(operatorId);
    
    if (!operator || !operator.qrCode) {
      return res.status(404).json({ error: 'QR code not found' });
    }
    
    const filePath = operator.qrCode.replace(/^\//, ''); // Remove leading slash
    const absolutePath = require('path').join(process.cwd(), filePath);
    
    // Check if file exists
    if (!require('fs').existsSync(absolutePath)) {
      return res.status(404).json({ 
        error: 'QR code file not found on server',
        message: 'File may have been deleted. Try regenerating the QR code.'
      });
    }
    
    // Send file for download
    res.download(absolutePath, `operator-${operator.driversID}-qr.png`, (err) => {
      if (err) {
        console.error('[QR] Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download QR code' });
        }
      }
    });
  } catch (error) {
    console.error('[QR] Download error:', error);
    next(error);
  }
};
