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

// Define all possible menu items with the roles that can access them
const allMenuItems = [
  { name: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', allowedRoles: ['super-admin', 'sb-admin', 'bplo-admin'] },
  { name: 'Franchisee List', icon: <ListAltIcon />, path: '/franchisee-list', allowedRoles: ['super-admin', 'sb-admin', 'bplo-admin'] },
  { name: 'Franchise Management', icon: <BusinessIcon />, path: '/franchise-management', allowedRoles: ['super-admin', 'sb-admin', 'bplo-admin'] },
  { name: 'Reports', icon: <AssessmentIcon />, path: '/reports', allowedRoles: ['super-admin', 'sb-admin', 'bplo-admin'] },
  { name: 'Fare Overpricing Report', icon: <AssessmentIcon />, path: '/fare-reports', allowedRoles: ['super-admin', 'sb-admin', 'bplo-admin'] },
  { name: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics', allowedRoles: ['super-admin'] },
  { name: 'Announcements', icon: <CampaignIcon />, path: '/announcements', allowedRoles: ['super-admin'] },
  { name: 'Audit Trail', icon: <HistoryIcon />, path: '/audit-trail', allowedRoles: ['super-admin'] },
  { name: 'User Management', icon: <PeopleAltIcon />, path: '/user-management', allowedRoles: ['super-admin'] },
  { name: 'Settings', icon: <SettingsIcon />, path: '/settings', allowedRoles: ['super-admin'] }
];

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLogout, setShowLogout] = useState(false);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);
  
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

  // Filter menu items based on the current user's role
  const visibleMenuItems = useMemo(() => {
    // Don't filter while loading - wait for user data
    if (loading) return [];
    if (!user?.role) return [];
    return allMenuItems.filter(item => item.allowedRoles.includes(user.role));
  }, [user, loading]);

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