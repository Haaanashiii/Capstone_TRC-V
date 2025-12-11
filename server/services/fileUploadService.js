const storage = require('./storageAdapter');
const path = require('path');
const fs = require('fs').promises;

const isLocalhost = () => {
  const hostname = process.env.HOSTNAME || process.env.COMPUTERNAME || 'unknown';
  const nodeEnv = process.env.NODE_ENV || 'development';
  return nodeEnv === 'development' || hostname.includes('localhost') || hostname.includes('127.0.0.1');
};

const UPLOAD_TO_LOCAL = process.env.UPLOAD_TO_LOCAL_DIR === 'true' && isLocalhost();
const LOCAL_BASE_PATH = './TRC-V-DIR';

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

async function uploadToLocalDir(buffer, originalname, metadata) {
  const { baseFolder, subFolder, applicationId, category } = metadata;
  
  let uploadDir;
  if (baseFolder === 'franchiseApplications' && applicationId) {
    uploadDir = path.join(LOCAL_BASE_PATH, baseFolder, subFolder, applicationId, category);
  } else {
    uploadDir = path.join(LOCAL_BASE_PATH, baseFolder, subFolder, category);
  }
  
  await fs.mkdir(uploadDir, { recursive: true });
  
  const filename = generateSecureFilename(originalname);
  const filePath = path.join(uploadDir, filename);
  
  await fs.writeFile(filePath, buffer);
  
  console.log(`[Upload] File saved locally`);
  return filePath;
}

async function uploadFile(buffer, originalname, mimetype, metadata) {
  const results = {
    url: null,
    local: null
  };
  
  try {
    const storageResult = await storage.uploadFile(buffer, originalname, mimetype, metadata);
    // storageResult can be either a string (legacy) or an object { url, id, filename, filePath }
    results.url = typeof storageResult === 'string' ? storageResult : storageResult.url;
    console.log(`[Upload] GridFS OK:`, results.url);
  } catch (err) {
    console.error(`[Upload] Storage error:`, err.message);
    throw new Error(`Failed to upload to storage: ${err.message}`);
  }
  
  if (UPLOAD_TO_LOCAL) {
    try {
      const localPath = await uploadToLocalDir(buffer, originalname, metadata);
      results.local = localPath;
      console.log(`[Upload] Local OK`);
    } catch (err) {
      console.error(`[Upload] Local error:`, err.message);
    }
  }
  
  return results;
}

async function moveFilesToInformation(userId, applicationId, franchiseNo, franchiseChainId, version) {
  return await storage.moveFranchiseFiles(userId, applicationId, franchiseNo, franchiseChainId, version);
}

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
