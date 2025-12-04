const STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'gridfs';

let storageService;
let initialized = false;

function getStorageService() {
  if (!storageService) {
    if (STORAGE_BACKEND === 'r2') {
      storageService = require('./cloudflareService');
    } else {
      storageService = require('./gridfsService');
    }
  }
  return storageService;
}

function init() {
  if (initialized) return;
  
  const service = getStorageService();
  if (STORAGE_BACKEND === 'gridfs' && service.initGridFS) {
    service.initGridFS();
  }
  initialized = true;
}

async function uploadFile(buffer, originalName, mimetype, options) {
  const service = getStorageService();
  if (STORAGE_BACKEND === 'gridfs') {
    return service.uploadToGridFS(buffer, originalName, mimetype, options);
  }
  return service.uploadToR2(buffer, originalName, mimetype, options);
}

async function getFile(fileUrl) {
  const service = getStorageService();
  
  if (fileUrl.startsWith('gridfs://')) {
    const gridfs = require('./gridfsService');
    return gridfs.getFileFromGridFS(fileUrl);
  }
  
  if (fileUrl.startsWith('r2://')) {
    const r2 = require('./cloudflareService');
    const key = fileUrl.substring(5);
    return r2.getFileFromR2(key);
  }
  
  if (STORAGE_BACKEND === 'gridfs') {
    return service.getFileFromGridFS(fileUrl);
  }
  return service.getFileFromR2(fileUrl);
}

async function deleteFile(fileUrl) {
  const service = getStorageService();
  
  if (fileUrl.startsWith('gridfs://')) {
    const gridfs = require('./gridfsService');
    return gridfs.deleteFromGridFS(fileUrl);
  }
  
  if (STORAGE_BACKEND === 'gridfs') {
    return service.deleteFromGridFS(fileUrl);
  }
  throw new Error('R2 delete not implemented in adapter');
}

async function moveFranchiseFiles(userId, applicationId, franchiseNo, franchiseChainId, version) {
  const service = getStorageService();
  return service.moveFranchiseFiles(userId, applicationId, franchiseNo, franchiseChainId, version);
}

async function uploadQRCode(qrBuffer, hashedMTOP) {
  const service = getStorageService();
  if (STORAGE_BACKEND === 'gridfs') {
    return service.uploadQRToGridFS(qrBuffer, hashedMTOP);
  }
  return service.uploadQRToR2(qrBuffer, hashedMTOP);
}

async function uploadFileToStorage(file, folder) {
  const service = getStorageService();
  if (STORAGE_BACKEND === 'gridfs') {
    return service.uploadFileToGridFS(file, folder);
  }
  return service.uploadFileToR2(file, folder);
}

async function deleteFileFromStorage(filePath) {
  const service = getStorageService();
  if (STORAGE_BACKEND === 'gridfs') {
    return service.deleteFileFromGridFS(filePath);
  }
  return service.deleteFileFromR2(filePath);
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
  storageType: STORAGE_BACKEND,
  
  compressImage: () => getStorageService().compressImage,
  compressPDF: () => getStorageService().compressPDF
};
