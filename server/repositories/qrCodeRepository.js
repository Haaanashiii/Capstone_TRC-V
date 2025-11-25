/**
 * QR Code Repository
 * Handles database operations for QR codes
 */

const FranchiseInformation = require('../models/franchiseInformationModel');
const FranchiseApplication = require('../models/franchiseApplicationModel');

/**
 * Store QR code information in operator record
 * @param {string} operatorId - Operator ID (userId or _id)
 * @param {string} qrCodePath - File path to QR code image
 * @param {string} qrCodeDataURL - Base64 data URL (optional)
 * @returns {Promise<Object>} - Updated operator
 */
exports.storeOperatorQRCode = async (operatorId, qrCodePath, qrCodeDataURL = null) => {
  // Try to find by userId first, then by _id
  let franchise = await FranchiseInformation.findOne({ userId: operatorId });
  if (!franchise) {
    franchise = await FranchiseInformation.findById(operatorId);
  }
  
  if (!franchise) {
    throw new Error('Franchise not found');
  }
  
  // Update QR code fields
  franchise.qrCode = qrCodePath;
  if (qrCodeDataURL) {
    franchise.qrCodeDataURL = qrCodeDataURL;
  }
  franchise.qrCodeGeneratedAt = new Date();
  
  return await franchise.save();
};

/**
 * Get operator's QR code information
 * @param {string} operatorId - Operator ID
 * @returns {Promise<Object>} - Operator with QR code info
 */
exports.getOperatorQRCode = async (operatorId) => {
  let franchise = await FranchiseInformation.findOne({ userId: operatorId })
    .select('operatorName franchiseStatus qrCode ');
  
  if (!franchise) {
    franchise = await FranchiseInformation.findById(operatorId)
      .select('operatorName franchiseStatus qrCode');
  }
  
  return franchise;
};

/**
 * Store QR code in franchise application
 * @param {string} applicationId - Application ID
 * @param {string} qrCodePath - File path to QR code
 * @returns {Promise<Object>} - Updated application
 */
exports.storeFranchiseQRCode = async (applicationId, qrCodePath) => {
  const application = await FranchiseApplication.findById(applicationId);
  
  if (!application) {
    throw new Error('Franchise application not found');
  }
  
  application.qrCode = qrCodePath;
  application.qrCodeGeneratedAt = new Date();
  
  return await application.save();
};

/**
 * Get franchise application QR code
 * @param {string} applicationId - Application ID
 * @returns {Promise<Object>} - Application with QR code
 */
exports.getFranchiseQRCode = async (applicationId) => {
  return await FranchiseApplication.findById(applicationId)
    .select('franchiseNumber name qrCode qrCodeGeneratedAt');
};

/**
 * Delete QR code reference from database
 * @param {string} operatorId - Operator ID
 * @returns {Promise<Object>} - Updated operator
 */
exports.deleteOperatorQRCode = async (operatorId) => {
  let franchise = await FranchiseInformation.findOne({ userId: operatorId });
  if (!franchise) {
    franchise = await FranchiseInformation.findById(operatorId);
  }
  
  if (!franchise) {
    throw new Error('Franchise not found');
  }
  
  const oldQRPath = franchise.qrCode;
  
  franchise.qrCode = null;
  franchise.qrCodeDataURL = null;
  franchise.qrCodeGeneratedAt = null;
  
  await franchise.save();
  
  return { franchise, oldQRPath };
};

