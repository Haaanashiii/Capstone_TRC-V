const AdminAccount = require('../models/adminAccountModel');
const bcrypt = require('bcryptjs');

/**
 * Create a new admin account
 */
exports.createAdminAccount = async (adminData) => {
  // Hash password
  if (adminData.password) {
    const saltRounds = 12;
    adminData.password = await bcrypt.hash(adminData.password, saltRounds);
  }

  const admin = new AdminAccount(adminData);
  
  try {
    const saved = await admin.save();
    return saved;
  } catch (err) {
    console.error('adminAccountRepository.createAdminAccount error:', err && err.message);
    if (err && err.errors) {
      Object.keys(err.errors).forEach((k) => {
        console.error(' validation.', k, err.errors[k].message);
      });
    }
    throw err;
  }
};

/**
 * Find admin account by ID (adminId or _id)
 */
exports.findAdminById = async (id, { projection, lean = false } = {}) => {
  // Try to find by adminId first (UUID), then fall back to MongoDB _id
  let admin = await AdminAccount.findOne({ adminId: id }, projection);
  if (!admin) {
    admin = await AdminAccount.findById(id, projection);
  }
  if (lean && admin) {
    return admin.toObject();
  }
  return admin;
};

/**
 * Find admin account by email
 */
exports.findAdminByEmail = async (email, { projection, lean = false } = {}) => {
  if (typeof email !== 'string' || !email.trim()) {
    throw new TypeError('email must be a non-empty string');
  }
  
  const normalized = email.trim().toLowerCase();
  let query = AdminAccount.findOne({ email: normalized }, projection);
  if (lean) query = query.lean();
  return await query;
};

/**
 * Find admin account by username
 */
exports.findAdminByUsername = async (username, { projection, lean = false } = {}) => {
  if (typeof username !== 'string' || !username.trim()) {
    throw new TypeError('username must be a non-empty string');
  }
  
  let query = AdminAccount.findOne({ username: username.trim().toLowerCase() }, projection);
  if (lean) query = query.lean();
  return await query;
};

/**
 * Get all admin accounts
 */
exports.getAllAdmins = async ({ includeInactive = false } = {}) => {
  const filter = includeInactive ? {} : { isActive: true };
  return await AdminAccount.find(filter).select('-password').lean();
};

/**
 * Get admins by role
 */
exports.getAdminsByRole = async (role) => {
  return await AdminAccount.find({ role, isActive: true }).select('-password').lean();
};

/**
 * Update admin account
 */
exports.updateAdminAccount = async (id, updateData) => {
  // Hash password if being updated
  if (updateData.password) {
    const saltRounds = 12;
    updateData.password = await bcrypt.hash(updateData.password, saltRounds);
  }

  // Try to find by adminId first (UUID), then fall back to MongoDB _id
  let admin = await AdminAccount.findOne({ adminId: id });
  if (!admin) {
    admin = await AdminAccount.findById(id);
  }

  if (!admin) {
    throw new Error('Admin not found');
  }

  // Update admin
  Object.assign(admin, updateData);
  return await admin.save();
};

/**
 * Soft delete (deactivate) admin account
 */
exports.deactivateAdmin = async (id) => {
  return await exports.updateAdminAccount(id, { isActive: false });
};

/**
 * Hard delete admin account
 */
exports.deleteAdminAccount = async (id) => {
  // Try to find by adminId first (UUID), then fall back to MongoDB _id
  let admin = await AdminAccount.findOne({ adminId: id });
  if (!admin) {
    admin = await AdminAccount.findById(id);
  }

  if (!admin) {
    throw new Error('Admin not found');
  }

  return await AdminAccount.deleteOne({ _id: admin._id });
};

/**
 * Update last login timestamp
 */
exports.updateLastLogin = async (id) => {
  return await exports.updateAdminAccount(id, { lastLogin: new Date() });
};

/**
 * Add permission to admin
 */
exports.addPermission = async (id, permission) => {
  let admin = await AdminAccount.findOne({ adminId: id });
  if (!admin) {
    admin = await AdminAccount.findById(id);
  }

  if (!admin) {
    throw new Error('Admin not found');
  }

  if (!admin.permissions.includes(permission)) {
    admin.permissions.push(permission);
    return await admin.save();
  }

  return admin;
};

/**
 * Remove permission from admin
 */
exports.removePermission = async (id, permission) => {
  let admin = await AdminAccount.findOne({ adminId: id });
  if (!admin) {
    admin = await AdminAccount.findById(id);
  }

  if (!admin) {
    throw new Error('Admin not found');
  }

  admin.permissions = admin.permissions.filter(p => p !== permission);
  return await admin.save();
};
