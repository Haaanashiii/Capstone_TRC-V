const { uploadToR2 } = require('./cloudflareService');
const path = require('path');
const fs = require('fs').promises;

// Upload files to cloud storage (Cloudflare R2) and optionally to local disk

// Only save files locally in development mode
const isLocalhost = () => {
  const hostname = process.env.HOSTNAME || process.env.COMPUTERNAME || 'unknown';
  const nodeEnv = process.env.NODE_ENV || 'development';
  return nodeEnv === 'development' || hostname.includes('localhost') || hostname.includes('127.0.0.1');
};

const UPLOAD_TO_LOCAL = process.env.UPLOAD_TO_LOCAL_DIR === 'true' && isLocalhost();
const LOCAL_BASE_PATH = './TRC-V-DIR';

// Create a safe filename with timestamp and random hash
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

// Save file to local computer disk
async function uploadToLocalDir(buffer, originalname, metadata) {
  const { baseFolder, subFolder, applicationId, category } = metadata;
  
  // Create folder structure
  let uploadDir;
  if (baseFolder === 'franchiseApplications' && applicationId) {
    uploadDir = path.join(LOCAL_BASE_PATH, baseFolder, subFolder, applicationId, category);
  } else {
    uploadDir = path.join(LOCAL_BASE_PATH, baseFolder, subFolder, category);
  }
  
  // Create folders if they don't exist
  await fs.mkdir(uploadDir, { recursive: true });
  
  // Create safe filename
  const filename = generateSecureFilename(originalname);
  const filePath = path.join(uploadDir, filename);
  
  // Write file to disk
  await fs.writeFile(filePath, buffer);
  
  console.log(`[Upload] ✅ File uploaded locally`);
  return filePath;
}

// Upload file to cloud and optionally to local disk
async function uploadFile(buffer, originalname, mimetype, metadata) {
  const results = {
    cloudflare: null,
    local: null
  };
  
  // Upload to cloud storage (always)
  try {
    const cloudflareUrl = await uploadToR2(buffer, originalname, mimetype, metadata);
    results.cloudflare = cloudflareUrl;
    console.log(`[Upload] Cloud OK`);
  } catch (err) {
    console.error(`[Upload] Cloud error:`, err.message);
    throw new Error(`Failed to upload to cloud: ${err.message}`);
  }
  
  // Conditionally upload to local directory (ONLY on localhost for development/testing)
  if (UPLOAD_TO_LOCAL) {
    try {
      const localPath = await uploadToLocalDir(buffer, originalname, metadata);
      results.local = localPath;
      console.log(`[Upload] Local OK`);
    } catch (err) {
      console.error(`[Upload] Local error:`, err.message);
      // Don't throw - local upload failure shouldn't block the operation
      // Cloudflare R2 is the primary storage (always works online and offline)
    }
  } else {
    const reason = !isLocalhost() ? '(deployed online)' : '(UPLOAD_TO_LOCAL_DIR not enabled)';
    console.log(`[Upload] Local disabled - ${reason}`);
  }
  
  return results;
}

/**
 * Move files from franchiseApplications to franchiseInformations
 * Used when SB admin accepts application
 * @param {string} userId - User ID (source folder)
 * @param {string} applicationId - Application ID (source folder)
 * @param {string} franchiseNo - Franchise number (destination folder level 1)
 * @param {string} franchiseChainId - Franchise chain ID (destination folder level 2)
 * @param {number} version - Version number
 * @returns {Promise<void>}
 */
async function moveFilesToInformation(userId, applicationId, franchiseNo, franchiseChainId, version) {
  if (!UPLOAD_TO_LOCAL) {
    console.log('[Move] Local storage disabled, skipping');
    return;
  }

  const sourcePath = path.join(LOCAL_BASE_PATH, 'franchiseApplications', userId, applicationId);
  const destPath = path.join(LOCAL_BASE_PATH, 'franchiseInformations', franchiseNo, franchiseChainId, `version-${version}`);

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
          console.log(`[Move] Copied`);
        }
      } catch (err) {
        console.log(`[MOVE_FILES] Category ${category} not found or empty, skipping`);
      }
    }
    
    console.log(`[Move] Successfully moved files`);
  } catch (err) {
    console.error(`[Move] Error:`, err.message);
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
