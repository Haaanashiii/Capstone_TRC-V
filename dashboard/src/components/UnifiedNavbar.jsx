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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  useMediaQuery,
  useTheme
} from "@mui/material";
import LogoutIcon from '@mui/icons-material/Logout';
import WarningIcon from '@mui/icons-material/Warning';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from "../contexts/AuthContext";
import "../Styles/UnifiedNavbar.css";

const UnifiedNavbar = ({ language, onLanguageToggle, translations }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, logout, loading } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [activeFranchiseDialogOpen, setActiveFranchiseDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuOpen = Boolean(anchorEl);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleMobileMenuToggle = () => setMobileMenuOpen(!mobileMenuOpen);
  const handleMobileMenuClose = () => setMobileMenuOpen(false);

  // Determine if we're on landing page
  const isLandingPage = location.pathname === '/';
  
  // Build a friendly display name from AuthContext user or fall back to direct token decode
  const getDisplayName = () => {
    // First, try to use AuthContext user (preferred)
    if (authUser?.name) {
      const parts = String(authUser.name).trim().split(/\s+/);
      const first = parts[0];
      const last = parts.slice(1).join(' ');
      return last ? `${first} ${String(last).charAt(0).toUpperCase()}` : first;
    }
    
    // Fallback: directly decode token from sessionStorage
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
      console.error('[UnifiedNavbar] Error decoding token:', error);
    }
    
    return null;
  };

  // Wait for loading to complete before displaying name
  const displayName = loading ? 'Loading...' : getDisplayName();

  // Check if user has franchise from JWT token
  const checkHasFranchise = () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        return decoded.hasFranchise === true;
      }
    } catch {
      return false;
    }
    return false;
  };

  const userHasFranchise = checkHasFranchise();

  const handleLogout = async () => {
    console.log('[UnifiedNavbar] Logout initiated');
    handleMenuClose();
    
    try {
      await logout();
      console.log('[UnifiedNavbar] Logout successful, navigating to home');
    } catch (error) {
      console.error('[UnifiedNavbar] Error during logout:', error);
    } finally {
      navigate('/');
    }
  };
  
  const handleActiveFranchiseDialogClose = () => {
    setActiveFranchiseDialogOpen(false);
  };

  // Get navigation items based on mode
  const getNavigationItems = () => {
    if (isLandingPage) {
      // Landing page mode - only show HOME, ANNOUNCEMENTS, and NEW APPLICATION
      return [
        { label: "HOME", path: "/", isActive: true, disabled: false },
        { label: "ANNOUNCEMENTS", path: "/", isActive: false, disabled: false },
        { label: "NEW APPLICATION", path: "/operator/franchise/application", isActive: false, disabled: false }
      ];
    } else {
      // Logged in operator mode
      if (!userHasFranchise) {
        return [
          { label: "ANNOUNCEMENTS", path: "/", isActive: location.pathname === "/", disabled: false },
          { label: "MY FRANCHISE", path: "/operator/franchise", isActive: location.pathname === "/operator/franchise", disabled: false },
          { label: "FRANCHISEE LIST", path: "/operator/franchisee-list", isActive: location.pathname === "/operator/franchisee-list", disabled: false },
        ];
      }
      
      return [
        { label: "ANNOUNCEMENTS", path: "/", isActive: location.pathname === "/", disabled: false },
        { label: "MY FRANCHISE", path: "/operator/franchise", isActive: location.pathname === "/operator/franchise", disabled: false },
        { label: "REQUEST FOR AMENDMENT", path: "/operator/request-amendment", isActive: location.pathname === "/operator/request-amendment", disabled: false },
        { label: "FRANCHISEE LIST", path: "/operator/franchisee-list", isActive: location.pathname === "/operator/franchisee-list", disabled: false },
        { label: "OPERATOR ID", path: "/operator/id", isActive: location.pathname === "/operator/id", disabled: false },
      ];
    }
  };

  const navigationItems = getNavigationItems();

  return (
    <>
      <AppBar 
        position="sticky" 
        className={`unified-navbar ${isLandingPage ? 'landing-mode' : 'logged-in-mode'}`}
      >
        <Toolbar className="unified-navbar-toolbar">
          {/* Logo Section */}
          <Box className="unified-navbar-logo-section">
            <img 
              src="/Logos/TRC-vLogo.png" 
              alt="TRC-V Logo" 
              className="unified-navbar-logo-img"
            />
            <Box className="unified-navbar-title-section">
              <Typography className="unified-navbar-title">
                <span className="trc-yellow">TRC</span>
                <span className="trc-white">-V</span>
              </Typography>
              <Typography className="unified-navbar-subtitle">
                TRICYCLE VERIFICATION SYSTEM
              </Typography>
            </Box>
          </Box>

          {/* Mobile Hamburger Menu */}
          {isMobile && (
            <IconButton
              className="unified-navbar-mobile-menu-button"
              onClick={handleMobileMenuToggle}
              aria-label="menu"
              sx={{ 
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: '#ffe066',
                borderRadius: '12px',
                padding: '12px',
                zIndex: 1100,
                border: '2px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                '&:hover': {
                  backgroundColor: '#ffd633',
                  transform: 'translateY(-50%) scale(1.05)',
                  boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)'
                },
                '&:active': {
                  transform: 'translateY(-50%) scale(0.95)'
                }
              }}
            >
              <MenuIcon sx={{ color: '#083d77', fontSize: 36, fontWeight: 'bold' }} />
            </IconButton>
          )}

          {/* Desktop Navigation Section */}
          {!isMobile && (
            <Box className="unified-navbar-center">
              <Box className="unified-navbar-nav-holder">
                <Box className="unified-navbar-nav-items">
                  {navigationItems.map((item, index) => (
                    <Button
                      key={index}
                      component={item.disabled ? 'button' : Link}
                      to={item.disabled ? undefined : item.path}
                      className={`unified-nav-button ${item.isActive ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
                      disabled={item.disabled}
                      onClick={item.disabled ? (e) => e.preventDefault() : undefined}
                      title={item.title || undefined}
                    >
                      {item.label}
                    </Button>
                  ))}
                </Box>

                {/* User Section */}
                <Box className="unified-navbar-user-section">
                  {displayName && displayName !== 'USER' ? (
                    <>
                      <Button 
                        onClick={handleMenuOpen}
                        className="unified-navbar-user-button"
                        aria-controls={menuOpen ? 'user-menu' : undefined}
                        aria-haspopup="true"
                      >
                        {displayName}
                      </Button>
                      <Menu
                        id="user-menu"
                        anchorEl={anchorEl}
                        open={menuOpen}
                        onClose={handleMenuClose}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                        PaperProps={{ sx: { borderRadius: 2, minWidth: 200 } }}
                      >
                        <MenuItem onClick={handleLogout}>
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            <LogoutIcon fontSize="small" />
                          </ListItemIcon>
                          Logout
                        </MenuItem>
                      </Menu>
                    </>
                  ) : (
                    <Button 
                      onClick={() => navigate('/login')}
                      className="unified-navbar-login-button"
                    >
                      LOGIN
                    </Button>
                  )}
                </Box>
              </Box>

              {/* Language Toggle (if provided) */}
              {onLanguageToggle && (
                <Box className="unified-navbar-lang-group" title={translations?.toggleLanguage || 'Language'}>
                  <Button
                    className={`unified-navbar-lang-button ${(language || 'en').toString().toLowerCase() === 'en' ? 'active' : ''}`}
                    onClick={() => onLanguageToggle('en')}
                  >
                    EN
                  </Button>
                  <Button
                    className={`unified-navbar-lang-button ${(language || 'en').toString().toLowerCase() === 'tag' || (language || 'en').toString().toLowerCase() === 'tl' ? 'active' : ''}`}
                    onClick={() => onLanguageToggle('tag')}
                  >
                    TAG
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer Menu */}
      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={handleMobileMenuClose}
        className="unified-navbar-mobile-drawer"
        PaperProps={{
          sx: {
            width: 280,
            backgroundColor: '#083d77',
            color: 'white'
          }
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#ffe066' }}>
            MENU
          </Typography>
          <IconButton onClick={handleMobileMenuClose} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
        
        <List>
          {navigationItems.map((item, index) => (
            <ListItem key={index} disablePadding>
              <ListItemButton
                component={item.disabled ? 'button' : Link}
                to={item.disabled ? undefined : item.path}
                onClick={item.disabled ? undefined : handleMobileMenuClose}
                disabled={item.disabled}
                sx={{
                  py: 2,
                  px: 3,
                  backgroundColor: item.isActive ? 'rgba(255,224,102,0.15)' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255,224,102,0.1)'
                  }
                }}
              >
                <ListItemText 
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: item.isActive ? 700 : 500,
                    color: item.isActive ? '#ffe066' : 'white',
                    fontSize: '0.95rem'
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', mt: 2 }} />

        {/* Mobile User Section */}
        <Box sx={{ p: 3 }}>
          {displayName && displayName !== 'USER' ? (
            <>
              <Typography variant="body2" sx={{ mb: 1, color: '#ffe066', fontWeight: 600 }}>
                Logged in as:
              </Typography>
              <Typography variant="body1" sx={{ mb: 2, color: 'white', fontWeight: 700 }}>
                {displayName}
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  handleMobileMenuClose();
                  handleLogout();
                }}
                startIcon={<LogoutIcon />}
                sx={{
                  color: 'white',
                  borderColor: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderColor: '#ffe066'
                  }
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <Button
              fullWidth
              variant="contained"
              onClick={() => {
                handleMobileMenuClose();
                navigate('/login');
              }}
              sx={{
                backgroundColor: '#ffe066',
                color: '#083d77',
                fontWeight: 700,
                '&:hover': {
                  backgroundColor: '#ffd633'
                }
              }}
            >
              LOGIN
            </Button>
          )}
        </Box>

        {/* Mobile Language Toggle */}
        {onLanguageToggle && (
          <Box sx={{ p: 3, pt: 0 }}>
            <Typography variant="body2" sx={{ mb: 1, color: '#ffe066', fontWeight: 600 }}>
              Language:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                fullWidth
                variant={language === 'en' ? 'contained' : 'outlined'}
                onClick={() => {
                  onLanguageToggle('en');
                  handleMobileMenuClose();
                }}
                sx={{
                  backgroundColor: language === 'en' ? '#ffe066' : 'transparent',
                  color: language === 'en' ? '#083d77' : 'white',
                  borderColor: 'white',
                  fontWeight: 700,
                  '&:hover': {
                    backgroundColor: language === 'en' ? '#ffd633' : 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                EN
              </Button>
              <Button
                fullWidth
                variant={language === 'tag' || language === 'tl' ? 'contained' : 'outlined'}
                onClick={() => {
                  onLanguageToggle('tag');
                  handleMobileMenuClose();
                }}
                sx={{
                  backgroundColor: language === 'tag' || language === 'tl' ? '#ffe066' : 'transparent',
                  color: language === 'tag' || language === 'tl' ? '#083d77' : 'white',
                  borderColor: 'white',
                  fontWeight: 700,
                  '&:hover': {
                    backgroundColor: language === 'tag' || language === 'tl' ? '#ffd633' : 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                TAG
              </Button>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* Active Franchise Dialog */}
      <Dialog
        open={activeFranchiseDialogOpen}
        onClose={handleActiveFranchiseDialogClose}
        PaperProps={{
          sx: {
            borderRadius: 3,
            padding: 2,
            maxWidth: 500
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#083d77' }}>
          <WarningIcon sx={{ fontSize: 32 }} />
          Active Franchise Detected
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            You already have an active franchise.
          </Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            Please use the "Request for Amendment" option to modify your existing franchise details.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleActiveFranchiseDialogClose} 
            sx={{ color: '#666' }}
          >
            Close
          </Button>
          <Button 
            onClick={() => {
              handleActiveFranchiseDialogClose();
              navigate('/operator/request-amendment');
            }}
            variant="contained"
            sx={{ 
              bgcolor: '#083d77',
              '&:hover': { bgcolor: '#0a3970' }
            }}
          >
            Go to Amendment
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UnifiedNavbar;