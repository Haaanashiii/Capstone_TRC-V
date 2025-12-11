/**
 * usePermissionSync Hook
 * 
 * Custom hook for real-time permission synchronization via WebSocket.
 * Automatically updates when role permissions change on the server.
 * Optionally redirects users away from pages they no longer have access to.
 * 
 * @example
 * import { usePermissionSync } from '../hooks/usePermissionSync';
 * import { useNavigate, useLocation } from 'react-router-dom';
 * 
 * function MyComponent() {
 *   const navigate = useNavigate();
 *   const location = useLocation();
 *   const { allowedPages, isLoading, hasAccess } = usePermissionSync({
 *     autoRedirect: true,
 *     navigate,
 *     currentPath: location.pathname
 *   });
 *   
 *   if (isLoading) return <Loading />;
 *   
 *   return (
 *     <div>
 *       {hasAccess('dashboard') && <DashboardLink />}
 *     </div>
 *   );
 * }
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import websocketService from '../services/websocket';
import { useAuth } from '../contexts/AuthContext';
import { showWarning } from '../utils/sweetAlert';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';

// Valid page keys for validation
const VALID_PAGE_KEYS = [
  'dashboard',
  'franchisee-list',
  'franchise-management',
  'certificate',
  'incident-reports',
  'analytics',
  'announcements',
  'audit-trail',
  'admin-management',
  'settings'
];

// Default pages per role
const DEFAULT_PAGES = {
  'super-admin': VALID_PAGE_KEYS,
  'sb-admin': ['dashboard', 'franchisee-list', 'franchise-management', 'certificate', 'incident-reports'],
  'bplo-admin': ['dashboard', 'franchisee-list', 'franchise-management', 'certificate', 'incident-reports']
};

/**
 * Get cached pages from sessionStorage
 */
const getCachedPages = (role) => {
  try {
    const cached = sessionStorage.getItem(`allowedPages_${role}`);
    if (cached) {
      const pages = JSON.parse(cached);
      // Validate cached pages
      return pages.filter(p => VALID_PAGE_KEYS.includes(p));
    }
  } catch (e) {
    console.warn('[usePermissionSync] Failed to parse cached pages');
  }
  return null;
};

/**
 * Cache pages in sessionStorage
 */
const setCachedPages = (role, pages) => {
  try {
    // Filter to only valid keys before caching
    const validPages = pages.filter(p => VALID_PAGE_KEYS.includes(p));
    sessionStorage.setItem(`allowedPages_${role}`, JSON.stringify(validPages));
  } catch (e) {
    console.warn('[usePermissionSync] Failed to cache pages');
  }
};

/**
 * Clear cached pages for a role
 */
export const clearCachedPages = (role) => {
  try {
    sessionStorage.removeItem(`allowedPages_${role}`);
  } catch (e) {
    console.warn('[usePermissionSync] Failed to clear cached pages');
  }
};

/**
 * Hook for real-time permission synchronization
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoConnect - Auto-connect to WebSocket (default: true)
 * @param {boolean} options.autoRedirect - Auto-redirect when access is revoked (default: false)
 * @param {Function} options.navigate - React Router navigate function (required if autoRedirect is true)
 * @param {string} options.currentPath - Current page path (required if autoRedirect is true)
 */
export function usePermissionSync(options = {}) {
  const { 
    autoConnect = true, 
    autoRedirect = false, 
    navigate = null, 
    currentPath = null 
  } = options;
  const { user } = useAuth();
  const role = user?.role;
  
  // Initialize state with cached data to prevent flicker
  const [allowedPages, setAllowedPages] = useState(() => {
    if (role) {
      return getCachedPages(role) || DEFAULT_PAGES[role] || [];
    }
    return [];
  });
  
  const [isLoading, setIsLoading] = useState(() => {
    if (role) {
      return !getCachedPages(role);
    }
    return false;
  });
  
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Track if component is mounted
  const isMountedRef = useRef(true);

  // Map paths to page keys
  const pathToPageKey = {
    '/dashboard': 'dashboard',
    '/franchisee-list': 'franchisee-list',
    '/franchise-management': 'franchise-management',
    '/certificate': 'certificate',
    '/incident-reports': 'incident-reports',
    '/analytics': 'analytics',
    '/announcements': 'announcements',
    '/audit-trail': 'audit-trail',
    '/admin-management': 'admin-management',
    '/settings': 'settings'
  };

  /**
   * Check if current page access is revoked and redirect if needed
   */
  const checkAndRedirectIfNeeded = useCallback((newAllowedPages) => {
    if (!autoRedirect || !navigate || !currentPath) return;
    
    const currentPageKey = pathToPageKey[currentPath];
    
    if (currentPageKey && !newAllowedPages.includes(currentPageKey)) {
      console.log(`[usePermissionSync] Current page "${currentPageKey}" is no longer accessible`);
      
      // Find redirect target
      let redirectPath = '/dashboard';
      if (newAllowedPages.includes('dashboard')) {
        redirectPath = '/dashboard';
      } else if (newAllowedPages.length > 0) {
        // Find the first valid page
        const firstPageKey = newAllowedPages[0];
        const pageKeyToPath = Object.entries(pathToPageKey).reduce((acc, [path, key]) => {
          acc[key] = path;
          return acc;
        }, {});
        redirectPath = pageKeyToPath[firstPageKey] || '/dashboard';
      }
      
      showWarning(
        'Your access to this page has been revoked by an administrator. You will be redirected.',
        'Access Revoked'
      ).then(() => {
        navigate(redirectPath, { replace: true });
      });
    }
  }, [autoRedirect, navigate, currentPath]);

  /**
   * Fetch permissions from API
   */
  const fetchPermissions = useCallback(async (showLoading = false) => {
    if (!role) {
      setIsLoading(false);
      return;
    }

    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
      if (!token) {
        const defaultPages = DEFAULT_PAGES[role] || [];
        setAllowedPages(defaultPages);
        setCachedPages(role, defaultPages);
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/role-page-access/${role}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!isMountedRef.current) return;

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const pages = (result.data.allowedPages || []).filter(p => VALID_PAGE_KEYS.includes(p));
          setAllowedPages(pages);
          setCachedPages(role, pages);
          setLastUpdated(new Date());
          setError(null);
        }
      } else {
        throw new Error('Failed to fetch permissions');
      }
    } catch (err) {
      console.error('[usePermissionSync] Fetch error:', err);
      if (isMountedRef.current) {
        setError(err.message);
        // Use cached or default on error
        const cached = getCachedPages(role);
        if (!cached) {
          const defaultPages = DEFAULT_PAGES[role] || [];
          setAllowedPages(defaultPages);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [role]);

  /**
   * Check if user has access to a specific page
   */
  const hasAccess = useCallback((pageKey) => {
    return allowedPages.includes(pageKey);
  }, [allowedPages]);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchPermissions();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchPermissions]);

  // WebSocket subscription for real-time updates
  useEffect(() => {
    if (!role || !autoConnect) return;

    // Ensure WebSocket is connected
    if (!websocketService.isConnected()) {
      websocketService.connect('general');
    }

    /**
     * Handle permission update event from server
     */
    const handlePageAccessUpdate = (data) => {
      console.log('[usePermissionSync] Received page-access-updated:', data);
      
      // Only process if it affects current user's role
      if (data.role === role) {
        if (Array.isArray(data.allowedPages)) {
          const validPages = data.allowedPages.filter(p => VALID_PAGE_KEYS.includes(p));
          setAllowedPages(validPages);
          setCachedPages(role, validPages);
          setLastUpdated(new Date(data.updatedAt || Date.now()));
          setError(null);
          console.log('[usePermissionSync] Permissions updated in real-time for role:', role);
          
          // Check if user needs to be redirected from current page
          checkAndRedirectIfNeeded(validPages);
        } else {
          // Fallback: refetch from API
          fetchPermissions(false);
        }
      }
    };

    /**
     * Handle role-specific permission change notification
     */
    const handleRolePermissionsChanged = (data) => {
      console.log('[usePermissionSync] Received role-permissions-changed:', data);
      
      if (data.role === role) {
        // Refetch to get latest permissions
        fetchPermissions(false);
      }
    };

    // Subscribe to events
    websocketService.on('page-access-updated', handlePageAccessUpdate);
    websocketService.on('role-permissions-changed', handleRolePermissionsChanged);

    // Cleanup
    return () => {
      websocketService.off('page-access-updated', handlePageAccessUpdate);
      websocketService.off('role-permissions-changed', handleRolePermissionsChanged);
    };
  }, [role, autoConnect, fetchPermissions, checkAndRedirectIfNeeded]);

  return {
    allowedPages,
    isLoading,
    error,
    lastUpdated,
    hasAccess,
    refetch: fetchPermissions,
    clearCache: () => clearCachedPages(role),
    checkAndRedirectIfNeeded
  };
}

export default usePermissionSync;
