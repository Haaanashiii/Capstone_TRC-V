/**
 * Index Building Utility for 10K+ Document Optimization
 * 
 * Run this script ONCE after deploying to ensure all indexes are created:
 * node utils/buildIndexes.js
 * 
 * This is especially important when you first deploy with 10K+ documents
 * as MongoDB needs to build the indexes for optimal query performance.
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function buildIndexes() {
  console.log('[BUILD] Starting index build process...\n');
  
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10
    });
    console.log('[BUILD] Connected to MongoDB\n');

    // Import models to register schemas
    const FranchiseInformation = require('../models/franchiseInformationModel');
    const FranchiseApplication = require('../models/franchiseApplicationModel');
    const Report = require('../models/reportsModel');
    const UserAccount = require('../models/userAccountModel');
    const AdminAccount = require('../models/adminAccountModel');

    const models = [
      { name: 'Franchise Information', model: FranchiseInformation },
      { name: 'Franchise Application', model: FranchiseApplication },
      { name: 'Reports', model: Report },
      { name: 'User Accounts', model: UserAccount },
      { name: 'Admin Accounts', model: AdminAccount }
    ];

    console.log('[BUILD] Building indexes for all collections...\n');

    for (const { name, model } of models) {
      try {
        console.log(`  ${name}:`);
        
        // Get existing indexes
        const existingIndexes = await model.collection.getIndexes();
        console.log(`     - Existing indexes: ${Object.keys(existingIndexes).length}`);
        
        // Ensure all schema indexes are created
        await model.ensureIndexes();
        
        // Get updated indexes
        const newIndexes = await model.collection.getIndexes();
        console.log(`     - Total indexes after build: ${Object.keys(newIndexes).length}`);
        
        // List index names
        Object.keys(newIndexes).forEach(indexName => {
          const idx = newIndexes[indexName];
          const fields = Object.keys(idx.key).join(', ');
          const isText = idx.textIndexVersion ? ' (TEXT)' : '';
          console.log(`       • ${indexName}: [${fields}]${isText}`);
        });
        
        console.log('     [OK] Done\n');
      } catch (err) {
        console.error(`     [ERROR] ${err.message}\n`);
      }
    }

    // Get collection stats
    console.log('\n📈 Collection Statistics:\n');
    
    for (const { name, model } of models) {
      try {
        const stats = await model.collection.stats();
        console.log(`  ${name}:`);
        console.log(`    - Documents: ${stats.count.toLocaleString()}`);
        console.log(`    - Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`    - Index Size: ${(stats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`    - Avg Doc Size: ${Math.round(stats.avgObjSize || 0)} bytes\n`);
      } catch (err) {
        console.log(`  ${name}: Unable to get stats\n`);
      }
    }

    console.log('[BUILD] Index build complete!\n');
    console.log('[INFO] Tips for 10K+ documents:');
    console.log('   1. Text indexes are now active for fast search');
    console.log('   2. Compound indexes optimize common query patterns');
    console.log('   3. Run this script again after adding new index definitions');
    console.log('   4. Monitor slow queries with MongoDB profiler\n');

  } catch (error) {
    console.error('[ERROR]', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  buildIndexes().then(() => process.exit(0));
}

module.exports = { buildIndexes };
