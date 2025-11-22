const mongoose = require('mongoose');
const franchiseApplicationRepository = require('../repositories/franchiseApplicationRepository');
const FranchiseApplication = require('../models/franchiseApplicationModel');
const FranchiseInformation = require('../models/franchiseInformationModel');
const { uploadFile, validateFile, moveFilesToInformation } = require('../services/fileUploadService');
const { generateHashedFranchiseNo, generateQRCodeBuffer, handleVersionControl, validateFranchiseStatus } = require('../utils/franchiseHelpers');
const { moveFranchiseFiles } = require('../services/cloudflareService');

// 1) CREATE NEW APPLICATION
exports.createNewApplication = async (req, res, next) => {
  try {
    const { body, files, user } = req;
    const userId = user?._id || user?.userId || String(user?.id);
    
    console.log('[createNewApplication] Request body:', {
      operatorName: body.operatorName,
      operatorContactNumber: body.operatorContactNumber,
      operatorAddress: body.operatorAddress,
      operatorBarangay: body.operatorBarangay,
      mvPlateNo: body.mvPlateNo,
      filesCount: files ? Object.keys(files).length : 0
    });
    
    // Build application data from request body
    const applicationData = {
      operatorName: body.operatorName,
      operatorContactNumber: body.operatorContactNumber,
      operatorAddress: body.operatorAddress,
      operatorBarangay: body.operatorBarangay,
      operatorCivilStatus: body.operatorCivilStatus,
      operatorBirthPlace: body.operatorBirthPlace,
      operatorBirthDate: body.operatorBirthDate ? new Date(body.operatorBirthDate) : null,
      operatorCitizenship: body.operatorCitizenship,
      operatorEmail: body.operatorEmail || '',
      coOwnerName: body.coOwnerName || '',
      coOwnerAddress: body.coOwnerAddress || '',
      driversID: body.driversID,
      driverName: body.driverName,
      driversAddress: body.driversAddress,
      todaMembership: body.todaMembership || '',
      unitModel: body.unitModel,
      colorMotor: body.colorMotor,
      sideCarColor: body.sideCarColor,
      sideCarPlateNumber: body.sideCarPlateNumber || '',
      mvPlateNo: body.mvPlateNo,
      motorEngineNo: body.motorEngineNo,
      chasisNo: body.chasisNo,
      applicationType: 'new',
      statusOfBPLO: 'pending',
      operatorInfo: user?._id || null
    };
    
    console.log('[createNewApplication] Creating application with data:', applicationData);
    const application = await franchiseApplicationRepository.createFranchiseApplication(applicationData);
    console.log('[createNewApplication] Application created:', application._id);
    const appId = String(application._id);
    
    // Link application to user's franchiseApplications array
    if (user?._id) {
      try {
        const User = require('../models/userAccountModel');
        await User.findByIdAndUpdate(
          user._id,
          { $addToSet: { franchiseApplications: application._id } },
          { new: true }
        );
        console.log('[createNewApplication] Application linked to user:', user._id);
      } catch (linkError) {
        console.error('[createNewApplication] Failed to link application to user:', linkError);
        // Don't fail the whole operation if linking fails
      }
    }
    
    // Upload documents if provided
    if (files && Object.keys(files).length > 0) {
      const uploadHelper = async (fieldName, category) => {
        const fileArray = files[fieldName];
        if (!fileArray?.[0]) return null;
        
        validateFile(fileArray[0]);
        const result = await uploadFile(
          fileArray[0].buffer,
          fileArray[0].originalname,
          fileArray[0].mimetype,
          { baseFolder: 'franchiseApplications', subFolder: userId, category }
        );
        return result.cloudflare;
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
      
      await franchiseApplicationRepository.updateFranchiseApplication(appId, {
        'documents.motorRegistrationObj': motorReg,
        'documents.barangayClearanceObj': barangay,
        'documents.cedulaObj': cedula,
        'documents.driversLicenseObj': license,
        'documents.votersAffidavitObj': affidavit,
        'documents.motorChassisStencilObj': stencil,
        'documents.driverPictureObj': driverPic,
        'documents.operatorPictureObj': operatorPic,
        'documents.oRLTOObj': orLTO,
        'documents.cRLTOObj': crLTO
      });
    }
    
    res.status(201).json({ success: true, data: await franchiseApplicationRepository.getFranchiseApplicationById(appId) });
  } catch (error) {
    console.error('[createNewApplication] Error:', error.message);
    console.error('[createNewApplication] Stack:', error.stack);
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern || {})[0];
      return res.status(400).json({ 
        success: false, 
        error: `Duplicate ${field}: A franchise application with this ${field} already exists.` 
      });
    }
    next(error);
  }
};

// 2) GET PENDING FRANCHISES
exports.getPendingFranchises = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const applications = await FranchiseApplication.find({ 
      operatorInfo: userId, 
      statusOfBPLO: 'pending' 
    }).sort({ submittedAt: -1 });
    res.json({ success: true, data: applications });
  } catch (error) {
    next(error);
  }
};

// 3) GET SPECIFIC PENDING FRANCHISE
exports.getSpecificPendingFranchise = async (req, res, next) => {
  try {
    const { id } = req.params;
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
    if (!application || application.statusOfBPLO !== 'pending') {
      return res.status(404).json({ error: 'Pending application not found' });
    }
    res.json({ success: true, data: application });
  } catch (error) {
    next(error);
  }
};

// 4) EDIT PENDING FRANCHISE
exports.editPendingFranchise = async (req, res, next) => {
  try {
    const { id } = req.params;
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
    
    if (!application || application.statusOfBPLO !== 'pending') {
      return res.status(400).json({ error: 'Can only edit pending applications' });
    }
    
    const updated = await franchiseApplicationRepository.updateFranchiseApplication(id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// 5) CREATE RENEWAL OR AMENDMENT
exports.createRenewOrAmendment = async (req, res, next) => {
  try {
    const { franchiseId, applicationType, body, files, user } = { ...req, franchiseId: req.body.relatedFranchise, applicationType: req.body.applicationType };
    const userId = user?._id || user?.userId || String(user?.id);
    
    // Fetch existing franchise
    const existingFranchise = await FranchiseInformation.findOne({ _id: franchiseId, isCurrentVersion: true });
    if (!existingFranchise) return res.status(404).json({ error: 'Franchise not found' });
    
    if (!validateFranchiseStatus(existingFranchise, applicationType)) {
      return res.status(400).json({ error: `Cannot ${applicationType} this franchise (status: ${existingFranchise.franchiseStatus})` });
    }
    
    // Pre-fill data based on type
    const applicationData = {
      applicationType,
      relatedFranchise: franchiseId,
      operatorInfo: user?._id,
      statusOfBPLO: 'pending',
      ...(applicationType === 'change_unit' ? {
        // Keep operator, update motor + driver
        operatorName: existingFranchise.operatorName,
        operatorContactNumber: existingFranchise.operatorContactNumber,
        operatorAddress: existingFranchise.operatorAddress,
        operatorBarangay: existingFranchise.operatorBarangay,
        operatorCivilStatus: existingFranchise.operatorCivilStatus,
        operatorBirthPlace: existingFranchise.operatorBirthPlace,
        operatorBirthDate: existingFranchise.operatorBirthDate,
        operatorCitizenship: existingFranchise.operatorCitizenship,
        operatorEmail: existingFranchise.operatorEmail,
        driversID: body.driversID || existingFranchise.driversID,
        driverName: body.driverName || existingFranchise.driverName,
        driversAddress: body.driversAddress || existingFranchise.driversAddress,
        todaMembership: body.todaMembership || existingFranchise.todaMembership,
        unitModel: body.unitModel,
        colorMotor: body.colorMotor,
        sideCarColor: body.sideCarColor,
        sideCarPlateNumber: body.sideCarPlateNumber,
        mvPlateNo: body.mvPlateNo,
        motorEngineNo: body.motorEngineNo,
        chasisNo: body.chasisNo
      } : applicationType === 'update_ownership' ? {
        // Update operator, keep motor + driver
        operatorName: body.operatorName,
        operatorContactNumber: body.operatorContactNumber,
        operatorAddress: body.operatorAddress,
        operatorBarangay: body.operatorBarangay,
        operatorCivilStatus: body.operatorCivilStatus,
        operatorBirthPlace: body.operatorBirthPlace,
        operatorBirthDate: new Date(body.operatorBirthDate),
        operatorCitizenship: body.operatorCitizenship,
        operatorEmail: body.operatorEmail,
        driversID: existingFranchise.driversID,
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
      } : {
        // Renewal - keep all
        ...existingFranchise.toObject()
      })
    };
    
    const application = await franchiseApplicationRepository.createFranchiseApplication(applicationData);
    
    // Link application to user's franchiseApplications array
    if (user?._id) {
      try {
        const User = require('../models/userAccountModel');
        await User.findByIdAndUpdate(
          user._id,
          { $addToSet: { franchiseApplications: application._id } },
          { new: true }
        );
        console.log('[createRenewOrAmendment] Application linked to user:', user._id);
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
          { baseFolder: 'franchiseApplications', subFolder: userId, category });
        return result.cloudflare;
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
    }
    
    res.status(201).json({ success: true, data: application, message: `${applicationType} application created` });
  } catch (error) {
    next(error);
  }
};

// 6) GET FRANCHISES WITH WEBSOCKET IO (BPLO Admin)
exports.getFranchisesWithWebSocketIO = async (req, res, next) => {
  try {
    const applications = await FranchiseApplication.find({ statusOfBPLO: 'pending' }).sort({ submittedAt: -1 });
    
    // Emit to WebSocket if available
    if (req.app.get('io')) {
      req.app.get('io').to('bplo-admins','super-admin').emit('pending-applications', applications);
    }
    
    res.json({ success: true, data: applications });
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
    
    const updated = await franchiseApplicationRepository.updateFranchiseApplication(id, { 
      statusOfBPLO: 'bplo-approved',
      bploApprovedBy: adminUsername,
      bploApprovedAt: new Date(),
      bploInspectionRequired: true, // Set inspection requirement
      approvedAt: new Date() // Legacy field
    });
    
    // Send notification to user about BPLO approval and inspection requirement
    const notificationService = require('../services/notificationService');
    if (updated.operatorEmail) {
      await notificationService.sendBPLOApprovalNotification(updated);
    }
    
    // Emit to WebSocket
    if (req.app.get('io')) {
      req.app.get('io').to('bplo-admins').emit('application-approved', updated);
      // Notify user about the approval
      if (updated.operatorInfo) {
        req.app.get('io').to(`user-${updated.operatorInfo}`).emit('bplo-approval', {
          applicationId: updated._id,
          message: 'Your application has been approved by BPLO. Please proceed to BPLO office for tricycle inspection and then submit your OR number.',
          status: 'bplo-approved'
        });
      }
    }
    
    res.json({ success: true, data: updated, message: 'Application approved by BPLO. Applicant will be notified to proceed with inspection and OR submission.' });
  } catch (error) {
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
    const notificationService = require('../services/notificationService');
    if (updated.operatorEmail) {
      await notificationService.sendBPLODisapprovalNotification(updated, reason);
    }
    
    // Emit to WebSocket
    if (req.app.get('io')) {
      req.app.get('io').to('bplo-admins').emit('application-disapproved', updated);
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
    
    res.json({ success: true, data: updated, message: 'Application disapproved by BPLO. Applicant has been notified.' });
  } catch (error) {
    next(error);
  }
};

// 8) EDIT APPROVED FRANCHISE (Add OR + Receipt)
// Users can add Official Receipt number and OR document after BPLO approval
exports.editApprovedFranchise = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { officialReceiptNumber } = req.body;
    const { files } = req;
    
    console.log('[editApprovedFranchise] Request:', { id, officialReceiptNumber, hasFiles: !!files });
    
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Allow OR submission only after BPLO approval
    if (application.statusOfBPLO !== 'bplo-approved' && application.statusOfBPLO !== 'approved') {
      return res.status(400).json({ error: 'Application must be approved by BPLO first' });
    }
    
    // Check if user owns this application
    const userId = req.user?._id?.toString() || req.user?.userId || String(req.user?.id);
    const appUserId = application.operatorInfo?.toString();
    if (userId !== appUserId && req.user?.role !== 'admin') {
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
    }
    
    // Upload OR document if provided
    if (files?.oRTreasurerOfficeObj) {
      const file = files.oRTreasurerOfficeObj[0];
      validateFile(file);
      const result = await uploadFile(file.buffer, file.originalname, file.mimetype, 
        { baseFolder: 'franchiseApplications', subFolder: application.operatorInfo || 'pending', category: 'Documentations' });
      updateData['documents.oRTreasurerOfficeObj'] = result.cloudflare;
      console.log('[editApprovedFranchise] OR document uploaded:', result.cloudflare);
    }
    
    // Require at least one field to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Please provide officialReceiptNumber or oRTreasurerOfficeObj document' });
    }
    
    const updated = await franchiseApplicationRepository.updateFranchiseApplication(id, updateData);
    console.log('[editApprovedFranchise] Application updated successfully, now awaiting SB approval');
    
    // Notify SB admins via WebSocket
    if (req.app.get('io') && updateData.statusOfBPLO === 'awaiting-sb') {
      req.app.get('io').to('sb-admins').emit('new-sb-application', updated);
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
    // Get applications awaiting SB approval (have OR submitted)
    const applications = await FranchiseApplication.find({
      $or: [
        { statusOfBPLO: 'awaiting-sb' },
        { 
          statusOfBPLO: 'approved',
          officialRecieptNumber: { $exists: true, $ne: null, $ne: '' },
          'documents.oRTreasurerOfficeObj': { $exists: true, $ne: null, $ne: '' }
        }
      ]
    }).sort({ orSubmittedAt: -1, approvedAt: -1 });
    
    // Emit to WebSocket
    if (req.app.get('io')) {
      req.app.get('io').to('sb-admins').emit('approved-applications', applications);
    }
    
    res.json({ success: true, data: applications });
  } catch (error) {
    next(error);
  }
};

// 9b) SB ADMIN FINAL APPROVAL (with resolution number)
exports.approveFranchiseBySBAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolutionNumber } = req.body;
    
    if (!resolutionNumber || !resolutionNumber.trim()) {
      return res.status(400).json({ error: 'Resolution number is required for final approval' });
    }
    
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Allow approval for awaiting-sb or legacy 'approved' with OR
    const canApprove = application.statusOfBPLO === 'awaiting-sb' || 
                       (application.statusOfBPLO === 'approved' && application.officialReceiptNumber);
    
    if (!canApprove) {
      return res.status(400).json({ error: 'Application must have OR submitted and be awaiting SB approval' });
    }
    
    const adminUsername = req.user?.username || req.user?.email || 'SB Admin';
    
    const updated = await franchiseApplicationRepository.updateFranchiseApplication(id, { 
      statusOfBPLO: 'sb-approved',
      sbApprovedBy: adminUsername,
      sbApprovedAt: new Date(),
      sbResolutionNumber: resolutionNumber.trim()
    });
    
    // Send notification to user about final approval
    const notificationService = require('../services/notificationService');
    if (updated.operatorEmail) {
      await notificationService.sendSBApprovalNotification(updated, resolutionNumber);
    }
    
    // Emit to WebSocket
    if (req.app.get('io')) {
      req.app.get('io').to('sb-admins').emit('application-sb-approved', updated);
      // Notify user about the final approval
      if (updated.operatorInfo) {
        req.app.get('io').to(`user-${updated.operatorInfo}`).emit('sb-approval', {
          applicationId: updated._id,
          message: 'Your application has been finally approved! You can now claim your certificate of approval.',
          resolutionNumber: resolutionNumber,
          status: 'sb-approved'
        });
      }
    }
    
    res.json({ 
      success: true, 
      data: updated, 
      message: 'Application finally approved by SB Admin. Applicant can now claim their certificate.' 
    });
  } catch (error) {
    next(error);
  }
};
// get approvedroutes fromsb admin too ongoing franchise applicaion  for report session of sbAdminAcceptNewFranchise

// 10) SB ADMIN ACCEPT NEW FRANCHISE
exports.sbAdminAcceptNewFranchise = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const { franchiseNo, sessionNumber } = req.body;
    const { files } = req;
    
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
    if (!application || application.statusOfBPLO !== 'approved') {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Application not approved by BPLO' });
    }
    
    // Hash franchise number
    const hashedFranchiseNo = generateHashedFranchiseNo(franchiseNo);
    
    // Check version with transaction
    const { version, previousVersion } = await handleVersionControl(franchiseNo, 'new', session);
    
    // Upload SB documents
    let scannedReg, sessionReport;
    if (files) {
      if (files.scannedSignedRegistrationObj) {
        const file = files.scannedSignedRegistrationObj[0];
        validateFile(file);
        const result = await uploadFile(file.buffer, file.originalname, file.mimetype,
          { baseFolder: 'franchiseInformations', subFolder: franchiseNo, category: 'Documentations', customKey: `version-${version}/Documentations/${file.originalname}` });
        scannedReg = result.cloudflare;
      }
      if (files.individualSessionReportObj) {
        const file = files.individualSessionReportObj[0];
        validateFile(file);
        const result = await uploadFile(file.buffer, file.originalname, file.mimetype,
          { baseFolder: 'franchiseInformations', subFolder: franchiseNo, category: 'Documentations', customKey: `version-${version}/Documentations/${file.originalname}` });
        sessionReport = result.cloudflare;
      }
    }
    
    // Generate QR Code
    const qrBuffer = await generateQRCodeBuffer(hashedFranchiseNo);
    const qrResult = await uploadFile(qrBuffer, `qr-${franchiseNo}.png`, 'image/png',
      { baseFolder: 'franchiseInformations', subFolder: franchiseNo, category: 'QRCode', customKey: `version-${version}/QRCode/qr-${franchiseNo}.png` });
    
    // Move files from applications → information (both local and cloud)
    const userId = application.operatorInfo || 'pending';
    await moveFilesToInformation(userId, franchiseNo, version); // Local
    const urlMapping = await moveFranchiseFiles(userId, franchiseNo); // Cloud
    
    // Create FranchiseInformation record within transaction
    const franchiseData = {
      franchiseNumber: franchiseNo,
      sessionNumber,
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
      driversID: application.driversID,
      driverName: application.driverName,
      driversAddress: application.driversAddress,
      todaMembership: application.todaMembership,
      unitModel: application.unitModel,
      colorMotor: application.colorMotor,
      sideCarColor: application.sideCarColor,
      sideCarPlateNumber: application.sideCarPlateNumber,
      mvPlateNo: application.mvPlateNo,
      motorEngineNo: application.motorEngineNo,
      chasisNo: application.chasisNo,
      qrCode: qrResult.cloudflare,
      approvedAt: new Date(),
      expiryDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000), // 3 years
      franchiseStatus: 'Active',
      documents: {
        motorRegistrationObj: urlMapping[application.documents?.motorRegistrationObj] || application.documents?.motorRegistrationObj,
        barangayClearanceObj: urlMapping[application.documents?.barangayClearanceObj] || application.documents?.barangayClearanceObj,
        cedulaObj: urlMapping[application.documents?.cedulaObj] || application.documents?.cedulaObj,
        driversLicenseObj: urlMapping[application.documents?.driversLicenseObj] || application.documents?.driversLicenseObj,
        votersAffidavitObj: urlMapping[application.documents?.votersAffidavitObj] || application.documents?.votersAffidavitObj,
        motorChassisStencilObj: urlMapping[application.documents?.motorChassisStencilObj] || application.documents?.motorChassisStencilObj,
        driverPictureObj: urlMapping[application.documents?.driverPictureObj] || application.documents?.driverPictureObj,
        oRLTOObj: urlMapping[application.documents?.oRLTOObj] || application.documents?.oRLTOObj,
        cRLTOObj: urlMapping[application.documents?.cRLTOObj] || application.documents?.cRLTOObj,
        individualSessionReportObj: sessionReport
      },
      version,
      isCurrentVersion: true,
      previousVersion,
      changeType: 'new',
      changedBy: req.user?.username || 'SB Admin',
      linkedUser: application.operatorInfo
    };
    
    const FranchiseInformationModel = require('../models/franchiseInformationModel');
    const franchise = await FranchiseInformationModel.create([franchiseData], { session });
    
    // Commit transaction
    await session.commitTransaction();
    
    // Emit to WebSocket
    if (req.app.get('io')) {
      req.app.get('io').to('sb-admins').emit('franchise-created', franchise[0]);
    }
    
    res.status(201).json({ success: true, data: franchise[0], message: 'Franchise created successfully' });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// 11) SB ADMIN ACCEPT RENEWAL/AMENDMENT
exports.sbAdminAcceptRenewOrAmendment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const { files } = req;
    
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
    if (!application || application.statusOfBPLO !== 'approved') {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Application not approved' });
    }
    
    // Get existing franchise
    const existingFranchise = await FranchiseInformation.findById(application.relatedFranchise).session(session);
    if (!existingFranchise) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Related franchise not found' });
    }
    
    const franchiseNo = existingFranchise.franchiseNumber;
    const hashedFranchiseNo = generateHashedFranchiseNo(franchiseNo);
    
    // Handle versioning with transaction
    const { version, previousVersion } = await handleVersionControl(franchiseNo, application.applicationType, session);
    
    // Upload new docs
    let scannedReg, sessionReport;
    if (files) {
      if (files.scannedSignedRegistrationObj) {
        const file = files.scannedSignedRegistrationObj[0];
        validateFile(file);
        const result = await uploadFile(file.buffer, file.originalname, file.mimetype,
          { baseFolder: 'franchiseInformations', subFolder: franchiseNo, category: 'Documentations', customKey: `version-${version}/Documentations/${file.originalname}` });
        scannedReg = result.cloudflare;
      }
      if (files.individualSessionReportObj) {
        const file = files.individualSessionReportObj[0];
        validateFile(file);
        const result = await uploadFile(file.buffer, file.originalname, file.mimetype,
          { baseFolder: 'franchiseInformations', subFolder: franchiseNo, category: 'Documentations', customKey: `version-${version}/Documentations/${file.originalname}` });
        sessionReport = result.cloudflare;
      }
    }
    
    // Generate NEW QR Code for version
    const qrBuffer = await generateQRCodeBuffer(`${hashedFranchiseNo}_v${version}`);
    const qrResult = await uploadFile(qrBuffer, `qr-${franchiseNo}-v${version}.png`, 'image/png',
      { baseFolder: 'franchiseInformations', subFolder: franchiseNo, category: 'QRCode', customKey: `version-${version}/QRCode/qr-${franchiseNo}-v${version}.png` });
    
    // Create new version based on application type
    const newVersionData = {
      ...existingFranchise.toObject(),
      _id: undefined,
      version,
      isCurrentVersion: true,
      previousVersion,
      changeType: application.applicationType,
      changedBy: req.user?.username || 'SB Admin',
      changedAt: new Date(),
      qrCode: qrResult.cloudflare,
      approvedAt: new Date(),
      expiryDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000),
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
        scannedSignedRegistrationObj: scannedReg || existingFranchise.documents?.scannedSignedRegistrationObj,
        individualSessionReportObj: sessionReport || existingFranchise.documents?.individualSessionReportObj
      }
    };
    
    // Update specific sections based on type
    if (application.applicationType === 'change_unit') {
      newVersionData.unitModel = application.unitModel;
      newVersionData.colorMotor = application.colorMotor;
      newVersionData.sideCarColor = application.sideCarColor;
      newVersionData.sideCarPlateNumber = application.sideCarPlateNumber;
      newVersionData.mvPlateNo = application.mvPlateNo;
      newVersionData.motorEngineNo = application.motorEngineNo;
      newVersionData.chasisNo = application.chasisNo;
      newVersionData.driversID = application.driversID;
      newVersionData.driverName = application.driverName;
      newVersionData.driversAddress = application.driversAddress;
      newVersionData.todaMembership = application.todaMembership;
    } else if (application.applicationType === 'update_ownership') {
      newVersionData.operatorName = application.operatorName;
      newVersionData.operatorContactNumber = application.operatorContactNumber;
      newVersionData.operatorAddress = application.operatorAddress;
      newVersionData.operatorBarangay = application.operatorBarangay;
      newVersionData.operatorCivilStatus = application.operatorCivilStatus;
      newVersionData.operatorBirthPlace = application.operatorBirthPlace;
      newVersionData.operatorBirthDate = application.operatorBirthDate;
      newVersionData.operatorCitizenship = application.operatorCitizenship;
      newVersionData.operatorEmail = application.operatorEmail;
      newVersionData.linkedUser = application.operatorInfo;
    }
    
    const FranchiseInformationModel = require('../models/franchiseInformationModel');
    const newFranchise = await FranchiseInformationModel.create([newVersionData], { session });
    
    // Commit transaction
    await session.commitTransaction();
    
    // Emit to WebSocket
    if (req.app.get('io')) {
      req.app.get('io').to('sb-admins').emit('franchise-updated', newFranchise[0]);
    }
    
    res.status(201).json({ success: true, data: newFranchise[0], message: `${application.applicationType} completed - version ${version} created` });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// LEGACY ALIASES (for backward compatibility)
exports.createFranchiseApplication = exports.createNewApplication;
exports.getAllFranchiseApplications = async (req, res, next) => {
  try {
    const applications = await franchiseApplicationRepository.getAllFranchiseApplications();
    res.json({ success: true, data: applications });
  } catch (error) {
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
exports.proxyCloudflareFile = async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });
    
    const { getFileFromR2 } = require('../services/cloudflareService');
    const key = url.startsWith('r2://') ? url.substring(5) : url;
    const { buffer, contentType } = await getFileFromR2(key);
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
