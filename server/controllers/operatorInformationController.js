const operatorInformationRepository = require('../repositories/operatorInformationRepository');
const { generateOperatorQRCode, deleteQRCode } = require('../services/qrCodeService');

exports.createOperatorInformation = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'Request body is required' });
    }
    
    // Prevent id injection and prototype pollution
    const { id, _id, ...body } = req.body;
    for (const k of ['__proto__', 'prototype', 'constructor']) delete body[k];
    
    // Handle file uploads from multer
    if (req.files) {
      // Profile photo
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
    
    // Create operator information
    const operatorInformation = await operatorInformationRepository.createOperatorInformation(body);
    
    // Generate QR code for the operator
    try {
      const qrCodeData = await generateOperatorQRCode(operatorInformation._id, { saveToFile: true });
      
      // Update operator with QR code path
      operatorInformation.qrCode = qrCodeData.filePath;
      await operatorInformation.save();
      
      console.log(`[QR GENERATED] Operator: ${operatorInformation._id}, File: ${qrCodeData.filePath}`);
    } catch (qrError) {
      console.error('QR Code generation failed:', qrError);
      // Continue without QR code - can be generated later
    }

    return res.status(201).json({
      success: true,
      message: 'Operator information created successfully',
      data: operatorInformation
    });
  }
  catch (error) {
    if (error?.name === 'SequelizeUniqueConstraintError' || error?.code === 11000) {
      return res.status(409).json({ error: 'Duplicate operator information' });
    }
    return next(error);
  }
};

exports.getOperatorInformation = async (req, res, next) => {
  try {
    if (!req.params?.id) {
      return res.status(400).json({ error: 'id param is required' });
    }
    const operatorInformation = await operatorInformationRepository.getOperatorInformationById(req.params.id);
    if (!operatorInformation) {
      return res.status(404).json({ error: 'Operator information not found' });
    }
    return res.status(200).json(operatorInformation);
  } catch (error) {
    if (error?.name === 'CastError' || /invalid input syntax.*uuid/i.test(error?.message || '')) {
      return res.status(400).json({ error: 'Invalid id format' });
    }
    return next(error);
  }
};

exports.updateOperatorInformation = async (req, res, next) => {
  try {
    const operatorInformation = await operatorInformationRepository.updateOperatorInformation(req.params.id, req.body);
    if (!operatorInformation) {
      return res.status(404).json({ error: 'Operator information not found' });
    }
    res.status(200).json(operatorInformation);
  } catch (error) {
    next(error);
  }
};

exports.deleteOperatorInformation = async (req, res, next) => {
  try {
    const operatorInformation = await operatorInformationRepository.deleteOperatorInformation(req.params.id);
    if (!operatorInformation) {
      return res.status(404).json({ error: 'Operator information not found' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

exports.operatorQRIDLookup = async (req, res, next) => {
  try {
    if (!req.params?.operatorId) {
      return res.status(400).json({ error: 'operatorId param is required' });
    }
    
    const operatorInformation = await operatorInformationRepository.getOperatorInformationById(req.params.operatorId);
    
    if (!operatorInformation) {
      return res.status(404).json({ error: 'Operator information not found' });
    }
    
    // Log QR scan for audit trail
    const ipAddress = req.ip || req.socket.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
    console.log(`[QR SCAN] Operator: ${req.params.operatorId}, IP: ${ipAddress}, Time: ${new Date().toISOString()}`);
    
    // Return only public information for QR code display
    const publicData = {
      driversID: operatorInformation.driversID,
      firstName: operatorInformation.firstName,
      lastName: operatorInformation.lastName,
      middleName: operatorInformation.middleName,
      suffix: operatorInformation.suffix || '',
      address: operatorInformation.address,
      barangay: operatorInformation.barangay,
      profilePhoto: operatorInformation.profilePhoto || null,
      franchiseStatus: operatorInformation.franchiseStatus
    };
    
    return res.status(200).json(publicData);
  } catch (error) {
    if (error?.name === 'CastError' || /invalid input syntax.*uuid/i.test(error?.message || '')) {
      return res.status(400).json({ error: 'Invalid operatorId format' });
    }
    return next(error);
  }
};

exports.regenerateQRCode = async (req, res, next) => {
  try {
    const { operatorId } = req.params;
    
    if (!operatorId) {
      return res.status(400).json({ error: 'operatorId param is required' });
    }
    
    const operatorInformation = await operatorInformationRepository.getOperatorInformationById(operatorId);
    
    if (!operatorInformation) {
      return res.status(404).json({ error: 'Operator information not found' });
    }
    
    // Delete old QR code if it exists
    if (operatorInformation.qrCode) {
      await deleteQRCode(operatorInformation.qrCode);
    }
    
    // Generate new QR code
    const qrCodeData = await generateOperatorQRCode(operatorId, { saveToFile: true });
    
    // Update operator with new QR code path
    operatorInformation.qrCode = qrCodeData.filePath;
    await operatorInformation.save();
    
    console.log(`[QR REGENERATED] Operator: ${operatorId}, File: ${qrCodeData.filePath}`);
    
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
