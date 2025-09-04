const crypto = require('crypto');

/**
 * Service for encrypting and decrypting sensitive data
 * Uses AES-256-GCM encryption for strong security with authentication
 */
class EncryptionService {
  constructor() {
    // Use environment variables for encryption keys or generate secure defaults
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateSecureKey();
    this.algorithm = 'aes-256-gcm';
  }

  /**
   * Generate a secure encryption key if none is provided
   * @returns {Buffer} - A secure random key
   */
  generateSecureKey() {
    // Generate a secure random key and store it (in production, this should be in environment variables)
    const key = crypto.randomBytes(32); // 256 bits
    console.warn('WARNING: Using auto-generated encryption key. Set ENCRYPTION_KEY in environment for production.');
    return key;
  }

  /**
   * Encrypt sensitive data
   * @param {string} text - Plain text to encrypt
   * @returns {string} - Encrypted data in format: iv:authTag:encryptedData (base64)
   */
  encrypt(text) {
    if (!text) return text;
    
    try {
      // Generate a random initialization vector for each encryption
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      // Encrypt the data
      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Get the authentication tag
      const authTag = cipher.getAuthTag().toString('base64');
      
      // Return IV, auth tag and encrypted data as a single string
      return `${iv.toString('base64')}:${authTag}:${encrypted}`;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt encrypted data
   * @param {string} encryptedText - Encrypted text in format: iv:authTag:encryptedData
   * @returns {string} - Decrypted plain text
   */
  decrypt(encryptedText) {
    if (!encryptedText) return encryptedText;
    
    try {
      // Split the encrypted text into components
      const [ivBase64, authTagBase64, encryptedData] = encryptedText.split(':');
      
      if (!ivBase64 || !authTagBase64 || !encryptedData) {
        throw new Error('Invalid encrypted data format');
      }
      
      // Convert from base64
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt the data
      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash sensitive data for storage (one-way, cannot be decrypted)
   * @param {string} text - Text to hash
   * @returns {string} - Hashed data
   */
  hash(text) {
    if (!text) return text;
    
    try {
      // Use a secure hashing algorithm with a salt
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(text, salt, 10000, 64, 'sha512').toString('hex');
      
      return `${salt}:${hash}`;
    } catch (error) {
      console.error('Hashing error:', error);
      throw new Error('Failed to hash data');
    }
  }

  /**
   * Verify if plain text matches a stored hash
   * @param {string} text - Plain text to verify
   * @param {string} hashedText - Previously hashed text
   * @returns {boolean} - Whether the text matches the hash
   */
  verifyHash(text, hashedText) {
    if (!text || !hashedText) return false;
    
    try {
      // Split the hashed text into salt and hash
      const [salt, originalHash] = hashedText.split(':');
      
      if (!salt || !originalHash) {
        return false;
      }
      
      // Hash the plain text with the same salt
      const hash = crypto.pbkdf2Sync(text, salt, 10000, 64, 'sha512').toString('hex');
      
      // Compare the hashes using a constant-time comparison
      return crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(originalHash, 'hex')
      );
    } catch (error) {
      console.error('Hash verification error:', error);
      return false;
    }
  }
}

module.exports = new EncryptionService();