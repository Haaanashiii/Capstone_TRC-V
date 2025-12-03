const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const crypto = require('crypto');
const path = require('path');
const stream = require('stream');

let gfsBucket = null;

function initGridFS() {
  if (!gfsBucket && mongoose.connection.db) {
    gfsBucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'trcv_files'
    });
    console.log('[GridFS] Bucket initialized: trcv_files');
  }
  return gfsBucket;
}

function getBucket() {
  if (!gfsBucket) {
    initGridFS();
  }
  if (!gfsBucket) {
    throw new Error('GridFS bucket not initialized. Ensure MongoDB is connected.');
  }
  return gfsBucket;
}

const MAX_FILE_SIZE = 300 * 1024;

async function compressImage(buffer, mimetype) {
  try {
    let quality = 85;
    let compressed = buffer;
    
    const metadata = await sharp(buffer).metadata();
    
    let resizeOptions = {};
    if (metadata.width > 1920 || metadata.height > 1920) {
      resizeOptions = {
        width: 1920,
        height: 1920,
        fit: 'inside',
        withoutEnlargement: true
      };
    }

    while (quality >= 20) {
      const sharpInstance = sharp(buffer);
      
      if (resizeOptions.width) {
        sharpInstance.resize(resizeOptions);
      }

      if (mimetype === 'image/png') {
        compressed = await sharpInstance
          .png({ quality, compressionLevel: 9 })
          .toBuffer();
      } else if (mimetype === 'image/webp') {
        compressed = await sharpInstance
          .webp({ quality })
          .toBuffer();
      } else {
        compressed = await sharpInstance
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
      }

      if (compressed.length <= MAX_FILE_SIZE) {
        break;
      }
      quality -= 10;
    }

    console.log(`[GridFS] Image compressed: ${buffer.length} → ${compressed.length} bytes`);
    return compressed;
  } catch (error) {
    console.error('[GridFS] Image compression error:', error.message);
    return buffer;
  }
}

async function compressPDF(buffer) {
  try {
    if (buffer.length <= MAX_FILE_SIZE) {
      return buffer;
    }

    const pdfDoc = await PDFDocument.load(buffer);
    
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');

    const compressed = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    console.log(`[GridFS] PDF compressed: ${buffer.length} → ${compressed.length} bytes`);
    return Buffer.from(compressed);
  } catch (error) {
    console.error('[GridFS] PDF compression error:', error.message);
    return buffer;
  }
}

async function uploadToGridFS(buffer, originalName, mimetype, options = {}) {
  const {
    baseFolder = 'franchiseApplications',
    subFolder = 'pending',
    applicationId = null,
    category = 'Documentations',
    customKey = null
  } = options;

  try {
    const bucket = getBucket();
    
    let finalBuffer = buffer;
    
    if (mimetype.startsWith('image/')) {
      finalBuffer = await compressImage(buffer, mimetype);
    } else if (mimetype === 'application/pdf') {
      finalBuffer = await compressPDF(buffer);
    }

    const randomHash = crypto.randomBytes(8).toString('hex');
    const fileExt = path.extname(originalName).toLowerCase();
    const baseName = path.basename(originalName, fileExt)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    
    const fileName = `${baseName}-${randomHash}${fileExt}`;

    let filePath;
    if (customKey) {
      filePath = `TRC-V/${baseFolder}/${subFolder}/${customKey}`;
    } else if (baseFolder === 'franchiseApplications' && applicationId) {
      filePath = `TRC-V/${baseFolder}/${subFolder}/${applicationId}/${category}/${fileName}`;
    } else {
      filePath = `TRC-V/${baseFolder}/${subFolder}/${category}/${fileName}`;
    }

    const uploadStream = bucket.openUploadStream(fileName, {
      metadata: {
        originalName,
        mimetype,
        filePath,
        baseFolder,
        subFolder,
        applicationId,
        category,
        uploadedAt: new Date(),
        fileSize: finalBuffer.length
      }
    });

    const bufferStream = new stream.PassThrough();
    bufferStream.end(finalBuffer);

    return new Promise((resolve, reject) => {
      bufferStream.pipe(uploadStream)
        .on('error', (error) => {
          console.error('[GridFS] Upload error:', error.message);
          reject(new Error('Failed to upload file to GridFS'));
        })
        .on('finish', () => {
          const fileUrl = `gridfs://${uploadStream.id}`;
          console.log(`[GridFS] File uploaded: ${fileName} -> ${fileUrl}`);
          resolve(fileUrl);
        });
    });
  } catch (error) {
    console.error('[GridFS] Upload error:', error.message);
    throw new Error('Failed to upload file to GridFS');
  }
}

async function getFileFromGridFS(fileId) {
  try {
    const bucket = getBucket();
    
    const id = fileId.startsWith('gridfs://') ? fileId.substring(9) : fileId;
    const objectId = new mongoose.Types.ObjectId(id);

    const files = await bucket.find({ _id: objectId }).toArray();
    if (files.length === 0) {
      throw new Error(`File not found: ${fileId}`);
    }

    const file = files[0];
    const contentType = file.metadata?.mimetype || 'application/octet-stream';

    const downloadStream = bucket.openDownloadStream(objectId);
    const chunks = [];

    return new Promise((resolve, reject) => {
      downloadStream.on('data', (chunk) => chunks.push(chunk));
      downloadStream.on('error', (error) => {
        console.error('[GridFS] Download error:', error.message);
        reject(error);
      });
      downloadStream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`[GridFS] File retrieved: ${file.filename} (${buffer.length} bytes)`);
        resolve({
          buffer,
          contentType,
          filename: file.filename
        });
      });
    });
  } catch (error) {
    console.error('[GridFS] Get file error:', error.message);
    throw error;
  }
}

async function deleteFromGridFS(fileId) {
  try {
    const bucket = getBucket();
    const id = fileId.startsWith('gridfs://') ? fileId.substring(9) : fileId;
    const objectId = new mongoose.Types.ObjectId(id);
    
    await bucket.delete(objectId);
    console.log(`[GridFS] File deleted: ${fileId}`);
  } catch (error) {
    console.error('[GridFS] Delete error:', error.message);
    throw error;
  }
}

async function moveFranchiseFiles(userId, applicationId, franchiseNo, franchiseChainId, version = 1) {
  try {
    const bucket = getBucket();
    const urlMapping = {};

    const sourcePathPrefix = `TRC-V/franchiseApplications/${userId}/${applicationId}/`;
    const files = await bucket.find({
      'metadata.filePath': { $regex: `^${sourcePathPrefix}` }
    }).toArray();

    if (files.length === 0) {
      console.log('[GridFS] No files found to move');
      return {};
    }

    console.log(`[GridFS] Moving ${files.length} files for franchise ${franchiseNo}`);

    for (const file of files) {
      const oldPath = file.metadata.filePath;
      const relativePath = oldPath.replace(sourcePathPrefix, '');
      const newPath = `TRC-V/franchiseInformations/${franchiseNo}/${franchiseChainId}/version-${version}/${relativePath}`;

      await mongoose.connection.db.collection('trcv_files.files').updateOne(
        { _id: file._id },
        {
          $set: {
            'metadata.filePath': newPath,
            'metadata.movedAt': new Date(),
            'metadata.previousPath': oldPath
          }
        }
      );

      const oldUrl = `gridfs://${file._id}`;
      urlMapping[oldUrl] = oldUrl;

      console.log(`[GridFS] Moved: ${oldPath} -> ${newPath}`);
    }

    return urlMapping;
  } catch (error) {
    console.error('[GridFS] Move files error:', error.message);
    throw error;
  }
}

async function uploadQRToGridFS(qrBuffer, hashedMTOP) {
  try {
    const filename = `qr-${hashedMTOP}-${Date.now()}.png`;
    
    const url = await uploadToGridFS(qrBuffer, filename, 'image/png', {
      baseFolder: 'franchiseInformations',
      subFolder: hashedMTOP,
      category: 'QRCode',
      customKey: `${hashedMTOP}/qrcode/${filename}`
    });

    console.log(`[GridFS] QR code uploaded: ${url}`);
    return url;
  } catch (error) {
    console.error('[GridFS] QR upload error:', error.message);
    throw error;
  }
}

async function uploadFileToGridFS(file, folder = 'general') {
  try {
    const url = await uploadToGridFS(file.buffer, file.originalname, file.mimetype, {
      baseFolder: folder,
      subFolder: 'uploads',
      category: 'files'
    });

    const fileId = url.substring(9);

    return {
      success: true,
      publicUrl: url,
      filePath: fileId
    };
  } catch (error) {
    console.error('[GridFS] File upload error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function deleteFileFromGridFS(filePath) {
  try {
    await deleteFromGridFS(filePath);
  } catch (error) {
    console.error('[GridFS] Delete error:', error.message);
    throw error;
  }
}

async function listFiles(pathPrefix) {
  try {
    const bucket = getBucket();
    const files = await bucket.find({
      'metadata.filePath': { $regex: `^${pathPrefix}` }
    }).toArray();

    return files.map(f => ({
      id: f._id.toString(),
      filename: f.filename,
      path: f.metadata?.filePath,
      size: f.length,
      uploadedAt: f.uploadDate,
      contentType: f.metadata?.mimetype
    }));
  } catch (error) {
    console.error('[GridFS] List files error:', error.message);
    return [];
  }
}

module.exports = {
  initGridFS,
  getBucket,
  uploadToGridFS,
  getFileFromGridFS,
  deleteFromGridFS,
  moveFranchiseFiles,
  uploadQRToGridFS,
  uploadFileToGridFS,
  deleteFileFromGridFS,
  compressImage,
  compressPDF,
  listFiles,
  MAX_FILE_SIZE
};
