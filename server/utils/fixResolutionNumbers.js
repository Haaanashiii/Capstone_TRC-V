/**
 * Migration Script: Fix Missing Resolution Numbers
 * 
 * This script updates franchise information records that are missing
 * resolution numbers by copying them from their related applications.
 * 
 * Run with: node utils/fixResolutionNumbers.js
 */

const mongoose = require('mongoose');
const FranchiseInformation = require('../models/franchiseInformationModel');
const FranchiseApplication = require('../models/franchiseApplicationModel');
require('dotenv').config();

async function fixResolutionNumbers() {
  try {
    // Connect to MongoDB
    const dbURI = process.env.MONGO_URI || 'mongodb://localhost:27017/capstone-db';
    await mongoose.connect(dbURI);
    console.log('✓ Connected to MongoDB');

    // Find all franchise information records without resolution numbers
    const franchisesWithoutResolution = await FranchiseInformation.find({
      $or: [
        { resolutionNumber: null },
        { resolutionNumber: { $exists: false } },
        { resolutionNumber: '' }
      ]
    });

    console.log(`\nFound ${franchisesWithoutResolution.length} franchise(s) without resolution numbers`);

    let updated = 0;
    let notFound = 0;
    let alreadyHasResolution = 0;

    for (const franchise of franchisesWithoutResolution) {
      console.log(`\n[${franchise.franchiseNumber}] Processing...`);

      // Try to find the related application
      if (franchise.relatedApplicationId) {
        const application = await FranchiseApplication.findById(franchise.relatedApplicationId);
        
        if (application && application.sbResolutionNumber) {
          // Update the franchise with the resolution number
          franchise.resolutionNumber = application.sbResolutionNumber;
          await franchise.save();
          console.log(`  ✓ Updated: ${application.sbResolutionNumber}`);
          updated++;
        } else if (application) {
          console.log(`  ⚠ Application found but has no sbResolutionNumber`);
          notFound++;
        } else {
          console.log(`  ⚠ Application not found`);
          notFound++;
        }
      } else {
        // No related application ID, try to find by operator name and franchise number
        console.log(`  → No relatedApplicationId, searching by operator...`);
        const application = await FranchiseApplication.findOne({
          operatorName: franchise.operatorName,
          franchiseNumber: franchise.franchiseNumber,
          statusOfBPLO: 'sb-approved'
        }).sort({ sbApprovedAt: -1 });

        if (application && application.sbResolutionNumber) {
          franchise.resolutionNumber = application.sbResolutionNumber;
          await franchise.save();
          console.log(`  ✓ Updated (by search): ${application.sbResolutionNumber}`);
          updated++;
        } else {
          console.log(`  ⚠ No matching application found`);
          notFound++;
        }
      }
    }

    // Also check for franchises that might have the field but empty
    const franchisesWithEmptyResolution = await FranchiseInformation.find({
      resolutionNumber: ''
    });

    for (const franchise of franchisesWithEmptyResolution) {
      if (franchise.relatedApplicationId) {
        const application = await FranchiseApplication.findById(franchise.relatedApplicationId);
        if (application && application.sbResolutionNumber) {
          franchise.resolutionNumber = application.sbResolutionNumber;
          await franchise.save();
          console.log(`\n[${franchise.franchiseNumber}] Fixed empty resolution: ${application.sbResolutionNumber}`);
          updated++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✓ Updated: ${updated}`);
    console.log(`⚠ Not Found: ${notFound}`);
    console.log(`Total Processed: ${franchisesWithoutResolution.length + franchisesWithEmptyResolution.length}`);
    console.log('='.repeat(60));

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('\n✗ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the migration
fixResolutionNumbers();
