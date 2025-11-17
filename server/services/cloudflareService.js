const { S3Client, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const crypto = require('crypto');
const path = require('path');

/**
 * Cloudflare R2 Service for file compression and storage
 * Compresses images and PDFs to under 300KB while maintaining quality
 */

// Lazy-initialize R2 client to ensure env vars are loaded
let r2Client = null;

function getR2Client() {
  if (!r2Client) {
    // Validate credentials
    if (!process.env.CLOUDFLARE_R2_ENDPOINT || 
        !process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || 
        !process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
        !process.env.CLOUDFLARE_R2_BUCKET_NAME) {
      throw new Error('Missing required Cloudflare R2 environment variables. Check your .env file.');
    }

    console.log('[CLOUDFLARE] Initializing R2 client...');
    console.log('[CLOUDFLARE] Endpoint:', process.env.CLOUDFLARE_R2_ENDPOINT);
    console.log('[CLOUDFLARE] Bucket:', process.env.CLOUDFLARE_R2_BUCKET_NAME);
    console.log('[CLOUDFLARE] Access Key:', process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.substring(0, 8) + '...');
    
    // Initialize Cloudflare R2 client (S3-compatible)
    // For R2, use 'auto' region and the account endpoint
    r2Client = new S3Client({
      region: 'auto',
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
      // Force path-style for R2 (bucket in path, not subdomain)
      forcePathStyle: false,
    });
  }
  return r2Client;
}

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL; // Your R2 public URL or custom domain
const MAX_FILE_SIZE = 300 * 1024; // 300KB

/**
 * Compress image to target size while maintaining quality
 * @param {Buffer} buffer - Original image buffer
 * @param {string} mimetype - Image MIME type
 * @returns {Promise<Buffer>} Compressed image buffer
 */
async function compressImage(buffer, mimetype) {
  let quality = 90;
  let compressed = buffer;
  let attempts = 0;
  const maxAttempts = 10;

  // Determine format
  const format = mimetype === 'image/png' ? 'png' : 'jpeg';

  while (attempts < maxAttempts) {
    const sharpInstance = sharp(buffer);

    if (format === 'jpeg') {
      compressed = await sharpInstance
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
    } else {
      compressed = await sharpInstance
        .png({ quality, compressionLevel: 9 })
        .toBuffer();
    }

    // If size is acceptable, return
    if (compressed.length <= MAX_FILE_SIZE) {
      console.log(`Image compressed to ${(compressed.length / 1024).toFixed(2)}KB at quality ${quality}`);
      return compressed;
    }

    // Reduce quality for next attempt
    quality -= 10;
    attempts++;

    // If quality gets too low, resize the image
    if (quality < 40) {
      const metadata = await sharp(buffer).metadata();
      const scale = Math.sqrt(MAX_FILE_SIZE / compressed.length);
      const newWidth = Math.floor(metadata.width * scale * 0.9);

      compressed = await sharp(buffer)
        .resize(newWidth, null, { fit: 'inside' })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();

      if (compressed.length <= MAX_FILE_SIZE) {
        console.log(`Image resized and compressed to ${(compressed.length / 1024).toFixed(2)}KB`);
        return compressed;
      }
    }
  }

  throw new Error(`Unable to compress image to under ${MAX_FILE_SIZE / 1024}KB`);
}

/**
 * Compress PDF to target size
 * @param {Buffer} buffer - Original PDF buffer
 * @returns {Promise<Buffer>} Compressed PDF buffer
 */
async function compressPDF(buffer) {
  try {
    // If PDF is already under 300KB, return as-is
    if (buffer.length <= MAX_FILE_SIZE) {
      console.log(`PDF already under ${MAX_FILE_SIZE / 1024}KB`);
      return buffer;
    }

    // Load the PDF
    const pdfDoc = await PDFDocument.load(buffer);
    
    // Save with compression options
    const compressedPDF = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 50,
    });

    const compressedBuffer = Buffer.from(compressedPDF);
    
    if (compressedBuffer.length <= MAX_FILE_SIZE) {
      console.log(`PDF compressed to ${(compressedBuffer.length / 1024).toFixed(2)}KB`);
      return compressedBuffer;
    }

    // If still too large, extract and compress images within PDF
    // This is a basic implementation - for better compression, consider external tools
    console.warn(`PDF still ${(compressedBuffer.length / 1024).toFixed(2)}KB after compression`);
    return compressedBuffer;

  } catch (error) {
    console.error('PDF compression error:', error);
    // Return original if compression fails
    return buffer;
  }
}

/**
 * Upload file to Cloudflare R2 storage with organized folder structure
 * @param {Buffer} buffer - File buffer to upload
 * @param {string} originalName - Original filename
 * @param {string} mimetype - File MIME type
 * @param {Object} options - Upload options
 * @param {string} options.folder - Base folder (default: 'franchise-applications')
 * @param {string} options.applicationId - Application ID for organization
 * @param {string} options.documentType - Type of document (e.g., 'registration', 'profile')
 * @returns {Promise<string>} Public URL of uploaded file
 */
async function uploadToR2(buffer, originalName, mimetype, options = {}) {
  const {
    folder = 'franchise-applications',
    applicationId = 'pending',
    documentType = 'document'
  } = options;
  try {
    // Compress file based on type
    let finalBuffer = buffer;
    
    if (mimetype.startsWith('image/')) {
      finalBuffer = await compressImage(buffer, mimetype);
    } else if (mimetype === 'application/pdf') {
      finalBuffer = await compressPDF(buffer);
    }

    // Generate secure filename that preserves original name
    // Format: original-name-{hash}.ext (e.g., barangay-clearance-8b32022d.pdf)
    const randomHash = crypto.randomBytes(8).toString('hex'); // Shorter hash for readability
    const fileExt = path.extname(originalName).toLowerCase();
    const baseName = path.basename(originalName, fileExt)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace special chars with dashes
      .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
      .substring(0, 50); // Limit length
    
    const fileName = `${baseName}-${randomHash}${fileExt}`;
    
    // Organize: TRC-V/franchise-applications/{applicationId}/{documentType}/{readable-filename-hash.ext}
    // Example: TRC-V/franchise-applications/673abc123/documents/barangay-clearance-8b32022d.pdf
    //          TRC-V/franchise-applications/673abc123/profile/1x1-picture-a1b2c3d4.jpg
    const key = `TRC-V/${folder}/${applicationId}/${documentType}/${fileName}`;

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: finalBuffer,
      ContentType: mimetype,
      // Make file publicly accessible (optional, depending on your bucket settings)
      // ACL: 'public-read', // R2 doesn't use ACLs, use bucket policies instead
    });

    const client = getR2Client();
    await client.send(command);

    // Return the R2 key path (not public URL, since public URL doesn't work)
    // Files will be accessed through backend proxy: /api/franchise-applications/proxy-file
    // For backward compatibility with existing DB records, we still return a URL format
    // but prefix with a marker that this needs backend proxy
    const fileUrl = `r2://${key}`;
    console.log(`File uploaded successfully to R2: ${key}`);
    
    return fileUrl;

  } catch (error) {
    console.error('Error uploading to R2:', error);
    throw new Error('Failed to upload file to Cloudflare R2');
  }
}

/**
 * Upload multiple files from franchise application
 * @param {Object} files - Files object from multer
 * @param {string} applicationId - Application ID for folder organization
 * @returns {Promise<Object>} Object with document URLs
 */
async function uploadFranchiseDocuments(files, applicationId = 'pending') {
  const documentUrls = {};

  const uploadPromises = Object.entries(files).map(async ([key, fileArray]) => {
    if (fileArray && fileArray.length > 0) {
      const file = fileArray[0];
      const documentType = key === 'profilePhoto' ? 'profile' : 'documents';
      
      try {
        const url = await uploadToR2(
          file.buffer,
          file.originalname,
          file.mimetype,
          {
            folder: 'franchise-applications',
            applicationId: applicationId,
            documentType: documentType
          }
        );
        documentUrls[key] = url;
      } catch (error) {
        console.error(`Error uploading ${key}:`, error);
        throw new Error(`Failed to upload ${key}`);
      }
    }
  });

  await Promise.all(uploadPromises);
  return documentUrls;
}

/**
 * Move files from franchise-applications folder to franchise-information folder
 * Called after application approval to reorganize files with hashed MTOP
 * @param {string} applicationId - Original application ID
 * @param {string} hashedMTOP - Hashed MTOP number for new folder structure
 * @returns {Promise<Object>} Mapping of old URLs to new URLs
 */
async function moveFranchiseFiles(applicationId, hashedMTOP) {
  try {
    const client = getR2Client();
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('CLOUDFLARE_R2_BUCKET_NAME is not defined');
    }

    const sourcePrefix = `TRC-V/franchise-applications/${applicationId}/`;
    const destPrefix = `TRC-V/franchise-information/${hashedMTOP}/`;

    console.log(`[CLOUDFLARE] Moving files from ${sourcePrefix} to ${destPrefix}`);

    // List all files in the application folder
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: sourcePrefix,
    });

    const listResponse = await client.send(listCommand);
    
    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      console.log('[CLOUDFLARE] No files found to move');
      return {};
    }

    const urlMapping = {};

    // Copy each file to new location and delete old one
    for (const item of listResponse.Contents) {
      const oldKey = item.Key;
      const relativePath = oldKey.replace(sourcePrefix, '');
      const newKey = `${destPrefix}${relativePath}`;

      try {
        // Copy file to new location
        const copyCommand = new CopyObjectCommand({
          Bucket: bucketName,
          CopySource: `${bucketName}/${oldKey}`,
          Key: newKey,
        });
        await client.send(copyCommand);

        // Delete old file
        const deleteCommand = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: oldKey,
        });
        await client.send(deleteCommand);

        // Map old r2:// URL to new r2:// URL (not public URLs)
        const oldUrl = `r2://${oldKey}`;
        const newUrl = `r2://${newKey}`;
        urlMapping[oldUrl] = newUrl;

        console.log(`[CLOUDFLARE] Moved: ${oldKey} → ${newKey}`);
      } catch (error) {
        console.error(`[CLOUDFLARE] Error moving file ${oldKey}:`, error);
        // Continue with other files even if one fails
      }
    }

    console.log(`[CLOUDFLARE] Successfully moved ${Object.keys(urlMapping).length} files`);
    return urlMapping;

  } catch (error) {
    console.error('[CLOUDFLARE] Error moving franchise files:', error);
    throw new Error('Failed to move franchise files in Cloudflare R2');
  }
}

/**
 * Update document URLs in an object by replacing old Cloudflare URLs with new ones
 * @param {Object} documentObject - Object containing document URLs
 * @param {Object} urlMapping - Mapping of old URLs to new URLs
 * @returns {Object} Updated document object with new URLs
 */
function updateDocumentUrls(documentObject, urlMapping) {
  const updated = {};
  
  for (const [key, value] of Object.entries(documentObject)) {
    if (!value) {
      updated[key] = value;
    } else if (typeof value === 'string') {
      // Check if this URL has a mapping to a new location
      updated[key] = urlMapping[value] || value;
    } else if (typeof value === 'object' && value.path) {
      // Handle document objects with path property
      const newPath = urlMapping[value.path] || value.path;
      updated[key] = { ...value, path: newPath };
    } else if (typeof value === 'object' && value !== null) {
      // Handle nested objects (like documents subdocument)
      updated[key] = updateDocumentUrls(value, urlMapping);
    } else {
      updated[key] = value;
    }
  }
  
  return updated;
}

/**
 * Upload QR code to R2 storage
 * @param {Buffer} qrBuffer - QR code image buffer
 * @param {string} hashedMTOP - Hashed MTOP number for folder organization
 * @returns {Promise<string>} R2 URL path
 */
async function uploadQRToR2(qrBuffer, hashedMTOP) {
  try {
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('CLOUDFLARE_R2_BUCKET_NAME is not defined');
    }

    // Generate filename: qr-{hashedMTOP}-{timestamp}.png
    const filename = `qr-${hashedMTOP}-${Date.now()}.png`;
    const key = `TRC-V/franchise-information/${hashedMTOP}/qrcode/${filename}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: qrBuffer,
      ContentType: 'image/png',
    });

    const client = getR2Client();
    await client.send(command);

    const fileUrl = `r2://${key}`;
    console.log(`[CLOUDFLARE] QR code uploaded to R2: ${key}`);
    
    return fileUrl;
  } catch (error) {
    console.error('[CLOUDFLARE] Error uploading QR code to R2:', error);
    throw new Error('Failed to upload QR code to R2');
  }
}

/**
 * Generate a presigned URL for private R2 files
 * Use this if you don't want to enable public access
 * @param {string} key - The file key in R2 bucket
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
async function generatePresignedUrl(key, expiresIn = 3600) {
  try {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    
    const client = getR2Client();
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    
    const url = await getSignedUrl(client, command, { expiresIn });
    console.log(`[CLOUDFLARE] Generated presigned URL for: ${key} (expires in ${expiresIn}s)`);
    return url;
  } catch (error) {
    console.error('[CLOUDFLARE] Error generating presigned URL:', error);
    throw error;
  }
}

/**
 * Get file from R2 bucket directly
 * Returns the file buffer and content type
 * @param {string} key - The file key in R2 bucket
 * @returns {Promise<{buffer: Buffer, contentType: string}>} File buffer and content type
 */
async function getFileFromR2(key) {
  try {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    
    const client = getR2Client();
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    
    if (!bucketName) {
      throw new Error('CLOUDFLARE_R2_BUCKET_NAME is not defined in environment variables');
    }
    
    console.log(`[CLOUDFLARE] Fetching file from R2: ${key}`);
    console.log(`[CLOUDFLARE] Bucket name: ${bucketName}`);
    console.log(`[CLOUDFLARE] Endpoint: ${process.env.CLOUDFLARE_R2_ENDPOINT}`);
    
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    const response = await client.send(command);
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    console.log(`[CLOUDFLARE] File retrieved: ${key}, size: ${buffer.length} bytes, type: ${response.ContentType}`);
    
    return {
      buffer,
      contentType: response.ContentType || 'application/octet-stream'
    };
  } catch (error) {
    console.error('[CLOUDFLARE] Error getting file from R2:', error);
    throw error;
  }
}

module.exports = {
  uploadToR2,
  uploadFranchiseDocuments,
  compressImage,
  compressPDF,
  moveFranchiseFiles,
  updateDocumentUrls,
  uploadQRToR2,
  generatePresignedUrl,
  getFileFromR2,
  MAX_FILE_SIZE,
};
