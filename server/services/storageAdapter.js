const gridfsService = require('./gridfsService');

let initialized = false;

function init() {
  if (initialized) return;
  
  if (gridfsService.initGridFS) {
    gridfsService.initGridFS();
  }
  initialized = true;
}

/**
 * Convert a GridFS URL (gridfs://xxxxx) to an HTTP URL (/api/files/xxxxx)
 * This allows the frontend to fetch files via HTTP instead of trying to load gridfs:// directly
 * @param {string} url - The GridFS URL or any other URL
 * @returns {string} - HTTP URL for GridFS files, or original URL otherwise
 */
function toHttpUrl(url) {
  if (!url) return url;
  if (typeof url !== 'string') return url;
  
  if (url.startsWith('gridfs://')) {
    const fileId = url.substring(9); // Remove 'gridfs://'
    return `/api/files/${fileId}`;
  }
  
  return url;
}

const mongoose = require('mongoose');

/**
 * Convert all GridFS URLs in a document object to HTTP URLs
 * Also ensures MongoDB ObjectIds are converted to strings for frontend compatibility
 * Useful for transforming database records before sending to frontend
 * @param {Object} obj - Object potentially containing gridfs:// URLs
 * @returns {Object} - Same object with gridfs URLs converted to HTTP URLs
 */
function convertGridFSUrls(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  // Handle MongoDB ObjectId - convert to string
  if (obj._bsontype === 'ObjectID' || obj._bsontype === 'ObjectId') {
    return obj.toString();
  }
  
  // Handle Buffer objects (MongoDB Binary) - convert to hex string
  if (Buffer.isBuffer(obj)) {
    return obj.toString('hex');
  }
  
  // Handle objects with a buffer property (serialized Binary/ObjectId)
  if (obj.buffer && typeof obj.buffer === 'object' && !Array.isArray(obj.buffer)) {
    const bytes = Object.values(obj.buffer);
    if (bytes.every(b => typeof b === 'number' && b >= 0 && b <= 255)) {
      return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  }
  
  // Handle mongoose ObjectId
  if (mongoose.Types.ObjectId.isValid(obj) && obj.toString && typeof obj.toString === 'function') {
    const str = obj.toString();
    // Only convert if it looks like a valid ObjectId hex string
    if (/^[a-f0-9]{24}$/i.test(str)) {
      return str;
    }
  }
  
  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in result) {
    const value = result[key];
    
    if (typeof value === 'string' && value.startsWith('gridfs://')) {
      result[key] = toHttpUrl(value);
    } else if (value && typeof value === 'object') {
      // Special handling for _id and other ObjectId fields
      if (key === '_id' || key === 'operatorInfo' || key.endsWith('Id')) {
        if (value._bsontype || value.buffer || (value.id && Buffer.isBuffer(value.id))) {
          result[key] = convertGridFSUrls(value);
        } else if (mongoose.Types.ObjectId.isValid(value)) {
          result[key] = value.toString();
        } else {
          result[key] = convertGridFSUrls(value);
        }
      } else if (value instanceof Date) {
        // Keep dates as-is
        result[key] = value;
      } else {
        result[key] = convertGridFSUrls(value);
      }
    }
  }
  
  return result;
}

/**
 * Document type labels for user-friendly display names
 */
const DOCUMENT_TYPE_LABELS = {
  'motor-registration': 'Motor Registration',
  'barangay-clearance': 'Barangay Clearance',
  'cedula': 'Cedula',
  'drivers-license': "Driver's License",
  'voters-affidavit': "Voter's Affidavit",
  'chassis-stencil': 'Chassis Stencil',
  'driver-photo': 'Driver Picture',
  'operator-photo': 'Operator Picture',
  'or-lto': 'OR LTO',
  'cr-lto': 'CR LTO',
  'or-treasurer': 'OR Treasurer Office',
  'qr-code': 'QR Code',
  'resolution': 'SB Resolution'
};

/**
 * Generate a sanitized, user-friendly document display name
 * Format: "Document Type - Operator Name - Date"
 * @param {string} documentType - The document type key (e.g., 'motor-registration')
 * @param {string} operatorName - Name of the operator
 * @param {Date|string} uploadDate - Date when the document was uploaded
 * @returns {string} Formatted display name
 */
function generateDocumentDisplayName(documentType, operatorName, uploadDate) {
  const typeLabel = DOCUMENT_TYPE_LABELS[documentType] || documentType || 'Document';
  const sanitizedName = (operatorName || 'Unknown')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .substring(0, 30);
  const dateStr = uploadDate 
    ? new Date(uploadDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
    : '';
  
  return dateStr 
    ? `${typeLabel} - ${sanitizedName} - ${dateStr}`
    : `${typeLabel} - ${sanitizedName}`;
}

/**
 * Convert documents object with gridfs:// URLs to enriched objects with metadata
 * This fetches metadata from GridFS to provide proper display names
 * OPTIMIZED: Uses batch metadata fetching for better performance
 * @param {Object} documents - Documents object with field names pointing to gridfs:// URLs
 * @param {Object} applicationData - Application data containing operator info for naming
 * @returns {Object} Enhanced documents object with {url, displayName, type, uploadedAt}
 */
async function enrichDocumentsWithMetadata(documents, applicationData = {}) {
  if (!documents || typeof documents !== 'object') return documents;
  
  const operatorName = applicationData.operatorName || 'Unknown';
  const submittedAt = applicationData.submittedAt || new Date();
  
  const enrichedDocs = {};
  
  // Map of field names to document types
  const fieldToDocType = {
    'motorRegistrationObj': 'motor-registration',
    'barangayClearanceObj': 'barangay-clearance',
    'cedulaObj': 'cedula',
    'driversLicenseObj': 'drivers-license',
    'votersAffidavitObj': 'voters-affidavit',
    'motorChassisStencilObj': 'chassis-stencil',
    'driverPictureObj': 'driver-photo',
    'operatorPictureObj': 'operator-photo',
    'oRLTOObj': 'or-lto',
    'cRLTOObj': 'cr-lto',
    'oRTreasurerOfficeObj': 'or-treasurer',
    'qrCodeObj': 'qr-code',
    'resolutionDocumentObj': 'resolution'
  };
  
  // First pass: collect all gridfs URLs for batch fetching
  const gridfsUrls = [];
  const urlToFieldMap = new Map();
  
  for (const [fieldName, value] of Object.entries(documents)) {
    if (value && typeof value === 'string' && value.startsWith('gridfs://')) {
      gridfsUrls.push(value);
      urlToFieldMap.set(value, fieldName);
    }
  }
  
  // Batch fetch metadata for all URLs at once
  let metadataArray = [];
  if (gridfsUrls.length > 0) {
    try {
      metadataArray = await gridfsService.batchGetFileMetadata(gridfsUrls);
    } catch (err) {
      console.error('[StorageAdapter] Batch metadata fetch error:', err);
    }
  }
  
  // Create metadata map for quick lookup
  const metadataMap = new Map();
  metadataArray.forEach((metadata, index) => {
    if (metadata) {
      metadataMap.set(gridfsUrls[index], metadata);
    }
  });
  
  // Second pass: enrich documents with metadata
  for (const [fieldName, value] of Object.entries(documents)) {
    if (!value) {
      enrichedDocs[fieldName] = null;
      continue;
    }
    
    if (typeof value === 'string' && value.startsWith('gridfs://')) {
      const fileId = value.substring(9);
      const docType = fieldToDocType[fieldName] || fieldName.replace(/Obj$/, '').toLowerCase();
      
      // Get metadata from batch results
      const metadata = metadataMap.get(value);
      
      const uploadDate = metadata?.uploadedAt || submittedAt;
      const mimeType = metadata?.mimetype || 'application/octet-stream';
      
      enrichedDocs[fieldName] = {
        url: `/api/files/${fileId}`,
        displayName: generateDocumentDisplayName(docType, operatorName, uploadDate),
        type: mimeType,
        documentType: docType,
        uploadedAt: uploadDate,
        fileSize: metadata?.fileSize || null
      };
    } else if (typeof value === 'object') {
      // Already an object, just convert URL if needed
      enrichedDocs[fieldName] = {
        ...value,
        url: value.url?.startsWith('gridfs://') ? toHttpUrl(value.url) : value.url
      };
    } else {
      enrichedDocs[fieldName] = value;
    }
  }
  
  return enrichedDocs;
}

async function uploadFile(buffer, originalName, mimetype, options) {
  return gridfsService.uploadToGridFS(buffer, originalName, mimetype, options);
}

async function getFile(fileUrl) {
  if (fileUrl.startsWith('gridfs://')) {
    return gridfsService.getFileFromGridFS(fileUrl);
  }
  
  // Fallback for any legacy URLs
  return gridfsService.getFileFromGridFS(fileUrl);
}

async function deleteFile(fileUrl) {
  if (fileUrl.startsWith('gridfs://')) {
    return gridfsService.deleteFromGridFS(fileUrl);
  }
  return gridfsService.deleteFromGridFS(fileUrl);
}

async function moveFranchiseFiles(userId, applicationId, franchiseNo, franchiseChainId, version) {
  return gridfsService.moveFranchiseFiles(userId, applicationId, franchiseNo, franchiseChainId, version);
}

async function uploadQRCode(qrBuffer, hashedMTOP) {
  return gridfsService.uploadQRToGridFS(qrBuffer, hashedMTOP);
}

async function uploadFileToStorage(file, folder) {
  return gridfsService.uploadFileToGridFS(file, folder);
}

async function deleteFileFromStorage(filePath) {
  return gridfsService.deleteFileFromGridFS(filePath);
}

module.exports = {
  init,
  uploadFile,
  getFile,
  deleteFile,
  moveFranchiseFiles,
  uploadQRCode,
  uploadFileToStorage,
  deleteFileFromStorage,
  toHttpUrl,
  convertGridFSUrls,
  enrichDocumentsWithMetadata,
  generateDocumentDisplayName,
  DOCUMENT_TYPE_LABELS,
  storageType: 'gridfs',
  
  compressImage: () => gridfsService.compressImage,
  compressPDF: () => gridfsService.compressPDF
};
