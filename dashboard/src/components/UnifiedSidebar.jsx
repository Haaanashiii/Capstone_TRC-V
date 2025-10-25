import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  Button,
  styled
} from "@mui/material";

// Styled components for horizontal navbar
const StyledAppBar = styled(AppBar)(() => ({
  // Unified AppBar background so the navbar looks the same on every page
  backgroundColor: '#143c6e',
  position: 'sticky',
  top: 0,
  zIndex: 1000,
  boxShadow: 'none',
  borderBottom: 'none',
}));

const LogoSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
});

const TitleSection = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
});

const TrcTitle = styled(Typography)({
  fontSize: '32px',
  fontWeight: 900,
  letterSpacing: '2px',
  lineHeight: 1,
  marginBottom: '4px',
  '& .yellow': {
    color: '#ffe066', // brighter yellow used elsewhere in the project
  },
  '& .white': {
    color: 'white',
  },
});

const TrcSubtitle = styled(Typography)({
  fontSize: '13px',
  color: 'rgba(255,255,255,0.8)',
  letterSpacing: '1px',
  fontWeight: 500,
});

const NavigationSection = styled(Box)(() => ({
  backgroundColor: 'white',
  borderRadius: '25px',
  display: 'flex',
  alignItems: 'center',
  padding: '6px 14px',
  minWidth: '200px',
  // allow a sensible max so it won't cause horizontal scroll
  maxWidth: '720px',
  marginLeft: '12px',
  marginRight: '12px',
  gap: '12px',
  overflow: 'hidden',
  boxShadow: 'none'
}));

const NavButton = styled(Button)(({ isActive }) => ({
  color: isActive ? 'white' : '#111',
  backgroundColor: isActive ? '#143c6e' : 'transparent', // active uses the requested blue
  fontWeight: 600,
  padding: '8px 12px',
  borderRadius: '18px',
  fontSize: '14px',
  textTransform: 'none',
  minWidth: 'auto',
  whiteSpace: 'nowrap',
  '&:hover': {
    backgroundColor: isActive ? '#143c6e' : '#f0f0f0',
    transform: 'translateY(-2px)',
  },
  flexShrink: 0,
}));

const UserSection = styled(Box)(() => ({
  backgroundColor: '#143c6e', // keep the user pill blue so it reads on the page
  color: 'white',
  borderRadius: '18px',
  padding: '6px 20px',
  display: 'flex',
  alignItems: 'center',
  fontWeight: 600,
  minWidth: 'fit-content',
  flexShrink: 0,
  marginLeft: '12px',
  boxShadow: 'none'
}));

// Small language buttons (EN / TAG)
const LangButton = styled(Button)(({ active }) => ({
  padding: '6px 10px',
  borderRadius: '12px',
  fontWeight: 800,
  fontSize: '12px',
  textTransform: 'none',
  minWidth: '40px',
  boxShadow: 'none',
  border: active ? 'none' : '1px solid rgba(255,255,255,0.12)',
  background: active ? '#ffe066' : 'transparent',
  color: active ? '#143c6e' : '#fff',
  marginLeft: 8,
  '&:hover': {
    background: active ? '#ffe066' : 'rgba(255,255,255,0.06)'
  }
}));

const LangGroup = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginRight: 12,
}));

const UnifiedSidebar = ({ userType = "operator", language, onLanguageToggle, translations }) => {
  const location = useLocation();
  const [userDetails, setUserDetails] = useState(null);
  
  // Get user info from token
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

  // Fetch full user details from the server
  const fetchUserDetails = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
      console.log('Fetching user details from:', `${API_BASE_URL}/auth/me`);
      
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('User details received:', data);
        setUserDetails(data.user);
      } else {
        console.error('Failed to fetch user details:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  // Fetch user details on component mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Get token user data immediately
      const tokenUser = getUserInfo();
      if (tokenUser) {
        setUserDetails(tokenUser);
      }
      // Then try to fetch detailed user data
      fetchUserDetails();
    }
  }, []);

  const user = getUserInfo();
  // Helper to extract first name only for navbar display
  const getFirstName = (fullName) => {
    if (!fullName) return 'USER';
    const parts = String(fullName).trim().split(/\s+/);
    return parts[0] || fullName;
  };
  const displayName = getFirstName(userDetails?.name || userDetails?.username || user?.name);

  const getNavigationItems = () => {
    switch (userType) {
      case "operator":
        return [
          { label: "HOME", path: "/", isActive: location.pathname === "/" },
          { label: "MY FRANCHISE", path: "/operator/franchise", isActive: location.pathname === "/operator/franchise" },
          { label: "OPERATOR ID", path: "/operator/id", isActive: location.pathname === "/operator/id" },
          { label: "VERIFY TRICYCLE", path: "/login", isActive: false }
        ];
      case "admin": //for bplo-admin?
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
    <StyledAppBar position="sticky">
      <Toolbar sx={{ paddingTop: '12px', paddingBottom: '12px', paddingLeft: '32px', paddingRight: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', position: 'relative', overflowX: 'hidden' }}>
        
        {/* Logo and Title Section */}
        <LogoSection>
          <img 
            src="/Logos/TRC-vLogo.png" 
            alt="TRC-V Logo" 
            style={{ height: '58px', width: 'auto' }}
          />
          <TitleSection>
            <TrcTitle>
              <span className="yellow">TRC</span>
              <span className="white">-V</span>
            </TrcTitle>
            <TrcSubtitle>TRICYCLE VERIFICATION SYSTEM</TrcSubtitle>
          </TitleSection>
        </LogoSection>

  {/* Navigation Section */}
  {/* Center area: grow and center the nav so it appears visually centered between logo and language */}
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
    <NavigationSection sx={{ marginLeft: 0 }}>
      {/* Navigation Items */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '20px', whiteSpace: 'nowrap', justifyContent: 'center' }}>
        {navigationItems.map((item, index) => (
          <NavButton
            key={index}
            component={Link}
            to={item.path}
            isActive={item.isActive}
          >
            {item.label}
          </NavButton>
        ))}

        {/* User Section */}
        <UserSection>
          <Typography variant="body2" sx={{ fontSize: '14px' }}>
            {displayName}
          </Typography>
        </UserSection>
      </Box>
    </NavigationSection>

    {onLanguageToggle && (
      <LangGroup title={translations?.toggleLanguage || 'Language'} sx={{ marginLeft: 2 }}>
        <LangButton
          active={(language || 'en').toString().toLowerCase() === 'en'}
          onClick={() => onLanguageToggle('en')}
        >
          EN
        </LangButton>
        <LangButton
          active={(language || 'en').toString().toLowerCase() === 'tag' || (language || 'en').toString().toLowerCase() === 'tl'}
          onClick={() => onLanguageToggle('tag')}
        >
          TAG
        </LangButton>
      </LangGroup>
    )}
  </Box>
      </Toolbar>
    </StyledAppBar>
  );
};

export default UnifiedSidebar;