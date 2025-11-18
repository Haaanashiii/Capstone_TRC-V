import React, { useState, useEffect, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import '../../Styles/Administrator_Css/Sidebar.css'
import logoImage from '../../assets/TRC-vLogo.png'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ListAltIcon from '@mui/icons-material/ListAlt'
import BusinessIcon from '@mui/icons-material/Business'
import AssessmentIcon from '@mui/icons-material/Assessment'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import LogoutIcon from '@mui/icons-material/Logout'
import CampaignIcon from '@mui/icons-material/Campaign'

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLogout, setShowLogout] = useState(false);
  const [user, setUser] = useState(null);
  const [tokenChecked, setTokenChecked] = useState(false);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  // Get user info from sessionStorage token (JWT is single source of truth)
  // Only run once on mount
  useEffect(() => {
    if (tokenChecked) return;
    
    const token = sessionStorage.getItem('accessToken');
    
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        // JWT now contains: { id, role, name, accountType, hasOperator }
        setUser(decoded);
      } catch (error) {
        console.error('[AdminSidebar] Error decoding token:', error);
      }
    }
    
    setTokenChecked(true);
  }, [tokenChecked]);

  const handleLogout = async () => {
    console.log('[AdminSidebar] Logout initiated');
    
    try {
      // Call backend to invalidate refresh token
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
      const token = sessionStorage.getItem('accessToken');
      
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        console.log('[AdminSidebar] Backend logout successful');
      }
    } catch (error) {
      console.error('[AdminSidebar] Backend logout failed:', error);
    } finally {
      // Always clear frontend storage
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('userFranchiseInfo');
      sessionStorage.removeItem('franchiseLinked');
      sessionStorage.removeItem('franchiseMenuReplaced');
      sessionStorage.removeItem('franchiseOwnerUserId');
      console.log('[AdminSidebar] Storage cleared, navigating to login');
      navigate('/login');
    }
  };

  const toggleLogout = () => {
    setShowLogout(!showLogout);
  };

  // Memoize first name - only recalculate when user changes (JWT now contains: id, role, name, accountType, hasOperator)
  const firstName = useMemo(() => {
    if (!user) return 'User';
    
    if (user?.firstName) return user.firstName;
    if (user?.name) {
      // If full name is stored, split and get first name
      return user.name.split(' ')[0];
    }
    
    return 'Admin';
  }, [user]);

  // Memoize role display - only recalculate when user changes
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

  const menuItems = [
    { name: 'Dashboard', icon: <DashboardIcon />, path: '/sb-admin/dashboard' },
    { name: 'Franchisee List', icon: <ListAltIcon />, path: '/sb-admin/franchisee-list' },
    { name: 'Franchise Management', icon: <BusinessIcon />, path: '/sb-admin/franchise-management' },
    { name: 'Reports', icon: <AssessmentIcon />, path: '/sb-admin/reports' },
    { name: 'Announcements', icon: <CampaignIcon />, path: '/sb-admin/announcements' },
    { name: 'User Management', icon: <PeopleAltIcon />, path: '/sb-admin/user-management' }

  ]

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
          {menuItems.map((item) => (
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

export default Sidebar