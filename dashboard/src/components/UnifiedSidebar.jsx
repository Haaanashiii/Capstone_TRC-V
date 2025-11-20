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
  styled,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@mui/material";
import PermIdentityIcon from '@mui/icons-material/PermIdentity';
import LogoutIcon from '@mui/icons-material/Logout';
import WarningIcon from '@mui/icons-material/Warning';
import { useAuth } from "../contexts/AuthContext";

// Styled components for horizontal navbar
const StyledAppBar = styled(AppBar)(() => ({

  backgroundColor: '#083d77',
  position: 'sticky',
  top: 0,
  zIndex: 1000,
  boxShadow: 'none',
  borderBottom: 'none',
}));

const LogoSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  '@media (max-width: 600px)': {
    gap: '8px',
    '& img': {
      height: '44px'
    }
  }
});

const TitleSection = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  marginTop: '6px',
});

// Increased TRC title size as requested (only for UnifiedSidebar)
const TrcTitle = styled(Typography)({
  fontSize: '2.2rem',
  fontWeight: 700,
  letterSpacing: '2px',
  lineHeight: 1,
  marginBottom: '4px',
  '& .yellow': {
    color: '#ffe066',
  },
  '& .white': {
    color: 'white',
  },
  '@media (max-width: 900px)': {
    fontSize: '1.4rem',
    letterSpacing: '1px'
  }
});

const TrcSubtitle = styled(Typography)({
  fontSize: '12px',
  color: 'rgba(255,255,255,0.85)',
  letterSpacing: '1px',
  fontWeight: 500,
  '@media (max-width: 600px)': {
    fontSize: '10px'
  }
});

const NavigationSection = styled(Box)(() => ({
  backgroundColor: 'white',
  borderRadius: '40px',
  display: 'flex',
  alignItems: 'center',
  /* larger white holder to match reference */
  padding: '10px 28px',
  minWidth: '240px',
  maxWidth: '900px',
  marginLeft: '10px',
  marginRight: 0,
  gap: '22px',
  overflow: 'hidden',
  boxShadow: '0 6px 18px rgba(20,60,110,0.12)'
  ,
  '@media (max-width: 900px)': {
    padding: '8px 12px',
    gap: '10px',
    minWidth: 'auto',
    maxWidth: '100%',
    flexWrap: 'wrap',
    overflowX: 'auto'
  }
  ,
  '@media (max-width: 600px)': {
    padding: '6px 8px',
    gap: '8px',
    borderRadius: '20px',
    paddingLeft: '10px',
    paddingRight: '10px',
    minWidth: 'auto',
    maxWidth: '100%',
    flexWrap: 'nowrap',
    overflowX: 'auto',
    '-webkit-overflow-scrolling': 'touch'
  }
}));

const NavButton = styled(Button)(({ isActive, disabled }) => ({
  color: disabled ? '#999' : (isActive ? 'white' : '#111'),
  backgroundColor: isActive ? '#083d77' : 'transparent',
  fontWeight: 600,
  padding: '4px 8px',
  borderRadius: '14px',
  fontSize: '0.95rem',
  textTransform: 'none',
  minWidth: 'auto',
  whiteSpace: 'nowrap',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  '&:hover': {
    backgroundColor: disabled ? 'transparent' : (isActive ? '#083d77' : '#ffe066'),
    color: disabled ? '#999' : (isActive ? 'white' : '#083d77'),
    transform: 'none'
  },
  flexShrink: 0,
  pointerEvents: disabled ? 'none' : 'auto',
  '@media (max-width: 900px)': {
    fontSize: '0.9rem',
    padding: '6px 10px',
    borderRadius: '12px'
  }
  ,
  '@media (max-width: 600px)': {
    fontSize: '0.85rem',
    padding: '4px 8px',
    borderRadius: '10px'
  }
}));

const UserSection = styled(Box)(() => ({
  backgroundColor: 'transparent',
  color: 'white',
  borderRadius: '18px',
  padding: '2px 4px',
  display: 'flex',
  alignItems: 'center',
  fontWeight: 600,
  minWidth: 'fit-content',
  flexShrink: 0,
  marginLeft: '6px',
  boxShadow: 'none'
  ,
  '@media (max-width: 900px)': {
    padding: '2px',
    marginLeft: '4px'
  }
}));

const UserInnerPill = styled(Box)(() => ({
  backgroundColor: '#083d77',
  color: '#fff',
  padding: '4px 10px',
  borderRadius: '14px',
  fontWeight: 700,
  fontSize: '12px',
  cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(20,60,110,0.10)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 28,
  minWidth: 80,
  userSelect: 'none',
  '&:focus': { outline: 'none' },
  '&:active': { transform: 'none' }
  ,
  '@media (max-width: 600px)': {
    minWidth: 56,
    padding: '4px 8px',
    fontSize: '11px'
  }
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
  color: active ? '#083d77' : '#fff',
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
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
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
    
    // Check if user has franchise
    let hasFranchise = false;
    try {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        hasFranchise = decoded.hasFranchise === true;
      }
    } catch {
      hasFranchise = false;
    }
    
    if (!hasFranchise) {
      // Show warning dialog instead of navigating
      setWarningDialogOpen(true);
    } else {
      navigate('/operator/id');
    }
  };
  
  const handleWarningClose = () => {
    setWarningDialogOpen(false);
  };
  
  const handleGoToFranchise = () => {
    setWarningDialogOpen(false);
    navigate('/operator/franchise/application');
  };

  const getNavigationItems = () => {
    switch (userType) {
      case "operator": {
        // Check if user has franchise from JWT token
        let hasFranchise = false;
        try {
          const token = sessionStorage.getItem('accessToken');
          if (token) {
            const decoded = JSON.parse(atob(token.split('.')[1]));
            hasFranchise = decoded.hasFranchise === true;
          }
        } catch {
          hasFranchise = false;
        }
       
        // If user has no franchise, show limited navigation
        if (!hasFranchise) {
          return [
            { label: "MY FRANCHISE", path: "/operator/franchise", isActive: location.pathname === "/operator/franchise", disabled: false },
            { label: "FRANCHISEE LIST", path: "/operator/franchisee-list", isActive: location.pathname === "/operator/franchisee-list", disabled: false },
          ];
        }
        
        // If user has franchise, show full navigation with REQUEST FOR AMENDMENT
        return [
          { label: "MY FRANCHISE", path: "/operator/franchise", isActive: location.pathname === "/operator/franchise", disabled: false },
          { label: "REQUEST FOR AMENDMENT", path: "/operator/request-amendment", isActive: location.pathname === "/operator/request-amendment", disabled: false },
          { label: "FRANCHISEE LIST", path: "/operator/franchisee-list", isActive: location.pathname === "/operator/franchisee-list", disabled: false },
          { label: "OPERATOR ID", path: "/operator/id", isActive: location.pathname === "/operator/id", disabled: false },
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
      <Toolbar sx={{ paddingTop: '12px', paddingBottom: '10px', paddingLeft: '28px', paddingRight: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', position: 'relative', overflowX: 'hidden' }}>
        
    
        <LogoSection>
          <img 
            src="/Logos/TRC-vLogo.png" 
            alt="TRC-V Logo" 
            style={{ height: '60px', width: 'auto' }}
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
    <NavigationSection sx={{ marginLeft: 0, mt: '12px' }}>
    {/* Navigation Items */}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '28px', whiteSpace: 'nowrap', justifyContent: 'center' }}>
        {navigationItems.map((item, index) => (
          <NavButton
            key={index}
            component={item.disabled ? 'button' : Link}
            to={item.disabled ? undefined : item.path}
            isActive={item.isActive}
            disabled={item.disabled}
            onClick={item.disabled ? (e) => e.preventDefault() : undefined}
            title={item.disabled ? 'Complete your franchise application first' : undefined}
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
              
              {/* Warning Dialog for No Operator Information */}
              <Dialog
                open={warningDialogOpen}
                onClose={handleWarningClose}
                PaperProps={{
                  sx: {
                    borderRadius: 3,
                    padding: 2,
                    maxWidth: 500
                  }
                }}
              >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#d32f2f' }}>
                  <WarningIcon sx={{ fontSize: 32 }} />
                  No Franchise Found
                </DialogTitle>
                <DialogContent>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    You need an approved franchise to access the Operator ID.
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    To view your Operator ID, you need to:
                  </Typography>
                  <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                    <li><Typography variant="body2">Submit a franchise application and get it approved</Typography></li>
                  </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                  <Button 
                    onClick={handleWarningClose} 
                    sx={{ color: '#666' }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleGoToFranchise}
                    variant="contained"
                    sx={{ 
                      bgcolor: '#083d77',
                      '&:hover': { bgcolor: '#0a3970' }
                    }}
                  >
                    Submit Application
                  </Button>
                </DialogActions>
              </Dialog>
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