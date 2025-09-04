const crypto = require('crypto');
const { encryptData, decryptData } = require('./encryptionService');

// In-memory storage for URL mappings (in production, use a database)
const urlMappings = new Map();
// Track IP addresses for rate limiting
const ipAccessCounts = new Map();

// Configuration
const EPHEMERAL_LINK_EXPIRY_MS = 60 * 1000; 
const RATE_LIMIT_WINDOW_MS = 60 * 1000; 
const RATE_LIMIT_MAX_REQUESTS = 10; 

/**
 * Generate a short, random ID for the masked URL
 * @returns {string} A random ID
 */
function generateShortId() {
  return crypto.randomBytes(6).toString('hex'); // Increased to 6 bytes for more uniqueness
}

/**
 * Create a static QR code URL for a tricycle operator
 * 
 * @param {string} franchiseId - The franchise ID to encode in the URL
 * @returns {string} The static QR code URL
 */
function createStaticQrUrl(franchiseId) {
  if (!franchiseId) {
    throw new Error('franchiseId is required');
  }
  
  return `${process.env.BASE_URL || 'https://trc-v.gov.ph'}/verify?id=${franchiseId}`;
}

/**
 * Create an ephemeral token for temporary access to operator information
 * 
 * @param {Object} operatorData - The operator data to encode in the token
 * @param {string} operatorData.ssn - Social Security Number
 * @param {string} operatorData.franchiseId - Franchise ID
 * @param {string} [operatorData.name] - Operator name (optional)
 * @param {Date} [operatorData.expiryDate] - Franchise expiry date (optional)
 * @returns {Object} Object containing the ephemeral token and expiry time
 */
function createEphemeralToken(operatorData) {
  // Validate required fields
  if (!operatorData.ssn || !operatorData.franchiseId) {
    throw new Error('SSN and franchiseId are required');
  }

  // Create a payload with only necessary data
  const payload = {
    ssn: operatorData.ssn,
    franchiseId: operatorData.franchiseId,
    timestamp: Date.now(),
    expiresAt: Date.now() + EPHEMERAL_LINK_EXPIRY_MS
  };

  if (operatorData.expiryDate) {
    payload.expiryDate = operatorData.expiryDate;
  }

  // Encrypt the payload
  const encryptedData = encryptData(JSON.stringify(payload));
  
  // Generate a short ID
  const token = generateShortId();
  
  // Store the mapping
  urlMappings.set(token, encryptedData);
  
  // Return the ephemeral token information
  return {
    token,
    expiresAt: payload.expiresAt,
    ephemeralUrl: `${process.env.BASE_URL || 'https://trc-v.gov.ph'}/temp/${token}`
  };
}

/**
 * Retrieve operator data from an ephemeral token
 * 
 * @param {string} token - The ephemeral token
 * @param {string} ipAddress - The IP address of the requester (for rate limiting)
 * @returns {Object|null} The original operator data or null if not found/expired
 */
function getOperatorDataFromToken(token, ipAddress) {
  // Check rate limiting first
  if (!checkRateLimit(ipAddress)) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  // Get the encrypted data from storage
  const encryptedData = urlMappings.get(token);
  
  if (!encryptedData) {
    return null;
  }
  
  try {
    // Decrypt the data
    const decryptedData = decryptData(encryptedData);
    const payload = JSON.parse(decryptedData);
    
    // Check if the token has expired
    const currentTime = Date.now();
    
    if (currentTime > payload.expiresAt) {
      // Token has expired, remove it from storage
      urlMappings.delete(token);
      return null;
    }
    
    // Token is valid, but we'll delete it after use (one-time use)
    urlMappings.delete(token);
    
    return payload;
  } catch (error) {
    console.error('Error decrypting token data:', error);
    return null;
  }
}

/**
 * Check if an IP address has exceeded the rate limit
 * 
 * @param {string} ipAddress - The IP address to check
 * @returns {boolean} True if within rate limit, false if exceeded
 */
function checkRateLimit(ipAddress) {
  const currentTime = Date.now();
  
  // Initialize or get the access record for this IP
  if (!ipAccessCounts.has(ipAddress)) {
    ipAccessCounts.set(ipAddress, {
      count: 0,
      windowStart: currentTime
    });
  }
  
  const accessRecord = ipAccessCounts.get(ipAddress);
  
  // Reset counter if the window has expired
  if (currentTime - accessRecord.windowStart > RATE_LIMIT_WINDOW_MS) {
    accessRecord.count = 0;
    accessRecord.windowStart = currentTime;
  }
  
  // Increment the counter
  accessRecord.count++;
  
  // Check if rate limit is exceeded
  return accessRecord.count <= RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Clean up expired tokens and rate limit records
 * This should be called periodically to prevent memory leaks
 */
function cleanupExpiredData() {
  const currentTime = Date.now();
  
  // Clean up expired tokens
  for (const [token, encryptedData] of urlMappings.entries()) {
    try {
      const decryptedData = decryptData(encryptedData);
      const payload = JSON.parse(decryptedData);
      
      if (currentTime > payload.expiresAt) {
        urlMappings.delete(token);
      }
    } catch (error) {
      // If we can't decrypt, the data is corrupted, so remove it
      urlMappings.delete(token);
    }
  }
  
  // Clean up expired rate limit records
  for (const [ip, accessRecord] of ipAccessCounts.entries()) {
    if (currentTime - accessRecord.windowStart > RATE_LIMIT_WINDOW_MS) {
      ipAccessCounts.delete(ip);
    }
  }
}

// Schedule cleanup to run every minute
setInterval(cleanupExpiredData, 60 * 1000);

module.exports = {
  createStaticQrUrl,
  createEphemeralToken,
  getOperatorDataFromToken,
  checkRateLimit
};