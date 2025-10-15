import React from "react";
import { Link, useLocation } from "react-router-dom";
import "../Styles/UnifiedSidebar.css";

const UnifiedSidebar = ({ userType = "driver" }) => {
  const location = useLocation();
  
  // Get user info from token instead of useAuth
  const getUserInfo = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch {
      return null;
    }
  };

  const user = getUserInfo();

 
  const getNavigationItems = () => {
    switch (userType) {
      case "driver":
        return [
          { label: "HOME", path: "/", isActive: location.pathname === "/" },
          { label: "MY FRANCHISE", path: "/driver/franchise", isActive: location.pathname === "/driver/franchise" },
          { label: "DRIVER ID", path: "/driver/id", isActive: location.pathname === "/driver/id" },
          { label: "VERIFY TRICYCLE", path: "/login", isActive: false }
        ];
      case "admin":
        return [
          { label: "DASHBOARD", path: "/admin", isActive: location.pathname === "/admin" },
          { label: "USER MANAGEMENT", path: "/user-management", isActive: location.pathname === "/user-management" },
          { label: "REPORTS", path: "/reports", isActive: location.pathname === "/reports" }
        ];
      default:
        return [
          { label: "HOME", path: "/", isActive: location.pathname === "/" },
          { label: "ABOUT US", path: "/", isActive: false },
          { label: "VERIFY TRICYCLE", path: "/login", isActive: false },
          { label: "NEW APPLICATION", path: "/login", isActive: false }
        ];
    }
  };

  const navigationItems = getNavigationItems();

  return (
    <div className="unified-sidebar-container">
     
      <div className="sidebar-header">
        <div className="logo-section">
          <img src="/Logos/TRC-vLogo.png" alt="TRC-V Logo" className="sidebar-logo" />
          <div className="title-section">
            <div className="trc-title">
              <span className="trc-yellow">TRC</span>
              <span className="trc-white">-V</span>
            </div>
            <div className="trc-subtitle">TRICYCLE VERIFICATION SYSTEM</div>
          </div>
        </div>

        <nav className="unified-sidebar">
          <div className="sidebar-nav-container">
            <div className="nav-items-wrapper">
              {navigationItems.map((item, index) => (
                <Link
                  key={index}
                  to={item.path}
                  className={`nav-link ${item.isActive ? 'active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}
              
              <div className="user-section">
                <span className="user-label">{user?.name || "USER"}</span>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default UnifiedSidebar;