/**
 * Seed Initial Super Admin - ONE TIME USE ONLY
 * This script creates the first super admin account and then self-destructs
 * 
 * Usage:
 *   node scripts/seedSuperAdmin.js
 * 
 * SECURITY: This script will delete itself after successful execution
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/trc_v');
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Admin Model Schema (inline to avoid dependency issues)
const adminAccountSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8 },
  role: { 
    type: String, 
    enum: ['sb-admin', 'bplo-admin', 'super-admin'], 
    default: 'sb-admin',
    required: true 
  },
  permissions: [{ type: String }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const AdminAccount = mongoose.model('AdminAccount', adminAccountSchema);

// Self-destruct function
const selfDestruct = () => {
  try {
    const scriptPath = __filename;
    fs.unlinkSync(scriptPath);
    console.log('🔒 Security: Seed script has been permanently deleted');
  } catch (error) {
    console.warn('⚠️  Warning: Could not delete seed script:', error.message);
  }
};

// Create Super Admin
const createSuperAdmin = async () => {
  try {
    // Check if super admin already exists
    const existingSuperAdmin = await AdminAccount.findOne({ role: 'super-admin' });
    
    if (existingSuperAdmin) {
      console.log('\n⚠️  Super admin already exists!');
      console.log('Email:', existingSuperAdmin.email);
      console.log('Username:', existingSuperAdmin.username);
      console.log('\n🔒 Script will now self-destruct for security...');
      return true; // Return true to trigger self-destruct
    }

    // Super admin credentials - fixed credentials
    const superAdminData = {
      name: 'TRC-V System Administrator',
      username: 'raygabs',
      email: 'raygabs89@gmail.com',
      password: 'trC-V@Solano_2025', // Fixed password
      role: 'super-admin',
      permissions: [
        'manage-users',
        'manage-operators',
        'manage-franchises',
        'view-reports',
        'approve-franchise-applications',
        'manage-announcements',
        'system-settings'
      ],
      isActive: true
    };

    // Hash password with bcrypt (same as your system uses)
    const salt = await bcrypt.genSalt(12);
    superAdminData.password = await bcrypt.hash(superAdminData.password, salt);

    // Create admin
    const admin = await AdminAccount.create(superAdminData);
    
    console.log('\n✅ Super Admin Created Successfully!');
    console.log('========================================');
    console.log('Email:    ', 'raygabs89@gmail.com');
    console.log('Username: ', 'raygabs');
    console.log('Password: ', 'trC-V@Solano_2025');
    console.log('========================================');
    console.log('\n🔒 This script will now self-destruct for security...\n');
    
    return true; // Success, trigger self-destruct
    
  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    return false; // Don't self-destruct on error
  }
};

// Main execution
const main = async () => {
  console.log('\n🔐 TRC-V Super Admin Initialization');
  console.log('====================================\n');
  
  await connectDB();
  const success = await createSuperAdmin();
  await mongoose.connection.close();
  console.log('✅ Database connection closed\n');
  
  // Self-destruct only on success
  if (success) {
    selfDestruct();
    console.log('✅ Initialization complete\n');
  } else {
    console.log('❌ Initialization failed - script preserved for retry\n');
  }
  
  process.exit(0);
};

main();
