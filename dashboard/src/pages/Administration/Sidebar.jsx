import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import websocketService from '../../services/websocket';
import { showWarning } from '../../utils/sweetAlert';
import { logger } from '../../utils/logger';
import { getToken, rolePageAccessAPI } from '../Services/api';
import '../../Styles/Administrator_Css/Sidebar.css';
import logoImage from '../../assets/TRC-vLogo.png';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import BusinessIcon from '@mui/icons-material/Business';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import CampaignIcon from '@mui/icons-material/Campaign';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';

// Map page keys to menu items
const pageKeyToMenuItem = {
  'dashboard': { name: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  'franchisee-list': { name: 'Franchisee List', icon: <ListAltIcon />, path: '/franchisee-list' },
  'franchise-management': { name: 'Franchise Management', icon: <BusinessIcon />, path: '/franchise-management' },
  'franchise-linking': { name: 'Franchise Linking', icon: <LinkIcon />, path: '/franchise-linking' },
  'certificate': { name: 'Certificate', icon: <AssessmentIcon />, path: '/certificate' },
  'incident-reports': { name: 'Incident Reporting', icon: <AssessmentIcon />, path: '/incident-reports' },
  'analytics': { name: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
  'announcements': { name: 'Announcements', icon: <CampaignIcon />, path: '/announcements' },
  'audit-trail': { name: 'Audit Trail', icon: <HistoryIcon />, path: '/audit-trail' },
  'admin-management': { name: 'Admin Management', icon: <PeopleAltIcon />, path: '/admin-management' },
  'settings': { name: 'Settings', icon: <SettingsIcon />, path: '/settings' }
};

// Map paths to page keys (reverse lookup)
const pathToPageKey = Object.entries(pageKeyToMenuItem).reduce((acc, [key, item]) => {
  acc[item.path] = key;
  return acc;
}, {});

// Helper to get page key from current path
const getPageKeyFromPath = (pathname) => {
  return pathToPageKey[pathname] || null;
};

// Helper to get cached pages from sessionStorage
const getCachedPages = (role) => {
  try {
    const cached = sessionStorage.getItem(`allowedPages_${role}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    logger.warn('[Sidebar] Failed to parse cached pages');
  }
  return null;
};

// Helper to cache pages in sessionStorage
const setCachedPages = (role, pages) => {
  try {
    sessionStorage.setItem(`allowedPages_${role}`, JSON.stringify(pages));
  } catch (e) {
    logger.warn('[Sidebar] Failed to cache pages');
  }
};

// Default fallback pages if API is not available (moved outside component for use in useState initializer)
const getDefaultPages = (role) => {
  const defaults = {
    'super-admin': ['dashboard', 'franchisee-list', 'franchise-management', 'franchise-linking', 'certificate', 'incident-reports', 'analytics', 'announcements', 'audit-trail', 'admin-management', 'settings'],
    'sb-admin': ['dashboard', 'franchisee-list', 'franchise-management', 'franchise-linking', 'certificate', 'incident-reports'],
    'bplo-admin': ['dashboard', 'franchisee-list', 'franchise-management', 'certificate', 'incident-reports']
  };
  return defaults[role] || [];
};

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLogout, setShowLogout] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);
  
  // Initialize with cached pages to prevent flicker
  const [allowedPages, setAllowedPages] = useState(() => {
    if (user?.role) {
      return getCachedPages(user.role) || getDefaultPages(user.role);
    }
    return [];
  });
  // Only show loading if we don't have any cached pages
  const [loadingPages, setLoadingPages] = useState(() => {
    if (user?.role) {
      return !getCachedPages(user.role);
    }
    return false;
  });

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  // Handle window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // Close more menu when resizing
      if (!mobile) {
        setShowMoreMenu(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close more menu when navigating
  useEffect(() => {
    setShowMoreMenu(false);
  }, [location.pathname]);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    };

    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMoreMenu]);

  // Toggle more menu
  const toggleMoreMenu = useCallback(() => {
    setShowMoreMenu(prev => !prev);
  }, []);

  // Fetch allowed pages from API
  const fetchAllowedPages = useCallback(async (showLoadingState = false) => {
    if (!user?.role) {
      setLoadingPages(false);
      return;
    }

    // Check if we have cached data - if so, don't show loading state
    const cached = getCachedPages(user.role);
    if (cached && !showLoadingState) {
      setAllowedPages(cached);
      setLoadingPages(false);
    }

    try {
      const response = await rolePageAccessAPI.getByRole(user.role);
      const result = response.data;

      if (result?.success && result?.data) {
        const pages = result.data.allowedPages || [];
        setAllowedPages(pages);
        setCachedPages(user.role, pages);
      } else {
        // If API fails and no cache, use default fallback
        if (!cached) {
          logger.warn('[Sidebar] Invalid response, using defaults');
          const defaultPages = getDefaultPages(user.role);
          setAllowedPages(defaultPages);
          setCachedPages(user.role, defaultPages);
        }
      }
    } catch (error) {
      logger.error('[Sidebar] Error fetching page access:', error?.message || 'Unknown error');
      // Use default fallback on error if no cache
      if (!cached) {
        const defaultPages = getDefaultPages(user.role);
        setAllowedPages(defaultPages);
        setCachedPages(user.role, defaultPages);
      }
    } finally {
      setLoadingPages(false);
    }
  }, [user?.role]);

  // Initial fetch of allowed pages
  useEffect(() => {
    fetchAllowedPages();
  }, [fetchAllowedPages]);

  // Helper function to check if user should be redirected
  const checkAndRedirectIfNeeded = useCallback((newAllowedPages) => {
    const currentPageKey = getPageKeyFromPath(location.pathname);
    
    // If user is on a page that's no longer accessible
    if (currentPageKey && !newAllowedPages.includes(currentPageKey)) {
      logger.log(`[Sidebar] Current page "${currentPageKey}" is no longer accessible, redirecting...`);
      
      // Find the first accessible page to redirect to
      // Priority: dashboard > first available page
      let redirectPath = '/dashboard';
      
      if (newAllowedPages.includes('dashboard')) {
        redirectPath = '/dashboard';
      } else if (newAllowedPages.length > 0) {
        // Redirect to the first available page
        const firstPage = pageKeyToMenuItem[newAllowedPages[0]];
        if (firstPage) {
          redirectPath = firstPage.path;
        }
      }
      
      // Show a styled notification and redirect
      showWarning(
        'Your access to this page has been revoked by an administrator. You will be redirected to another page.',
        'Access Revoked'
      ).then(() => {
        navigate(redirectPath, { replace: true });
      });
    }
  }, [location.pathname, navigate]);

  // WebSocket listener for real-time permission updates
  useEffect(() => {
    if (!user?.role) return;

    // Connect to WebSocket if not already connected
    if (!websocketService.isConnected()) {
      websocketService.connect('general');
    }

    // Handler for permission updates
    const handlePageAccessUpdate = (data) => {
      logger.log('[Sidebar] Received page-access-updated event:', data);
      
      // Only update if the change affects the current user's role
      if (data.role === user.role) {
        logger.log('[Sidebar] Updating permissions for current user role:', user.role);
        
        // Update state with new permissions
        if (Array.isArray(data.allowedPages)) {
          setAllowedPages(data.allowedPages);
          setCachedPages(user.role, data.allowedPages);
          
          // Check if user needs to be redirected from current page
          checkAndRedirectIfNeeded(data.allowedPages);
        } else {
          // If allowedPages not in event, refetch from API
          fetchAllowedPages(false);
        }
      }
    };

    // Handler for role-specific permission change notification
    const handleRolePermissionsChanged = (data) => {
      logger.log('[Sidebar] Received role-permissions-changed event:', data);
      
      if (data.role === user.role) {
        // Refetch permissions when notified of changes
        fetchAllowedPages(false);
      }
    };

    // Subscribe to permission update events
    websocketService.on('page-access-updated', handlePageAccessUpdate);
    websocketService.on('role-permissions-changed', handleRolePermissionsChanged);

    // Cleanup on unmount
    return () => {
      websocketService.off('page-access-updated', handlePageAccessUpdate);
      websocketService.off('role-permissions-changed', handleRolePermissionsChanged);
    };
  }, [user?.role, fetchAllowedPages, checkAndRedirectIfNeeded]);
  
  const handleLogout = async () => {
    logger.log('[AdminSidebar] Logout initiated');
    await logout();
    logger.log('[AdminSidebar] Storage cleared, navigating to login');
    navigate('/login');
  };

  const toggleLogout = () => {
    setShowLogout(!showLogout);
  };

  const firstName = useMemo(() => {
    if (!user) return 'User';
    if (user?.firstName) return user.firstName;
    if (user?.name) return user.name.split(' ')[0];
    return 'Admin';
  }, [user]);

  const roleDisplay = useMemo(() => {
    if (!user?.role) return 'Employee';
    const roleMap = {
      'super-admin': 'Super Administrator',
      'sb-admin': 'SB Employee',
      'bplo-admin': 'BPLO Employee',
      'operator': 'Operator',
      'admin': 'Administrator',
      'driver': 'Driver'
    };
    return roleMap[user.role] || user.role;
  }, [user]);

  // Build menu items based on allowed pages from database
  const visibleMenuItems = useMemo(() => {
    // Only block rendering if auth is still loading and we have no pages at all
    if (loading && allowedPages.length === 0) return [];
    if (!user?.role) return [];
    if (allowedPages.length === 0) return [];

    // Convert allowed page keys to menu items
    // Show cached/default pages even while fetching to prevent flicker
    return allowedPages
      .map(pageKey => pageKeyToMenuItem[pageKey])
      .filter(item => item !== undefined); // Filter out any undefined items
  }, [user, loading, allowedPages]);

  // Priority order for bottom nav (most commonly used pages first)
  const PRIORITY_PAGES = ['dashboard', 'franchisee-list', 'franchise-management', 'certificate'];
  
  // Split menu items for mobile bottom nav
  const { primaryNavItems, moreNavItems } = useMemo(() => {
    const primary = [];
    const more = [];
    
    // First, add priority pages that are in visibleMenuItems
    PRIORITY_PAGES.forEach(pageKey => {
      const item = visibleMenuItems.find(i => i.path === pageKeyToMenuItem[pageKey]?.path);
      if (item && primary.length < 4) {
        primary.push(item);
      }
    });
    
    // Add remaining items to "more" menu
    visibleMenuItems.forEach(item => {
      if (!primary.includes(item)) {
        more.push(item);
      }
    });
    
    return { primaryNavItems: primary, moreNavItems: more };
  }, [visibleMenuItems]);

  // Check if current page is in the "more" menu
  const isMoreActive = useMemo(() => {
    return moreNavItems.some(item => item.path === location.pathname);
  }, [moreNavItems, location.pathname]);

  return (
    <>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="logo">
              <img src={logoImage} alt="TRC-V Logo" className="logo-icon" />
              <span className="logo-text">
                <span className="blue-text">TR</span>
                <span className="yellow-text">C-V</span>
              </span>
            </div>
            <div className="system-name">TRICYCLE VERIFICATION SYSTEM</div>
            <div className="divider"></div>
          </div>

          <div className="sidebar-items">
            <ul>
              {visibleMenuItems.map((item) => (
                <li
                  key={item.name}
                  className={location.pathname === item.path ? 'active' : ''}
                >
                  <Link to={item.path}>
                    <span className="menu-icon">{item.icon}</span>
                    <span className="menu-text">{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="timeanddate"> 
            <span className="time-display">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="date-display"> 
              {currentTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
            </span>
          </div>

          <div className="user-profile" onClick={toggleLogout}>
            <AccountCircleIcon className="profile-image-fallback" />
            <div className="user-info">
              <div className="user-name">{firstName}</div>
              <div className="user-role">{roleDisplay}</div>
            </div>
            {showLogout && (
              <div className="logout-dropdown" onClick={(e) => e.stopPropagation()}>
                <button className="logout-button" onClick={handleLogout}>
                  <LogoutIcon className="logout-icon" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {/* Primary Nav Items */}
          {primaryNavItems.map((item) => (
            <Link 
              key={item.name}
              to={item.path}
              className={`mobile-nav-item ${location.pathname === item.path ? 'active' : ''}`}
              aria-current={location.pathname === item.path ? 'page' : undefined}
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.name.split(' ')[0]}</span>
            </Link>
          ))}
          
          {/* More Menu Button */}
          {moreNavItems.length > 0 && (
            <div className="mobile-nav-more-container" ref={moreMenuRef}>
              <button 
                className={`mobile-nav-item mobile-nav-more ${showMoreMenu || isMoreActive ? 'active' : ''}`}
                onClick={toggleMoreMenu}
                aria-expanded={showMoreMenu}
                aria-haspopup="true"
                aria-label="More options"
              >
                <span className="mobile-nav-icon">
                  {showMoreMenu ? <CloseIcon /> : <MoreHorizIcon />}
                </span>
                <span className="mobile-nav-label">More</span>
              </button>
              
              {/* More Menu Popup */}
              {showMoreMenu && (
                <div className="more-menu-popup" role="menu">
                  <div className="more-menu-header">
                    <span className="more-menu-title">More Options</span>
                  </div>
                  <div className="more-menu-items">
                    {moreNavItems.map((item) => (
                      <Link
                        key={item.name}
                        to={item.path}
                        className={`more-menu-item ${location.pathname === item.path ? 'active' : ''}`}
                        role="menuitem"
                        onClick={() => setShowMoreMenu(false)}
                      >
                        <span className="more-menu-icon">{item.icon}</span>
                        <span className="more-menu-text">{item.name}</span>
                      </Link>
                    ))}
                  </div>
                  
                  {/* User Info & Logout in More Menu */}
                  <div className="more-menu-divider"></div>
                  <div className="more-menu-user">
                    <AccountCircleIcon className="more-menu-user-icon" />
                    <div className="more-menu-user-info">
                      <span className="more-menu-user-name">{firstName}</span>
                      <span className="more-menu-user-role">{roleDisplay}</span>
                    </div>
                  </div>
                  <button 
                    className="more-menu-logout"
                    onClick={handleLogout}
                  >
                    <LogoutIcon />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      )}
    </>
  )
}

export default Sidebar;