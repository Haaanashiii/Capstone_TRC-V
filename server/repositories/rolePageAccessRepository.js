const RolePageAccess = require('../models/rolePageAccessModel');

/**
 * Get page access configuration for a specific role
 */
exports.getPageAccessByRole = async (role) => {
  const access = await RolePageAccess.findOne({ role });
  
  // Return default configuration if not found
  if (!access) {
    const defaults = getDefaultPageAccess(role);
    // Return as plain object with consistent structure
    return {
      role: defaults.role,
      allowedPages: defaults.allowedPages,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  // Convert mongoose document to plain object
  return {
    role: access.role,
    allowedPages: access.allowedPages || [],
    updatedBy: access.updatedBy,
    createdAt: access.createdAt,
    updatedAt: access.updatedAt
  };
};

/**
 * Get all role page access configurations
 */
exports.getAllPageAccess = async () => {
  const allAccess = await RolePageAccess.find();
  
  // If no configurations exist, return defaults for all roles
  if (allAccess.length === 0) {
    const defaults = [
      getDefaultPageAccess('super-admin'),
      getDefaultPageAccess('sb-admin'),
      getDefaultPageAccess('bplo-admin')
    ];
    
    // Return as plain objects with consistent structure
    return defaults.map(def => ({
      role: def.role,
      allowedPages: def.allowedPages,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }
  
  // Convert mongoose documents to plain objects
  return allAccess.map(doc => ({
    role: doc.role,
    allowedPages: doc.allowedPages || [],
    updatedBy: doc.updatedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  }));
};

/**
 * Update page access for a specific role
 */
exports.updatePageAccess = async (role, allowedPages, updatedBy) => {
  const access = await RolePageAccess.findOneAndUpdate(
    { role },
    { 
      role,
      allowedPages,
      updatedBy
    },
    { 
      new: true, 
      upsert: true,
      runValidators: true 
    }
  );
  
  return access;
};

/**
 * Reset page access to default for a specific role
 */
exports.resetPageAccessToDefault = async (role, updatedBy) => {
  const defaultAccess = getDefaultPageAccess(role);
  
  return await exports.updatePageAccess(role, defaultAccess.allowedPages, updatedBy);
};

/**
 * Check if a role has access to a specific page
 */
exports.hasPageAccess = async (role, pageKey) => {
  const access = await exports.getPageAccessByRole(role);
  return access.allowedPages && access.allowedPages.includes(pageKey);
};

/**
 * Helper: Get default page access based on role
 */
function getDefaultPageAccess(role) {
  const defaults = {
    'super-admin': {
      role: 'super-admin',
      allowedPages: [
        'dashboard',
        'franchisee-list',
        'franchise-management',
        'certificate',
        'fare-reports',
        'analytics',
        'announcements',
        'audit-trail',
        'user-management',
        'settings'
      ]
    },
    'sb-admin': {
      role: 'sb-admin',
      allowedPages: [
        'dashboard',
        'franchisee-list',
        'franchise-management',
        'certificate',
        'fare-reports'
      ]
    },
    'bplo-admin': {
      role: 'bplo-admin',
      allowedPages: [
        'dashboard',
        'franchisee-list',
        'franchise-management',
        'certificate',
        'fare-reports'
      ]
    }
  };
  
  return defaults[role] || { role, allowedPages: [] };
}
