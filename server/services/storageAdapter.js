const gridfsService = require('./gridfsService');

let initialized = false;

function init() {
  if (initialized) return;
  
  if (gridfsService.initGridFS) {
    gridfsService.initGridFS();
  }
  initialized = true;
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
  storageType: 'gridfs',
  
  compressImage: () => gridfsService.compressImage,
  compressPDF: () => gridfsService.compressPDF
};
