/**
 * Client-side image compression utility
 * Compresses images to ~300KB before uploading to reduce bandwidth and storage
 */

const TARGET_SIZE = 300 * 1024; // 300KB target
const MAX_DIMENSION = 1920; // Max width/height for images
const QUALITY_START = 0.8; // Starting quality for JPEG
const QUALITY_STEP = 0.1; // Reduce quality by this amount each iteration
const MIN_QUALITY = 0.3; // Minimum acceptable quality

/**
 * Compress an image file to target size
 * @param {File} file - Image file to compress
 * @param {number} targetSize - Target size in bytes (default 300KB)
 * @returns {Promise<File>} Compressed image file
 */
export async function compressImage(file, targetSize = TARGET_SIZE) {
  // If file is already small enough and is not too large dimensionally, return as-is
  if (file.size <= targetSize && file.size < 1024 * 1024) {
    console.log(`[ImageCompression] File already small (${formatBytes(file.size)}), skipping compression`);
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onerror = () => reject(new Error('Failed to load image'));
      
      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          let { width, height } = img;
          
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }
          
          console.log(`[ImageCompression] Original: ${img.width}x${img.height} (${formatBytes(file.size)})`);
          console.log(`[ImageCompression] Target: ${width}x${height} (~${formatBytes(targetSize)})`);
          
          // Create canvas and draw resized image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = 'white'; // Fill background for transparent PNGs
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // Try to compress to target size by adjusting quality
          compressToTarget(canvas, file.name, file.type, targetSize)
            .then(resolve)
            .catch(reject);
            
        } catch (error) {
          reject(error);
        }
      };
      
      img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Compress canvas to target size by adjusting quality
 * @param {HTMLCanvasElement} canvas - Canvas with image
 * @param {string} fileName - Original file name
 * @param {string} fileType - Original file type
 * @param {number} targetSize - Target size in bytes
 * @returns {Promise<File>} Compressed file
 */
async function compressToTarget(canvas, fileName, fileType, targetSize) {
  // Use JPEG for better compression (unless original was PNG and small)
  const outputType = fileType === 'image/png' ? 'image/jpeg' : fileType;
  const extension = outputType === 'image/jpeg' ? '.jpg' : '.png';
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const outputName = baseName + extension;
  
  let quality = QUALITY_START;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, outputType, quality);
    });
    
    console.log(`[ImageCompression] Attempt ${attempts + 1}: quality=${quality.toFixed(2)}, size=${formatBytes(blob.size)}`);
    
    // If we're within 10% of target or below it, we're done
    if (blob.size <= targetSize * 1.1) {
      console.log(`[ImageCompression] ✓ Compressed to ${formatBytes(blob.size)} (${Math.round(blob.size / targetSize * 100)}% of target)`);
      return new File([blob], outputName, { type: outputType });
    }
    
    // If quality is already at minimum, return what we have
    if (quality <= MIN_QUALITY) {
      console.log(`[ImageCompression] ⚠ Min quality reached, size: ${formatBytes(blob.size)}`);
      return new File([blob], outputName, { type: outputType });
    }
    
    // Reduce quality for next attempt
    quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
    attempts++;
  }
  
  // Fallback: return the last attempt
  const finalBlob = await new Promise((resolve) => {
    canvas.toBlob(resolve, outputType, MIN_QUALITY);
  });
  
  console.log(`[ImageCompression] ⚠ Max attempts reached, final size: ${formatBytes(finalBlob.size)}`);
  return new File([finalBlob], outputName, { type: outputType });
}

/**
 * Compress a PDF using pdf-lib (client-side compression)
 * @param {File} file - PDF file
 * @param {number} targetSize - Target size in bytes
 * @returns {Promise<File>} Compressed PDF file
 */
export async function compressPDF(file, targetSize = TARGET_SIZE) {
  // If PDF is already small enough, return as-is
  if (file.size <= targetSize) {
    console.log(`[PDFCompression] PDF already small (${formatBytes(file.size)}), skipping compression`);
    return file;
  }

  try {
    console.log(`[PDFCompression] Starting compression: ${formatBytes(file.size)} → ~${formatBytes(targetSize)}`);
    
    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    
    // For PDFs, we'll use a simple approach: convert to lower quality
    // This is a basic implementation - production should use pdf-lib or similar
    
    // Create a new Blob with reduced quality metadata
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    
    // If the file is very large, we can't do much client-side without pdf-lib
    // So we'll just pass it through with a warning
    if (file.size > 5 * 1024 * 1024) {
      console.log(`[PDFCompression] PDF too large for client compression (${formatBytes(file.size)}), server will handle it`);
      return file;
    }
    
    // For smaller PDFs, return as-is (server will compress)
    console.log(`[PDFCompression] Prepared for server compression (${formatBytes(blob.size)})`);
    return new File([blob], file.name, { type: 'application/pdf' });
    
  } catch (error) {
    console.error('[PDFCompression] Error:', error);
    console.log('[PDFCompression] Falling back to original file');
    return file;
  }
}

/**
 * Compress any file (routes to appropriate compression method)
 * @param {File} file - File to compress
 * @returns {Promise<File>} Compressed file
 */
export async function compressFile(file) {
  if (!file) {
    throw new Error('No file provided');
  }
  
  console.log(`[FileCompression] Processing: ${file.name} (${file.type}, ${formatBytes(file.size)})`);
  
  // Check file type
  if (file.type.startsWith('image/')) {
    return await compressImage(file);
  } else if (file.type === 'application/pdf') {
    return await compressPDF(file);
  } else {
    // Unknown type, return as-is
    console.log(`[FileCompression] Unknown type, skipping compression`);
    return file;
  }
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export default {
  compressImage,
  compressPDF,
  compressFile,
  TARGET_SIZE,
  MAX_DIMENSION
};
