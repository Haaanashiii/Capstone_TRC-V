const fareMatrixRepository = require('../repositories/fareMatrixRepository');
const { uploadFileToR2, deleteFileFromR2 } = require('../services/cloudflareService');
const auditLogService = require('../services/auditLogService');

/**
 * Get active fare matrix (public endpoint)
 * Anyone can view
 */
exports.getActiveFareMatrix = async (req, res, next) => {
  try {
    const fareMatrix = await fareMatrixRepository.getActiveFareMatrix();
    
    if (!fareMatrix) {
      return res.status(404).json({ 
        error: 'No active fare matrix available',
        fareMatrix: null 
      });
    }

    // Log view access
    if (req.user) {
      await auditLogService.logAction({
        user: req.user,
        method: 'GET',
        route: '/api/fare-matrix/active',
        action: 'VIEW_FARE_MATRIX',
        statusCode: 200,
        ipAddress: req.ip || req.connection?.remoteAddress || 'Unknown',
        userAgent: req.headers['user-agent'],
        resourceType: 'fare-matrix',
        resourceId: fareMatrix.fareMatrixId
      }).catch(err => console.error('Audit log error:', err));
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
 * Get all fare matrices (admin only)
 * Super Admin: all
 * Others: 403 Forbidden
 */
exports.getAllFareMatrices = async (req, res, next) => {
  try {
    // Check authorization: only super-admin
    if (!req.user || req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Only super-admin can view all fare matrices' });
    }

    const includeInactive = req.query.includeInactive === 'true';
    const fareMatrices = await fareMatrixRepository.getAllFareMatrices(includeInactive);

    // Log access
    await auditLogService.logAction({
      user: req.user,
      method: 'GET',
      route: '/api/fare-matrix/all',
      action: 'VIEW_ALL_FARE_MATRICES',
      statusCode: 200,
      ipAddress: req.ip || req.connection?.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'],
      resourceType: 'fare-matrix',
      details: { count: fareMatrices.length, includeInactive }
    }).catch(err => console.error('Audit log error:', err));

    return res.status(200).json({ 
      success: true, 
      count: fareMatrices.length,
      fareMatrices 
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Upload new fare matrix (super-admin only)
 * Automatically deactivates previous versions
 */
exports.uploadFareMatrix = async (req, res, next) => {
  try {
    // Check authorization: only super-admin
    if (!req.user || req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Only super-admin can upload fare matrix' });
    }

    // Validate file exists
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file is image
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    console.log('[FareMatrix] Uploading file to R2:', req.file.originalname);

    // Upload to Cloudflare R2
    const r2Result = await uploadFileToR2(req.file, 'fare-matrices');
    
    if (!r2Result.success) {
      return res.status(500).json({ error: 'Failed to upload to R2' });
    }

    // Create fare matrix record
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

    // Deactivate all previous versions
    await fareMatrixRepository.deactivateOthers('NEW');

    // Save new fare matrix
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
 * Replace fare matrix (super-admin only)
 * Replaces existing with new version and deactivates old
 */
exports.replaceFareMatrix = async (req, res, next) => {
  try {
    // Check authorization: only super-admin
    if (!req.user || req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Only super-admin can replace fare matrix' });
    }

    const { fareMatrixId } = req.params;

    // Validate file exists
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file is image
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    // Get old fare matrix
    const oldFareMatrix = await fareMatrixRepository.getFareMatrixById(fareMatrixId);
    if (!oldFareMatrix) {
      return res.status(404).json({ error: 'Fare matrix not found' });
    }

    console.log('[FareMatrix] Replacing fare matrix:', fareMatrixId);

    // Delete old file from R2 if exists
    if (oldFareMatrix.r2FilePath) {
      try {
        await deleteFileFromR2(oldFareMatrix.r2FilePath);
        console.log('[FareMatrix] Old file deleted from R2');
      } catch (err) {
        console.error('[FareMatrix] Error deleting old file:', err.message);
        // Continue anyway - new file is uploaded
      }
    }

    // Upload new file to R2
    const r2Result = await uploadFileToR2(req.file, 'fare-matrices');
    
    if (!r2Result.success) {
      return res.status(500).json({ error: 'Failed to upload to R2' });
    }

    // Update fare matrix record
    const updatedData = {
      imageUrl: r2Result.publicUrl,
      r2FilePath: r2Result.filePath,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    };

    const updatedFareMatrix = await fareMatrixRepository.updateFareMatrix(fareMatrixId, updatedData);

    // Log replacement
    await auditLogService.logAction({
      user: req.user,
      method: 'PUT',
      route: `/api/fare-matrix/${fareMatrixId}/replace`,
      action: 'REPLACE_FARE_MATRIX',
      statusCode: 200,
      ipAddress: req.ip || req.connection?.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'],
      resourceType: 'fare-matrix',
      resourceId: fareMatrixId,
      details: {
        oldFileName: oldFareMatrix.fileName,
        newFileName: req.file.originalname,
        fileSize: req.file.size
      }
    }).catch(err => console.error('Audit log error:', err));

    console.log('[FareMatrix] Successfully replaced:', fareMatrixId);

    return res.status(200).json({
      success: true,
      message: 'Fare matrix replaced successfully',
      fareMatrix: updatedFareMatrix
    });
  } catch (error) {
    console.error('[FareMatrix] Replace error:', error);
    return next(error);
  }
};

/**
 * Soft delete fare matrix (super-admin only)
 * Mark as inactive but keep record
 */
exports.softDeleteFareMatrix = async (req, res, next) => {
  try {
    // Check authorization: only super-admin
    if (!req.user || req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Only super-admin can delete fare matrix' });
    }

    const { fareMatrixId } = req.params;

    // Get fare matrix
    const fareMatrix = await fareMatrixRepository.getFareMatrixById(fareMatrixId);
    if (!fareMatrix) {
      return res.status(404).json({ error: 'Fare matrix not found' });
    }

    // Soft delete
    const deletedFareMatrix = await fareMatrixRepository.softDeleteFareMatrix(
      fareMatrixId,
      req.user.adminId || req.user.id || req.user._id.toString()
    );

    // Log deletion
    await auditLogService.logAction({
      user: req.user,
      method: 'DELETE',
      route: `/api/fare-matrix/${fareMatrixId}`,
      action: 'DELETE_FARE_MATRIX',
      statusCode: 200,
      ipAddress: req.ip || req.connection?.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'],
      resourceType: 'fare-matrix',
      resourceId: fareMatrixId,
      details: {
        fileName: fareMatrix.fileName,
        deletionType: 'soft-delete'
      }
    }).catch(err => console.error('Audit log error:', err));

    return res.status(200).json({
      success: true,
      message: 'Fare matrix deleted',
      fareMatrix: deletedFareMatrix
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get fare matrix by ID (admin view)
 * Super Admin: view any
 * BPLO Admin: view any
 * Others: 403
 */
exports.getFareMatrixById = async (req, res, next) => {
  try {
    // Check authorization: admin only
    if (!req.user || !['super-admin', 'sb-admin', 'bplo-admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { fareMatrixId } = req.params;
    const fareMatrix = await fareMatrixRepository.getFareMatrixById(fareMatrixId);

    if (!fareMatrix) {
      return res.status(404).json({ error: 'Fare matrix not found' });
    }

    // Log view
    await auditLogService.logAction({
      user: req.user,
      method: 'GET',
      route: `/api/fare-matrix/${fareMatrixId}`,
      action: 'VIEW_FARE_MATRIX_DETAILS',
      statusCode: 200,
      ipAddress: req.ip || req.connection?.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'],
      resourceType: 'fare-matrix',
      resourceId: fareMatrixId
    }).catch(err => console.error('Audit log error:', err));

    return res.status(200).json({
      success: true,
      fareMatrix
    });
  } catch (error) {
    return next(error);
  }
};
