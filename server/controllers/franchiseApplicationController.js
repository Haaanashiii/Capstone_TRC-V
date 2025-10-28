const franchiseApplicationRepository = require('../repositories/applicationRepository');
const { generateOperatorQRCode } = require('../services/qrCodeService');

exports.createFranchiseApplication = async (req, res, next) => {
  try {
    const application = await franchiseApplicationRepository.createFranchiseApplication(req.body);
    res.status(201).json(application);
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
        const payload = pick(req.body, process.env.ALLOWED_UPDATE_FIELDS);
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
        
        // Update the application
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
