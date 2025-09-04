const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Generates a secure QR code with static URL for verification
 * @param {string} ssn - The SSN (Social Security Number) or unique identifier
 * @param {string} franchiseId - The franchise ID for the application
 * @param {Date} expiryDate - The expiration date of the franchise
 * @returns {Promise<string>} - The QR code data URL
 */
async function generateQRCode(ssn, franchiseId = null, expiryDate = null) {
  if (!franchiseId || franchiseId === 'PENDING') {
    franchiseId = 'PENDING';
  }
  
  // Create a static URL that only contains the franchise ID
  // The actual verification will happen server-side with ephemeral tokens
  const url = `${process.env.BASE_URL || 'https://trc-v.gov.ph'}/verify?id=${franchiseId}`;
  
  // Generate QR code
  return await QRCode.toDataURL(url);
}

/**
 * Creates a digital signature for the payload to prevent tampering
 * @param {Object} payload - The data payload to sign
 * @returns {string} - The digital signature
 */
function createDigitalSignature(payload) {
  // Remove any existing signature from the payload before signing
  const { signature, ...dataToSign } = payload;
  
  // Create string representation of data
  const dataString = JSON.stringify(dataToSign);
  
  // Create HMAC signature using server's secret key
  const hmac = crypto.createHmac('sha256', process.env.QR_SIGNATURE_SECRET || process.env.JWT_SECRET);
  hmac.update(dataString);
  
  return hmac.digest('hex');
}

/**
 * Verifies the authenticity of a QR code payload
 * @param {Object} payload - The payload from the QR code
 * @returns {boolean} - Whether the signature is valid
 */
function verifyQRCodeSignature(payload) {
  if (!payload || !payload.signature) {
    return false;
  }
  
  // Extract signature from payload
  const { signature, ...dataToVerify } = payload;
  
  // Recreate signature and compare
  const expectedSignature = createDigitalSignature(dataToVerify);
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

module.exports = { generateQRCode, verifyQRCodeSignature };
