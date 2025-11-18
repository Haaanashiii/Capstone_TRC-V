const franchiseApplicationRepository = require('../repositories/franchiseApplicationRepository');
const userAccountRepository = require('../repositories/userAccountRepository');
const franchiseInformationRepository = require('../repositories/franchiseInformationRepository');
const FranchiseInformation = require('../models/franchiseInformationModel');
const FranchiseApplication = require('../models/franchiseApplicationModel');
const { generateOperatorQRCode, generateFranchiseQRCode } = require('../services/qrCodeService');
const { uploadToR2, moveFranchiseFiles, updateDocumentUrls } = require('../services/cloudflareService');
const { generateUniqueMTOPNumber, hashMTOPNumber } = require('../utils/mtopGenerator');

exports.createFranchiseApplication = async (req, res, next) => {
  try {
        // Debug: Check if request has Authorization header
        console.log('[CREATE_APPLICATION] Authorization header present:', !!req.headers.authorization);
        
        // Debug: Full JWT token payload
        console.log('[CREATE_APPLICATION] Full req.user object:', JSON.stringify(req.user, null, 2));
        
        console.log('[CREATE_APPLICATION] Authenticated user:', {
            id: req.user?.id,
            role: req.user?.role,
            name: req.user?.name,
            accountType: req.user?.accountType,
            hasFranchise: req.user?.hasFranchise
        });
        
        // Normalize incoming payload to match Mongoose schema expectations.
        // Accept many aliases from the frontend to keep backward compatibility.
        const body = req.body || {};

        const operatorName = body.operatorName || body.name || body.operatorName || body.operator || body.driverName || '';
        const operatorContact = body.operatorContact || body.contactNumber || body.contact || body.phone || '';
        
        // If user is authenticated, use their email; otherwise use provided email
        let operatorEmail = body.operatorEmail || body.email || '';
        if (req.user && req.user.id && !operatorEmail) {
            // Fetch user's email from database if they're authenticated
            try {
                const User = require('../models/userAccountModel');
                // req.user.id contains userId (UUID), so search by userId field
                const user = await User.findOne({ userId: req.user.id });
                if (user && user.email) {
                    operatorEmail = user.email;
                    console.log('[CREATE_APPLICATION] Using authenticated user email:', operatorEmail);
                    console.log('[CREATE_APPLICATION] Found user by userId:', req.user.id);
                }
            } catch (err) {
                console.warn('[CREATE_APPLICATION] Could not fetch user email:', err.message);
            }
        }
        
        // Validate email if provided
        if (operatorEmail && !/^\S+@\S+\.\S+$/.test(operatorEmail)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        
        console.log('[CREATE_APPLICATION] Operator email:', operatorEmail || 'NOT PROVIDED');

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
            // Only link userId if submitter is an operator (not admin creating on behalf)
            userId: (req.user?.role === 'operator') ? req.user.id : null,
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

        try {
            // Step 1: Create the application first to get the real ID
            const application = await franchiseApplicationRepository.createFranchiseApplication(normalized);
            const applicationId = String(application._id);
            
            console.log(`[FRANCHISE CREATE] Application created with ID: ${applicationId}`);

            // Step 2: Upload files to Cloudflare R2 using the REAL application ID
            const files = req.files || {};
            console.log(`[FRANCHISE CREATE] Files received:`, Object.keys(files).length);
            Object.keys(files).forEach(field => {
                console.log(`  - ${field}: ${files[field][0]?.originalname || 'no file'}`);
            });
            
            if (Object.keys(files).length > 0) {
                const uploadFile = async (field, documentType = 'documents') => {
                    const f = files[field];
                    if (Array.isArray(f) && f[0]) {
                        const file = f[0];
                        
                        // Validate file size on server (not just client)
                        const MAX_SIZE = 10 * 1024 * 1024; // 10MB
                        if (file.size > MAX_SIZE) {
                            throw new Error(`${field} exceeds maximum size of 10MB`);
                        }
                        
                        try {
                            // Upload to Cloudflare R2 with the REAL application ID
                            const cloudflareUrl = await uploadToR2(
                                file.buffer,
                                file.originalname,
                                file.mimetype,
                                {
                                    folder: 'franchise-applications',
                                    applicationId: applicationId, // Use REAL ID from created application
                                    documentType: documentType
                                }
                            );
                            console.log(`[CLOUDFLARE] Uploaded ${field}: ${cloudflareUrl}`);
                            return cloudflareUrl;
                        } catch (uploadErr) {
                            console.error(`[CLOUDFLARE] Failed to upload ${field}:`, uploadErr);
                            throw new Error(`Failed to upload ${field} to Cloudflare`);
                        }
                    }
                    return null;
                };

                // Upload all documents in parallel for efficiency
                const [
                    docRegistration,
                    docBarangay,
                    docCedula,
                    docDriversLicense,
                    docVoters,
                    docChassisStencil,
                    docPicture,
                    profilePhotoUrl
                ] = await Promise.all([
                    uploadFile('documentRegistration', 'documents'),
                    uploadFile('documentBarangayClearance', 'documents'),
                    uploadFile('documentCedula', 'documents'),
                    uploadFile('documentDriversLicense', 'documents'),
                    uploadFile('documentVotersAffidavit', 'documents'),
                    uploadFile('documentChassisStencil', 'documents'),
                    uploadFile('documentPicture', 'profile'),
                    uploadFile('profilePhoto', 'profile')
                ]);

                // Step 3: Update the application with Cloudflare URLs in documents subdocument
                const documentUpdates = {
                    documents: {
                        motorRegistration: docRegistration || '',
                        barangayClearance: docBarangay || '',
                        cedula: docCedula || '',
                        driversLicense: docDriversLicense || '',
                        votersAffidavit: docVoters || '',
                        motorChassisStencil: docChassisStencil || '',
                        picture: docPicture || ''
                    }
                };
                
                // Add profilePhoto separately (it's not in documents subdocument)
                if (profilePhotoUrl) {
                    documentUpdates.profilePhoto = profilePhotoUrl;
                }

                // Update the application with file URLs
                const hasDocuments = Object.keys(documentUpdates.documents).some(k => documentUpdates.documents[k]);
                console.log(`[FRANCHISE CREATE] Document update check:`, {
                    hasDocuments,
                    motorRegistration: !!docRegistration,
                    barangayClearance: !!docBarangay,
                    cedula: !!docCedula,
                    driversLicense: !!docDriversLicense,
                    votersAffidavit: !!docVoters,
                    motorChassisStencil: !!docChassisStencil,
                    picture: !!docPicture
                });
                
                if (hasDocuments) {
                    const updateResult = await franchiseApplicationRepository.updateFranchiseApplication(applicationId, documentUpdates);
                    console.log(`[CLOUDFLARE] Updated application ${applicationId} with documents`);
                    console.log(`[CLOUDFLARE] Update result:`, updateResult ? 'SUCCESS' : 'FAILED');
                } else {
                    console.log(`[FRANCHISE CREATE] No documents to update`);
                }
            }
            
            // NOTE: QR code generation happens during APPROVAL, not during application creation
            // The admin will generate QR codes when they approve the application
            
            // Return the complete application with all file URLs
            const fresh = await franchiseApplicationRepository.getFranchiseApplicationById(applicationId);
            
            // Check if documents were uploaded (documents subdocument)
            const hasDocuments = fresh?.documents && Object.values(fresh.documents).some(doc => doc && doc.trim() !== '');
            console.log(`[FRANCHISE CREATE] Complete! Application ${applicationId} with ${hasDocuments ? 'documents uploaded' : 'no documents'}`);
            
            return res.status(201).json(fresh || application);
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

        // Helper to convert R2 path string to document object
        const normalizeDocument = (doc) => {
            if (!doc) return null;
            
            // Already an object with name and path
            if (typeof doc === 'object' && doc.path) {
                return doc;
            }
            
            // R2 path string (e.g., "r2://TRC-V/franchise-applications/.../filename-hash.pdf")
            if (typeof doc === 'string') {
                // Extract filename from path
                const parts = doc.split('/');
                const filename = parts[parts.length - 1];
                
                // Try to extract readable name from hashed filename
                // Format is typically: "type-originalname-hash.ext" or just "hash.ext"
                let displayName = filename;
                if (filename.includes('-')) {
                    const nameParts = filename.split('-');
                    // If we have parts like ["registration", "doc", "abc123.pdf"]
                    // Take the first meaningful part
                    if (nameParts.length >= 2) {
                        displayName = nameParts.slice(0, -1).join('-') + '.' + filename.split('.').pop();
                    }
                }
                
                // Determine type from extension
                const ext = filename.split('.').pop()?.toLowerCase();
                let type = '';
                if (ext === 'pdf') {
                    type = 'application/pdf';
                } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                    type = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                } else if (['doc', 'docx'].includes(ext)) {
                    type = 'application/msword';
                }
                
                return {
                    name: displayName,
                    type: type,
                    path: doc
                };
            }
            
            return null;
        };

        const normalized = (applications || []).map(it => {
            // Get documents from subdocument (new format) or fallback to old fields
            const docs = it.documents || {};
            
            return {
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
                // Read from documents subdocument (new format) or fallback to old fields
                documentRegistration: normalizeDocument(docs.motorRegistration || it.documentRegistration),
                documentBarangayClearance: normalizeDocument(docs.barangayClearance || it.documentBarangayClearance),
                documentCedula: normalizeDocument(docs.cedula || it.documentCedula),
                documentDriversLicense: normalizeDocument(docs.driversLicense || it.documentDriversLicense),
                documentVotersAffidavit: normalizeDocument(docs.votersAffidavit || it.documentVotersAffidavit),
                documentPicture: normalizeDocument(docs.picture || it.profilePhoto || it.documentPicture),
                qrCode: it.qrCode || null,
            };
        });

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
    // Ensure qrCode is present in single-application response
    const appObj = application;
    if (appObj) appObj.qrCode = appObj.qrCode || appObj.qrcode || appObj.qr || null;
    res.status(200).json(appObj);
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
            ,
            qrCode: it.qrCode || null
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
 * Approve franchise application and generate QR code with MTOP-based organization
 * Flow:
 * 1. Generate unique MTOP number
 * 2. Hash MTOP for secure URL and folder naming
 * 3. Move Cloudflare files to franchise-information/{hashedMTOP}
 * 4. Generate QR code with URL: /operator/{hashedMTOP}
 * 5. Create FranchiseInformation record with all data
 * 6. Link FranchiseInformation to user account
 * 7. Update application with approval data
 */
exports.approveFranchiseApplication = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { actionTaken, remarks } = req.body;
        
        console.log(`\n========================================`);
        console.log(`[APPROVAL] Starting approval process for application ${id}`);
        console.log(`========================================`);
        
        // Get the application
        const application = await franchiseApplicationRepository.getFranchiseApplicationById(id);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        // Check if application is already approved
        if (application.actionTaken && String(application.actionTaken).toUpperCase().includes('APPROV')) {
            console.log(`[APPROVAL] ⚠️ Application ${id} is already approved`);
            console.log(`[APPROVAL] Action taken: ${application.actionTaken}`);
            
            return res.status(409).json({ 
                error: 'Application already approved',
                message: 'This application has already been processed and approved.',
                actionTaken: application.actionTaken
            });
        }
        
        // STEP 1: Generate unique MTOP number
        let mtopNumber;
        try {
            mtopNumber = await generateUniqueMTOPNumber();
            console.log(`[APPROVAL] Generated MTOP number: ${mtopNumber}`);
        } catch (error) {
            console.error('[APPROVAL] Failed to generate MTOP number:', error);
            return res.status(500).json({ error: 'Failed to generate MTOP number' });
        }
        
        // STEP 2: Hash MTOP for secure identification
        const hashedMTOP = hashMTOPNumber(mtopNumber);
        console.log(`[APPROVAL] Hashed MTOP: ${hashedMTOP}`);
        
        // STEP 3: Move Cloudflare files to new folder structure
        let urlMapping = {};
        try {
            urlMapping = await moveFranchiseFiles(id, hashedMTOP);
            console.log(`[APPROVAL] Moved ${Object.keys(urlMapping).length} files to franchise-information folder`);
        } catch (error) {
            console.warn('[APPROVAL] Failed to move files, continuing with existing URLs:', error);
        }
        
        // STEP 4: Generate QR code with hashed MTOP URL and upload to R2
        let qrCodeFilePath = null;

        // Prepare updateData early so we can assign qrCode immediately after generation
        let updateData = {};
        try {
            const { uploadQRToR2 } = require('../services/cloudflareService');
            const qrCodeData = await generateFranchiseQRCode(hashedMTOP, { uploadToR2: true });
            
            // Upload QR code buffer to R2
            qrCodeFilePath = await uploadQRToR2(qrCodeData.buffer, hashedMTOP);
            console.log(`[APPROVAL] Generated and uploaded QR code to R2: ${qrCodeFilePath}`);
            // Save QR path to updateData so it will be written to the application record
            updateData.qrCode = qrCodeFilePath;
        } catch (qrError) {
            console.error('[APPROVAL] QR Code generation/upload failed:', qrError);
            // Continue with approval even if QR generation fails
        }
        
        // Helper to extract path from document (handles both string and object formats)
        const getDocPath = (doc) => {
            if (!doc) return null;
            if (typeof doc === 'string') return doc;
            if (typeof doc === 'object' && doc.path) return doc.path;
            return null;
        };
        
        // Get documents from the documents subdocument
        const appDocs = application.documents || {};
        
        // Update document URLs with new Cloudflare locations
        const updatedDocuments = updateDocumentUrls({
            motorRegistration: getDocPath(appDocs.motorRegistration),
            barangayClearance: getDocPath(appDocs.barangayClearance),
            cedula: getDocPath(appDocs.cedula),
            driversLicense: getDocPath(appDocs.driversLicense),
            votersAffidavit: getDocPath(appDocs.votersAffidavit),
            motorChassisStencil: getDocPath(appDocs.motorChassisStencil),
            picture: getDocPath(appDocs.picture || application.profilePhoto)
        }, urlMapping);
        
        const profilePhotoPath = getDocPath(application.profilePhoto || appDocs.picture);
        const updatedProfilePhoto = urlMapping[profilePhotoPath] || profilePhotoPath;
        
        // STEP 5: Create FranchiseInformation record
        let franchiseInfo = null;
        try {
            // Get barangay if available (temporarily optional)
            const barangay = application.operatorBarangay || application.barangay || '';

            // Check if franchise info already exists by operatorId (unique index) OR driversID
            const existingInfo = await FranchiseInformation.findOne({ 
                $or: [
                    { operatorId: hashedMTOP },
                    { driversID: application.driversID }
                ]
            });
            
            if (existingInfo) {
                console.log(`[APPROVAL] ⚠️ WARNING: FranchiseInformation already exists!`);
                console.log(`[APPROVAL] Existing operatorId: ${existingInfo.operatorId}`);
                console.log(`[APPROVAL] Existing driversID: ${existingInfo.driversID}`);
                console.log(`[APPROVAL] New hashedMTOP: ${hashedMTOP}`);
                console.log(`[APPROVAL] This appears to be a duplicate approval. Aborting.`);
                
                return res.status(409).json({ 
                    error: 'Franchise information already exists',
                    message: 'This application has already been approved or a franchise exists for this driver.',
                    existingOperatorId: existingInfo.operatorId,
                    existingMTOP: existingInfo.mtopNumber
                });
            }
            
            const franchiseData = {
                operatorId: hashedMTOP,
                mtopNumber: mtopNumber,
                operatorName: application.operatorName || application.driverName,
                contactNumber: application.operatorContact,
                address: application.driversAddress || application.operatorAddress,
                barangay: barangay,
                civilStatus: application.civilStatus || 'Single',
                email: application.operatorEmail,
                driversID: application.driversID,
                profilePhoto: updatedProfilePhoto,
                qrCode: qrCodeFilePath,
                approvedAt: new Date(),
                expiryDate: (() => {
                    const expiry = new Date();
                    expiry.setFullYear(expiry.getFullYear() + 3); // 3 years validity
                    return expiry;
                })(),
                documents: {
                    motorRegistration: updatedDocuments.motorRegistration,
                    barangayClearance: updatedDocuments.barangayClearance,
                    cedula: updatedDocuments.cedula,
                    driversLicense: updatedDocuments.driversLicense,
                    votersAffidavit: updatedDocuments.votersAffidavit,
                    motorChassisStencil: updatedDocuments.motorChassisStencil || '', // Optional for now
                    picture: updatedDocuments.picture
                },
                franchiseStatus: 'active'
            };
            
            franchiseInfo = await franchiseInformationRepository.createFranchiseInformation(franchiseData);
            console.log(`[APPROVAL] Created new FranchiseInformation: ${franchiseInfo._id}`);
        } catch (error) {
            console.error('[APPROVAL] CRITICAL ERROR - Failed to create FranchiseInformation:', error);
            return res.status(500).json({ 
                error: 'Failed to create franchise information', 
                details: error.message,
                note: 'Files were moved in R2 but database record creation failed.'
            });
        }
        
        // STEP 6: Link FranchiseInformation to user account
        let linkedUserId = null;
        try {
            const appUserId = application.userId;
            const appEmail = application.operatorEmail;
            
            console.log(`[APPROVAL] Attempting to link franchise to user...`);
            console.log(`[APPROVAL] Application userId: ${appUserId}`);
            console.log(`[APPROVAL] Application email: ${appEmail}`);
            
            if (!franchiseInfo) {
                console.warn('[APPROVAL] ⚠️  FranchiseInfo not created, cannot link');
            } else if (appUserId) {
                // PREFERRED METHOD: Use userId from application (UUID string)
                try {
                    const User = require('../models/userAccountModel');
                    // appUserId is now a UUID string, search by userId field not _id
                    const user = await User.findOne({ userId: appUserId });
                    
                    if (user) {
                        const updateData = {
                            franchiseInfo: franchiseInfo._id,
                            franchiseStatus: 'active',
                            operatorId: hashedMTOP,
                            address: application.driversAddress || application.operatorAddress,
                            phoneNumber: application.operatorContact,
                            profilePicture: updatedProfilePhoto,
                            approvedAt: franchiseInfo.approvedAt,
                            expiryDate: franchiseInfo.expiryDate
                        };
                        
                        await userAccountRepository.updateUserAccount(user._id, updateData);
                        
                        // BIDIRECTIONAL LINK: Update FranchiseInformation with linkedUser
                        await FranchiseInformation.findByIdAndUpdate(
                            franchiseInfo._id,
                            { linkedUser: user._id },
                            { new: true }
                        );
                        
                        linkedUserId = user._id;
                        console.log(`[APPROVAL] ✅ Successfully linked franchise to user by userId (UUID): ${appUserId}`);
                        console.log(`[APPROVAL] User: ${user.name} (${user.email})`);
                        console.log(`[APPROVAL] User MongoDB _id: ${user._id}`);
                        console.log(`[APPROVAL] Franchise status set to: active`);
                        console.log(`[APPROVAL] ✅ Bidirectional link created: FranchiseInfo.linkedUser = ${user._id}`);
                    } else {
                        console.warn(`[APPROVAL] ⚠️  User not found with userId (UUID): ${appUserId}`);
                        console.warn(`[APPROVAL] User may have been deleted. Franchise created but not linked.`);
                    }
                } catch (userError) {
                    console.error('[APPROVAL] ❌ Error finding user by userId:', userError.message);
                    throw userError;
                }
            } else if (appEmail) {
                // FALLBACK METHOD: Use email (for backward compatibility with old applications)
                console.log('[APPROVAL] No userId in application, falling back to email lookup...');
                const user = await userAccountRepository.findAccountByEmail(appEmail);
                
                if (user) {
                    const updateData = {
                        franchiseInfo: franchiseInfo._id,
                        franchiseStatus: 'active',
                        operatorId: hashedMTOP,
                        address: application.driversAddress || application.operatorAddress,
                        phoneNumber: application.operatorContact,
                        profilePicture: updatedProfilePhoto,
                        approvedAt: franchiseInfo.approvedAt,
                        expiryDate: franchiseInfo.expiryDate
                    };
                    
                    await userAccountRepository.updateUserAccount(user._id, updateData);
                    
                    // BIDIRECTIONAL LINK: Update FranchiseInformation with linkedUser
                    await FranchiseInformation.findByIdAndUpdate(
                        franchiseInfo._id,
                        { linkedUser: user._id },
                        { new: true }
                    );
                    
                    linkedUserId = user._id;
                    console.log(`[APPROVAL] ✅ Successfully linked franchise to user by email: ${user._id}`);
                    console.log(`[APPROVAL] User: ${user.name} (${user.email})`);
                    console.log(`[APPROVAL] ✅ Bidirectional link created: FranchiseInfo.linkedUser = ${user._id}`);
                } else {
                    console.warn(`[APPROVAL] ⚠️  No user found with email: ${appEmail}`);
                    console.warn(`[APPROVAL] Franchise created but not linked to any user account`);
                }
            } else {
                console.warn('[APPROVAL] ⚠️  Application has no userId or email, cannot link to user');
                console.warn('[APPROVAL] Franchise created but not linked to any user account');
            }
        } catch (error) {
            console.error('[APPROVAL] ❌ FAILED to link user account:', error.message);
            console.error('[APPROVAL] Stack:', error.stack);
        }
        
        // STEP 7: Mark application as approved and ensure generated QR code is stored on application
        // Reuse the earlier updateData (may already contain qrCode)
        updateData.actionTaken = actionTaken || 'APPROVED';
        updateData.remarks = remarks || `Application approved. MTOP Number: ${mtopNumber}`;
        // Ensure property exists (set to null if not generated)
        if (typeof updateData.qrCode === 'undefined') updateData.qrCode = qrCodeFilePath || null;

        const updatedApplication = await franchiseApplicationRepository.updateFranchiseApplication(id, updateData);
        console.log(`[APPROVAL] Updated franchise application ${id} - saved qrCode: ${updatedApplication && updatedApplication.qrCode}`);
        console.log(`[APPROVAL] Marked application ${id} as APPROVED`);

        console.log(`========================================`);
        console.log(`[APPROVAL] ✅ SUCCESS!`);
        console.log(`[APPROVAL] MTOP: ${mtopNumber}`);
        console.log(`[APPROVAL] Hashed MTOP: ${hashedMTOP}`);
        console.log(`[APPROVAL] FranchiseInfo ID: ${franchiseInfo ? franchiseInfo._id : 'None'}`);
        console.log(`[APPROVAL] QR Code: ${qrCodeFilePath || 'None'}`);
        console.log(`[APPROVAL] QR URL: ${process.env.BASE_URL || 'http://localhost:5173'}/operator/id/${hashedMTOP}`);
        console.log(`========================================\n`);

        res.status(200).json({
            success: true,
            message: 'Franchise application approved successfully',
            data: {
                applicationId: id,
                mtopNumber: mtopNumber,
                hashedMTOP: hashedMTOP,
                franchiseInfoId: franchiseInfo ? franchiseInfo._id : null,
                qrCodeUrl: `${process.env.BASE_URL || 'http://localhost:5173'}/operator/id/${hashedMTOP}`,
                actionTaken: 'APPROVED'
            }
        });
    } catch (error) {
        console.error('[APPROVAL] Approval process failed:', error);
        next(error);
    }
};

/**
 * Proxy endpoint to fetch files from Cloudflare R2 and serve them through backend
 * This bypasses CORS restrictions and allows frontend to preview/download files
 * Uses presigned URLs for secure access without enabling public bucket access
 */
exports.proxyCloudflareFile = async (req, res, next) => {
    try {
        const { url } = req.query;

        console.log('[PROXY] Received request for URL:', url);

        if (!url) {
            console.error('[PROXY] No URL parameter provided');
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        let key;
        
        // Handle new format: r2://path/to/file
        if (url.startsWith('r2://')) {
            key = url.substring(5); // Remove 'r2://' prefix
            console.log('[PROXY] New R2 format detected, key:', key);
        }
        // Handle old format: https://pub-xxx.r2.dev/path/to/file (for backward compatibility)
        else if (url.includes('.r2.dev')) {
            const r2Domain = process.env.CLOUDFLARE_R2_PUBLIC_URL;
            console.log('[PROXY] Old R2 public URL format detected');
            
            if (!url.startsWith(r2Domain)) {
                console.error('[PROXY] Invalid file URL - does not match R2 domain');
                return res.status(403).json({ error: 'Invalid file URL' });
            }
            
            const urlObj = new URL(url);
            key = urlObj.pathname.substring(1); // Remove leading slash
        }
        // Handle direct key path
        else {
            key = url;
            console.log('[PROXY] Direct key path provided:', key);
        }

        console.log('[PROXY] Extracted key:', key);
        console.log('[PROXY] Fetching file directly from R2 using API credentials...');

        // Fetch the file directly from R2 using API credentials
        const { getFileFromR2 } = require('../services/cloudflareService');
        const { buffer, contentType } = await getFileFromR2(key);

        console.log('[PROXY] File retrieved successfully:', contentType, buffer.length, 'bytes');
        
        // Set appropriate headers for CORS and caching
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Extract filename from URL
        const filename = key.split('/').pop();
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

        // Send the file buffer
        res.send(buffer);

        console.log('[PROXY] ✅ File served successfully:', filename, contentType, buffer.length, 'bytes');
    } catch (error) {
        console.error('[PROXY] ❌ Error proxying file:', error.message);
        console.error('[PROXY] Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to proxy file',
            message: error.message
        });
    }
};
