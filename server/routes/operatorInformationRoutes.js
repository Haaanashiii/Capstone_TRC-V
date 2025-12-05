const express = require('express');
const router = express.Router();

/**
 * GET /operators/qr/:operatorId
 * - Find OperatorInformation by operatorId
 * - Access franchiseInformations array (populated field)
 * - Return the franchise with QR code
 * - If qrCode points to GridFS (gridfs://), return proxied URL
 */
router.get('/qr/:operatorId', async (req, res, next) => {
  try {
    const { operatorId } = req.params;
    if (!operatorId) return res.status(400).json({ success: false, message: 'operatorId is required' });

    // Find OperatorInformation by operatorId and populate franchises
    const OperatorInformation = require('../models/operatorInformationModel');
    const operatorInfo = await OperatorInformation.findOne({ operatorId })
      .populate('franchiseInformations')
      .select('franchiseInformations')
      .lean();
    
    if (!operatorInfo) return res.status(404).json({ success: false, message: 'Operator not found' });

    // Get the first franchise (assuming one active franchise per operator)
    if (!operatorInfo.franchiseInformations || operatorInfo.franchiseInformations.length === 0) {
      return res.status(404).json({ success: false, message: 'Franchise information not linked' });
    }

    const franchiseInfo = operatorInfo.franchiseInformations[0];
    if (!franchiseInfo.qrCode) return res.status(404).json({ success: false, message: 'QR code not found' });

    const qr = franchiseInfo.qrCode;

    // Determine if we should return a proxied URL for GridFS files
    const isGridFS = typeof qr === 'string' && qr.startsWith('gridfs://');

    let resolved = qr;
    if (isGridFS) {
      const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      resolved = `${base.replace(/\/+$/,'')}/api/franchise-applications/proxy-file?url=${encodeURIComponent(qr)}`;
    }

    return res.json({ success: true, qrCode: resolved });
  } catch (error) {
    next(error);
  }
}); 

module.exports = router;
