const crypto = require('crypto');
const FranchiseApplication = require('../models/franchiseApplicationModel');

/**
 * Generate a unique MTOP number
 * Format: MTOP-YYYY-XXXXX (e.g., MTOP-2025-00001)
 * @returns {Promise<string>} Unique MTOP number
 */
async function generateUniqueMTOPNumber() {
  const currentYear = new Date().getFullYear();
  
  // Find the highest MTOP number for this year
  const latestApplication = await FranchiseApplication
    .findOne({ 
      mtopNumber: { $regex: `^MTOP-${currentYear}-` } 
    })
    .sort({ mtopNumber: -1 })
    .limit(1);

  let sequenceNumber = 1;
  
  if (latestApplication && latestApplication.mtopNumber) {
    // Extract sequence number from format MTOP-YYYY-XXXXX
    const match = latestApplication.mtopNumber.match(/MTOP-\d{4}-(\d+)/);
    if (match) {
      sequenceNumber = parseInt(match[1], 10) + 1;
    }
  }

  // Format with leading zeros (5 digits)
  const paddedSequence = String(sequenceNumber).padStart(5, '0');
  const mtopNumber = `MTOP-${currentYear}-${paddedSequence}`;

  // Verify uniqueness (edge case protection)
  const exists = await FranchiseApplication.findOne({ mtopNumber });
  if (exists) {
    // Recursively try next number if collision occurs
    return generateUniqueMTOPNumber();
  }

  return mtopNumber;
}

/**
 * Hash MTOP number for secure QR code URLs and folder naming
 * Uses SHA-256 with truncation for readability
 * @param {string} mtopNumber - The MTOP number to hash
 * @returns {string} Hashed MTOP (first 16 chars of SHA-256)
 */
function hashMTOPNumber(mtopNumber) {
  if (!mtopNumber) {
    throw new Error('MTOP number is required for hashing');
  }

  // Add secret salt to prevent rainbow table attacks
  const secret = process.env.MTOP_HASH_SECRET || process.env.JWT_SECRET || 'default-secret-change-me';
  const hash = crypto
    .createHmac('sha256', secret)
    .update(mtopNumber)
    .digest('hex');

  // Return first 16 characters for brevity (still 64 bits of entropy)
  return hash.substring(0, 16);
}

/**
 * Verify if a hashed MTOP matches the original
 * @param {string} mtopNumber - Original MTOP number
 * @param {string} hashedMTOP - Hashed MTOP to verify
 * @returns {boolean} True if hash matches
 */
function verifyMTOPHash(mtopNumber, hashedMTOP) {
  try {
    const expectedHash = hashMTOPNumber(mtopNumber);
    return expectedHash === hashedMTOP;
  } catch (error) {
    return false;
  }
}

module.exports = {
  generateUniqueMTOPNumber,
  hashMTOPNumber,
  verifyMTOPHash
};
