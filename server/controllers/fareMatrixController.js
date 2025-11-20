const fareMatrixRepository = require('../repositories/fareMatrixRepository');
const { uploadFileToR2, deleteFileFromR2 } = require('../services/cloudflareService');
const auditLogService = require('../services/auditLogService');

/**
 * Get current active fare matrix (public endpoint)
 * Returns the most recently uploaded fare matrix
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
 * - Uploads image to Cloudflare R2
 * - Deactivates previous fare matrix
 * - Saves new fare matrix as active
 */
exports.uploadFareMatrix = async (req, res, next) => {
  try {
    // Validate file exists
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file is image
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    console.log('[FareMatrix] Uploading to R2:', req.file.originalname);

    // Upload to Cloudflare R2
    const r2Result = await uploadFileToR2(req.file, 'fare-matrices');
    
    if (!r2Result.success) {
      return res.status(500).json({ error: 'Failed to upload to R2' });
    }

    // Get old active fare matrix to delete from R2
    const oldFareMatrix = await fareMatrixRepository.getActiveFareMatrix();
    if (oldFareMatrix && oldFareMatrix.r2FilePath) {
      try {
        await deleteFileFromR2(oldFareMatrix.r2FilePath);
        console.log('[FareMatrix] Old file deleted from R2');
      } catch (err) {
        console.error('[FareMatrix] Error deleting old file:', err.message);
        // Continue anyway - new file is uploaded
      }
    }

    // Deactivate all previous versions
    await fareMatrixRepository.deactivateOthers('NEW');

    // Create new fare matrix record
    const fareMatrixData = {
      imageUrl: r2Result.publicUrl,
      r2FilePath: r2Result.filePath,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.adminId || req.user.id || req.user._id.toString(),
      uploadedByName: req.user.name || req.user.email,
      isActive: true,
      createdAt: new Date()
    };

    const fareMatrix = await fareMatrixRepository.createFareMatrix(fareMatrixData);

    // Log upload
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
        uploadedTo: 'Cloudflare R2'
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
 * - Marks as inactive (soft delete)
 * - Deletes from Cloudflare R2
 */
exports.deleteFareMatrix = async (req, res, next) => {
  try {
    const fareMatrix = await fareMatrixRepository.getActiveFareMatrix();
    
    if (!fareMatrix) {
      return res.status(404).json({ 
        error: 'No active fare matrix to delete' 
      });
    }

    // Delete from R2 if exists
    if (fareMatrix.r2FilePath) {
      try {
        await deleteFileFromR2(fareMatrix.r2FilePath);
        console.log('[FareMatrix] File deleted from R2:', fareMatrix.r2FilePath);
      } catch (err) {
        console.error('[FareMatrix] Error deleting from R2:', err.message);
        // Continue with soft delete anyway
      }
    }

    // Soft delete the fare matrix
    const adminId = req.user.adminId || req.user.id || req.user._id.toString();
    await fareMatrixRepository.softDeleteFareMatrix(fareMatrix.fareMatrixId, adminId);

    // Log deletion
    await auditLogService.logAction({
      user: req.user,
      method: 'DELETE',
      route: '/api/fare-matrix',
      action: 'DELETE_FARE_MATRIX',
      statusCode: 200,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      resourceType: 'fare-matrix',
      resourceId: fareMatrix.fareMatrixId,
      details: {
        fileName: fareMatrix.fileName,
        deletedFrom: 'Cloudflare R2'
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
