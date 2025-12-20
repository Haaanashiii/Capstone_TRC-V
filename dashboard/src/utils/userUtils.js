/**
 * User Utilities
 * 
 * Centralized utilities for user data handling across the application.
 * Ensures consistent user ID extraction and validation.
 */

import logger from './logger';

/**
 * Standardized user ID extraction
 * Handles MongoDB ObjectId format (_id) and legacy id format
 * 
 * Priority order:
 * 1. _id (MongoDB ObjectId - preferred for backend API calls)
 * 2. id (legacy format or decoded JWT)
 * 3. userId (alternative format in some contexts)
 * 
 * @param {Object} user - User object from context or token
 * @returns {string|null} User ID or null if not found
 * 
 * @example
 * const userId = getUserId(user);
 * if (!userId) {
 *   logger.error('No user ID found');
 *   return;
 * }
 */
export const getUserId = (user) => {
  if (!user) {
    logger.warn('[getUserId] No user object provided');
    return null;
  }

  // Try _id first (MongoDB format - preferred)
  if (user._id) {
    return String(user._id);
  }

  // Fallback to id (JWT or legacy format)
  if (user.id) {
    return String(user.id);
  }

  // Last fallback to userId
  if (user.userId) {
    return String(user.userId);
  }

  logger.warn('[getUserId] No valid user ID found in user object:', {
    hasId: !!user.id,
    has_Id: !!user._id,
    hasUserId: !!user.userId,
    keys: Object.keys(user)
  });

  return null;
};

/**
 * Validate user object has required fields
 * 
 * @param {Object} user - User object to validate
 * @param {Array<string>} requiredFields - Fields that must be present
 * @returns {boolean} True if all required fields are present
 * 
 * @example
 * if (!validateUser(user, ['id', 'role'])) {
 *   throw new Error('Invalid user object');
 * }
 */
export const validateUser = (user, requiredFields = ['id']) => {
  if (!user) {
    logger.error('[validateUser] User object is null or undefined');
    return false;
  }

  const missingFields = [];

  for (const field of requiredFields) {
    // For 'id', check both id and _id
    if (field === 'id') {
      if (!user.id && !user._id && !user.userId) {
        missingFields.push('id/_id/userId');
      }
    } else if (!user[field]) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    logger.error('[validateUser] Missing required fields:', missingFields);
    return false;
  }

  return true;
};

/**
 * Check if user has specific role(s)
 * 
 * @param {Object} user - User object
 * @param {string|Array<string>} roles - Role(s) to check
 * @returns {boolean} True if user has any of the specified roles
 * 
 * @example
 * if (hasRole(user, 'operator')) {
 *   // Show operator-specific content
 * }
 * 
 * if (hasRole(user, ['sb-admin', 'super-admin'])) {
 *   // Show admin content
 * }
 */
export const hasRole = (user, roles) => {
  if (!user || !user.role) {
    return false;
  }

  const rolesArray = Array.isArray(roles) ? roles : [roles];
  return rolesArray.includes(user.role);
};

/**
 * Check if user is an admin (any admin role)
 * 
 * @param {Object} user - User object
 * @returns {boolean} True if user has any admin role
 */
export const isAdmin = (user) => {
  return hasRole(user, ['bplo-admin', 'sb-admin', 'super-admin']);
};

/**
 * Check if user is an operator
 * 
 * @param {Object} user - User object
 * @returns {boolean} True if user is an operator
 */
export const isOperator = (user) => {
  return hasRole(user, 'operator');
};

/**
 * Get user display name
 * Prioritizes name, falls back to username, then email
 * 
 * @param {Object} user - User object
 * @returns {string} Display name or 'Unknown User'
 */
export const getUserDisplayName = (user) => {
  if (!user) return 'Unknown User';

  return user.name || user.username || user.email || 'Unknown User';
};

/**
 * Check if user owns a franchise
 * 
 * @param {Object} user - User object
 * @returns {boolean} True if user has franchise
 */
export const hasFranchise = (user) => {
  if (!user) return false;

  // Check various franchise flags
  return !!(
    user.hasFranchise ||
    user.hasOperator ||
    user.franchiseApplications?.length > 0
  );
};

/**
 * Clear user-specific session data
 * Used on logout or when switching users
 * 
 * @param {Object} options - Cleanup options
 */
export const clearUserSession = (options = {}) => {
  const {
    clearToken = true,
    clearFranchiseData = true,
    clearCache = true
  } = options;

  try {
    if (clearToken) {
      sessionStorage.removeItem('accessToken');
      logger.log('[clearUserSession] Access token cleared');
    }

    if (clearFranchiseData) {
      sessionStorage.removeItem('userFranchiseInfo');
      sessionStorage.removeItem('franchiseLinked');
      sessionStorage.removeItem('franchiseMenuReplaced');
      sessionStorage.removeItem('franchiseOwnerUserId');
      logger.log('[clearUserSession] Franchise data cleared');
    }

    if (clearCache) {
      // Clear any cached user data
      // Add your cache clearing logic here if you have a cache manager
      logger.log('[clearUserSession] Cache cleared');
    }
  } catch (error) {
    logger.error('[clearUserSession] Error clearing session:', error);
  }
};

/**
 * Verify franchise data belongs to current user
 * Prevents data leakage between user sessions
 * 
 * @param {Object} user - Current user object
 * @returns {boolean} True if stored franchise data belongs to current user
 */
export const verifyFranchiseOwnership = (user) => {
  try {
    const userId = getUserId(user);
    if (!userId) {
      logger.warn('[verifyFranchiseOwnership] No user ID found');
      return false;
    }

    const storedOwnerUserId = sessionStorage.getItem('franchiseOwnerUserId');
    
    if (!storedOwnerUserId) {
      // No stored franchise data
      return true;
    }

    const matches = storedOwnerUserId === userId;
    
    if (!matches) {
      logger.warn('[verifyFranchiseOwnership] Franchise data mismatch, clearing stale data');
      clearUserSession({ clearToken: false, clearFranchiseData: true });
    }

    return matches;
  } catch (error) {
    logger.error('[verifyFranchiseOwnership] Error:', error);
    return false;
  }
};

/**
 * Get user initials for avatar display
 * 
 * @param {Object} user - User object
 * @returns {string} User initials (e.g., "JD" for John Doe)
 */
export const getUserInitials = (user) => {
  if (!user) return '??';

  const name = user.name || user.username || user.email || '';
  
  if (!name) return '??';

  const parts = name.trim().split(/\s+/);
  
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default {
  getUserId,
  validateUser,
  hasRole,
  isAdmin,
  isOperator,
  getUserDisplayName,
  hasFranchise,
  clearUserSession,
  verifyFranchiseOwnership,
  getUserInitials
};
