const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
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
    console.log('[CLOUDFLARE] Endpoint:', process.env.CLOUDFLARE_R2_ENDPOINT.substring(0, 30) + '...');
    console.log('[CLOUDFLARE] Bucket:', process.env.CLOUDFLARE_R2_BUCKET_NAME);
    
    // Initialize Cloudflare R2 client (S3-compatible)
    r2Client = new S3Client({
      region: 'auto',
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
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

    // Generate secure filename
    const randomName = crypto.randomBytes(16).toString('hex');
    const fileExt = path.extname(originalName).toLowerCase();
    const fileName = `${randomName}${fileExt}`;
    
    // Organize: TRC-V/franchise-applications/{applicationId}/{documentType}/{filename}
    // Example: TRC-V/franchise-applications/673abc123/documents/registration.jpg
    //          TRC-V/franchise-applications/673abc123/profile/1x1-picture.jpg
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

    // Return public URL
    const publicUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
    console.log(`File uploaded successfully: ${publicUrl}`);
    
    return publicUrl;

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

module.exports = {
  uploadToR2,
  uploadFranchiseDocuments,
  compressImage,
  compressPDF,
  MAX_FILE_SIZE,
};
