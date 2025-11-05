/**
 * QR Code Repository
 * Handles database operations for QR codes
 */

const OperatorInformation = require('../models/operatorInformationModel');
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
  let operator = await OperatorInformation.findOne({ userId: operatorId });
  if (!operator) {
    operator = await OperatorInformation.findById(operatorId);
  }
  
  if (!operator) {
    throw new Error('Operator not found');
  }
  
  // Update QR code fields
  operator.qrCode = qrCodePath;
  if (qrCodeDataURL) {
    operator.qrCodeDataURL = qrCodeDataURL;
  }
  operator.qrCodeGeneratedAt = new Date();
  
  return await operator.save();
};

/**
 * Get operator's QR code information
 * @param {string} operatorId - Operator ID
 * @returns {Promise<Object>} - Operator with QR code info
 */
exports.getOperatorQRCode = async (operatorId) => {
  let operator = await OperatorInformation.findOne({ userId: operatorId })
    .select('driversID firstName lastName franchiseStatus qrCode ');
  
  if (!operator) {
    operator = await OperatorInformation.findById(operatorId)
      .select('driversID firstName lastName franchiseStatus qrCode');
  }
  
  return operator;
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
  let operator = await OperatorInformation.findOne({ userId: operatorId });
  if (!operator) {
    operator = await OperatorInformation.findById(operatorId);
  }
  
  if (!operator) {
    throw new Error('Operator not found');
  }
  
  const oldQRPath = operator.qrCode;
  
  operator.qrCode = null;
  operator.qrCodeDataURL = null;
  operator.qrCodeGeneratedAt = null;
  
  await operator.save();
  
  return { operator, oldQRPath };
};

