import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
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

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';

// Map page keys to menu items
const pageKeyToMenuItem = {
  'dashboard': { name: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  'franchisee-list': { name: 'Franchisee List', icon: <ListAltIcon />, path: '/franchisee-list' },
  'franchise-management': { name: 'Franchise Management', icon: <BusinessIcon />, path: '/franchise-management' },
  'certificate': { name: 'Certificate', icon: <AssessmentIcon />, path: '/certificate' },
  'fare-reports': { name: 'Fare Overpricing Report', icon: <AssessmentIcon />, path: '/fare-reports' },
  'analytics': { name: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
  'announcements': { name: 'Announcements', icon: <CampaignIcon />, path: '/announcements' },
  'audit-trail': { name: 'Audit Trail', icon: <HistoryIcon />, path: '/audit-trail' },
  'user-management': { name: 'User Management', icon: <PeopleAltIcon />, path: '/user-management' },
  'settings': { name: 'Settings', icon: <SettingsIcon />, path: '/settings' }
};

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLogout, setShowLogout] = useState(false);
  const [allowedPages, setAllowedPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(true);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  // Fetch allowed pages for current user's role
  useEffect(() => {
    const fetchAllowedPages = async () => {
      if (!user?.role) {
        setLoadingPages(false);
        return;
      }

      try {
        const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
        if (!token) {
          setLoadingPages(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/role-page-access/${user.role}`, {
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
          // If API fails, use default fallback
          console.warn('[Sidebar] Failed to fetch page access, using defaults');
          setAllowedPages(getDefaultPages(user.role));
        }
      } catch (error) {
        console.error('[Sidebar] Error fetching page access:', error);
        // Use default fallback on error
        setAllowedPages(getDefaultPages(user.role));
      } finally {
        setLoadingPages(false);
      }
    };

    fetchAllowedPages();
  }, [user?.role]);

  // Default fallback if API is not available
  const getDefaultPages = (role) => {
    const defaults = {
      'super-admin': ['dashboard', 'franchisee-list', 'franchise-management', 'certificate', 'fare-reports', 'analytics', 'announcements', 'audit-trail', 'user-management', 'settings'],
      'sb-admin': ['dashboard', 'franchisee-list', 'franchise-management', 'certificate', 'fare-reports'],
      'bplo-admin': ['dashboard', 'franchisee-list', 'franchise-management', 'certificate', 'fare-reports']
    };
    return defaults[role] || [];
  };
  
  const handleLogout = async () => {
    console.log('[AdminSidebar] Logout initiated');
    await logout();
    console.log('[AdminSidebar] Storage cleared, navigating to login');
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
    // Don't show menu while loading
    if (loading || loadingPages) return [];
    if (!user?.role) return [];
    if (allowedPages.length === 0) return [];

    // Convert allowed page keys to menu items
    return allowedPages
      .map(pageKey => pageKeyToMenuItem[pageKey])
      .filter(item => item !== undefined); // Filter out any undefined items
  }, [user, loading, loadingPages, allowedPages]);

  return (
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
  )
}

export default Sidebar;