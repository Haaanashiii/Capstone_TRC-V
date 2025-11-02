const franchiseApplicationRepository = require('../repositories/franchiseApplicationRepository');
const { generateOperatorQRCode } = require('../services/qrCodeService');

exports.createFranchiseApplication = async (req, res, next) => {
  try {
        // Normalize incoming payload to match Mongoose schema expectations.
        // Accept many aliases from the frontend to keep backward compatibility.
        const body = req.body || {};

        const operatorName = body.operatorName || body.name || body.operatorName || body.operator || body.driverName || '';
        const operatorContact = body.operatorContact || body.contactNumber || body.contact || body.phone || '';
        // Build a unique placeholder email if none provided to satisfy schema uniqueness in dev.
        const operatorEmail = body.operatorEmail || body.email || `${(operatorName || 'user').toString().replace(/\s+/g, '.').toLowerCase()}.${Date.now()}@example.invalid`;

        const applicationType = (body.actionType || body.applicationType || 'NEW').toString().toUpperCase();
        // Map common human-friendly variants
        const actionTypeMap = {
            'NEW': 'NEW',
            'RENEWAL': 'RENEWAL',
            'RENEW': 'RENEWAL',
            'AMEND': 'AMMENDMENTS',
            'AMMENDMENTS': 'AMMENDMENTS',
            'TRANSFER': 'AMMENDMENTS'
        };
        const actionType = actionTypeMap[applicationType] || (applicationType === 'NEW' ? 'NEW' : applicationType);

        const normalized = {
            operatorName,
            operatorContact,
            operatorEmail,
            actionType,
            operatorAddress: body.operatorAddress || body.address || body.driverAddress || '',
            profilePhoto: body.profilePhoto || body.documentPicture || null,
            qrCode: body.qrCode || null,

            driversID: body.driversID || body.driversId || body.driverId || body.driverName || '',
            birthPlace: body.birthPlace || body.placeOfBirth || '',
            birthDate: body.birthDate ? new Date(body.birthDate) : (body.dateOfBirth ? new Date(body.dateOfBirth) : null),
            civilStatus: body.civilStatus || '',
            citizenship: body.citizenship || '',
            todaMembership: body.todaMembership || '',

            unitModel: body.unitModel || body.make || '',
            colorMotor: body.colorMotor || body.color || '',
            sideCar: body.sideCar || body.sidecarPlateNumber || body.sidecar_plate || '',
            mvPlateNo: body.mvPlate || body.plateNumber || body.mv_plate || '',

            motorEngineNo: body.motorEngineNo || body.motorEngineNumber || body.engineNumber || '',
            chasisNo: body.chasisNo || body.chassisNumber || body.chassis || '',
            driversAddress: body.driversAddress || body.driverAddress || body.address || '',

            actionTaken: body.actionTaken || undefined,
            remarks: body.remarks || undefined
        };

        try {
            const application = await franchiseApplicationRepository.createFranchiseApplication(normalized);
            // Log persistence details to help debug where documents are being stored
            try {
                const mongoose = require('mongoose');
                console.log('[FRANCHISE CREATE] saved id=', application && application._id ? String(application._id) : '(no id)');
                console.log('[FRANCHISE CREATE] mongoose db=', mongoose.connection && mongoose.connection.name);
                console.log('[FRANCHISE CREATE] collection=', application && application.collection && application.collection.name);
                console.log('[FRANCHISE CREATE] document=', JSON.stringify(application.toObject ? application.toObject() : application));
            } catch (logErr) {
                console.warn('Failed to log franchise save details', logErr);
            }
            return res.status(201).json(application);
        } catch (innerErr) {
            if (innerErr && innerErr.name === 'ValidationError') {
                const details = Object.keys(innerErr.errors || {}).map(k => ({ field: k, message: innerErr.errors[k].message }));
                return res.status(400).json({ error: 'Validation failed', details });
            }
            throw innerErr;
        }
  } catch (error) {
    next(error);
  }
};

exports.getAllFranchiseApplications = async (req, res, next) => {
    try {
        const { status } = req.query || {};
        let query = {};
        if (status === 'pending') {
            query = { $or: [{ actionTaken: { $exists: false } }, { actionTaken: null }] };
        } else if (status === 'approved') {
            query = { actionTaken: { $exists: true, $ne: null } };
        }

        const applications = await franchiseApplicationRepository.getAllFranchiseApplications(query);

        const normalized = (applications || []).map(it => ({
            id: it._id ? String(it._id) : (it.id || ''),
            franchiseNumber: it.franchiseNumber || it.franchise_number || '',
            name: it.operatorName || it.name || it.driverName || '',
            make: it.unitModel || it.make || '',
            plateNumber: it.mvPlateNo || it.mvPlate || it.plateNumber || '',
            applicationType: it.actionType || it.applicationType || 'New',
            address: it.driversAddress || it.address || '',
            contactNumber: it.operatorContact || it.contactNumber || it.phone || '',
            sidecarPlateNumber: it.sideCar || it.sidecarPlateNumber || '',
            birthPlace: it.birthPlace || '',
            birthDate: it.birthDate ? new Date(it.birthDate).toISOString() : '',
            civilStatus: it.civilStatus || '',
            citizenship: it.citizenship || '',
            todaMembership: it.todaMembership || '',
            unitModel: it.unitModel || '',
            colorMotor: it.colorMotor || '',
            colorSidecar: it.sideCar || '',
            mvPlate: it.mvPlateNo || '',
            motorEngineNumber: it.motorEngineNo || it.motorEngineNumber || '',
            chassisNumber: it.chasisNo || it.chassisNumber || '',
            driverName: it.driversID || it.driverName || '',
            driverAddress: it.driversAddress || it.driverAddress || '',
            documentRegistration: it.documentRegistration || null,
            documentBarangayClearance: it.documentBarangayClearance || null,
            documentCedula: it.documentCedula || null,
            documentDriversLicense: it.documentDriversLicense || null,
            documentVotersAffidavit: it.documentVotersAffidavit || null,
            documentPicture: it.profilePhoto || it.documentPicture || null,
        }));

        res.status(200).json(normalized);
    } catch (error) {
        next(error);
    }
};

exports.getFranchiseApplication = async (req, res, next) => {
  try {
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }   
    res.status(200).json(application);
    } catch (error) {
        next(error);
    }
};


exports.updateFranchiseApplication = async (req, res, next) => {
    try {
        const payload = req.body || {};
        const application = await franchiseApplicationRepository.updateFranchiseApplication(req.params.id, payload);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        res.status(200).json(application);
    } catch (error) {
        next(error);
    }
};

exports.deleteFranchiseApplication = async (req, res, next) => {
    try {
        const application = await franchiseApplicationRepository.deleteFranchiseApplication(req.params.id);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        res.status(204).send();
    } catch (error) {
        next(error);
    }   
};

/**
 * Approve franchise application and generate QR code
 * This endpoint should be called by admin when approving an application
 */
exports.approveFranchiseApplication = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { actionTaken, remarks } = req.body;
        
        // Get the application
        const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        // Update application status
        const updateData = {
            actionTaken: actionTaken || 'APPROVED',
            remarks: remarks || 'Application approved'
        };
        
        // Generate QR code for the approved franchise
        try {
            const qrCodeData = await generateOperatorQRCode(id, { saveToFile: true });
            updateData.qrCode = qrCodeData.filePath;
            
            console.log(`[QR GENERATED] Franchise Application: ${id}, File: ${qrCodeData.filePath}`);
        } catch (qrError) {
            console.error('QR Code generation failed during approval:', qrError);
            // Continue with approval even if QR generation fails
        }
        

        const updatedApplication = await franchiseApplicationRepository.updateFranchiseApplication(id, updateData);
        
        res.status(200).json({
            success: true,
            message: 'Franchise application approved successfully',
            data: updatedApplication
        });
    } catch (error) {
        next(error);
    }
};
