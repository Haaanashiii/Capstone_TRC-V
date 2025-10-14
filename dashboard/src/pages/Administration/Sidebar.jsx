import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Sidebar.css'
import logoImage from '../../assets/TRC-vLogo.png'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ListAltIcon from '@mui/icons-material/ListAlt'
import BusinessIcon from '@mui/icons-material/Business'
import AssessmentIcon from '@mui/icons-material/Assessment'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'

function Sidebar() {
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  const menuItems = [
    { name: 'Dashboard', icon: <DashboardIcon />, path: '/admin/dashboard' },
    { name: 'Franchisee List', icon: <ListAltIcon />, path: '/admin/franchisee-list' },
    { name: 'Franchise Management', icon: <BusinessIcon />, path: '/admin/franchise-management' },
    { name: 'Reports', icon: <AssessmentIcon />, path: '/admin/reports' },
    { name: 'User Management', icon: <PeopleAltIcon />, path: '/admin/user-management' }
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

      <div className="user-profile">
        <AccountCircleIcon className="profile-image-fallback" />
        <div className="user-info">
          <div className="user-name">Luke Dominic</div>
          <div className="user-role">SB Employee</div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar