const express = require('express');
const router = express.Router();

const User = require('../models/userAccountModel');
const FranchiseApplication = require('../models/franchiseApplicationModel');

/**
 * GET /operators/qr/:operatorId
 * - Find user by `operatorId` (field on User document)
 * - Load the franchise application using FranchiseApplication.findById(user.franchiseInfo)
 * - Return { success: true, qrCode: <resolved> }
 * - If qrCode points to R2 (r2:// or public R2 URL), return proxied URL
 */
router.get('/qr/:operatorId', async (req, res, next) => {
  try {
    const { operatorId } = req.params;
    if (!operatorId) return res.status(400).json({ success: false, message: 'operatorId is required' });

    const user = await User.findOne({ operatorId }).select('franchiseInfo').lean();
    if (!user) return res.status(404).json({ success: false, message: 'Operator not found' });

    const franchiseAppId = user.franchiseInfo;
    if (!franchiseAppId) return res.status(404).json({ success: false, message: 'Franchise application not linked' });

    const application = await FranchiseApplication.findById(franchiseAppId).select('qrCode').lean();
    if (!application || !application.qrCode) return res.status(404).json({ success: false, message: 'QR code not found' });

    const qr = application.qrCode;

    // Determine if we should return a proxied URL
    const isR2Scheme = typeof qr === 'string' && qr.startsWith('r2://');
    const isR2Public = typeof qr === 'string' && (
      qr.includes('.r2.dev') ||
      (process.env.CLOUDFLARE_R2_PUBLIC_URL && qr.startsWith(process.env.CLOUDFLARE_R2_PUBLIC_URL))
    );

    let resolved = qr;
    if (isR2Scheme || isR2Public) {
      const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      resolved = `${base.replace(/\/+$/,'')}/api/franchise-applications/proxy-file?url=${encodeURIComponent(qr)}`;
    }

    return res.json({ success: true, qrCode: resolved });
  } catch (error) {
    next(error);
  }
}); 

module.exports = router;
