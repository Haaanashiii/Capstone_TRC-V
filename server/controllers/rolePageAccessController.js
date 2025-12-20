const rolePageAccessRepository = require('../repositories/rolePageAccessRepository');

/**
 * Helper function to broadcast page access updates via WebSocket
 * Notifies all connected admin users when permissions change
 */
const broadcastPageAccessUpdate = (io, role, allowedPages, updatedBy = null) => {
  if (!io) {
    console.warn('[PageAccessController] Socket.IO not available for broadcast');
    return;
  }
  
  const eventData = {
    role,
    allowedPages,
    updatedBy,
    updatedAt: new Date().toISOString()
  };
  
  // Broadcast to general room (all admins) and role-specific rooms
  // This ensures all logged-in admins receive the update
  io.to('general').emit('page-access-updated', eventData);
  io.to('bplo-admins').emit('page-access-updated', eventData);
  io.to('sb-admins').emit('page-access-updated', eventData);
  
  // Also emit to individual role room if the affected role matches
  // This allows more targeted updates
  const roleRoomMap = {
    'bplo-admin': 'bplo-admins',
    'sb-admin': 'sb-admins'
  };
  
  if (roleRoomMap[role]) {
    io.to(roleRoomMap[role]).emit('role-permissions-changed', {
      ...eventData,
      message: `Your role permissions have been updated`
    });
  }
  
  console.log(`[PageAccessController] Broadcast page-access-updated for role "${role}" to all admin rooms`);
};

/**
 * GET /api/role-page-access
 * Get all role page access configurations
 */
exports.getAllPageAccess = async (req, res, next) => {
  try {
    const allAccess = await rolePageAccessRepository.getAllPageAccess();
    
    res.status(200).json({
      success: true,
      data: allAccess
    });
  } catch (err) {
    console.error('[PageAccessController] Error getting all page access:', err);
    next(err);
  }
};

/**
 * GET /api/role-page-access/:role
 * Get page access configuration for a specific role
 */
exports.getPageAccessByRole = async (req, res, next) => {
  try {
    const { role } = req.params;
    
    // Validate role
    if (!['sb-admin', 'bplo-admin', 'super-admin'].includes(role)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid role. Must be one of: sb-admin, bplo-admin, super-admin' 
      });
    }
    
    // Super admin always has access to all pages
    if (role === 'super-admin') {
      const allPages = [
        'dashboard',
        'franchisee-list',
        'franchise-management',
        'franchise-linking',
        'certificate',
        'incident-reports',
        'analytics',
        'announcements',
        'audit-trail',
        'admin-management',
        'settings'
      ];
      
      return res.status(200).json({
        success: true,
        data: {
          role: 'super-admin',
          allowedPages: allPages
        }
      });
    }
    
    const access = await rolePageAccessRepository.getPageAccessByRole(role);
    
    res.status(200).json({
      success: true,
      data: access
    });
  } catch (err) {
    console.error(`[PageAccessController] Error getting page access for role ${req.params.role}:`, err);
    next(err);
  }
};

/**
 * PUT /api/role-page-access/:role
 * Update page access for a specific role
 */
exports.updatePageAccess = async (req, res, next) => {
  try {
    const { role } = req.params;
    const { allowedPages } = req.body;
    
    // Validate role
    if (!['sb-admin', 'bplo-admin', 'super-admin'].includes(role)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid role. Must be one of: sb-admin, bplo-admin, super-admin' 
      });
    }
    
    // Validate allowedPages
    if (!Array.isArray(allowedPages)) {
      return res.status(400).json({ 
        success: false,
        error: 'allowedPages must be an array' 
      });
    }
    
    // Prevent modifying super-admin access (optional security measure)
    if (role === 'super-admin') {
      return res.status(403).json({ 
        success: false,
        error: 'Cannot modify super-admin page access' 
      });
    }
    
    const updatedBy = req.user.adminId || req.user.id;
    const access = await rolePageAccessRepository.updatePageAccess(role, allowedPages, updatedBy);
    
    // Broadcast update via WebSocket
    const io = req.app.get('io');
    broadcastPageAccessUpdate(io, role, allowedPages);
    
    res.status(200).json({
      success: true,
      message: 'Page access updated successfully',
      data: access
    });
  } catch (err) {
    console.error(`[PageAccessController] Error updating page access for role ${req.params.role}:`, err);
    next(err);
  }
};

/**
 * POST /api/role-page-access/:role/reset
 * Reset page access to default for a specific role
 */
exports.resetPageAccessToDefault = async (req, res, next) => {
  try {
    const { role } = req.params;
    
    // Validate role
    if (!['sb-admin', 'bplo-admin', 'super-admin'].includes(role)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid role. Must be one of: sb-admin, bplo-admin, super-admin' 
      });
    }
    
    const updatedBy = req.user.adminId || req.user.id;
    const access = await rolePageAccessRepository.resetPageAccessToDefault(role, updatedBy);
    
    // Broadcast update via WebSocket
    const io = req.app.get('io');
    broadcastPageAccessUpdate(io, role, access.allowedPages);
    
    res.status(200).json({
      success: true,
      message: 'Page access reset to default successfully',
      data: access
    });
  } catch (err) {
    console.error(`[PageAccessController] Error resetting page access for role ${req.params.role}:`, err);
    next(err);
  }
};

/**
 * GET /api/role-page-access/:role/check/:pageKey
 * Check if a role has access to a specific page
 */
exports.checkPageAccess = async (req, res, next) => {
  try {
    const { role, pageKey } = req.params;
    
    // Validate role
    if (!['sb-admin', 'bplo-admin', 'super-admin'].includes(role)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid role' 
      });
    }
    
    const hasAccess = await rolePageAccessRepository.hasPageAccess(role, pageKey);
    
    res.status(200).json({
      success: true,
      hasAccess
    });
  } catch (err) {
    console.error(`[PageAccessController] Error checking page access:`, err);
    next(err);
  }
};
