import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  styled
} from "@mui/material";
import PermIdentityIcon from '@mui/icons-material/PermIdentity';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from "../contexts/AuthContext";

// Styled components for horizontal navbar
const StyledAppBar = styled(AppBar)(() => ({

  backgroundColor: '#0a3970',
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
    color: '#ffe066',
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
  backgroundColor: 'transparent',
  color: 'white',
  borderRadius: '24px',
  padding: '6px 10px',
  display: 'flex',
  alignItems: 'center',
  fontWeight: 600,
  minWidth: 'fit-content',
  flexShrink: 0,
  marginLeft: '12px',
  boxShadow: 'none'
}));

const UserInnerPill = styled(Box)(() => ({
  backgroundColor: '#143c6e',
  color: '#fff',
  padding: '6px 18px',
  borderRadius: '18px',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
  boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  minWidth: 140,
  userSelect: 'none',
  '&:focus': { outline: 'none' },
  '&:active': { transform: 'none' }
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
  const navigate = useNavigate();
  const { user: authUser, logout, loading } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  // Build a friendly display name from AuthContext user or fall back to direct token decode
  const getDisplayName = () => {
    // First, try to use AuthContext user (preferred)
    if (authUser?.name) {
      const parts = String(authUser.name).trim().split(/\s+/);
      const first = parts[0];
      const last = parts.slice(1).join(' ');
      return last ? `${first} ${String(last).charAt(0).toUpperCase()}` : first;
    }
    
    // Fallback: directly decode token from sessionStorage (same as Admin Sidebar)
    try {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        if (decoded?.name) {
          const parts = String(decoded.name).trim().split(/\s+/);
          const first = parts[0];
          const last = parts.slice(1).join(' ');
          return last ? `${first} ${String(last).charAt(0).toUpperCase()}` : first;
        }
      }
    } catch (error) {
      console.error('[UnifiedSidebar] Error decoding token:', error);
    }
    
    return 'USER';
  };

  // Wait for loading to complete before displaying name
  const displayName = loading ? 'Loading...' : getDisplayName();

  const handleLogout = async () => {
    console.log('[UnifiedSidebar] Logout initiated');
    handleMenuClose();
    
    // use AuthContext logout then navigate to landing page
    try {
      await logout(); // Now async - calls backend and clears all tokens
      console.log('[UnifiedSidebar] Logout successful, navigating to home');
    } catch (error) {
      console.error('[UnifiedSidebar] Error during logout:', error);
      // AuthContext logout handles token cleanup even on error
    } finally {
      // Always navigate to home page after logout
      navigate('/');
    }
  };

  const handleGoToId = () => {
    handleMenuClose();
    navigate('/operator/id');
  };

  const getNavigationItems = () => {
    switch (userType) {
      case "operator": {
       
        let franchiseLabel = 'MY FRANCHISE'
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            const replaced = sessionStorage.getItem('franchiseMenuReplaced')
            const linked = sessionStorage.getItem('franchiseLinked')
            const storedOwnerUserId = sessionStorage.getItem('franchiseOwnerUserId')
            let tokenUserId = null
            try {
              const token = sessionStorage.getItem('accessToken')
              if (token) tokenUserId = JSON.parse(atob(token.split('.')[1])).id
            } catch {
              tokenUserId = null
            }

            const ownerMatches = storedOwnerUserId && tokenUserId && storedOwnerUserId === tokenUserId

           
            const effectiveReplaced = replaced === 'true' && ownerMatches
            const effectiveLinked = linked === 'true' && ownerMatches

            if (effectiveReplaced || effectiveLinked) franchiseLabel = 'REQUEST FOR AMENDMENT'
          }
        } catch {
          // ignore sessionStorage/token errors
        }

        // If label replaced, route to the Request Amendment page instead of the franchise page
        const franchisePath = franchiseLabel === 'REQUEST FOR AMENDMENT' ? '/request-amendment' : '/operator/franchise'
        return [
          { label: "HOME", path: "/", isActive: location.pathname === "/" },
          { label: franchiseLabel, path: franchisePath, isActive: location.pathname === franchisePath },
          { label: "OPERATOR ID", path: "/operator/id", isActive: location.pathname === "/operator/id" },
        ];
      }
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
          { label: "NEW APPLICATION", path: "/login", isActive: false }
        ];
    }
  };

  const navigationItems = getNavigationItems();

  return (
    <StyledAppBar position="sticky">
      <Toolbar sx={{ paddingTop: '12px', paddingBottom: '12px', paddingLeft: '32px', paddingRight: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', position: 'relative', overflowX: 'hidden' }}>
        
    
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

     
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {displayName && displayName !== 'USER' ? (
            <>
              <UserSection component="div">
                {/* Outer transparent pill with inner blue pill for name */}
                <UserInnerPill onClick={handleMenuOpen} aria-controls={menuOpen ? 'user-menu' : undefined} aria-haspopup="true">
                  {displayName}
                </UserInnerPill>
              </UserSection>
              <Menu
                id="user-menu"
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{ sx: { borderRadius: 2, minWidth: 200 } }}
              >
                <MenuItem onClick={handleGoToId}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <PermIdentityIcon fontSize="small" />
                  </ListItemIcon>
                  Operator ID
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  Logout
                </MenuItem>
              </Menu>
            </>
          ) : (
            <UserSection>
              <Typography variant="body2" sx={{ fontSize: '14px' }}>
                {displayName}
              </Typography>
            </UserSection>
          )}
        </Box>
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