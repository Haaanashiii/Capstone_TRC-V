const adminAccountRepository = require('../repositories/adminAccountRepository');

/**
 * Helper function to broadcast admin updates via WebSocket
 */
const broadcastAdminUpdate = (io, admin, eventType = 'admin-updated') => {
  if (!io) return;
  
  const adminResponse = admin.toObject?.() || admin;
  delete adminResponse.password;
  
  // Broadcast to super-admin-room (permission changes only visible to super admins)
  io.to('super-admin-room').emit(eventType, {
    adminId: adminResponse.adminId,
    name: adminResponse.name,
    email: adminResponse.email,
    role: adminResponse.role,
    permissions: adminResponse.permissions,
    isActive: adminResponse.isActive,
    updatedAt: adminResponse.updatedAt
  });
  
  console.log(`[AdminController] Broadcast ${eventType} for admin ${adminResponse.adminId} to super-admin-room`);
};

/**
 * Get all admin accounts
 */
exports.getAllAdmins = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const admins = await adminAccountRepository.getAllAdmins({ 
      includeInactive: includeInactive === 'true' 
    });
    
    res.status(200).json(admins);
  } catch (err) {
    next(err);
  }
};

/**
 * Get admin account by ID
 */
exports.getAdminById = async (req, res, next) => {
  try {
    const admin = await adminAccountRepository.findAdminById(req.params.id);
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    // Don't return password
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    
    res.status(200).json(adminResponse);
  } catch (err) {
    next(err);
  }
};

/**
 * Get admins by role
 */
exports.getAdminsByRole = async (req, res, next) => {
  try {
    const { role } = req.params;
    
    if (!['sb-admin', 'bplo-admin', 'super-admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const admins = await adminAccountRepository.getAdminsByRole(role);
    res.status(200).json(admins);
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new admin account
 */
exports.createAdmin = async (req, res, next) => {
  try {
    const { name, username, email, password, role, phoneNumber, department, position } = req.body;
    
    // Basic validation
    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: 'Name, username, email, and password are required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    // Check if admin already exists
    const existingAdminByEmail = await adminAccountRepository.findAdminByEmail(email);
    if (existingAdminByEmail) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    
    const existingAdminByUsername = await adminAccountRepository.findAdminByUsername(username);
    if (existingAdminByUsername) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    const admin = await adminAccountRepository.createAdminAccount({
      name,
      username,
      email,
      password,
      role: role || 'bplo-admin',
      phoneNumber,
      department,
      position
    });
    
    // Don't return password in response
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    
    res.status(201).json({ 
      message: 'Admin account created successfully', 
      admin: adminResponse 
    });
  } catch (err) {
    if (err.code === 11000) {
      // Handle MongoDB duplicate key error
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ error: `${field} already exists` });
    }
    next(err);
  }
};

/**
 * Update admin account
 */
exports.updateAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updateData.adminId;
    delete updateData.createdAt;
    
    const admin = await adminAccountRepository.updateAdminAccount(id, updateData);
    
    // Don't return password in response
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    
    res.status(200).json({
      message: 'Admin account updated successfully',
      admin: adminResponse
    });
  } catch (err) {
    if (err.message === 'Admin not found') {
      return res.status(404).json({ error: 'Admin not found' });
    }
    next(err);
  }
};

/**
 * Deactivate admin account (soft delete)
 */
exports.deactivateAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const admin = await adminAccountRepository.deactivateAdmin(id);
    
    res.status(200).json({
      message: 'Admin account deactivated successfully',
      admin: {
        adminId: admin.adminId,
        isActive: admin.isActive
      }
    });
  } catch (err) {
    if (err.message === 'Admin not found') {
      return res.status(404).json({ error: 'Admin not found' });
    }
    next(err);
  }
};

/**
 * Delete admin account (hard delete)
 */
exports.deleteAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await adminAccountRepository.deleteAdminAccount(id);
    
    res.status(204).send();
  } catch (err) {
    if (err.message === 'Admin not found') {
      return res.status(404).json({ error: 'Admin not found' });
    }
    next(err);
  }
};

/**
 * Add permission to admin
 */
exports.addPermission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permission } = req.body;
    
    if (!permission) {
      return res.status(400).json({ error: 'Permission is required' });
    }
    
    const admin = await adminAccountRepository.addPermission(id, permission);
    
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    
    // Get io instance from req (set by server)
    const io = req.app.get('io');
    broadcastAdminUpdate(io, admin, 'admin-permission-added');
    
    res.status(200).json({
      message: 'Permission added successfully',
      admin: adminResponse
    });
  } catch (err) {
    if (err.message === 'Admin not found') {
      return res.status(404).json({ error: 'Admin not found' });
    }
    next(err);
  }
};

/**
 * Remove permission from admin
 */
exports.removePermission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permission } = req.body;
    
    if (!permission) {
      return res.status(400).json({ error: 'Permission is required' });
    }
    
    const admin = await adminAccountRepository.removePermission(id, permission);
    
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    
    // Get io instance from req (set by server)
    const io = req.app.get('io');
    broadcastAdminUpdate(io, admin, 'admin-permission-removed');
    
    res.status(200).json({
      message: 'Permission removed successfully',
      admin: adminResponse
    });
  } catch (err) {
    if (err.message === 'Admin not found') {
      return res.status(404).json({ error: 'Admin not found' });
    }
    next(err);
  }
};
