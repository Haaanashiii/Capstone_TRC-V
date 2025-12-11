/**
 * File Routes - Serve files from GridFS storage
 * 
 * This route handles serving files stored in MongoDB GridFS.
 * GridFS URLs like gridfs://6932970b6be389dd2a473805 are converted
 * to accessible HTTP URLs like /api/files/6932970b6be389dd2a473805
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const storage = require('../services/storageAdapter');

/**
 * GET /api/files/:fileId
 * Serve a file from GridFS storage
 */
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID format' });
    }
    
    // Get file from GridFS
    const file = await storage.getFile(`gridfs://${fileId}`);
    
    if (!file || !file.buffer) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Set appropriate headers
    res.set({
      'Content-Type': file.contentType || 'application/octet-stream',
      'Content-Length': file.buffer.length,
      'Content-Disposition': `inline; filename="${file.filename || 'file'}"`,
      'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      'X-Content-Type-Options': 'nosniff'
    });
    
    // Send file buffer
    res.send(file.buffer);
  } catch (error) {
    console.error('[FileRoutes] Error serving file:', error.message);
    
    if (error.message?.includes('File not found')) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.status(500).json({ error: 'Failed to retrieve file' });
  }
});

/**
 * GET /api/files/info/:fileId
 * Get file metadata without downloading
 */
router.get('/info/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID format' });
    }
    
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads'
    });
    
    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
    
    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const file = files[0];
    res.json({
      id: file._id,
      filename: file.filename,
      contentType: file.metadata?.mimetype || 'application/octet-stream',
      size: file.length,
      uploadDate: file.uploadDate,
      metadata: file.metadata
    });
  } catch (error) {
    console.error('[FileRoutes] Error getting file info:', error.message);
    res.status(500).json({ error: 'Failed to get file info' });
  }
});

module.exports = router;
