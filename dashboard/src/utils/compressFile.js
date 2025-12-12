import imageCompression from 'browser-image-compression';
import { PDFDocument } from 'pdf-lib';
import logger from './logger';

/**
 * Compresses images and PDFs for upload.
 * @param {File} file - The file to compress.
 * @returns {Promise<File>} - The compressed file (or original if not compressible).
 */
export async function compressFile(file) {
  const maxSize = 300 * 1024; // 300KB target
  const type = file.type;

  // Compress images (JPG, PNG)
  if (type.startsWith('image/')) {
    try {
      const options = {
        maxSizeMB: 0.3, // 300KB
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };
      const compressedBlob = await imageCompression(file, options);
      // Convert Blob to File
      return new File([compressedBlob], file.name, { type: compressedBlob.type });
    } catch (err) {
      logger.warn('[compressFile] Image compression failed:', err);
      return file;
    }
  }

  // Compress PDFs (basic: re-save, not true compression)
  if (type === 'application/pdf') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      // Remove unused objects, re-save (does not compress images inside PDF)
      const pdfBytes = await pdfDoc.save();
      if (pdfBytes.byteLength < file.size) {
        return new File([pdfBytes], file.name, { type: 'application/pdf' });
      }
      return file;
    } catch (err) {
      logger.warn('[compressFile] PDF compression failed:', err);
      return file;
    }
  }

  // Other file types: return as-is
  return file;
}
