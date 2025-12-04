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
    gfsBucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'trcv_files' });
  }
  return gfsBucket;
}

function getBucket() {
  if (!gfsBucket) initGridFS();
  if (!gfsBucket) throw new Error('GridFS bucket not initialized. Ensure MongoDB is connected.');
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
      resizeOptions = { width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true };
    }

    while (quality >= 20) {
      const sharpInstance = sharp(buffer);
      if (resizeOptions.width) sharpInstance.resize(resizeOptions);

      if (mimetype === 'image/png') {
        compressed = await sharpInstance.png({ quality, compressionLevel: 9 }).toBuffer();
      } else if (mimetype === 'image/webp') {
        compressed = await sharpInstance.webp({ quality }).toBuffer();
      } else {
        compressed = await sharpInstance.jpeg({ quality, mozjpeg: true }).toBuffer();
      }

      if (compressed.length <= MAX_FILE_SIZE) break;
      quality -= 10;
    }
    return compressed;
  } catch (error) {
    return buffer;
  }
}

async function compressPDF(buffer) {
  try {
    if (buffer.length <= MAX_FILE_SIZE) return buffer;

    const pdfDoc = await PDFDocument.load(buffer);
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');

    const compressed = await pdfDoc.save({ useObjectStreams: true, addDefaultPage: false });
    return Buffer.from(compressed);
  } catch (error) {
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
        originalName, mimetype, filePath, baseFolder, subFolder,
        applicationId, category, uploadedAt: new Date(), fileSize: finalBuffer.length
      }
    });

    const bufferStream = new stream.PassThrough();
    bufferStream.end(finalBuffer);

    return new Promise((resolve, reject) => {
      bufferStream.pipe(uploadStream)
        .on('error', () => reject(new Error('Failed to upload file to GridFS')))
        .on('finish', () => resolve(`gridfs://${uploadStream.id}`));
    });
  } catch (error) {
    throw new Error('Failed to upload file to GridFS');
  }
}

async function getFileFromGridFS(fileId) {
  try {
    const bucket = getBucket();
    const id = fileId.startsWith('gridfs://') ? fileId.substring(9) : fileId;
    const objectId = new mongoose.Types.ObjectId(id);

    const files = await bucket.find({ _id: objectId }).toArray();
    if (files.length === 0) throw new Error(`File not found: ${fileId}`);

    const file = files[0];
    const contentType = file.metadata?.mimetype || 'application/octet-stream';
    const downloadStream = bucket.openDownloadStream(objectId);
    const chunks = [];

    return new Promise((resolve, reject) => {
      downloadStream.on('data', (chunk) => chunks.push(chunk));
      downloadStream.on('error', reject);
      downloadStream.on('end', () => {
        resolve({ buffer: Buffer.concat(chunks), contentType, filename: file.filename });
      });
    });
  } catch (error) {
    throw error;
  }
}

async function deleteFromGridFS(fileId) {
  const bucket = getBucket();
  const id = fileId.startsWith('gridfs://') ? fileId.substring(9) : fileId;
  await bucket.delete(new mongoose.Types.ObjectId(id));
}

async function moveFranchiseFiles(userId, applicationId, franchiseNo, franchiseChainId, version = 1) {
  try {
    const bucket = getBucket();
    const urlMapping = {};

    const sourcePathPrefix = `TRC-V/franchiseApplications/${userId}/${applicationId}/`;
    const files = await bucket.find({
      'metadata.filePath': { $regex: `^${sourcePathPrefix}` }
    }).toArray();

    if (files.length === 0) return {};

    for (const file of files) {
      const oldPath = file.metadata.filePath;
      const relativePath = oldPath.replace(sourcePathPrefix, '');
      const newPath = `TRC-V/franchiseInformations/${franchiseNo}/${franchiseChainId}/version-${version}/${relativePath}`;

      await mongoose.connection.db.collection('trcv_files.files').updateOne(
        { _id: file._id },
        { $set: { 'metadata.filePath': newPath, 'metadata.movedAt': new Date(), 'metadata.previousPath': oldPath } }
      );

      urlMapping[`gridfs://${file._id}`] = `gridfs://${file._id}`;
    }

    return urlMapping;
  } catch (error) {
    throw error;
  }
}

async function uploadQRToGridFS(qrBuffer, hashedMTOP) {
  const filename = `qr-${hashedMTOP}-${Date.now()}.png`;
  return await uploadToGridFS(qrBuffer, filename, 'image/png', {
    baseFolder: 'franchiseInformations',
    subFolder: hashedMTOP,
    category: 'QRCode',
    customKey: `${hashedMTOP}/qrcode/${filename}`
  });
}

async function uploadFileToGridFS(file, folder = 'general') {
  try {
    const url = await uploadToGridFS(file.buffer, file.originalname, file.mimetype, {
      baseFolder: folder, subFolder: 'uploads', category: 'files'
    });
    return { success: true, publicUrl: url, filePath: url.substring(9) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteFileFromGridFS(filePath) {
  await deleteFromGridFS(filePath);
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
