const fareMatrixRepository = require('../repositories/fareMatrixRepository');
const storage = require('../services/storageAdapter');
const auditLogService = require('../services/auditLogService');

/**
 * Get current active fare matrix (public endpoint)
 */
exports.getActiveFareMatrix = async (req, res, next) => {
  try {
    const fareMatrix = await fareMatrixRepository.getActiveFareMatrix();
    
    if (!fareMatrix) {
      return res.status(404).json({ 
        error: 'No fare matrix available',
        fareMatrix: null 
      });
    }

    return res.status(200).json({ 
      success: true, 
      fareMatrix 
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Upload new fare matrix (super-admin only)
 */
exports.uploadFareMatrix = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    console.log('[FareMatrix] Uploading:', req.file.originalname);

    const result = await storage.uploadFileToStorage(req.file, 'fare-matrices');
    
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to upload file' });
    }

    const oldFareMatrix = await fareMatrixRepository.getActiveFareMatrix();
    if (oldFareMatrix && oldFareMatrix.r2FilePath) {
      try {
        await storage.deleteFileFromStorage(oldFareMatrix.r2FilePath);
        console.log('[FareMatrix] Old file deleted');
      } catch (err) {
        console.error('[FareMatrix] Error deleting old file:', err.message);
      }
    }

    await fareMatrixRepository.deactivateOthers('NEW');

    const fareMatrixData = {
      imageUrl: result.publicUrl,
      r2FilePath: result.filePath,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.adminId || req.user.id || req.user._id.toString(),
      uploadedByName: req.user.name || 'Unknown Admin',
      isActive: true,
      createdAt: new Date()
    };

    const fareMatrix = await fareMatrixRepository.createFareMatrix(fareMatrixData);

    await auditLogService.logAction({
      user: req.user,
      method: 'POST',
      route: '/api/fare-matrix/upload',
      action: 'UPLOAD_FARE_MATRIX',
      statusCode: 201,
      ipAddress: req.ip || req.connection?.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'],
      resourceType: 'fare-matrix',
      resourceId: fareMatrix.fareMatrixId,
      details: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        storageBackend: storage.storageType
      }
    }).catch(err => console.error('Audit log error:', err));

    console.log('[FareMatrix] Successfully uploaded:', fareMatrix.fareMatrixId);

    return res.status(201).json({
      success: true,
      message: 'Fare matrix uploaded successfully',
      fareMatrix
    });
  } catch (error) {
    console.error('[FareMatrix] Upload error:', error);
    return next(error);
  }
};

/**
 * Delete active fare matrix (super-admin only)
 */
exports.deleteFareMatrix = async (req, res, next) => {
  try {
    const fareMatrix = await fareMatrixRepository.getActiveFareMatrix();
    
    if (!fareMatrix) {
      return res.status(404).json({ 
        error: 'No active fare matrix to delete' 
      });
    }

    if (fareMatrix.r2FilePath) {
      try {
        await storage.deleteFileFromStorage(fareMatrix.r2FilePath);
        console.log('[FareMatrix] File deleted:', fareMatrix.r2FilePath);
      } catch (err) {
        console.error('[FareMatrix] Error deleting file:', err.message);
      }
    }

    const adminId = req.user.adminId || req.user.id || req.user._id.toString();
    await fareMatrixRepository.softDeleteFareMatrix(fareMatrix.fareMatrixId, adminId);

    await auditLogService.logAction({
      user: req.user,
      method: 'DELETE',
      route: '/api/fare-matrix',
      action: 'DELETE_FARE_MATRIX',
      statusCode: 200,
      ipAddress: req.ip || req.connection?.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'],
      resourceType: 'fare-matrix',
      resourceId: fareMatrix.fareMatrixId,
      details: {
        fileName: fareMatrix.fileName,
        storageBackend: storage.storageType
      }
    }).catch(err => console.error('Audit log error:', err));

    console.log('[FareMatrix] Successfully deleted:', fareMatrix.fareMatrixId);

    return res.status(200).json({
      success: true,
      message: 'Fare matrix deleted successfully'
    });
  } catch (error) {
    console.error('[FareMatrix] Delete error:', error);
    return next(error);
  }
};
