const mongoose = require('mongoose');
const franchiseApplicationRepository = require('../repositories/franchiseApplicationRepository');
const FranchiseApplication = require('../models/franchiseApplicationModel');
const FranchiseInformation = require('../models/franchiseInformationModel');
const { uploadFile, validateFile, moveFilesToInformation } = require('../services/fileUploadService');
const { generateHashedFranchiseNo, generateQRCodeBuffer, handleVersionControl, validateFranchiseStatus } = require('../utils/franchiseHelpers');
const storage = require('../services/storageAdapter');
const { auditLogService } = require('../services/auditLogService');
const { sendBPLOApprovalNotification, sendSBApprovalNotification } = require('../services/notificationQueueService');
const cacheManager = require('../utils/cache');
const crypto = require('crypto');

// Helper to invalidate QR cache when franchise data changes
const invalidateQRCache = (franchiseNumber) => {
  if (!franchiseNumber) return;
  const hash = crypto.createHash('sha256').update(franchiseNumber).digest('hex').substring(0, 16);
  cacheManager.delete(`qr-scan-${hash}`);
};

// 1) CREATE NEW APPLICATION
exports.createNewApplication = async (req, res, next) => {
  try {
    const { body, files, user } = req;
    const userId = user?._id || user?.userId || String(user?.id);
    const adminUsername = user?.username || user?.email || 'BPLO Admin';
    
    let userEmail = user?.email || '';
    if (!userEmail && userId) {
      try {
        const User = require('../models/userAccountModel');
        const foundUser = await User.findById(userId).select('email');
        if (foundUser?.email) userEmail = foundUser.email;
      } catch (emailError) {}
    }
    
    // Determine if this is a walk-in application
    const isWalkIn = body.isWalkIn === 'true' || body.isWalkIn === true;
    
    // Walk-in applications submitted by BPLO Admin go directly to SB
    // OR is optional at submission - SB can also add it during their review
    let initialStatus = 'pending';
    let bploApprovalData = {};
    
    if (isWalkIn) {
      // Walk-in always goes directly to SB queue (awaiting-sb)
      // OR is optional - BPLO can include it, or SB can add it later
      initialStatus = 'awaiting-sb';
      
      // Set BPLO approval metadata for walk-in applications
      bploApprovalData = {
        bploApprovedBy: adminUsername,
        bploApprovedAt: new Date(),
        bploInspectionRequired: false // Walk-in already inspected at counter
      };
    }
    
    const applicationData = {
      operatorName: body.operatorName,
      operatorContactNumber: body.operatorContactNumber,
      operatorAddress: body.operatorAddress,
      operatorBarangay: body.operatorBarangay,
      operatorCivilStatus: body.operatorCivilStatus,
      operatorBirthPlace: body.operatorBirthPlace,
      operatorBirthDate: body.operatorBirthDate ? new Date(body.operatorBirthDate) : null,
      operatorCitizenship: body.operatorCitizenship,
      operatorEmail: body.operatorEmail || userEmail,
      coOwnerName: body.coOwnerName || '',
      coOwnerAddress: body.coOwnerAddress || '',
      driverName: body.driverName,
      driversAddress: body.driversAddress,
      todaMembership: body.todaMembership || '',
      unitModel: body.unitModel,
      colorMotor: body.colorMotor,
      sideCarColor: body.sideCarColor,
      mvPlateNo: body.mvPlateNo,
      motorEngineNo: body.motorEngineNo,
      chasisNo: body.chasisNo,
      applicationType: 'new',
      statusOfBPLO: initialStatus,
      operatorInfo: userId,
      isWalkIn: isWalkIn,
      officialReceiptNumber: body.officialReceiptNumber || '',
      orSubmittedAt: body.orSubmittedAt ? new Date(body.orSubmittedAt) : null,
      ...bploApprovalData
    };
    
    const application = await franchiseApplicationRepository.createFranchiseApplication(applicationData);
    const appId = String(application._id);
    
    // For walk-in NEW applications, assign franchise number immediately (same as BPLO approval)
    if (isWalkIn && body.applicationType !== 'renewal' && body.applicationType !== 'change-unit') {
      try {
        // Get available franchise numbers from both completed franchises and pending applications
        const allCurrentFranchises = await FranchiseInformation.find({
          isCurrentVersion: true
        }).select('franchiseNumber franchiseStatus').lean().exec();
        
        const allPendingApplications = await FranchiseApplication.find({
          applicationType: 'new',
          franchiseNumber: { $exists: true, $ne: null },
          statusOfBPLO: { $in: ['bplo-approved', 'awaiting-sb', 'sb-approved', 'completed'] }
        }).select('franchiseNumber').lean().exec();
        
        const franchiseMap = new Map();
        let latestNumber = 0;
        
        for (const franchise of allCurrentFranchises) {
          const numberMatch = franchise.franchiseNumber?.match(/^(\d{1,4})$/);
          if (!numberMatch) continue;
          const franchiseNum = parseInt(numberMatch[1], 10);
          latestNumber = Math.max(latestNumber, franchiseNum);
          const isRevoked = franchise.franchiseStatus?.toLowerCase() === 'revoked';
          franchiseMap.set(franchiseNum, { available: isRevoked, reserved: false });
        }
        
        for (const pendingApp of allPendingApplications) {
          const numberMatch = pendingApp.franchiseNumber?.match(/^(\d{1,4})$/);
          if (!numberMatch) continue;
          const franchiseNum = parseInt(numberMatch[1], 10);
          latestNumber = Math.max(latestNumber, franchiseNum);
          franchiseMap.set(franchiseNum, { available: false, reserved: true });
        }
        
        let assignedNumber = null;
        for (let i = 1; i <= latestNumber; i++) {
          const franchise = franchiseMap.get(i);
          if (!franchise || franchise.available) {
            assignedNumber = i;
            break;
          }
        }
        
        if (!assignedNumber) {
          assignedNumber = latestNumber + 1;
        }
        
        const franchiseNumber = String(assignedNumber).padStart(4, '0');
        await franchiseApplicationRepository.updateFranchiseApplication(appId, { franchiseNumber });
        console.log(`[Walk-in] Assigned franchise number ${franchiseNumber} to application ${appId}`);
      } catch (numberError) {
        console.error('[Walk-in] Failed to assign franchise number:', numberError.message);
        // Continue without franchise number - can be assigned manually later
      }
    }
    
    if (userId) {
      try {
        const User = require('../models/userAccountModel');
        await User.findByIdAndUpdate(userId, { $addToSet: { franchiseApplications: application._id } }, { new: true });
      } catch (linkError) {}
    }
    
    if (files && Object.keys(files).length > 0) {
      const uploadAsync = (async () => {
        try {
          // Map field names to clean document type names for better file naming
          const documentTypeMap = {
            'motorRegistrationObj': 'motor-registration',
            'barangayClearanceObj': 'barangay-clearance',
            'cedulaObj': 'cedula',
            'driversLicenseObj': 'drivers-license',
            'votersAffidavitObj': 'voters-affidavit',
            'motorChassisStencilObj': 'chassis-stencil',
            'driverPictureObj': 'driver-photo',
            'operatorPictureObj': 'operator-photo',
            'oRLTOObj': 'or-lto',
            'cRLTOObj': 'cr-lto',
            'oRTreasurerOfficeObj': 'or-treasurer'
          };
          
          const uploadHelper = async (fieldName, category) => {
            const fileArray = files[fieldName];
            if (!fileArray?.[0]) return null;
            validateFile(fileArray[0]);
            const documentType = documentTypeMap[fieldName] || fieldName.replace(/Obj$/, '').toLowerCase();
            const result = await uploadFile(fileArray[0].buffer, fileArray[0].originalname, fileArray[0].mimetype,
              { baseFolder: 'franchiseApplications', subFolder: userId, applicationId: appId, category, documentType });
            return result.url;
          };
          
          const [motorReg, barangay, cedula, license, affidavit, stencil, driverPic, operatorPic, orLTO, crLTO, orTreasurer] = await Promise.all([
            uploadHelper('motorRegistrationObj', 'Documentations'),
            uploadHelper('barangayClearanceObj', 'Documentations'),
            uploadHelper('cedulaObj', 'Documentations'),
            uploadHelper('driversLicenseObj', 'Documentations'),
            uploadHelper('votersAffidavitObj', 'Documentations'),
            uploadHelper('motorChassisStencilObj', 'Documentations'),
            uploadHelper('driverPictureObj', 'ProfilePictures'),
            uploadHelper('operatorPictureObj', 'ProfilePictures'),
            uploadHelper('oRLTOObj', 'Documentations'),
            uploadHelper('cRLTOObj', 'Documentations'),
            uploadHelper('oRTreasurerOfficeObj', 'Documentations')
          ]);
          
          const updateData = {};
          if (motorReg) updateData['documents.motorRegistrationObj'] = motorReg;
          if (barangay) updateData['documents.barangayClearanceObj'] = barangay;
          if (cedula) updateData['documents.cedulaObj'] = cedula;
          if (license) updateData['documents.driversLicenseObj'] = license;
          if (affidavit) updateData['documents.votersAffidavitObj'] = affidavit;
          if (stencil) updateData['documents.motorChassisStencilObj'] = stencil;
          if (driverPic) updateData['documents.driverPictureObj'] = driverPic;
          if (operatorPic) updateData['documents.operatorPictureObj'] = operatorPic;
          if (orLTO) updateData['documents.oRLTOObj'] = orLTO;
          if (crLTO) updateData['documents.cRLTOObj'] = crLTO;
          if (orTreasurer) updateData['documents.oRTreasurerOfficeObj'] = orTreasurer;
          
          console.log('[Upload] Documents to save:', Object.keys(updateData));
          
          if (Object.keys(updateData).length > 0) {
            await franchiseApplicationRepository.updateFranchiseApplication(appId, updateData);
            console.log('[Upload] Documents saved to application:', appId);
          } else {
            console.log('[Upload] No documents uploaded for application:', appId);
          }
        } catch (uploadError) {
          console.error('[Upload] FAILED for application:', appId, uploadError.message);
          if (req.app.get('io') && userId) {
            try {
              req.app.get('io').to(`user-${userId}`).emit('file-upload-error', {
                applicationId: appId,
                message: 'Some documents failed to upload. Please try re-uploading them.',
                error: uploadError.message
              });
            } catch (wsError) {}
          }
        }
      })();
      uploadAsync.catch((err) => {
        console.error('[Upload] Async upload failed:', err.message);
      });
    }
    
    const finalApplication = await franchiseApplicationRepository.getFranchiseApplicationById(appId);
    
    if (user) {
      await auditLogService.logApplicationCreation(finalApplication, user, req).catch(() => {});
    }
    
    try {
      const io = req.app.get('io');
      if (io) {
        // Notify appropriate admins based on application status
        if (isWalkIn) {
          // Walk-in applications go to SB admins (already BPLO approved)
          const sbApplications = await FranchiseApplication.find({
            statusOfBPLO: { $in: ['bplo-approved', 'awaiting-sb', 'sb-approved'] }
          }).sort({ sbApprovedAt: -1, bploApprovedAt: -1, orSubmittedAt: -1 });
          io.to('sb-admins').emit('approved-applications', sbApplications);
          console.log(`[Walk-in] Notified SB admins - Application ${appId} status: ${initialStatus}`);
        } else {
          // Regular applications go to BPLO admins first
          io.to('bplo-admin').emit('pending-applications', [finalApplication]);
        }
        io.to('general').emit('application-updated', finalApplication);
      }
    } catch (wsError) {}
    
    if (finalApplication.isWalkIn) {
      try {
        const { sendWalkInApplicationNotification } = require('../services/notificationQueueService');
        await sendWalkInApplicationNotification(finalApplication).catch(() => {});
      } catch (notifError) {}
    }
    
    // Prepare appropriate response message
    const responseMessage = isWalkIn 
      ? 'Walk-in application submitted and forwarded to SB for approval.'
      : 'Franchise application submitted successfully.';
    
    res.status(201).json({ success: true, data: finalApplication, message: responseMessage });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return res.status(400).json({ success: false, error: `Duplicate ${field}: A franchise application with this ${field} already exists.` });
    }
    next(error);
  }
};

// 2) GET PENDING FRANCHISES (All statuses for user)
exports.getPendingFranchises = async (req, res, next) => {
  try {
    const { getPaginationParams } = require('../utils/cache');
    const { page, limit, status } = req.query;
    const { skip, limit: pageLimit, page: pageNum } = getPaginationParams(page, limit);
    
    const userId = req.user?._id?.toString() || req.user?.userId || String(req.user?.id);
    const userEmail = req.user?.email;
    
    const filter = {
      $or: [
        { operatorInfo: userId },
        ...(userEmail ? [{ operatorEmail: userEmail }] : [])
      ]
    };
    
    if (status) {
      filter.statusOfBPLO = status;
    } else {
      filter.statusOfBPLO = { $in: ['pending', 'bplo-approved', 'awaiting-sb', 'sb-approved', 'bplo-disapproved'] };
    }
    
    const total = await FranchiseApplication.countDocuments(filter);
    const applications = await FranchiseApplication
      .find(filter)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(pageLimit)
      .lean();
    
    // Enrich documents with proper metadata (display names, types, etc.)
    const enrichedApplications = await Promise.all(
      applications.map(async (app) => {
        const converted = storage.convertGridFSUrls(app);
        if (converted.documents) {
          converted.documents = await storage.enrichDocumentsWithMetadata(app.documents, {
            operatorName: app.operatorName,
            submittedAt: app.submittedAt
          });
        }
        return converted;
      })
    );
    
    res.json({ 
      success: true, 
      data: enrichedApplications,
      pagination: { page: pageNum, limit: pageLimit, total, pages: Math.ceil(total / pageLimit) }
    });
  } catch (error) {
    next(error);
  }
};

// 3) GET SPECIFIC PENDING FRANCHISE
exports.getSpecificPendingFranchise = async (req, res, next) => {
  try {
    const { id } = req.params;
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Allow viewing various application statuses for users
    const allowedStatuses = ['pending', 'bplo-disapproved', 'bplo-approved', 'awaiting-sb'];
    if (!allowedStatuses.includes(application.statusOfBPLO)) {
      return res.status(403).json({ error: 'Cannot access this application' });
    }
    
    // Check if user owns this application
    const userId = req.user?._id?.toString() || req.user?.userId || String(req.user?.id);
    const appUserId = application.operatorInfo?.toString();
    if (userId !== appUserId && !['bplo-admin', 'sb-admin', 'super-admin'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'You can only view your own applications' });
    }
    
    // Convert gridfs:// URLs to HTTP URLs and enrich documents with metadata
    const appObj = application.toObject ? application.toObject() : application;
    const appData = storage.convertGridFSUrls(appObj);
    
    // Enrich documents with proper display names
    if (appData.documents) {
      appData.documents = await storage.enrichDocumentsWithMetadata(appObj.documents, {
        operatorName: appObj.operatorName,
        submittedAt: appObj.submittedAt
      });
    }
    
    res.json({ success: true, data: appData });
  } catch (error) {
    next(error);
  }
};

// 4) EDIT PENDING FRANCHISE
exports.editPendingFranchise = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { body, files } = req;
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
    
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.statusOfBPLO !== 'pending' && application.statusOfBPLO !== 'bplo-disapproved') {
      return res.status(400).json({ error: 'Can only edit pending or disapproved applications' });
    }
    
    const userId = req.user?._id?.toString() || req.user?.userId || String(req.user?.id);
    const appUserId = application.operatorInfo?.toString();
    if (userId !== appUserId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'You can only edit your own applications' });
    }
    
    const updateData = { ...body };
    if (application.statusOfBPLO === 'bplo-disapproved') {
      updateData.statusOfBPLO = 'pending';
      updateData.bploDisapprovedReason = null;
      updateData.submittedAt = new Date();
    }
    
    if (files && Object.keys(files).length > 0) {
      const uploadAsync = (async () => {
        try {
          const { uploadFile, validateFile } = require('../services/fileUploadService');
          
          const uploadHelper = async (fieldName, category) => {
            const fileArray = files[fieldName];
            if (!fileArray?.[0]) return null;
            validateFile(fileArray[0]);
            const result = await uploadFile(fileArray[0].buffer, fileArray[0].originalname, fileArray[0].mimetype,
              { baseFolder: 'franchiseApplications', subFolder: userId, applicationId: id, category });
            return result.url;
          };
          
          const [motorReg, barangay, cedula, license, affidavit, stencil, driverPic, operatorPic, orLTO, crLTO] = await Promise.all([
            uploadHelper('motorRegistrationObj', 'Documentations'),
            uploadHelper('barangayClearanceObj', 'Documentations'),
            uploadHelper('cedulaObj', 'Documentations'),
            uploadHelper('driversLicenseObj', 'Documentations'),
            uploadHelper('votersAffidavitObj', 'Documentations'),
            uploadHelper('motorChassisStencilObj', 'Documentations'),
            uploadHelper('driverPictureObj', 'ProfilePictures'),
            uploadHelper('operatorPictureObj', 'ProfilePictures'),
            uploadHelper('oRLTOObj', 'Documentations'),
            uploadHelper('cRLTOObj', 'Documentations')
          ]);
          
          const fileUpdateData = {};
          if (motorReg) fileUpdateData['documents.motorRegistrationObj'] = motorReg;
          if (barangay) fileUpdateData['documents.barangayClearanceObj'] = barangay;
          if (cedula) fileUpdateData['documents.cedulaObj'] = cedula;
          if (license) fileUpdateData['documents.driversLicenseObj'] = license;
          if (affidavit) fileUpdateData['documents.votersAffidavitObj'] = affidavit;
          if (stencil) fileUpdateData['documents.motorChassisStencilObj'] = stencil;
          if (driverPic) fileUpdateData['documents.driverPictureObj'] = driverPic;
          if (operatorPic) fileUpdateData['documents.operatorPictureObj'] = operatorPic;
          if (orLTO) fileUpdateData['documents.oRLTOObj'] = orLTO;
          if (crLTO) fileUpdateData['documents.cRLTOObj'] = crLTO;
          
          if (Object.keys(fileUpdateData).length > 0) {
            await franchiseApplicationRepository.updateFranchiseApplication(id, fileUpdateData);
          }
        } catch (uploadError) {
          if (req.app.get('io') && userId) {
            try {
              req.app.get('io').to(`user-${userId}`).emit('file-upload-error', {
                applicationId: id,
                message: 'Some documents failed to upload. Please try re-uploading them.',
                error: uploadError.message
              });
            } catch (wsError) {}
          }
        }
      })();
      uploadAsync.catch(() => {});
    }
    
    const updated = await franchiseApplicationRepository.updateFranchiseApplication(id, updateData);
    
    if (req.user) {
      await auditLogService.logApplicationEdit(updated, req.user, req).catch(() => {});
    }
    
    if (application.statusOfBPLO === 'bplo-disapproved' && req.app.get('io')) {
      try {
        const FranchiseApplication = require('../models/franchiseApplicationModel');
        const pendingApplications = await FranchiseApplication.find({ statusOfBPLO: 'pending' }).sort({ submittedAt: -1 });
        req.app.get('io').to('bplo-admins').emit('pending-applications', pendingApplications);
      } catch (wsError) {}
    }
    
    res.json({ 
      success: true, 
      data: updated,
      message: application.statusOfBPLO === 'bplo-disapproved' ? 
        'Application resubmitted successfully. It will be reviewed by BPLO again.' :
        'Application updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// 5) CREATE RENEWAL OR AMENDMENT
exports.createRenewOrAmendment = async (req, res, next) => {
  try {
    const { applicationType, body, files, user } = req;
    const userId = user?._id || user?.userId || String(user?.id);
    
    console.log('[createRenewOrAmendment] Creating renewal/amendment application');
    console.log('[createRenewOrAmendment] User ID:', userId);
    console.log('[createRenewOrAmendment] Application Type:', applicationType || body?.applicationType);
    
    const appType = applicationType || body?.applicationType;
    
    if (!appType) {
      return res.status(400).json({ error: 'applicationType is required' });
    }
    
    // Fetch user email from database
    let userEmail = user?.email || '';
    if (!userEmail && userId) {
      try {
        const User = require('../models/userAccountModel');
        const foundUser = await User.findById(userId).select('email');
        if (foundUser && foundUser.email) {
          userEmail = foundUser.email;
          console.log('[createRenewOrAmendment] Fetched user email from DB:', userEmail);
        }
      } catch (emailError) {
        console.error('[createRenewOrAmendment] Failed to fetch user email:', emailError);
      }
    }
    
    // Find the user's latest active franchise (isCurrentVersion: true)
    // This is the franchise they are renewing or amending
    const existingFranchise = await FranchiseInformation.findOne({
      linkedUser: userId,
      isCurrentVersion: true
    }).sort({ createdAt: -1 });
    
    if (!existingFranchise) {
      console.error('[createRenewOrAmendment] No active franchise found for user:', userId);
      return res.status(404).json({ error: 'No active franchise found. Please apply for a franchise first.' });
    }
    
    console.log('[createRenewOrAmendment] Found existing franchise:', {
      franchiseNumber: existingFranchise.franchiseNumber,
      franchiseChainId: existingFranchise.franchiseChainId,
      franchiseStatus: existingFranchise.franchiseStatus,
      version: existingFranchise.version
    });
    
    if (!validateFranchiseStatus(existingFranchise, appType)) {
      return res.status(400).json({ error: `Cannot ${appType} this franchise (status: ${existingFranchise.franchiseStatus})` });
    }
    
    // Pre-fill data based on application type
    const applicationData = {
      applicationType: appType,
      relatedFranchise: existingFranchise._id,
      operatorInfo: userId,
      statusOfBPLO: 'pending',
      ...(appType === 'amendment' ? {
        // Amendment: Update operator information, keep motor + driver
        operatorName: body.operatorName || existingFranchise.operatorName,
        operatorContactNumber: body.operatorContactNumber || existingFranchise.operatorContactNumber,
        operatorAddress: body.operatorAddress || existingFranchise.operatorAddress,
        operatorBarangay: body.operatorBarangay || existingFranchise.operatorBarangay,
        operatorCivilStatus: body.operatorCivilStatus || existingFranchise.operatorCivilStatus,
        operatorBirthPlace: body.operatorBirthPlace || existingFranchise.operatorBirthPlace,
        operatorBirthDate: body.operatorBirthDate ? new Date(body.operatorBirthDate) : existingFranchise.operatorBirthDate,
        operatorCitizenship: body.operatorCitizenship || existingFranchise.operatorCitizenship,
        operatorEmail: userEmail || body.operatorEmail || existingFranchise.operatorEmail,
        coOwnerName: body.coOwnerName || existingFranchise.coOwnerName,
        coOwnerAddress: body.coOwnerAddress || existingFranchise.coOwnerAddress,
        // Keep existing motor and driver info
        driverName: existingFranchise.driverName,
        driversAddress: existingFranchise.driversAddress,
        todaMembership: existingFranchise.todaMembership,
        unitModel: existingFranchise.unitModel,
        colorMotor: existingFranchise.colorMotor,
        sideCarColor: existingFranchise.sideCarColor,
        mvPlateNo: existingFranchise.mvPlateNo,
        motorEngineNo: existingFranchise.motorEngineNo,
        chasisNo: existingFranchise.chasisNo
      } : appType === 'change_unit' ? {
        // Change Unit: Keep operator, update motor + driver
        operatorName: existingFranchise.operatorName,
        operatorContactNumber: existingFranchise.operatorContactNumber,
        operatorAddress: existingFranchise.operatorAddress,
        operatorBarangay: existingFranchise.operatorBarangay,
        operatorCivilStatus: existingFranchise.operatorCivilStatus,
        operatorBirthPlace: existingFranchise.operatorBirthPlace,
        operatorBirthDate: existingFranchise.operatorBirthDate,
        operatorCitizenship: existingFranchise.operatorCitizenship,
        operatorEmail: userEmail || existingFranchise.operatorEmail,
        coOwnerName: existingFranchise.coOwnerName,
        coOwnerAddress: existingFranchise.coOwnerAddress,
        // Allow updates to motor/driver info
        driverName: body.driverName || existingFranchise.driverName,
        driversAddress: body.driversAddress || existingFranchise.driversAddress,
        todaMembership: body.todaMembership || existingFranchise.todaMembership,
        unitModel: body.unitModel || existingFranchise.unitModel,
        colorMotor: body.colorMotor || existingFranchise.colorMotor,
        sideCarColor: body.sideCarColor || existingFranchise.sideCarColor,
        mvPlateNo: body.mvPlateNo || existingFranchise.mvPlateNo,
        motorEngineNo: body.motorEngineNo || existingFranchise.motorEngineNo,
        chasisNo: body.chasisNo || existingFranchise.chasisNo
      } : {
        // Renewal: Keep everything from existing franchise, extend expiry date
        operatorName: existingFranchise.operatorName,
        operatorContactNumber: existingFranchise.operatorContactNumber,
        operatorAddress: existingFranchise.operatorAddress,
        operatorBarangay: existingFranchise.operatorBarangay,
        operatorCivilStatus: existingFranchise.operatorCivilStatus,
        operatorBirthPlace: existingFranchise.operatorBirthPlace,
        operatorBirthDate: existingFranchise.operatorBirthDate,
        operatorCitizenship: existingFranchise.operatorCitizenship,
        operatorEmail: userEmail || existingFranchise.operatorEmail,
        coOwnerName: existingFranchise.coOwnerName,
        coOwnerAddress: existingFranchise.coOwnerAddress,
        driverName: existingFranchise.driverName,
        driversAddress: existingFranchise.driversAddress,
        todaMembership: existingFranchise.todaMembership,
        unitModel: existingFranchise.unitModel,
        colorMotor: existingFranchise.colorMotor,
        sideCarColor: existingFranchise.sideCarColor,
        sideCarPlateNumber: existingFranchise.sideCarPlateNumber,
        mvPlateNo: existingFranchise.mvPlateNo,
        motorEngineNo: existingFranchise.motorEngineNo,
        chasisNo: existingFranchise.chasisNo
      })
    };
    
    console.log('[createRenewOrAmendment] Application data prepared:', {
      applicationType: applicationData.applicationType,
      operatorName: applicationData.operatorName,
      relatedFranchise: applicationData.relatedFranchise
    });
    
    const application = await franchiseApplicationRepository.createFranchiseApplication(applicationData);
    console.log('[createRenewOrAmendment] Application created:', application._id);
    
    // Link application to user's franchiseApplications array
    if (userId) {
      try {
        const User = require('../models/userAccountModel');
        await User.findByIdAndUpdate(
          userId,
          { $addToSet: { franchiseApplications: application._id } },
          { new: true }
        );
        console.log('[createRenewOrAmendment] Application linked to user:', userId);
      } catch (linkError) {
        console.error('[createRenewOrAmendment] Failed to link application to user:', linkError);
        // Don't fail the whole operation if linking fails
      }
    }
    
    // Upload new documents if provided
    if (files && Object.keys(files).length > 0) {
      const uploadHelper = async (fieldName, category) => {
        const fileArray = files[fieldName];
        if (!fileArray?.[0]) return null;
        validateFile(fileArray[0]);
        const result = await uploadFile(fileArray[0].buffer, fileArray[0].originalname, fileArray[0].mimetype, 
          { baseFolder: 'franchiseApplications', subFolder: userId, applicationId: String(application._id), category });
        return result.url;
      };
      
      const docs = await Promise.all([
        uploadHelper('motorRegistrationObj', 'Documentations'),
        uploadHelper('barangayClearanceObj', 'Documentations'),
        uploadHelper('cedulaObj', 'Documentations'),
        uploadHelper('driversLicenseObj', 'Documentations'),
        uploadHelper('votersAffidavitObj', 'Documentations'),
        uploadHelper('motorChassisStencilObj', 'Documentations'),
        uploadHelper('driverPictureObj', 'ProfilePictures'),
        uploadHelper('operatorPictureObj', 'ProfilePictures'),
        uploadHelper('oRLTOObj', 'Documentations'),
        uploadHelper('cRLTOObj', 'Documentations')
      ]);
      
      await franchiseApplicationRepository.updateFranchiseApplication(String(application._id), {
        'documents.motorRegistrationObj': docs[0],
        'documents.barangayClearanceObj': docs[1],
        'documents.cedulaObj': docs[2],
        'documents.driversLicenseObj': docs[3],
        'documents.votersAffidavitObj': docs[4],
        'documents.motorChassisStencilObj': docs[5],
        'documents.driverPictureObj': docs[6],
        'documents.operatorPictureObj': docs[7],
        'documents.oRLTOObj': docs[8],
        'documents.cRLTOObj': docs[9]
      });
      
      console.log('[createRenewOrAmendment] Documents uploaded for application:', application._id);
    }
    
    // Broadcast renewal/amendment application to BPLO admins and dashboard
    try {
      const io = req.app.get('io');
      if (io) {
        io.to('bplo-admins').emit('pending-applications', [application]);
        io.to('general').emit('application-updated', application);
        console.log('[createRenewOrAmendment] Broadcasted new application to bplo-admins and general rooms');
      }
    } catch (wsError) {
      console.error('[createRenewOrAmendment] WebSocket broadcast error:', wsError.message);
    }
    
    res.status(201).json({ 
      success: true, 
      data: application, 
      message: `${appType} application created successfully` 
    });
  } catch (error) {
    console.error('[createRenewOrAmendment] Error:', error);
    next(error);
  }
};

// 6) GET FRANCHISES WITH WEBSOCKET IO (BPLO Admin)
exports.getFranchisesWithWebSocketIO = async (req, res, next) => {
  try {
    const applications = await FranchiseApplication.find({ 
      statusOfBPLO: 'pending' 
    }).sort({ submittedAt: -1 });
    
    // Emit to WebSocket if available
    if (req.app.get('io')) {
      req.app.get('io').to('bplo-admins').emit('pending-applications', applications);
    }
    
    res.json({ success: true, data: applications, message: 'BPLO pending applications retrieved' });
  } catch (error) {
    next(error);
  }
};

// 7) APPROVE FRANCHISE BY BPLO
exports.approveFranchiseByBPLO = async (req, res, next) => {
  try {
    const { id } = req.params;
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
    
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.statusOfBPLO !== 'pending') {
      return res.status(400).json({ error: 'Application already processed' });
    }
    
    const adminUsername = req.user?.username || req.user?.email || 'BPLO Admin';
    
    // For NEW applications, automatically assign the next available franchise number
    const updateData = { 
      statusOfBPLO: 'bplo-approved',
      bploApprovedBy: adminUsername,
      bploApprovedAt: new Date(),
      bploInspectionRequired: true, // Set inspection requirement
      approvedAt: new Date() // Legacy field
    };
    
    // Only assign franchiseNumber for NEW applications (not renewals/amendments)
    if (application.applicationType === 'new' && !application.franchiseNumber) {
      try {
        // Get available franchise numbers
        // Check TWO sources:
        // 1. FranchiseInformation (completed franchises)
        // 2. FranchiseApplication (pending applications with assigned numbers)
        
        const FranchiseInformation = require('../models/franchiseInformationModel');
        const allCurrentFranchises = await FranchiseInformation.find({
          isCurrentVersion: true
        }).select('franchiseNumber franchiseStatus expiryDate').lean().exec();
        
        // CRITICAL: Also check pending applications to avoid duplicate assignments
        // Get all applications that have been assigned a franchise number (bplo-approved or later)
        const allPendingApplications = await FranchiseApplication.find({
          applicationType: 'new',
          franchiseNumber: { $exists: true, $ne: null },
          statusOfBPLO: { $in: ['bplo-approved', 'awaiting-sb', 'sb-approved', 'completed'] }
        }).select('franchiseNumber').lean().exec();
        
        const franchiseMap = new Map();
        let latestNumber = 0;
        
        // Add completed franchises to the map
        for (const franchise of allCurrentFranchises) {
          const numberMatch = franchise.franchiseNumber.match(/^(\d{1,4})$/);
          if (!numberMatch) continue;
          
          const franchiseNum = parseInt(numberMatch[1], 10);
          latestNumber = Math.max(latestNumber, franchiseNum);
          
          // A franchise number is AVAILABLE for recycling if:
          // - Status is 'Revoked' or 'revoked' (case-insensitive check)
          // That's it! Once revoked, the number can be reassigned to a new applicant
          const isRevoked = franchise.franchiseStatus?.toLowerCase() === 'revoked';
          
          franchiseMap.set(franchiseNum, { available: isRevoked, reserved: false });
        }
        
        // Add pending applications to mark numbers as RESERVED (in use)
        for (const pendingApp of allPendingApplications) {
          const numberMatch = pendingApp.franchiseNumber.match(/^(\d{1,4})$/);
          if (!numberMatch) continue;
          
          const franchiseNum = parseInt(numberMatch[1], 10);
          latestNumber = Math.max(latestNumber, franchiseNum);
          
          // Mark this number as reserved (being processed) - overrides any "available" status
          franchiseMap.set(franchiseNum, { available: false, reserved: true });
        }
        
        // Find first available gap or use next number
        let assignedNumber = null;
        for (let i = 1; i <= latestNumber; i++) {
          const franchise = franchiseMap.get(i);
          // Use if: (1) number never existed, OR (2) exists and is available (revoked)
          if (!franchise || franchise.available) {
            assignedNumber = i;
            break;
          }
        }
        
        if (!assignedNumber) {
          assignedNumber = latestNumber + 1;
        }
        
        const franchiseNumber = String(assignedNumber).padStart(4, '0');
        updateData.franchiseNumber = franchiseNumber;
      } catch (numberError) {
        console.error('[BPLO Approval] Failed to assign franchise number:', numberError.message);
        // Continue without franchise number assignment - can be assigned manually later
      }
    }
    
    const updated = await franchiseApplicationRepository.updateFranchiseApplication(id, updateData);
    
    // Send SMS + Email notification using notification queue
    // SMS: Go to BPLO office (max 2 SMS attempts)
    // Email: Always sent (free)
    if (updated.operatorContactNumber || updated.operatorEmail) {
      try {
        const notificationResult = await sendBPLOApprovalNotification(updated);
        console.log('[BPLO Approval] Notification sent:', {
          sms: notificationResult.sms?.success ? 'SENT' : 'FAILED',
          email: notificationResult.email?.success ? 'SENT' : 'FAILED',
          operator: updated.operatorName
        });
      } catch (notificationError) {
        console.warn('[BPLO Approval] Failed to send notification:', notificationError.message);
        // Continue with approval even if notification fails
      }
    } else {
      console.warn('[BPLO Approval] No contact information, skipping notification');
    }
    
    // Emit to WebSocket
    if (req.app.get('io')) {
      // Notify BPLO admins that application was approved
      req.app.get('io').to('bplo-admins').emit('application-approved', updated);
      
      // Broadcast to general room for dashboard pages
      req.app.get('io').to('general').emit('application-updated', updated);
      
      // Update SB admins list - show applications with OR or without OR
      // SB should see all statuses: 'bplo-approved', 'awaiting-sb', AND 'sb-approved'
      try {
        const FranchiseApplication = require('../models/franchiseApplicationModel');
        const sbApplications = await FranchiseApplication.find({
          statusOfBPLO: { $in: ['bplo-approved', 'awaiting-sb', 'sb-approved'] }
        }).sort({ sbApprovedAt: -1, bploApprovedAt: -1, orSubmittedAt: -1 });
        req.app.get('io').to('sb-admins').emit('approved-applications', sbApplications);
        console.log(`[BPLO Approval] Updated SB admins with ${sbApplications.length} applications`);
      } catch (error) {
        console.error('[BPLO Approval] Failed to fetch SB applications:', error.message);
      }
      
      // Notify user about the approval
      if (updated.operatorInfo) {
        req.app.get('io').to(`user-${updated.operatorInfo}`).emit('bplo-approval', {
          applicationId: updated._id,
          message: 'Your application has been approved by BPLO. Please proceed to BPLO office for inspection, then submit your Official Receipt (OR) number and document through your account.',
          status: 'bplo-approved'
        });
      }
    }
    
    // Log BPLO approval action
    if (req.user) {
      await auditLogService.logBPLOAction(updated, 'approve', req.user, req).catch(err =>
        console.error('[BPLO Approval] Audit log error:', err)
      );
    }
    
    res.json({ success: true, data: updated, message: 'Application approved by BPLO. Applicant will be notified via SMS and email to proceed with inspection and OR submission.' });
  } catch (error) {
    console.error('[BPLO Approval] Error:', error);
    next(error);
  }
};
// 7b) DISAPPROVE FRANCHISE BY BPLO
exports.disapproveFranchiseByBPLO = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Disapproval reason is required' });
    }
    
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
    
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.statusOfBPLO !== 'pending') {
      return res.status(400).json({ error: 'Application already processed' });
    }
    
    const adminUsername = req.user?.username || req.user?.email || 'BPLO Admin';
    
    const updated = await franchiseApplicationRepository.updateFranchiseApplication(id, { 
      statusOfBPLO: 'bplo-disapproved',
      bploApprovedBy: adminUsername,
      bploApprovedAt: new Date(),
      bploDisapprovedReason: reason.trim()
    });
    
    // Send notification to user about BPLO disapproval
    // Non-blocking: email failures should not prevent disapproval
    if (updated.operatorEmail) {
      try {
        const { sendFranchiseDisapprovalEmail } = require('../services/emailService');
        await sendFranchiseDisapprovalEmail(updated.operatorEmail, updated.operatorName, reason);
        console.log('[BPLO Disapproval] Email notification sent to:', updated.operatorEmail);
      } catch (emailError) {
        console.warn('[BPLO Disapproval] Failed to send email notification:', emailError.message);
        // Continue with disapproval even if email fails
      }
    } else {
      console.warn('[BPLO Disapproval] No operator email, skipping notification');
    }
    
    // Emit to WebSocket
    if (req.app.get('io')) {
      // Update BPLO admins with refreshed pending list
      try {
        const FranchiseApplication = require('../models/franchiseApplicationModel');
        const pendingApplications = await FranchiseApplication.find({
          statusOfBPLO: 'pending'
        }).sort({ submittedAt: -1 });
        req.app.get('io').to('bplo-admins').emit('pending-applications', pendingApplications);
        console.log(`[BPLO Disapproval] Updated BPLO admins: ${pendingApplications.length} pending applications`);
      } catch (error) {
        console.error('[BPLO Disapproval] Failed to fetch pending applications:', error.message);
      }
      
      // Broadcast to general room for dashboard pages
      req.app.get('io').to('general').emit('application-updated', updated);
      
      // Notify user about the disapproval
      if (updated.operatorInfo) {
        req.app.get('io').to(`user-${updated.operatorInfo}`).emit('bplo-disapproval', {
          applicationId: updated._id,
          message: `Your application has been disapproved by BPLO. Reason: ${reason}`,
          reason: reason,
          status: 'bplo-disapproved'
        });
      }
    }
    
    // Log BPLO rejection action
    if (req.user) {
      await auditLogService.logBPLOAction(updated, 'reject', req.user, req, reason).catch(err =>
        console.error('[BPLO Disapproval] Audit log error:', err)
      );
    }
    
    res.json({ success: true, data: updated, message: 'Application disapproved by BPLO. Applicant has been notified.' });
  } catch (error) {
    console.error('[BPLO Disapproval] Error:', error);
    next(error);
  }
};

// 8) EDIT APPROVED FRANCHISE (Add OR + Receipt)
// Users can add Official Receipt number and OR document after BPLO approval
exports.editApprovedFranchise = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Get officialReceiptNumber from body or fallback to checking all possible locations
    let officialReceiptNumber = req.body?.officialReceiptNumber;
    
    // Debug logging
    console.log('[editApprovedFranchise] Full Request body:', req.body);
    console.log('[editApprovedFranchise] Request files:', Object.keys(req.files || {}));
    console.log('[editApprovedFranchise] Extracted OR number:', officialReceiptNumber);
    
    const { files } = req;
    
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Allow OR submission only after BPLO approval
    if (application.statusOfBPLO !== 'bplo-approved' && application.statusOfBPLO !== 'approved') {
      return res.status(400).json({ error: 'Application must be approved by BPLO first' });
    }
    
    // Check authorization:
    // - Admin roles (admin, bplo-admin, sb-admin) can edit any application
    // - Regular users can only edit their own applications
    const userId = req.user?._id?.toString() || req.user?.userId || String(req.user?.id);
    const appUserId = application.operatorInfo?.toString();
    const isAdminRole = ['admin', 'bplo-admin', 'sb-admin'].includes(req.user?.role);
    
    if (userId !== appUserId && !isAdminRole) {
      return res.status(403).json({ error: 'You can only edit your own applications' });
    }
    
    const updateData = {};
    
    // Update Official Receipt Number if provided
    if (officialReceiptNumber) {
      updateData.officialReceiptNumber = officialReceiptNumber;
      updateData.orSubmittedAt = new Date();
      // Move to next stage - awaiting SB approval
      updateData.statusOfBPLO = 'awaiting-sb';
      console.log('[editApprovedFranchise] Adding OR number:', officialReceiptNumber);
    } else {
      console.log('[editApprovedFranchise] WARNING: No OR number provided in request');
    }
    
    // Upload OR document if provided
    if (files?.oRTreasurerOfficeObj) {
      const file = files.oRTreasurerOfficeObj[0];
      validateFile(file);
      const result = await uploadFile(file.buffer, file.originalname, file.mimetype, 
        { baseFolder: 'franchiseApplications', subFolder: application.operatorInfo || 'pending', applicationId: id, category: 'Documentations' });
      updateData['documents.oRTreasurerOfficeObj'] = result.url;
      console.log('[editApprovedFranchise] OR document uploaded:', result.url);
    } else {
      console.log('[editApprovedFranchise] WARNING: No OR document file provided');
    }
    
    // Require at least one field to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Please provide officialReceiptNumber or oRTreasurerOfficeObj document' });
    }
    
    console.log('[editApprovedFranchise] Final updateData to save:', updateData);
    const updated = await franchiseApplicationRepository.updateFranchiseApplication(id, updateData);
    console.log('[editApprovedFranchise] Application updated successfully');
    console.log('[editApprovedFranchise] Updated record - officialReceiptNumber:', updated.officialReceiptNumber);
    console.log('[editApprovedFranchise] Updated record - documents.oRTreasurerOfficeObj:', updated.documents?.oRTreasurerOfficeObj);
    
    // Log operator adding OR
    if (req.user && updateData.officialReceiptNumber) {
      await auditLogService.logOperatorAddOR(updated, updateData.officialReceiptNumber, req.user, req).catch(err =>
        console.error('[editApprovedFranchise] Audit log error:', err)
      );
    }
    
    // Notify SB admins via WebSocket with updated application list
    if (req.app.get('io') && updateData.statusOfBPLO === 'awaiting-sb') {
      try {
        // Fetch all applications awaiting SB review (includes bplo-approved, awaiting-sb, and sb-approved)
        const FranchiseApplication = require('../models/franchiseApplicationModel');
        const sbApplications = await FranchiseApplication.find({
          statusOfBPLO: { $in: ['bplo-approved', 'awaiting-sb', 'sb-approved'] }
        }).sort({ sbApprovedAt: -1, bploApprovedAt: -1, orSubmittedAt: -1 });
        
        // Emit updated list to all SB admins
        req.app.get('io').to('sb-admins').emit('approved-applications', sbApplications);
        console.log(`[editApprovedFranchise] Notified SB admins: ${sbApplications.length} applications for SB review (${sbApplications.filter(a => a.officialReceiptNumber).length} with OR)`);
      } catch (wsError) {
        console.error('[editApprovedFranchise] WebSocket notification failed:', wsError.message);
      }
    }
    
    res.json({ 
      success: true, 
      data: updated,
      message: 'Official Receipt information added successfully. Application ready for SB Admin review.' 
    });
  } catch (error) {
    console.error('[editApprovedFranchise] Error:', error);
    next(error);
  }
};

// 9) GET APPROVED ROUTES FOR SB ADMIN (WebSocket)
exports.getApprovedRoutesForSBAdmin = async (req, res, next) => {
  try {
    // Get applications ready for SB review and acceptance
    // Show applications with 'bplo-approved' (OR not yet submitted), 'awaiting-sb' (OR submitted), AND 'sb-approved' (ready to accept)
    // This ensures SB can see applications through the entire workflow: approve → accept
    const applications = await FranchiseApplication.find({
      statusOfBPLO: { $in: ['bplo-approved', 'awaiting-sb', 'sb-approved'] }
    }).sort({ sbApprovedAt: -1, bploApprovedAt: -1, orSubmittedAt: -1 });
    
    // Emit to WebSocket
    if (req.app.get('io')) {
      req.app.get('io').to('sb-admins').emit('approved-applications', applications);
    }
    
    res.json({ 
      success: true, 
      data: applications,
      message: 'SB Admin applications retrieved',
      count: applications.length
    });
  } catch (error) {
    next(error);
  }
};

// 9) SB ADMIN FINAL APPROVAL (with resolution number and optional document)
exports.approveFranchiseBySBAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolutionNumber, officialReceiptNumber } = req.body;
    const { files } = req;
    
    if (!resolutionNumber || !resolutionNumber.trim()) {
      return res.status(400).json({ error: 'Resolution number is required for final approval' });
    }
    
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Allow approval for:
    // 1. bplo-approved (even without OR - SB can approve in advance)
    // 2. awaiting-sb (walk-in or OR submitted)
    // 3. legacy 'approved' with OR
    const canApprove = application.statusOfBPLO === 'bplo-approved' ||
                       application.statusOfBPLO === 'awaiting-sb' || 
                       (application.statusOfBPLO === 'approved' && application.officialReceiptNumber);
    
    if (!canApprove) {
      return res.status(400).json({ error: 'Application must be approved by BPLO before SB can give final approval' });
    }
    
    const adminUsername = req.user?.username || req.user?.email || 'SB Admin';
    
    const updateData = { 
      statusOfBPLO: 'sb-approved',
      sbApprovedBy: adminUsername,
      sbApprovedAt: new Date(),
      sbResolutionNumber: resolutionNumber.trim()
    };
    
    // SB Admin can add OR if not already provided (for walk-in applications)
    if (officialReceiptNumber && officialReceiptNumber.trim() && !application.officialReceiptNumber) {
      updateData.officialReceiptNumber = officialReceiptNumber.trim();
      updateData.orSubmittedAt = new Date();
      console.log('[SB Approval] OR number added by SB Admin:', officialReceiptNumber.trim());
    }
    
    // Upload OR document if provided by SB Admin
    if (files?.oRTreasurerOfficeObj && !application.documents?.oRTreasurerOfficeObj) {
      const { validateFile, uploadFile } = require('../services/fileUploadService');
      const orFile = files.oRTreasurerOfficeObj[0];
      validateFile(orFile);
      const orResult = await uploadFile(
        orFile.buffer, 
        orFile.originalname, 
        orFile.mimetype, 
        { baseFolder: 'franchiseApplications', subFolder: application.operatorInfo || 'pending', applicationId: id, category: 'Documentations' }
      );
      updateData['documents.oRTreasurerOfficeObj'] = orResult.cloudflare;
      console.log('[SB Approval] OR document uploaded by SB Admin:', orResult.cloudflare);
    }
    
    // Upload resolution document if provided
    if (files?.resolutionDocument) {
      const { validateFile, uploadFile } = require('../services/fileUploadService');
      const file = files.resolutionDocument[0];
      validateFile(file);
      const result = await uploadFile(
        file.buffer, 
        file.originalname, 
        file.mimetype, 
        { baseFolder: 'franchiseApplications', subFolder: application.operatorInfo || 'pending', applicationId: id, category: 'Documentations' }
      );
      updateData.sbResolutionDocument = result.url;
      console.log('[SB Approval] Resolution document uploaded:', result.url);
    }
    
    const updated = await franchiseApplicationRepository.updateFranchiseApplication(id, updateData);
    
    // Log SB Admin approval action
    if (req.user) {
      // Create a minimal franchise object for logging (since full franchise isn't created yet)
      const franchiseForLogging = {
        _id: updated._id,
        franchiseNumber: resolutionNumber.trim(), // Use resolution number as reference
        operatorName: updated.operatorName,
        operatorEmail: updated.operatorEmail,
        mvPlateNo: updated.mvPlateNo,
        unitModel: updated.unitModel
      };
      await auditLogService.logSBApproval(franchiseForLogging, updated, resolutionNumber.trim(), req.user, req).catch(err =>
        console.error('[SB Approval] Audit log error:', err)
      );
    }
    
    // Send SMS + Email notification using notification queue
    // SMS: Claim your franchise (action required)
    // Email: Always sent (free)
    if (updated.operatorContactNumber || updated.operatorEmail) {
      try {
        // Note: We need franchise info for the notification, but it's not created yet
        // So we'll pass the application data with franchise info to be added post-acceptance
        const notificationResult = await sendSBApprovalNotification(updated, resolutionNumber);
        console.log('[SB Approval] Notification sent:', {
          sms: notificationResult.sms?.success ? 'SENT' : 'FAILED',
          email: notificationResult.email?.success ? 'SENT' : 'FAILED',
          operator: updated.operatorName
        });
      } catch (notificationError) {
        console.warn('[SB Approval] Failed to send notification:', notificationError.message);
        // Continue with approval even if notification fails
      }
    } else {
      console.warn('[SB Approval] No contact information, skipping notification');
    }
    
    // Emit to WebSocket
    if (req.app.get('io')) {
      // Update both SB and BPLO admins with refreshed lists
      try {
        const FranchiseApplication = require('../models/franchiseApplicationModel');
        
        // Update SB admins list - now includes the newly approved application with 'sb-approved' status
        // Continue showing all statuses: 'bplo-approved', 'awaiting-sb', AND 'sb-approved'
        const sbApplications = await FranchiseApplication.find({
          statusOfBPLO: { $in: ['bplo-approved', 'awaiting-sb', 'sb-approved'] }
        }).sort({ sbApprovedAt: -1, bploApprovedAt: -1, orSubmittedAt: -1 });
        req.app.get('io').to('sb-admins').emit('approved-applications', sbApplications);
        console.log(`[SB Approval] Updated SB admins: ${sbApplications.length} applications (including sb-approved for acceptance)`);
        
        // Update BPLO admins about the final approval
        req.app.get('io').to('bplo-admins').emit('application-sb-approved', updated);
        
        // Broadcast to general room for dashboard pages
        req.app.get('io').to('general').emit('application-updated', updated);
      } catch (error) {
        console.error('[SB Approval] Failed to fetch application lists:', error.message);
      }
      
      // Notify user about the final approval
      if (updated.operatorInfo) {
        req.app.get('io').to(`user-${updated.operatorInfo}`).emit('sb-approval', {
          applicationId: updated._id,
          message: 'Your franchise application has been approved by the Sangguniang Bayan.',
          resolutionNumber: resolutionNumber,
          status: 'sb-approved'
        });
      }
    }
    
    res.json({ 
      success: true, 
      data: updated, 
      message: 'Application approved successfully by SB Admin. Applicant has been notified via SMS and email.' 
    });
  } catch (error) {
    console.error('[SB Approval] Error:', error);
    next(error);
  }
};
// get approvedroutes fromsb admin too ongoing franchise applicaion  for report session of sbAdminAcceptNewFranchise

// 10) SB ADMIN ACCEPT NEW FRANCHISE
// Note: Transactions removed for standalone MongoDB compatibility
// For production with replica set, consider re-enabling transactions
exports.sbAdminAcceptNewFranchise = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Only accept applications that have been fully approved (sb-approved)
    if (application.statusOfBPLO !== 'sb-approved') {
      return res.status(400).json({ 
        error: 'Application must be fully approved by SB Admin first',
        currentStatus: application.statusOfBPLO,
        requiredStatus: 'sb-approved'
      });
    }
    
    // Use the franchise number assigned by BPLO (or from req.body for manual override)
    const franchiseNo = application.franchiseNumber;
    if (!franchiseNo) {
      console.error('[sbAdminAcceptNewFranchise] Franchise number not found for application:', id);
      return res.status(400).json({ 
        error: 'Franchise number not assigned by BPLO',
        message: 'The application must be approved by BPLO first to receive a franchise number. Please ensure BPLO has processed this application.',
        applicationId: id,
        currentStatus: application.statusOfBPLO
      });
    }
    
    console.log('[sbAdminAcceptNewFranchise] Processing franchise creation:', {
      applicationId: id,
      franchiseNumber: franchiseNo,
      operatorName: application.operatorName,
      sbResolutionNumber: application.sbResolutionNumber || 'NOT FOUND',
      hasDocuments: !!application.documents,
      documentKeys: application.documents ? Object.keys(application.documents).filter(k => application.documents[k]) : []
    });
    
    // Create franchiseChainId early for folder organization
    const franchiseChainId = `${franchiseNo}-${application.operatorName.toLowerCase().replace(/\s+/g, '-')}`;
    
    // Check if this franchise number was used before (recycled number)
    // If yes, verify the previous franchise is revoked before allowing reuse
    let qrResult;
    const latestFranchiseWithNumber = await FranchiseInformation.findOne(
      { franchiseNumber: franchiseNo, isCurrentVersion: true },
      { franchiseStatus: 1, qrCode: 1 }
    );
    
    // If a current active franchise exists with this number, cannot reuse it
    if (latestFranchiseWithNumber && latestFranchiseWithNumber.franchiseStatus !== 'Revoked') {
      return res.status(400).json({ 
        error: 'Cannot assign franchise number that is currently in use',
        franchiseNumber: franchiseNo,
        currentStatus: latestFranchiseWithNumber.franchiseStatus,
        message: 'This franchise number is already assigned to an active franchise. It can only be reused after it is revoked.'
      });
    }
    
    // If there's a revoked franchise with isCurrentVersion: true, update it to false
    // This allows the recycled number to be assigned to a new franchise
    if (latestFranchiseWithNumber && latestFranchiseWithNumber.franchiseStatus === 'Revoked') {
      console.log('[sbAdminAcceptNewFranchise] Found revoked franchise with isCurrentVersion: true, updating to false for recycling:', franchiseNo);
      await FranchiseInformation.updateOne(
        { _id: latestFranchiseWithNumber._id },
        { $set: { isCurrentVersion: false } }
      );
      // Reuse QR code from the revoked franchise
      qrResult = { url: latestFranchiseWithNumber.qrCode };
      console.log('[sbAdminAcceptNewFranchise] Recycled revoked franchise number:', franchiseNo, '- Reusing previous QR code');
    } else {
      // Check for previous version to reuse QR code (only if the franchise is revoked and already marked as not current)
      const previousFranchiseWithSameNumber = await FranchiseInformation.findOne(
        { franchiseNumber: franchiseNo, isCurrentVersion: false, franchiseStatus: 'Revoked' },
        { qrCode: 1 }
      ).sort({ version: -1 });
      
      if (previousFranchiseWithSameNumber?.qrCode) {
        // Recycled number - reuse previous QR code
        qrResult = { url: previousFranchiseWithSameNumber.qrCode };
        console.log('[sbAdminAcceptNewFranchise] Recycled revoked franchise number:', franchiseNo, '- Reusing previous QR code from archived version');
      } else {
        // New franchise number - generate new QR code with hashed franchise number (static)
        const hashedFranchiseNo = generateHashedFranchiseNo(franchiseNo);
        const qrBuffer = await generateQRCodeBuffer(hashedFranchiseNo);
        qrResult = await uploadFile(qrBuffer, `qr-${franchiseNo}.png`, 'image/png',
          { baseFolder: 'franchiseInformations', subFolder: `${franchiseNo}/${franchiseChainId}`, category: 'QRCode', customKey: `version-1/QRCode/qr-${franchiseNo}.png` });
        console.log('[sbAdminAcceptNewFranchise] New franchise number:', franchiseNo, '- Generated static QR code with hash:', hashedFranchiseNo);
      }
    }
    
    // Check version (no transaction for standalone MongoDB compatibility)
    const { version, previousVersion } = await handleVersionControl(franchiseNo, 'new');
    
    // Upload SB documents
    let scannedReg, sessionReport;
    if (req.files) {
      if (req.files.scannedSignedRegistrationObj) {
        const file = req.files.scannedSignedRegistrationObj[0];
        validateFile(file);
        const result = await uploadFile(file.buffer, file.originalname, file.mimetype,
          { baseFolder: 'franchiseInformations', subFolder: `${franchiseNo}/${franchiseChainId}`, category: 'Documentations', customKey: `version-${version}/Documentations/${file.originalname}` });
        scannedReg = result.url;
      }
      if (req.files.individualSessionReportObj) {
        const file = req.files.individualSessionReportObj[0];
        validateFile(file);
        const result = await uploadFile(file.buffer, file.originalname, file.mimetype,
          { baseFolder: 'franchiseInformations', subFolder: `${franchiseNo}/${franchiseChainId}`, category: 'Documentations', customKey: `version-${version}/Documentations/${file.originalname}` });
        sessionReport = result.url;
      }
    }
    
    // Create FranchiseInformation record FIRST within transaction (with original document URLs)
    // File movements will happen asynchronously after transaction commits
    const franchiseData = {
      franchiseNumber: franchiseNo,
      officialReceiptNumber: application.officialReceiptNumber || '', // Include OR number from application
      franchiseChainId: `${franchiseNo}-${application.operatorName.toLowerCase().replace(/\s+/g, '-')}`,
      operatorName: application.operatorName,
      operatorContactNumber: application.operatorContactNumber,
      coOwnerName: application.coOwnerName,
      coOwnerAddress: application.coOwnerAddress,
      operatorAddress: application.operatorAddress,
      operatorBarangay: application.operatorBarangay,
      operatorCivilStatus: application.operatorCivilStatus,
      operatorBirthPlace: application.operatorBirthPlace,
      operatorBirthDate: application.operatorBirthDate,
      operatorCitizenship: application.operatorCitizenship,
      operatorEmail: application.operatorEmail,
      driverName: application.driverName,
      driversAddress: application.driversAddress,
      todaMembership: application.todaMembership,
      unitModel: application.unitModel,
      colorMotor: application.colorMotor,
      sideCarColor: application.sideCarColor,
      mvPlateNo: application.mvPlateNo,
      motorEngineNo: application.motorEngineNo,
      chasisNo: application.chasisNo,
      qrCode: qrResult.url,
      approvedAt: new Date(),
      expiryDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000), // 3 years
      resolutionNumber: application.sbResolutionNumber, // Copy resolution number from application
      resolutionDocument: application.sbResolutionDocument, // Copy resolution document from application (root level)
      sbApprovedAt: application.sbApprovedAt || new Date(), // Copy SB approval date
      officialReceiptNumber: application.officialReceiptNumber, // Copy official receipt number
      officialReceiptDocument: application.documents?.oRTreasurerOfficeObj, // Copy OR document from application
      franchiseStatus: 'Active',
      documents: {
        // Use original application document URLs - will be updated async after transaction
        motorRegistrationObj: application.documents?.motorRegistrationObj,
        barangayClearanceObj: application.documents?.barangayClearanceObj,
        cedulaObj: application.documents?.cedulaObj,
        driversLicenseObj: application.documents?.driversLicenseObj,
        votersAffidavitObj: application.documents?.votersAffidavitObj,
        motorChassisStencilObj: application.documents?.motorChassisStencilObj,
        driverPictureObj: application.documents?.driverPictureObj,
        operatorPictureObj: application.documents?.operatorPictureObj,
        oRLTOObj: application.documents?.oRLTOObj,
        cRLTOObj: application.documents?.cRLTOObj,
        oRTreasurerOfficeObj: application.documents?.oRTreasurerOfficeObj,
        individualSessionReportObj: sessionReport,
        resolutionDocumentObj: application.sbResolutionDocument // Add SB resolution document
      },
      version,
      isCurrentVersion: true,
      previousVersion,
      changeType: 'new',
      changedBy: req.user?.username || 'SB Admin',
      linkedUser: application.operatorInfo,
      relatedApplicationId: application._id
    };
    
    const FranchiseInformationModel = require('../models/franchiseInformationModel');
    const franchise = await FranchiseInformationModel.create([franchiseData]);
    
    // Log created franchise document structure for debugging
    console.log('[sbAdminAcceptNewFranchise] Franchise created with documents:', {
      franchiseId: franchise[0]._id,
      franchiseNumber: franchise[0].franchiseNumber,
      hasDocumentsField: !!franchise[0].documents,
      documentKeys: franchise[0].documents ? Object.keys(franchise[0].documents).filter(k => franchise[0].documents[k]) : []
    });
    
    // Invalidate QR cache - important for recycled franchise numbers
    // When 0001 goes from gabatino-0001 (revoked) to gonzales-0001 (new), QR shows new owner
    invalidateQRCache(franchiseNo);
    
    // Link franchise chain ID to user account
    if (application.operatorInfo) {
      try {
        const User = require('../models/userAccountModel');
        await User.findByIdAndUpdate(
          application.operatorInfo,
          { 
            $addToSet: { 
              franchiseChainIds: franchiseChainId
            } 
          }
        );
        console.log('[sbAdminAcceptNewFranchise] Franchise chain ID linked to user:', application.operatorInfo, '| Chain ID:', franchiseChainId);
      } catch (linkError) {
        console.error('[sbAdminAcceptNewFranchise] Failed to link franchise chain ID to user:', linkError);
        throw linkError;
      }
    }
    
    // Delete the application after successful franchise creation (cleanup)
    // This maintains consistency with renewal/amendment workflow
    await franchiseApplicationRepository.deleteFranchiseApplication(id);
    
    // ASYNC file movements - happens in background, doesn't block response
    // This solves the timeout issue
    const userId = application.operatorInfo || 'pending';
    const appId = String(application._id);
    const fileMovementPromise = (async () => {
      try {
        console.log('[sbAdminAcceptNewFranchise] Starting background file movements for franchise:', franchiseNo);
        const startTime = Date.now();
        
        // Move files from applications → information
        await moveFilesToInformation(userId, appId, franchiseNo, franchiseChainId, version);
        const urlMapping = await storage.moveFranchiseFiles(userId, appId, franchiseNo, franchiseChainId, version);
        
        const elapsedTime = Date.now() - startTime;
        console.log(`[sbAdminAcceptNewFranchise] File movements completed in ${elapsedTime}ms for franchise: ${franchiseNo}`);
        
        // Update franchise documents with new URLs from file movement
        if (Object.keys(urlMapping).length > 0) {
          const updateDocs = {};
          for (const [oldUrl, newUrl] of Object.entries(urlMapping)) {
            // Map each old URL to new URL in documents
            Object.keys(franchiseData.documents).forEach(key => {
              if (franchiseData.documents[key] === oldUrl) {
                updateDocs[`documents.${key}`] = newUrl;
              }
            });
          }
          
          if (Object.keys(updateDocs).length > 0) {
            await FranchiseInformationModel.updateOne(
              { _id: franchise[0]._id },
              { $set: updateDocs }
            );
            console.log('[sbAdminAcceptNewFranchise] Updated franchise documents with new URLs');
          }
        }
      } catch (fileError) {
        console.error('[sbAdminAcceptNewFranchise] Async file movement error (franchise still created):', fileError);
        // Send alert to admin that files need manual review
        if (req.app.get('io')) {
          req.app.get('io').to('sb-admins').emit('franchise-file-error', {
            franchiseNumber: franchiseNo,
            franchiseId: franchise[0]._id,
            message: 'Franchise created successfully but file migration encountered an error. Please review and re-migrate files manually.',
            error: fileError.message
          });
        }
      }
    })();
    
    // Don't await - let it run in background
    fileMovementPromise.catch(err => 
      console.error('[sbAdminAcceptNewFranchise] Uncaught file movement error:', err)
    );
    
    // Log franchise creation (after transaction is committed)
    if (req.user) {
      await auditLogService.logFranchiseCreation(franchise[0], application, req.user, req).catch(err =>
        console.error('[sbAdminAcceptNewFranchise] Audit log error:', err)
      );
    }
    
    // Send notification to user
    if (franchise[0].operatorEmail) {
      try {
        const { sendFranchiseCreatedEmail } = require('../services/emailService');
        await sendFranchiseCreatedEmail(franchise[0].operatorEmail, franchise[0].operatorName, franchise[0].franchiseNumber);
        console.log('[sbAdminAcceptNewFranchise] Email notification sent to:', franchise[0].operatorEmail);
      } catch (emailError) {
        console.warn('[sbAdminAcceptNewFranchise] Failed to send email notification:', emailError.message);
      }
    }
    
    // Emit to WebSocket
    if (req.app.get('io')) {
      req.app.get('io').to('sb-admins').to('bplo-admins').emit('franchise-created', franchise[0]);
      
      // Notify user
      if (franchise[0].linkedUser) {
        req.app.get('io').to(`user-${franchise[0].linkedUser}`).emit('franchise-created', {
          franchiseId: franchise[0]._id,
          franchiseNumber: franchise[0].franchiseNumber,
          message: 'Your franchise has been successfully registered and is now active in the system.',
          qrCode: franchise[0].qrCode
        });
      }
    }
    
    res.status(201).json({ 
      success: true, 
      data: franchise[0], 
      message: `Franchise record created successfully. Franchise number: ${franchiseNo}` 
    });
  } catch (error) {
    console.error('[sbAdminAcceptNewFranchise] Error:', error);
    next(error);
  }
};

// 11) SB ADMIN ACCEPT RENEWAL/AMENDMENT
// Note: Transactions removed for standalone MongoDB compatibility
exports.sbAdminAcceptRenewOrAmendment = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Only accept applications that have been fully approved (sb-approved)
    if (application.statusOfBPLO !== 'sb-approved') {
      return res.status(400).json({ 
        error: 'Application must be fully approved by SB Admin first',
        currentStatus: application.statusOfBPLO,
        requiredStatus: 'sb-approved'
      });
    }
    
    // Get existing franchise
    const existingFranchise = await FranchiseInformation.findById(application.relatedFranchise);
    if (!existingFranchise) {
      return res.status(404).json({ error: 'Related franchise not found' });
    }
    
    const franchiseNo = existingFranchise.franchiseNumber;
    
    // Determine franchiseChainId based on application type:
    // - Amendment: KEEP same franchise number AND chainId (just update operator info, version increments)
    // - Renewal: KEEP same franchise number AND chainId (extend expiry, version increments)
    // - Change_unit: KEEP same franchise number AND chainId (update motor/driver, version increments)
    const newFranchiseChainId = existingFranchise.franchiseChainId;
    console.log('[sbAdminAcceptRenewOrAmendment] ' + application.applicationType + ' - keeping same franchiseChainId:', newFranchiseChainId);
    
    // Handle versioning (no transaction for standalone MongoDB compatibility)
    const { version, previousVersion } = await handleVersionControl(franchiseNo, application.applicationType);
    
    // Upload new docs
    let scannedReg, sessionReport;
    if (req.files) {
      if (req.files.scannedSignedRegistrationObj) {
        const file = req.files.scannedSignedRegistrationObj[0];
        validateFile(file);
        const result = await uploadFile(file.buffer, file.originalname, file.mimetype,
          { baseFolder: 'franchiseInformations', subFolder: `${franchiseNo}/${franchiseChainId}`, category: 'Documentations', customKey: `version-${version}/Documentations/${file.originalname}` });
        scannedReg = result.url;
      }
      if (req.files.individualSessionReportObj) {
        const file = req.files.individualSessionReportObj[0];
        validateFile(file);
        const result = await uploadFile(file.buffer, file.originalname, file.mimetype,
          { baseFolder: 'franchiseInformations', subFolder: `${franchiseNo}/${franchiseChainId}`, category: 'Documentations', customKey: `version-${version}/Documentations/${file.originalname}` });
        sessionReport = result.url;
      }
    }
    
    // Generate QR Code (STATIC - based only on franchise number)
    // For renewals/amendments, reuse the existing QR code to keep it consistent
    let qrResult;
    if (existingFranchise.qrCode) {
      // Reuse existing QR code from previous version (static for franchise number)
      qrResult = { url: existingFranchise.qrCode };
      console.log('[sbAdminAcceptRenewOrAmendment] Reusing static QR code for franchise:', franchiseNo);
    } else {
      // Generate new QR if somehow missing (shouldn't happen)
      const hashedFranchiseNo = generateHashedFranchiseNo(franchiseNo);
      const qrBuffer = await generateQRCodeBuffer(hashedFranchiseNo);
      qrResult = await uploadFile(qrBuffer, `qr-${franchiseNo}.png`, 'image/png',
        { baseFolder: 'franchiseInformations', subFolder: `${franchiseNo}/${franchiseChainId}`, category: 'QRCode', customKey: `version-${version}/QRCode/qr-${franchiseNo}.png` });
      console.log('[sbAdminAcceptRenewOrAmendment] Generated static QR code with hash:', hashedFranchiseNo);
    }
    
    // Create new version based on application type
    // Use the NEW franchiseChainId created for this renewal/amendment/ownership application
    const newVersionData = {
      ...existingFranchise.toObject(),
      _id: undefined,
      franchiseChainId: newFranchiseChainId, // Use NEW chain ID for this application
      version,
      isCurrentVersion: true,
      previousVersion,
      // Map amendment types to their base types for franchise changeType
      changeType: application.applicationType === 'amend-update_ownership' ? 'update_ownership' :
                  application.applicationType === 'amend-change_unit' ? 'change_unit' :
                  application.applicationType,
      changedBy: req.user?.username || 'SB Admin',
      changedAt: new Date(),
      qrCode: qrResult.url,
      approvedAt: new Date(),
      franchiseStatus: 'Active', // Set status to Active after SB approval for renewals/amendments
      expiryDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000),
      officialReceiptNumber: application.officialReceiptNumber || '', // Use new OR number from application (updated data)
      resolutionNumber: application.sbResolutionNumber, // Use new resolution number from application
      sbApprovedAt: application.sbApprovedAt || new Date(), // Copy SB approval date
      officialReceiptNumber: application.officialReceiptNumber || existingFranchise.officialReceiptNumber, // Copy official receipt number
      // Update documents from the application (users upload fresh documents for renewal/amendments)
      documents: {
        motorRegistrationObj: application.documents?.motorRegistrationObj || existingFranchise.documents?.motorRegistrationObj,
        barangayClearanceObj: application.documents?.barangayClearanceObj || existingFranchise.documents?.barangayClearanceObj,
        cedulaObj: application.documents?.cedulaObj || existingFranchise.documents?.cedulaObj,
        driversLicenseObj: application.documents?.driversLicenseObj || existingFranchise.documents?.driversLicenseObj,
        votersAffidavitObj: application.documents?.votersAffidavitObj || existingFranchise.documents?.votersAffidavitObj,
        motorChassisStencilObj: application.documents?.motorChassisStencilObj || existingFranchise.documents?.motorChassisStencilObj,
        driverPictureObj: application.documents?.driverPictureObj || existingFranchise.documents?.driverPictureObj,
        operatorPictureObj: application.documents?.operatorPictureObj || existingFranchise.documents?.operatorPictureObj,
        oRLTOObj: application.documents?.oRLTOObj || existingFranchise.documents?.oRLTOObj,
        cRLTOObj: application.documents?.cRLTOObj || existingFranchise.documents?.cRLTOObj,
        oRTreasurerOfficeObj: application.documents?.oRTreasurerOfficeObj || existingFranchise.documents?.oRTreasurerOfficeObj,
        resolutionDocumentObj: application.sbResolutionDocument || existingFranchise.documents?.resolutionDocumentObj // Add SB resolution document
      },
      relatedApplicationId: application._id
    };
    
    // Update specific sections based on type
    if (application.applicationType === 'amendment') {
      // Amendment: Update operator information only, keep franchise number
      newVersionData.operatorName = application.operatorName;
      newVersionData.operatorContactNumber = application.operatorContactNumber;
      newVersionData.operatorAddress = application.operatorAddress;
      newVersionData.operatorBarangay = application.operatorBarangay;
      newVersionData.operatorCivilStatus = application.operatorCivilStatus;
      newVersionData.operatorBirthPlace = application.operatorBirthPlace;
      newVersionData.operatorBirthDate = application.operatorBirthDate;
      newVersionData.operatorCitizenship = application.operatorCitizenship;
      newVersionData.operatorEmail = application.operatorEmail;
      newVersionData.coOwnerName = application.coOwnerName;
      newVersionData.coOwnerAddress = application.coOwnerAddress;
      // Keep existing motor/driver info and franchise number
      console.log('[sbAdminAcceptRenewOrAmendment] Amendment - updated operator info, retained franchise number:', franchiseNo);
    } else if (application.applicationType === 'change_unit') {
      // Change Unit: Update motor/driver info, keep operator
      newVersionData.unitModel = application.unitModel;
      newVersionData.colorMotor = application.colorMotor;
      newVersionData.sideCarColor = application.sideCarColor;
      newVersionData.mvPlateNo = application.mvPlateNo;
      newVersionData.motorEngineNo = application.motorEngineNo;
      newVersionData.chasisNo = application.chasisNo;
      newVersionData.driverName = application.driverName;
      newVersionData.driversAddress = application.driversAddress;
      newVersionData.todaMembership = application.todaMembership;
      console.log('[sbAdminAcceptRenewOrAmendment] Change Unit - updated motor/driver info, retained franchise number:', franchiseNo);
    } else if (application.applicationType === 'renewal') {
      // Renewal: Keep all information, just extend expiry
      console.log('[sbAdminAcceptRenewOrAmendment] Renewal - extended expiry date, retained all information and franchise number:', franchiseNo);
    }
    
    const FranchiseInformationModel = require('../models/franchiseInformationModel');
    const newFranchise = await FranchiseInformationModel.create([newVersionData]);
    
    // Invalidate QR cache - renewal/amendment may update driver/operator info shown in QR scan
    invalidateQRCache(franchiseNo);
    
    // Link franchise chain ID to new owner (for ownership updates)
    if (application.applicationType === 'update_ownership' && application.operatorInfo) {
      try {
        const User = require('../models/userAccountModel');
        const newFranchiseChainId = `${franchiseNo}-${application.operatorName.toLowerCase().replace(/\s+/g, '-')}`;
        await User.findByIdAndUpdate(
          application.operatorInfo,
          { 
            $addToSet: { 
              franchiseChainIds: newFranchiseChainId
            } 
          }
        );
        console.log('[sbAdminAcceptRenewOrAmendment] Franchise chain ID linked to new owner:', application.operatorInfo, '| Chain ID:', newFranchiseChainId);
      } catch (linkError) {
        console.error('[sbAdminAcceptRenewOrAmendment] Failed to link franchise chain ID to user:', linkError);
        throw linkError;
      }
    }
     // Delete application from FranchiseApplication collection (now in FranchiseInformation)
    // This prevents data redundancy and keeps FranchiseApplication for pending applications only
    await franchiseApplicationRepository.deleteFranchiseApplication(id);
    console.log('[sbAdminAcceptRenewOrAmendment] Application deleted from FranchiseApplication collection:', id);

    
    // ASYNC file movements - happens in background, doesn't block response
    // This solves the timeout issue
    const userId = application.operatorInfo || 'pending';
    const appId = String(application._id);
    const fileMovementPromise = (async () => {
      try {
        console.log('[sbAdminAcceptRenewOrAmendment] Starting background file movements for franchise:', franchiseNo);
        const startTime = Date.now();
        
        // Move files from applications → information
        await moveFilesToInformation(userId, appId, franchiseNo, newFranchiseChainId, version);
        const urlMapping = await storage.moveFranchiseFiles(userId, appId, franchiseNo, newFranchiseChainId, version);
        
        const elapsedTime = Date.now() - startTime;
        console.log(`[sbAdminAcceptRenewOrAmendment] File movements completed in ${elapsedTime}ms for franchise: ${franchiseNo}`);
        
        // Update franchise documents with new URLs from file movement
        if (Object.keys(urlMapping).length > 0) {
          const updateDocs = {};
          for (const [oldUrl, newUrl] of Object.entries(urlMapping)) {
            // Map each old URL to new URL in documents
            Object.keys(newVersionData.documents).forEach(key => {
              if (newVersionData.documents[key] === oldUrl) {
                updateDocs[`documents.${key}`] = newUrl;
              }
            });
          }
          
          if (Object.keys(updateDocs).length > 0) {
            await FranchiseInformationModel.updateOne(
              { _id: newFranchise[0]._id },
              { $set: updateDocs }
            );
            console.log('[sbAdminAcceptRenewOrAmendment] Updated franchise documents with new URLs');
          }
        }
      } catch (fileError) {
        console.error('[sbAdminAcceptRenewOrAmendment] Async file movement error (franchise still created):', fileError);
        // Send alert to admin that files need manual review
        if (req.app.get('io')) {
          req.app.get('io').to('sb-admins').emit('franchise-file-error', {
            franchiseNumber: franchiseNo,
            franchiseId: newFranchise[0]._id,
            message: 'Franchise updated successfully but file migration encountered an error. Please review and re-migrate files manually.',
            error: fileError.message
          });
        }
      }
    })();
    
    // Don't await - let it run in background
    fileMovementPromise.catch(err => 
      console.error('[sbAdminAcceptRenewOrAmendment] Uncaught file movement error:', err)
    );
    
    // Log franchise update (after transaction is committed)
    if (req.user) {
      await auditLogService.logFranchiseUpdate(newFranchise[0], application, application.applicationType, req.user, req).catch(err =>
        console.error('[sbAdminAcceptRenewOrAmendment] Audit log error:', err)
      );
    }
    
    // Send notification to user
    if (newFranchise[0].operatorEmail) {
      try {
        const { sendFranchiseUpdatedEmail } = require('../services/emailService');
        await sendFranchiseUpdatedEmail(newFranchise[0].operatorEmail, newFranchise[0].operatorName, newFranchise[0].franchiseNumber, application.applicationType);
        console.log('[sbAdminAcceptRenewOrAmendment] Email notification sent to:', newFranchise[0].operatorEmail);
      } catch (emailError) {
        console.warn('[sbAdminAcceptRenewOrAmendment] Failed to send email notification:', emailError.message);
      }
    }
    // Emit to WebSocket
    if (req.app.get('io')) {
      req.app.get('io').to('sb-admins').to('bplo-admins').emit('franchise-updated', newFranchise[0]);
      
      // Notify user
      if (newFranchise[0].linkedUser) {
        req.app.get('io').to(`user-${newFranchise[0].linkedUser}`).emit('franchise-updated', {
          franchiseId: newFranchise[0]._id,
          franchiseNumber: newFranchise[0].franchiseNumber,
          version: version,
          changeType: application.applicationType,
          message: `Your franchise has been successfully updated (${application.applicationType})!`,
          qrCode: newFranchise[0].qrCode
        });
      }
    }
    
    res.status(201).json({ success: true, data: newFranchise[0], message: `${application.applicationType} completed - version ${version} created` });
  } catch (error) {
    console.error('[sbAdminAcceptRenewOrAmendment] Error:', error);
    next(error);
  }
};

// LEGACY ALIASES (for backward compatibility)
exports.createFranchiseApplication = exports.createNewApplication;
exports.getAllFranchiseApplications = async (req, res, next) => {
  try {
    const { getPaginationParams } = require('../utils/cache');
    const { page, limit, status, startDate, endDate, search } = req.query;
    const { skip, limit: pageLimit, page: pageNum } = getPaginationParams(page, limit);
    
    // Build filter for admin queries
    const filter = {};
    const conditions = [];
    
    // Status filter
    if (status) {
      filter.statusOfBPLO = status;
    }
    
    // Date range filter - match if ANY date field falls within range
    if (startDate || endDate) {
      const startDateTime = startDate ? new Date(startDate) : null;
      const endDateTime = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : null;
      
      const dateCondition = {};
      if (startDateTime) dateCondition.$gte = startDateTime;
      if (endDateTime) dateCondition.$lte = endDateTime;
      
      // Match documents where createdAt OR sbApprovedAt falls within range
      conditions.push({
        $or: [
          { createdAt: dateCondition },
          { sbApprovedAt: dateCondition }
        ]
      });
    }
    
    // Search filter
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      conditions.push({
        $or: [
          { operatorName: searchRegex },
          { franchiseNumber: searchRegex },
          { mvPlateNo: searchRegex }
        ]
      });
    }
    
    // Combine all conditions with AND
    if (conditions.length > 0) {
      filter.$and = conditions;
    }
    
    console.log('[getAllFranchiseApplications] Filter:', JSON.stringify(filter, null, 2));
    
    // Get total count
    const total = await FranchiseApplication.countDocuments(filter);
    
    // Fetch results - increase limit for MTOF reports with date range
    const effectiveLimit = (startDate && endDate) ? 1000 : pageLimit;
    
    const applications = await franchiseApplicationRepository.getAllFranchiseApplications(
      filter, 
      { skip: 0, limit: effectiveLimit }
    );
    
    console.log(`[getAllFranchiseApplications] Found ${applications.length} applications`);
    
    // Enrich documents with proper metadata (display names, types, etc.)
    const enrichedApplications = await Promise.all(
      applications.map(async (app) => {
        const converted = storage.convertGridFSUrls(app);
        // Enrich document metadata for better frontend display
        if (converted.documents) {
          converted.documents = await storage.enrichDocumentsWithMetadata(app.documents, {
            operatorName: app.operatorName,
            submittedAt: app.submittedAt
          });
        }
        return converted;
      })
    );
    
    res.json({ 
      success: true, 
      data: enrichedApplications,
      pagination: {
        page: pageNum,
        limit: effectiveLimit,
        total,
        pages: Math.ceil(total / effectiveLimit)
      }
    });
  } catch (error) {
    console.error('[getAllFranchiseApplications] Error:', error);
    next(error);
  }
};
exports.getMyFranchiseApplication = exports.getPendingFranchises;
exports.getFranchiseApplication = exports.getSpecificPendingFranchise;
exports.updateFranchiseApplication = exports.editPendingFranchise;
exports.approveFranchiseApplication = exports.approveFranchiseByBPLO;
exports.deleteFranchiseApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    await franchiseApplicationRepository.deleteFranchiseApplication(id);
    res.json({ success: true, message: 'Application deleted' });
  } catch (error) {
    next(error);
  }
};
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

module.exports = exports;
