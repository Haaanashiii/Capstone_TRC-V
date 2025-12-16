/**
 * File Routes - Serve files from GridFS storage
 * 
 * This route handles serving files stored in MongoDB GridFS.
 * GridFS URLs like gridfs://6932970b6be389dd2a473805 are converted
 * to accessible HTTP URLs like /api/files/6932970b6be389dd2a473805
 * 
 * Optimizations:
 * - Streaming for large files (avoids loading entire file into memory)
 * - ETag support for caching
 * - Range requests support for partial content
 * - Compression support
 * - Security headers
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const storage = require('../services/storageAdapter');
const crypto = require('crypto');
const zlib = require('zlib');

// Simple in-memory cache for file metadata (5 minute TTL)
const metadataCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedMetadata(fileId) {
  const cached = metadataCache.get(fileId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedMetadata(fileId, data) {
  metadataCache.set(fileId, { data, timestamp: Date.now() });
  // Cleanup old cache entries
  if (metadataCache.size > 1000) {
    const entries = Array.from(metadataCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    // Remove oldest 100 entries
    for (let i = 0; i < 100; i++) {
      metadataCache.delete(entries[i][0]);
    }
  }
}

/**
 * GET /api/files/:fileId
 * Serve a file from GridFS storage with streaming and caching support
 */
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID format' });
    }
    
    // Check cached metadata first
    let metadata = getCachedMetadata(fileId);
    let isNewFetch = false;
    
    if (!metadata) {
      // Get file metadata without fetching content
      const gridfsService = require('../services/gridfsService');
      metadata = await gridfsService.getFileMetadata(`gridfs://${fileId}`);
      
      if (!metadata) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      setCachedMetadata(fileId, metadata);
      isNewFetch = true;
    }
    
    // Generate ETag from file ID and upload date
    const etag = crypto
      .createHash('md5')
      .update(`${fileId}-${metadata.uploadedAt}${metadata.fileSize}`)
      .digest('hex');
    
    // Check if client has cached version
    const clientETag = req.headers['if-none-match'];
    if (clientETag === etag) {
      return res.status(304).end(); // Not Modified
    }
    
    // Support range requests for large files (video/audio streaming)
    const range = req.headers.range;
    const fileSize = metadata.fileSize;
    
    // Determine if we should stream (for large files) or send buffer
    const STREAM_THRESHOLD = 1024 * 1024; // 1MB
    const shouldStream = fileSize > STREAM_THRESHOLD;
    
    if (range && shouldStream) {
      // Parse range header
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': metadata.mimetype || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable', // 1 year for immutable content
        'ETag': etag,
      });
      
      // Stream partial content
      const gridfsService = require('../services/gridfsService');
      const bucket = gridfsService.getBucket();
      const objectId = new mongoose.Types.ObjectId(fileId);
      const downloadStream = bucket.openDownloadStream(objectId, { start, end: end + 1 });
      
      downloadStream.pipe(res);
      downloadStream.on('error', (err) => {
        console.error('[FileRoutes] Stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream file' });
        }
      });
      
      return;
    }
    
    // For smaller files or non-range requests, use buffer method
    const file = await storage.getFile(`gridfs://${fileId}`);
    
    if (!file || !file.buffer) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check if client accepts compression
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const shouldCompress = acceptEncoding.includes('gzip') && 
                          !metadata.mimetype?.startsWith('image/') && 
                          !metadata.mimetype?.includes('compressed');
    
    // Set security and caching headers
    const headers = {
      'Content-Type': metadata.mimetype || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(metadata.filename || 'file')}"`,
      'Cache-Control': 'public, max-age=31536000, immutable', // 1 year cache
      'ETag': etag,
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Vary': 'Accept-Encoding'
    };
    
    // Compress if applicable
    if (shouldCompress && file.buffer.length > 1024) {
      zlib.gzip(file.buffer, (err, compressed) => {
        if (err) {
          // Send uncompressed on error
          res.set(headers);
          res.set('Content-Length', file.buffer.length);
          return res.send(file.buffer);
        }
        
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = compressed.length;
        res.set(headers);
        res.send(compressed);
      });
    } else {
      headers['Content-Length'] = file.buffer.length;
      res.set(headers);
      res.send(file.buffer);
    }
    
  } catch (error) {
    console.error('[FileRoutes] Error serving file:', error.message);
    
    if (error.message?.includes('File not found')) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to retrieve file' });
    }
  }
});

/**
 * GET /api/files/info/:fileId
 * Get file metadata without downloading - optimized with caching
 */
router.get('/info/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID format' });
    }
    
    // Check cache first
    let metadata = getCachedMetadata(fileId);
    
    if (!metadata) {
      const gridfsService = require('../services/gridfsService');
      metadata = await gridfsService.getFileMetadata(`gridfs://${fileId}`);
      
      if (!metadata) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      setCachedMetadata(fileId, metadata);
    }
    
    // Set caching headers
    res.set({
      'Cache-Control': 'public, max-age=3600', // 1 hour
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true'
    });
    
    res.json({
      id: metadata.id,
      filename: metadata.filename,
      originalName: metadata.originalName,
      contentType: metadata.mimetype,
      documentType: metadata.documentType,
      size: metadata.fileSize,
      uploadDate: metadata.uploadedAt,
      category: metadata.category
    });
  } catch (error) {
    console.error('[FileRoutes] Error getting file info:', error.message);
    res.status(500).json({ error: 'Failed to get file info' });
  }
});

module.exports = router;
