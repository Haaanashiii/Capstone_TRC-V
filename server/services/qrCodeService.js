const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Ensure QR code directory exists
const qrCodeDir = 'uploads/operators/qrcodes';
if (!fs.existsSync(qrCodeDir)) {
  fs.mkdirSync(qrCodeDir, { recursive: true });
}

/**
 * Generates a secure QR code for franchise verification using hashed MTOP
 * @param {string} hashedMTOP - The hashed MTOP number for secure lookup
 * @param {Object} options - Additional options
 * @param {boolean} options.saveToFile - Whether to save QR to file system
 * @param {string} options.folderPath - Optional custom folder path for saving
 * @returns {Promise<Object>} - Object containing QR code data URL and file path
 */
async function generateFranchiseQRCode(hashedMTOP, options = {}) {
  if (!hashedMTOP) {
    throw new Error('Hashed MTOP is required to generate QR code');
  }

  // Create verification URL with hashed MTOP (not the actual MTOP number for security)
  // Uses BASE_URL from .env (should be your frontend URL, e.g., https://trc-v.gov.ph or http://localhost:5173)
  const baseUrl = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const verificationUrl = `${baseUrl}/operator/id/${hashedMTOP}`;
  
  // Generate QR code options
  const qrOptions = {
    errorCorrectionLevel: 'H', // High error correction
    type: 'image/png',
    quality: 0.92,
    margin: 1,
    color: {
      dark: '#1B4B75',  // TRC-V blue
      light: '#FFFFFF'  // White background
    },
    width: 300
  };

  try {
    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(verificationUrl, qrOptions);
    
    // Convert data URL to buffer for GridFS upload or local save
    const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    let qrCodeFilePath = null;
    
    // Return buffer for GridFS upload (preferred) or save locally (legacy)
    if (options.uploadToStorage) {
      // Caller will handle GridFS upload using the buffer
      qrCodeFilePath = 'pending-storage-upload';
    } else if (options.saveToFile !== false) {
      // Legacy: Save to local filesystem
      const saveDir = options.folderPath || qrCodeDir;
      const filename = `qr-${hashedMTOP}-${Date.now()}.png`;
      const filePath = path.join(saveDir, filename);
      
      // Ensure directory exists
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }
      
      await fs.promises.writeFile(filePath, buffer);
      
      // Return relative path for database storage
      qrCodeFilePath = options.folderPath 
        ? `/${path.relative(process.cwd(), filePath).replace(/\\/g, '/')}`
        : `/uploads/operators/qrcodes/${filename}`;
    }
    
    return {
      dataURL: qrCodeDataURL,
      buffer: buffer, // Return buffer for R2 upload
      filePath: qrCodeFilePath,
      verificationUrl: verificationUrl,
      hashedMTOP: hashedMTOP
    };
  } catch (error) {
    console.error('QR Code generation error:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Legacy: Generates a secure QR code for operator verification (backward compatibility)
 * @param {string} operatorId - The operator's MongoDB _id
 * @param {Object} options - Additional options (save to file, etc.)
 * @returns {Promise<Object>} - Object containing QR code data URL and file path
 */
async function generateOperatorQRCode(operatorId, options = {}) {
  if (!operatorId) {
    throw new Error('Operator ID is required to generate QR code');
  }

  // Create verification URL with operator ID
  const baseUrl = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const verificationUrl = `${baseUrl}/operators/qr/${operatorId}`;
  
  // Generate QR code options
  const qrOptions = {
    errorCorrectionLevel: 'H', // High error correction
    type: 'image/png',
    quality: 0.92,
    margin: 1,
    color: {
      dark: '#1B4B75',  // TRC-V blue
      light: '#FFFFFF'  // White background
    },
    width: 300
  };

  try {
    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(verificationUrl, qrOptions);
    
    let qrCodeFilePath = null;
    
    // Save to file if requested
    if (options.saveToFile !== false) {
      const filename = `qr-${operatorId}-${Date.now()}.png`;
      const filePath = path.join(qrCodeDir, filename);
      
      // Convert data URL to buffer and save
      const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      await fs.promises.writeFile(filePath, buffer);
      
      // Return relative path for database storage
      qrCodeFilePath = `/uploads/operators/qrcodes/${filename}`;
    }
    
    return {
      dataURL: qrCodeDataURL,
      filePath: qrCodeFilePath,
      verificationUrl: verificationUrl,
      operatorId: operatorId
    };
  } catch (error) {
    console.error('QR Code generation error:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generates a secure QR code with static URL for verification (legacy support)
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
  const baseUrl = (process.env.BASE_URL || 'https://trc-v.gov.ph').replace(/\/+$/, '');
  const url = `${baseUrl}/verify?id=${encodeURIComponent(franchiseId)}`;
  
  // Generate QR code
  return await QRCode.toDataURL(url);
}

/**
 * Delete QR code file from storage
 * @param {string} filePath - The file path to delete
 * @returns {Promise<boolean>} - Success status
 */
async function deleteQRCode(filePath) {
  if (!filePath) return false;
  
  try {
    // Convert relative path to absolute
    const absolutePath = path.join(process.cwd(), filePath);
    
    if (fs.existsSync(absolutePath)) {
      await fs.promises.unlink(absolutePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('QR Code deletion error:', error);
    return false;
  }
}

/**
 * Creates a digital signature for the payload to prevent tampering
 * @param {Object} payload - The data payload to sign
 * @returns {string} - The digital signature
 */
function createDigitalSignature(payload) {
  // Remove any existing signature from the payload before signing
  const { signature, ...dataToSign } = payload;
  
  // Create string representation of data (canonicalized key order)
  const dataString = JSON.stringify(dataToSign, Object.keys(dataToSign).sort());
  
  // Create HMAC signature using server's secret key
  const secret = process.env.QR_SIGNATURE_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('QR signature secret is not configured');
  }
  const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'utf8'));
  
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
  
  // Validate hex and compare in constant time without throwing on length mismatch
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expectedSignature, 'hex');
  return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

}

module.exports = { 
  generateQRCode, 
  generateOperatorQRCode,
  generateFranchiseQRCode,
  deleteQRCode,
  verifyQRCodeSignature 
};

