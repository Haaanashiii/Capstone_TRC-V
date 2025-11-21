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
  DialogActions
} from "@mui/material";
import PermIdentityIcon from '@mui/icons-material/PermIdentity';
import LogoutIcon from '@mui/icons-material/Logout';
import WarningIcon from '@mui/icons-material/Warning';
import { useAuth } from "../contexts/AuthContext";
import "../Styles/UnifiedNavbar.css";

const UnifiedNavbar = ({ language, onLanguageToggle, translations }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, logout, loading } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [activeFranchiseDialogOpen, setActiveFranchiseDialogOpen] = useState(false);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

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

  const handleGoToId = () => {
    handleMenuClose();
    
    if (!userHasFranchise) {
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

          {/* Navigation Section */}
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
        </Toolbar>
      </AppBar>

      {/* Warning Dialog for No Franchise */}
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
