/**
 * GridFS Test Utility
 * 
 * Run this script to verify GridFS is working correctly:
 * node utils/testGridFS.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

async function testGridFS() {
  console.log('='.repeat(60));
  console.log('GridFS Connection Test');
  console.log('='.repeat(60));
  
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/capstone-db';
    console.log('\n1. Connecting to MongoDB...');
    console.log('   URI:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//*****:*****@'));
    
    await mongoose.connect(mongoUri);
    console.log('   ✓ Connected successfully!\n');
    
    // Initialize GridFS bucket
    console.log('2. Initializing GridFS bucket...');
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'trcv_files' });
    console.log('   ✓ GridFS bucket "trcv_files" initialized\n');
    
    // List existing files
    console.log('3. Checking existing files in GridFS...');
    const files = await bucket.find({}).limit(10).toArray();
    console.log(`   Found ${files.length} files in GridFS:\n`);
    
    if (files.length === 0) {
      console.log('   No files stored yet. Files will appear here after upload.\n');
    } else {
      files.forEach((file, idx) => {
        console.log(`   [${idx + 1}] ID: ${file._id}`);
        console.log(`       Filename: ${file.filename}`);
        console.log(`       Size: ${(file.length / 1024).toFixed(2)} KB`);
        console.log(`       Upload Date: ${file.uploadDate}`);
        console.log(`       Content Type: ${file.metadata?.mimetype || 'unknown'}`);
        console.log(`       HTTP URL: /api/files/${file._id}`);
        console.log('');
      });
    }
    
    // Show MongoDB collections related to GridFS
    console.log('4. GridFS Collections in Database:');
    const collections = await mongoose.connection.db.listCollections().toArray();
    const gridfsCollections = collections.filter(c => 
      c.name.includes('trcv_files') || c.name.includes('.files') || c.name.includes('.chunks')
    );
    
    if (gridfsCollections.length > 0) {
      gridfsCollections.forEach(c => console.log(`   - ${c.name}`));
    } else {
      console.log('   No GridFS collections yet. They will be created on first upload.');
      console.log('   Expected: trcv_files.files, trcv_files.chunks');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('GridFS Test Complete!');
    console.log('='.repeat(60));
    console.log('\nTo access files:');
    console.log('  HTTP URL format: /api/files/<file_id>');
    console.log('  Example: http://localhost:5170/api/files/6932970b6be389dd2a473805');
    console.log('\nIn MongoDB Compass, look for:');
    console.log('  - trcv_files.files (file metadata)');
    console.log('  - trcv_files.chunks (file binary data)');
    console.log('');
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Make sure MongoDB is running');
    console.error('  2. Check your MONGO_URI in .env file');
    console.error('  3. For local MongoDB: mongodb://localhost:27017/capstone-db');
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

testGridFS();
