const crypto = require('crypto');
const QRCode = require('qrcode');
const FranchiseInformation = require('../models/franchiseInformationModel');

// Generate SHA-256 hashed franchise number (first 16 chars)
function generateHashedFranchiseNo(franchiseNo) {
  const hash = crypto.createHash('sha256').update(franchiseNo).digest('hex');
  return hash.substring(0, 16);
}

// Generate QR code buffer for franchise verification
// Encodes a hashed franchise number (static)
// The hash stays the same regardless of owner changes
async function generateQRCodeBuffer(hashedFranchiseNo) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
  // QR code encodes hashed franchise number (e.g., "a1b2c3d4e5f6g7h8")
  // Scanner will use /api/qr/scan/{hashedFranchiseNo} endpoint
  // Backend will unhash and find current owner
  const verifyUrl = `${baseUrl}/verify/franchise/${hashedFranchiseNo}`;
  return await QRCode.toBuffer(verifyUrl, { type: 'image/png', width: 400 });
}

// Handle franchise version control - mark previous as non-current, calculate next version
// Now supports MongoDB transactions for atomicity
async function handleVersionControl(franchiseNo, changeType, session = null) {
  const currentFranchise = await FranchiseInformation.findOne({
    franchiseNumber: franchiseNo,
    isCurrentVersion: true
  }).session(session);

  if (changeType === 'new') {
    return { version: 1, previousVersion: null };
  }

  if (!currentFranchise) {
    throw new Error(`No current franchise found for: ${franchiseNo}`);
  }

  // Mark previous version as non-current
  await FranchiseInformation.findByIdAndUpdate(
    currentFranchise._id, 
    { isCurrentVersion: false },
    { session }
  );

  return {
    version: (currentFranchise.version || 1) + 1,
    previousVersion: currentFranchise._id
  };
}

// Validate franchise status for renewal/amendment operations
function validateFranchiseStatus(franchise, applicationType) {
  if (!franchise) return false;

  // Renewal: Allow only Active or Expired franchises
  if (applicationType === 'renewal') {
    return ['Active', 'Expired'].includes(franchise.franchiseStatus);
  }

  // Amendment (change_unit/update_ownership): Allow only Active franchises
  if (['change_unit', 'update_ownership'].includes(applicationType)) {
    return franchise.franchiseStatus === 'Active';
  }

  return false;
}

module.exports = {
  generateHashedFranchiseNo,
  generateQRCodeBuffer,
  handleVersionControl,
  validateFranchiseStatus
};
