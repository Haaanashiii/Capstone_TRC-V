const { uploadToR2 } = require('./cloudflareService');
const path = require('path');
const fs = require('fs').promises;

/**
 * File Upload Service
 * Handles uploading to both local directory (optional) and Cloudflare R2
 * Based on UPLOAD_TO_LOCAL_DIR environment variable
 * Supports TRC-V-DIR structure with baseFolder/subFolder/category
 */

// Only upload to local if explicitly enabled AND running on localhost
const isLocalhost = () => {
  const hostname = process.env.HOSTNAME || process.env.COMPUTERNAME || 'unknown';
  const nodeEnv = process.env.NODE_ENV || 'development';
  return nodeEnv === 'development' || hostname.includes('localhost') || hostname.includes('127.0.0.1');
};

const UPLOAD_TO_LOCAL = process.env.UPLOAD_TO_LOCAL_DIR === 'true' && isLocalhost();
const LOCAL_BASE_PATH = './TRC-V-DIR';

/**
 * Generate secure filename with hash
 * @param {string} originalname - Original filename
 * @returns {string} Secure filename
 */
function generateSecureFilename(originalname) {
  const crypto = require('crypto');
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(4).toString('hex');
  const ext = path.extname(originalname).toLowerCase();
  const baseName = path.basename(originalname, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);
  return `${baseName}-${timestamp}-${randomHash}${ext}`;
}

/**
 * Upload file to local directory with TRC-V-DIR structure
 * @param {Buffer} buffer - File buffer
 * @param {string} originalname - Original filename
 * @param {Object} metadata - { baseFolder, subFolder, applicationId, category }
 * @returns {Promise<string>} Local file path
 */
async function uploadToLocalDir(buffer, originalname, metadata) {
  const { baseFolder, subFolder, applicationId, category } = metadata;
  
  // Structure for franchise applications with applicationId:
  // TRC-V-DIR/franchiseApplications/{userId}/{applicationId}/{category}/
  // Structure for franchise informations:
  // TRC-V-DIR/franchiseInformations/{franchiseNo}/{category}/
  let uploadDir;
  if (baseFolder === 'franchiseApplications' && applicationId) {
    uploadDir = path.join(LOCAL_BASE_PATH, baseFolder, subFolder, applicationId, category);
  } else {
    uploadDir = path.join(LOCAL_BASE_PATH, baseFolder, subFolder, category);
  }
  
  // Lazy directory creation - only create when actually uploading a file
  // This prevents empty directory creation on server start
  await fs.mkdir(uploadDir, { recursive: true });
  
  // Generate secure filename
  const filename = generateSecureFilename(originalname);
  const filePath = path.join(uploadDir, filename);
  
  // Write file to disk
  await fs.writeFile(filePath, buffer);
  
  console.log(`[LOCAL] ✅ Uploaded file to: ${filePath}`);
  return filePath;
}

/**
 * Upload file to configured storage(s)
 * Uploads to Cloudflare R2 (always) and local directory (if enabled)
 * 
 * @param {Buffer} buffer - File buffer
 * @param {string} originalname - Original filename
 * @param {string} mimetype - File MIME type
 * @param {Object} metadata - { baseFolder, subFolder, applicationId, category }
 * @returns {Promise<Object>} Upload result with cloudflare and local paths
 */
async function uploadFile(buffer, originalname, mimetype, metadata) {
  const results = {
    cloudflare: null,
    local: null
  };
  
  // Always upload to Cloudflare R2 (for online access)
  try {
    const cloudflareUrl = await uploadToR2(buffer, originalname, mimetype, metadata);
    results.cloudflare = cloudflareUrl;
    console.log(`[UPLOAD_SERVICE] Cloudflare upload success: ${cloudflareUrl}`);
  } catch (err) {
    console.error(`[UPLOAD_SERVICE] Cloudflare upload failed:`, err);
    throw new Error(`Failed to upload to Cloudflare: ${err.message}`);
  }
  
  // Conditionally upload to local directory (ONLY on localhost for development/testing)
  if (UPLOAD_TO_LOCAL) {
    try {
      const localPath = await uploadToLocalDir(buffer, originalname, metadata);
      results.local = localPath;
      console.log(`[UPLOAD_SERVICE] ✅ Local upload success: ${localPath}`);
    } catch (err) {
      console.error(`[UPLOAD_SERVICE] ❌ Local upload failed:`, err);
      // Don't throw - local upload failure shouldn't block the operation
      // Cloudflare R2 is the primary storage (always works online and offline)
    }
  } else {
    const reason = !isLocalhost() ? '(deployed online)' : '(UPLOAD_TO_LOCAL_DIR not enabled)';
    console.log(`[UPLOAD_SERVICE] Local upload disabled ${reason}`);
  }
  
  return results;
}

/**
 * Move files from franchiseApplications to franchiseInformations
 * Used when SB admin accepts application
 * @param {string} userId - User ID (source folder)
 * @param {string} applicationId - Application ID (source folder)
 * @param {string} franchiseNo - Franchise number (destination folder)
 * @param {number} version - Version number
 * @returns {Promise<void>}
 */
async function moveFilesToInformation(userId, applicationId, franchiseNo, version) {
  if (!UPLOAD_TO_LOCAL) {
    console.log('[MOVE_FILES] Local storage disabled, skipping file move');
    return;
  }

  const sourcePath = path.join(LOCAL_BASE_PATH, 'franchiseApplications', userId, applicationId);
  const destPath = path.join(LOCAL_BASE_PATH, 'franchiseInformations', franchiseNo, `version-${version}`);

  try {
    // Check if source exists
    await fs.access(sourcePath);
    
    // Create destination directory
    await fs.mkdir(destPath, { recursive: true });
    
    // Copy all subdirectories (Documentations, ProfilePictures, QRCode)
    const categories = ['Documentations', 'ProfilePictures', 'QRCode'];
    
    for (const category of categories) {
      const srcDir = path.join(sourcePath, category);
      const destDir = path.join(destPath, category);
      
      try {
        // Check if category exists
        await fs.access(srcDir);
        
        // Create destination category
        await fs.mkdir(destDir, { recursive: true });
        
        // Read files in category
        const files = await fs.readdir(srcDir);
        
        // Copy each file
        for (const file of files) {
          const srcFile = path.join(srcDir, file);
          const destFile = path.join(destDir, file);
          await fs.copyFile(srcFile, destFile);
          console.log(`[MOVE_FILES] Copied: ${srcFile} -> ${destFile}`);
        }
      } catch (err) {
        console.log(`[MOVE_FILES] Category ${category} not found or empty, skipping`);
      }
    }
    
    console.log(`[MOVE_FILES] Successfully moved files from ${sourcePath} to ${destPath}`);
  } catch (err) {
    console.error(`[MOVE_FILES] Error moving files:`, err);
    // Don't throw - local file operations shouldn't block the main flow
  }
}

/**
 * Validate file before upload
 * @param {Object} file - Multer file object
 * @param {number} maxSize - Maximum file size in bytes (default 10MB)
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
function validateFile(file, maxSize = 10 * 1024 * 1024) {
  if (!file || !file.buffer) {
    throw new Error('Invalid file object');
  }
  
  if (file.size > maxSize) {
    throw new Error(`File size exceeds maximum of ${maxSize / 1024 / 1024}MB`);
  }
  
  return true;
}

module.exports = {
  uploadFile,
  validateFile,
  moveFilesToInformation,
  generateSecureFilename,
  UPLOAD_TO_LOCAL
};
