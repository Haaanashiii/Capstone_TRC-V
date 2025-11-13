const franchiseApplicationRepository = require('../repositories/franchiseApplicationRepository');
const userAccountRepository = require('../repositories/userAccountRepository');
const operatorInformationRepository = require('../repositories/operatorInformationRepository');
const OperatorInformation = require('../models/operatorInformationModel');
const FranchiseApplication = require('../models/franchiseApplicationModel');
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
       
        const actionTypeMap = {
            'NEW': 'NEW',
            'RENEWAL': 'RENEWAL',
            'RENEW': 'RENEWAL',
            'AMEND': 'AMMENDMENTS',
            'AMMENDMENTS': 'AMMENDMENTS',
            'TRANSFER': 'AMMENDMENTS'
        };
        const actionType = actionTypeMap[applicationType] || (applicationType === 'NEW' ? 'NEW' : applicationType);

        // Provide sensible defaults for required fields so tests and partial submissions
        const normalized = {
            operatorName: operatorName || 'UNKNOWN',
            operatorContact: operatorContact || '0000',
            operatorEmail,
            actionType,
            operatorAddress: body.operatorAddress || body.address || body.driverAddress || 'UNKNOWN',
            profilePhoto: body.profilePhoto || body.documentPicture || null,
            qrCode: body.qrCode || null,

            driversID: body.driversID || body.driversId || body.driverId || body.driverName || 'UNKNOWN',
            birthPlace: body.birthPlace || body.placeOfBirth || 'UNKNOWN',
            birthDate: body.birthDate ? new Date(body.birthDate) : (body.dateOfBirth ? new Date(body.dateOfBirth) : new Date()),
            civilStatus: body.civilStatus || 'UNKNOWN',
            citizenship: body.citizenship || 'UNKNOWN',
            todaMembership: body.todaMembership || 'UNKNOWN',

            unitModel: body.unitModel || body.make || 'UNKNOWN',
            colorMotor: body.colorMotor || body.color || 'UNKNOWN',
            sideCar: body.sideCar || body.sidecarPlateNumber || body.sidecar_plate || 'UNKNOWN',
            mvPlateNo: body.mvPlate || body.plateNumber || body.mv_plate || 'UNKNOWN',

            motorEngineNo: body.motorEngineNo || body.motorEngineNumber || body.engineNumber || 'UNKNOWN',
            chasisNo: body.chasisNo || body.chassisNumber || body.chassis || 'UNKNOWN',
            driversAddress: body.driversAddress || body.driverAddress || body.address || 'UNKNOWN',

            actionTaken: body.actionTaken || undefined,
            remarks: body.remarks || undefined
        };

        // If files were uploaded via multipart/form-data (multer), map them into the normalized payload
        try {
            const files = req.files || {};

            const mapFile = (field) => {
                const f = files[field];
                if (Array.isArray(f) && f[0]) {
                    const file = f[0];
                    // Normalize path to URL path served by express static
                    let p = file.path || (file.destination && file.filename ? `${file.destination}/${file.filename}` : '');
                    if (typeof p === 'string') {
                        // Convert backslashes (windows) to forward slashes for URLs
                        p = p.replace(/\\/g, '/');
                        if (!p.startsWith('/')) p = '/' + p;
                    }

                    // Build an absolute URL so the frontend (which may run on a different origin
                    // during development) requests the file from the backend host where it's served.
                    // Fallback: if req is not available or host is missing, return the normalized path.
                    let absolutePath = p;
                    try {
                        const host = req && req.get && req.get('host');
                        const proto = req && req.protocol ? req.protocol : 'http';
                        if (host) {
                            absolutePath = `${proto}://${host}${p}`;
                        }
                    } catch (e) {
                        // keep the normalized path if something goes wrong
                    }

                    return {
                        name: file.originalname || file.filename,
                        type: file.mimetype || '',
                        path: absolutePath
                    };
                }
                return null;
            };

            // Map expected frontend document field names (fallback to legacy names)
            const docRegistration = mapFile('documentRegistration') || mapFile('motorRegistration');
            const docBarangay = mapFile('documentBarangayClearance') || mapFile('barangayClearance');
            const docCedula = mapFile('documentCedula') || mapFile('cedula');
            const docDriversLicense = mapFile('documentDriversLicense') || mapFile('driversLicense');
            const docVoters = mapFile('documentVotersAffidavit') || mapFile('votersAffidavit');
            const docPicture = mapFile('documentPicture') || mapFile('picture');

            if (docRegistration) normalized.documentRegistration = docRegistration;
            if (docBarangay) normalized.documentBarangayClearance = docBarangay;
            if (docCedula) normalized.documentCedula = docCedula;
            if (docDriversLicense) normalized.documentDriversLicense = docDriversLicense;
            if (docVoters) normalized.documentVotersAffidavit = docVoters;
            if (docPicture) normalized.documentPicture = docPicture;

            // If a profilePhoto was uploaded, map it as well
            const profile = mapFile('profilePhoto');
            if (profile) normalized.profilePhoto = profile.path;
        } catch (fileMapErr) {
            console.warn('Error while mapping uploaded files into franchise application payload', fileMapErr);
        }

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

        // Helper to ensure document objects contain absolute URLs where possible
        const normalizeDoc = (doc) => {
            if (!doc) return null;
            // If doc is an object with path
            if (typeof doc === 'object' && doc.path) {
                let p = doc.path;
                try {
                    if (typeof p === 'string') {
                        p = p.replace(/\\/g, '/');
                        if (!/^https?:\/\//i.test(p)) {
                            if (!p.startsWith('/')) p = '/' + p;
                            const host = req && req.get && req.get('host');
                            const proto = req && req.protocol ? req.protocol : 'http';
                            if (host) p = `${proto}://${host}${p}`;
                        }
                    }
                } catch (e) {
                    // fallback to original
                }
                return Object.assign({}, doc, { path: p });
            }

            // If doc is a string path, convert to absolute URL
            if (typeof doc === 'string') {
                let p = doc.replace(/\\/g, '/');
                try {
                    if (!/^https?:\/\//i.test(p)) {
                        if (!p.startsWith('/')) p = '/' + p;
                        const host = req && req.get && req.get('host');
                        const proto = req && req.protocol ? req.protocol : 'http';
                        if (host) p = `${proto}://${host}${p}`;
                    }
                } catch (e) {}
                return { name: p.split('/').pop() || p, type: '', path: p };
            }

            return null;
        };

        const normalized = (applications || []).map(it => ({
            id: it._id ? String(it._id) : (it.id || ''),
            franchiseNumber: it.franchiseNumber || it.franchise_number || '',
            operatorEmail: it.operatorEmail || it.email || '',
            // Normalize dates to ISO strings so frontend parsers (dayjs) receive consistent values
            approvedAt: it.approvedAt ? new Date(it.approvedAt).toISOString() : (it.approved_at ? new Date(it.approved_at).toISOString() : ''),
            expiryDate: it.expiryDate ? new Date(it.expiryDate).toISOString() : (it.expiry_date ? new Date(it.expiry_date).toISOString() : ''),
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

/**
 * Get the current logged-in user's approved franchise application (if any).
 * This uses the authenticated token (req.user) to find a matching application
 * by email, driversID, or operator id/identifiers.
 */
exports.getMyFranchiseApplication = async (req, res, next) => {
    try {
        const user = req.user || {};
        const email = (user.email || user.username || '').toString().toLowerCase();
        const driversId = (user.driversID || user.driverId || user.driversId || '').toString();

        const query = { actionTaken: { $exists: true, $ne: null } };

        // Try a few likely matches in order of confidence
        const orQueries = [];
        if (email) orQueries.push({ operatorEmail: { $regex: new RegExp(`^${email}$`, 'i') } });
        if (driversId) orQueries.push({ driversID: driversId });
        if (user.operatorId) orQueries.push({ franchiseNumber: user.operatorId });

        if (orQueries.length) query.$or = orQueries;

        const apps = await franchiseApplicationRepository.getAllFranchiseApplications(query);
        if (!apps || !apps.length) {
            return res.status(404).json({ error: 'No approved application found for this user' });
        }

        const it = apps[0];
        const normalized = {
            id: it._id ? String(it._id) : (it.id || ''),
            franchiseNumber: it.franchiseNumber || it.franchise_number || '',
            operatorEmail: it.operatorEmail || it.email || '',
            approvedAt: it.approvedAt ? new Date(it.approvedAt).toISOString() : (it.approved_at ? new Date(it.approved_at).toISOString() : ''),
            expiryDate: it.expiryDate ? new Date(it.expiryDate).toISOString() : (it.expiry_date ? new Date(it.expiry_date).toISOString() : ''),
            name: it.operatorName || it.name || it.driverName || '',
            make: it.unitModel || it.make || '',
            plateNumber: it.mvPlateNo || it.mvPlate || it.plateNumber || '',
            address: it.driversAddress || it.address || '',
            contactNumber: it.operatorContact || it.contactNumber || it.phone || '',
            sidecarPlateNumber: it.sideCar || it.sidecarPlateNumber || '',
            civilStatus: it.civilStatus || it.civil_status || '',
            birthDate: it.birthDate ? new Date(it.birthDate).toISOString() : '',
            // include chassis and motor engine numbers so frontend can populate correctly
            chassisNumber: it.chasisNo || it.chasisNumber || it.chasis || it.chasis_no || '',
            motorEngineNumber: it.motorEngineNo || it.motorEngineNumber || it.motor_engine_no || it.engineNumber || ''
        };

        res.status(200).json(normalized);
    } catch (error) {
        next(error);
    }
};


exports.updateFranchiseApplication = async (req, res, next) => {
    try {
        const payload = req.body || {};
        // If the update is marking the application as approved, run the approval side-effects
        const isApproval = payload.actionTaken && String(payload.actionTaken).toUpperCase().startsWith('APPROV');

        // If it's an approval, ensure we set franchise metadata like approvedAt/expiryDate and generate QR
        if (isApproval) {
            // Fetch current application
            const application = await franchiseApplicationRepository.getFranchiseApplicationById(req.params.id);
            if (!application) {
                return res.status(404).json({ error: 'Application not found' });
            }

            const updateData = Object.assign({}, payload);
            // Ensure franchiseNumber and timestamps
            try {
                // Blank muna logig nero, hindi pa confirmed saan kukuhain OR and FranchiseNumber
                if (application.franchiseNumber) {
                    updateData.franchiseNumber = application.franchiseNumber;
                } else if (application.orNumber) {
                    updateData.franchiseNumber = application.orNumber;
                }
                updateData.approvedAt = new Date();
                const expiry = new Date();
                expiry.setFullYear(expiry.getFullYear() + 3);
                updateData.expiryDate = expiry;
            } catch (genErr) {
                console.warn('Failed to generate franchise metadata during generic update approval', genErr);
            }

            // Try to generate QR (best-effort)
            try {
                const qrCodeData = await generateOperatorQRCode(req.params.id, { saveToFile: true });
                if (qrCodeData && qrCodeData.filePath) updateData.qrCode = qrCodeData.filePath;
            } catch (qrErr) {
                console.warn('QR generation failed during generic update approval', qrErr);
            }

            const updatedApplication = await franchiseApplicationRepository.updateFranchiseApplication(req.params.id, updateData);

            // Update linked user/operator records similar to the dedicated approve handler
            try {
                const appEmail = application.operatorEmail || application.email;
                if (appEmail) {
                    const user = await userAccountRepository.findAccountByEmail(appEmail).catch(() => null);
                    if (user) {
                        const userUpdate = {
                            franchiseStatus: 'active',
                            operatorId: updatedApplication.franchiseNumber || (updatedApplication._id ? String(updatedApplication._id) : undefined),
                            address: application.operatorAddress || application.driversAddress || undefined,
                            phoneNumber: application.operatorContact || undefined,
                            profilePicture: updatedApplication.qrCode || application.profilePhoto || undefined,
                            approvedAt: updatedApplication.approvedAt || updateData.approvedAt || undefined,
                            expiryDate: updatedApplication.expiryDate || updateData.expiryDate || undefined
                        };
                        await userAccountRepository.updateUserAccount(user._id, userUpdate).catch(err => console.warn('Failed to update user account after generic approval', err));
                    }
                }
            } catch (e) {
                console.warn('Post-approval update failed (generic update)', e);
            }

            return res.status(200).json(updatedApplication);
        }

        // For update
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

      
        try {
           
            if (application.franchiseNumber) {
                updateData.franchiseNumber = application.franchiseNumber;
            } else if (application.orNumber) {
                updateData.franchiseNumber = application.orNumber;
            }
            updateData.approvedAt = new Date();
            // Default expiry: 3 years from now (policy: 3-year franchises)
            const expiry = new Date();
            expiry.setFullYear(expiry.getFullYear() + 3);
            updateData.expiryDate = expiry;
        } catch (genErr) {
            console.warn('Failed to generate franchise metadata during approval', genErr);
        }
        
        // Generate QR code for the approved franchise
        try {
            const qrCodeData = await generateOperatorQRCode(id, { saveToFile: true });
            updateData.qrCode = qrCodeData.filePath;
            
            console.log(`[QR GENERATED] Franchise Application: ${id}, File: ${qrCodeData.filePath}`);
        } catch (qrError) {
            console.error('QR Code generation failed during approval:', qrError);
            // Continue with approval even if QR generation fails
        }
        

    
        let updatedApplication;
        try {
            const appDoc = await FranchiseApplication.findById(id);
            if (!appDoc) {
                return res.status(404).json({ error: 'Application not found' });
            }

            // Assign approval metadata and QR path directly on the document
            appDoc.actionTaken = updateData.actionTaken;
            appDoc.remarks = updateData.remarks;
            if (updateData.franchiseNumber) appDoc.franchiseNumber = updateData.franchiseNumber;
            if (updateData.approvedAt) appDoc.approvedAt = updateData.approvedAt;
            if (updateData.expiryDate) appDoc.expiryDate = updateData.expiryDate;
            if (updateData.qrCode) appDoc.qrCode = updateData.qrCode;

            updatedApplication = await appDoc.save();
        } catch (saveErr) {
            console.error('Failed to persist approval metadata on franchise application:', saveErr);
            // Fall back to repository update to at least set whatever we can
            updatedApplication = await franchiseApplicationRepository.updateFranchiseApplication(id, updateData);
        }
        
    // Attempt to update linked user/operator records so Operator ID reflects approval
        try {
            // Update user account (if email present)
            const appEmail = application.operatorEmail || application.operatorEmail;
            if (appEmail) {
                try {
                    const user = await userAccountRepository.findAccountByEmail(appEmail).catch(() => null);
                    if (user) {
                        // Map application fields to user account fields used by frontend
                        const userUpdate = {
                            franchiseStatus: 'active',
                            operatorId: updatedApplication.franchiseNumber || (updatedApplication._id ? String(updatedApplication._id) : undefined),
                            address: application.operatorAddress || application.driversAddress || undefined,
                            phoneNumber: application.operatorContact || undefined,
                            profilePicture: updatedApplication.qrCode || application.profilePhoto || undefined
                            ,
                            // Record approval timestamps on the user account for visibility in other pages
                            approvedAt: updatedApplication.approvedAt || updateData.approvedAt || undefined,
                            expiryDate: updatedApplication.expiryDate || updateData.expiryDate || undefined
                        };
                        await userAccountRepository.updateUserAccount(user._id, userUpdate).catch(err => console.warn('Failed to update user account after approval', err));
                    }
                } catch (e) {
                    console.warn('Error updating user account for approved application', e);
                }
            }

            // Update OperatorInformation record if one exists for this driver's ID
            try {
                const driversId = application.driversID || application.driversId || application.driversID;
                if (driversId) {
                    const existing = await OperatorInformation.findOne({ driversID: driversId }).exec();
                    if (existing) {
                        const opUpdate = {
                            profilePhoto: updatedApplication.profilePhoto || application.profilePhoto || existing.profilePhoto,
                            qrCode: updatedApplication.qrCode || existing.qrCode,
                            franchiseStatus: 'active',
                            address: application.driversAddress || application.operatorAddress || existing.address,
                            contactNumber: application.operatorContact || existing.contactNumber,
                            unitModel: application.unitModel || existing.unitModel,
                            mvPlate: application.mvPlateNo || existing.mvPlate || existing.mvPlate,
                            motorEngineNo: application.motorEngineNo || existing.motorEngineNo,
                            chasisNo: application.chasisNo || existing.chasisNo
                        };
                        await operatorInformationRepository.updateOperatorInformation(existing._id, opUpdate).catch(err => console.warn('Failed to update operator information after approval', err));
                    }
                }
            } catch (e) {
                console.warn('Error updating operator information for approved application', e);
            }
        } catch (e) {
            console.warn('Post-approval update failed', e);
        }

        res.status(200).json({
            success: true,
            message: 'Franchise application approved successfully',
            data: updatedApplication
        });
    } catch (error) {
        next(error);
    }
};
