import { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';

/**
 * Custom hook to check if current user's role has access to a specific page
 * @param {string} pageKey - The page key (e.g., 'dashboard', 'analytics')
 * @returns {object} { hasAccess: boolean, loading: boolean }
 */
export const usePageAccess = (pageKey) => {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Get token and decode to get role
        const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
        if (!token) {
          console.warn('[usePageAccess] No token found');
          setHasAccess(false);
          setLoading(false);
          return;
        }

        // Decode token to get role
        const payload = JSON.parse(atob(token.split('.')[1]));
        const role = payload.role;

        if (!role) {
          console.warn('[usePageAccess] No role in token');
          setHasAccess(false);
          setLoading(false);
          return;
        }

        console.log(`[usePageAccess] Checking access for role: ${role}, page: ${pageKey}`);

        // Super admin always has access
        if (role === 'super-admin') {
          console.log('[usePageAccess] Super admin - granting access');
          setHasAccess(true);
          setLoading(false);
          return;
        }

        // Fetch page access from backend - Get all pages for role
        const response = await fetch(`${API_BASE_URL}/api/role-page-access/${role}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`[usePageAccess] API response for ${role}:`, result);
          
          if (result.success && result.data && result.data.allowedPages) {
            const hasPageAccess = result.data.allowedPages.includes(pageKey);
            console.log(`[usePageAccess] ${role} has access to ${pageKey}: ${hasPageAccess}`);
            setHasAccess(hasPageAccess);
          } else {
            console.warn('[usePageAccess] Invalid API response structure');
            // Fallback to default permissions
            const defaults = getDefaultPageAccess(role);
            const hasPageAccess = defaults.includes(pageKey);
            console.log(`[usePageAccess] Using defaults - ${role} has access to ${pageKey}: ${hasPageAccess}`);
            setHasAccess(hasPageAccess);
          }
        } else {
          console.error(`[usePageAccess] API failed with status: ${response.status}`);
          // Fallback to default permissions if API fails
          const defaults = getDefaultPageAccess(role);
          const hasPageAccess = defaults.includes(pageKey);
          console.log(`[usePageAccess] Using defaults - ${role} has access to ${pageKey}: ${hasPageAccess}`);
          setHasAccess(hasPageAccess);
        }
      } catch (error) {
        console.error('[usePageAccess] Error checking page access:', error);
        // Try fallback
        try {
          const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const defaults = getDefaultPageAccess(payload.role);
            const hasPageAccess = defaults.includes(pageKey);
            console.log(`[usePageAccess] Exception fallback - ${payload.role} has access to ${pageKey}: ${hasPageAccess}`);
            setHasAccess(hasPageAccess);
          } else {
            setHasAccess(false);
          }
        } catch {
          setHasAccess(false);
        }
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [pageKey]);

  return { hasAccess, loading };
};

/**
 * Hook to get all allowed pages for current user's role
 * @returns {object} { allowedPages: string[], loading: boolean }
 */
export const useAllowedPages = () => {
  const [allowedPages, setAllowedPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllowedPages = async () => {
      try {
        const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
        if (!token) {
          setAllowedPages([]);
          setLoading(false);
          return;
        }

        // Decode token to get role
        const payload = JSON.parse(atob(token.split('.')[1]));
        const role = payload.role;

        if (!role) {
          setAllowedPages([]);
          setLoading(false);
          return;
        }

        // Fetch page access from backend
        const response = await fetch(`${API_BASE_URL}/api/role-page-access/${role}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setAllowedPages(result.data.allowedPages || []);
          }
        } else {
          // Fallback to defaults
          setAllowedPages(getDefaultPageAccess(role));
        }
      } catch (error) {
        console.error('[useAllowedPages] Error fetching allowed pages:', error);
        // Try to use defaults
        const token = sessionStorage.getItem('accessToken');
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setAllowedPages(getDefaultPageAccess(payload.role));
          } catch {
            setAllowedPages([]);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAllowedPages();
  }, []);

  return { allowedPages, loading };
};

// Default fallback permissions
function getDefaultPageAccess(role) {
  const defaults = {
    'super-admin': [
      'dashboard', 'franchisee-list', 'franchise-management', 'certificate', 'incident-reports',
      'analytics', 'announcements', 'audit-trail', 'admin-management', 'settings'
    ],
    'sb-admin': [
      'dashboard', 'franchisee-list', 'franchise-management', 'certificate', 'incident-reports'
    ],
    'bplo-admin': [
      'dashboard', 'franchisee-list', 'franchise-management', 'certificate', 'incident-reports'
    ]
  };
  return defaults[role] || [];
}
