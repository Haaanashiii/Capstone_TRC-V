import React, { useState, useEffect } from 'react'
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

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLogout, setShowLogout] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  // Get user info from localStorage token
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setUser(decoded);
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('accessToken');
    navigate('/login');
  };

  const toggleLogout = () => {
    setShowLogout(!showLogout);
  };

  // Get first name from user object
  const getFirstName = () => {
    if (user?.firstName) return user.firstName;
    if (user?.name) {
      // If full name is stored, split and get first name
      return user.name.split(' ')[0];
    }
    if (user?.username) return user.username;
    return 'User';
  };

  // Get role display name
  const getRoleDisplay = () => {
    if (!user?.role) return 'Employee';
    
    // Map role codes to display names
    const roleMap = {
      'sb-admin': 'SB Employee',
      'bplo-admin': 'BPLO Employee',
      'operator': 'Operator',
      'admin': 'Administrator',
      'driver': 'Driver'
    };
    
    return roleMap[user.role] || user.role;
  };

  const menuItems = [
    { name: 'Dashboard', icon: <DashboardIcon />, path: '/sb-admin/dashboard' },
    { name: 'Franchisee List', icon: <ListAltIcon />, path: '/sb-admin/franchisee-list' },
    { name: 'Franchise Management', icon: <BusinessIcon />, path: '/sb-admin/franchise-management' },
    { name: 'Reports', icon: <AssessmentIcon />, path: '/sb-admin/reports' },
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
        <br />
        <span className="date-display"> 
          {currentTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
        </span>
      </div>

      <div className="user-profile" onClick={toggleLogout}>
        <AccountCircleIcon className="profile-image-fallback" />
        <div className="user-info">
          <div className="user-name">{getFirstName()}</div>
          <div className="user-role">{getRoleDisplay()}</div>
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