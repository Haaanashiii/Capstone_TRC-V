import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import '../../Styles/LandingCss/LandingPage.css';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, MenuItem, ListItemIcon, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, useMediaQuery, useTheme, MobileStepper } from '@mui/material';
import PermIdentityIcon from '@mui/icons-material/PermIdentity';
import LogoutIcon from '@mui/icons-material/Logout';
import WarningIcon from '@mui/icons-material/Warning';
import SwipeableViews from 'react-swipeable-views';
import { autoPlay } from 'react-swipeable-views-utils';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';

// --- Added for mobile carousel auto-play
const AutoPlaySwipeableViews = autoPlay(SwipeableViews);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const Card = ({ children, className }) => (
  <div className={className}>{children}</div>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const { user, logout, login } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const menuOpen = Boolean(anchorEl);
  
  // --- Added for responsiveness and carousel
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeAnnouncementStep, setActiveAnnouncementStep] = useState(0);
  const [activeFeatureStep, setActiveFeatureStep] = useState(0);
  
  // Get display name from AuthContext user or fallback to token decode (consistent with UnifiedSidebar)
  const getDisplayName = () => {
    if (user?.name) {
      const parts = String(user.name).trim().split(/\s+/);
      const first = parts[0];
      const last = parts.slice(1).join(' ');
      return last ? `${first} ${String(last).charAt(0).toUpperCase()}` : first;
    }
    
    // Fallback: decode token directly from sessionStorage
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
      console.error('[LandingPage] Error decoding token:', error);
    }
    
    return null;
  };
  
  const displayName = getDisplayName();
  
  // Check if user has franchise (for enabling REQUEST FOR AMENDMENT)
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

  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  
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
  
  const handleLogout = async () => {
    console.log('[LandingPage] Logout initiated');
    handleMenuClose();
    try {
      await logout(); // Now async - calls backend and clears tokens
      console.log('[LandingPage] Logout successful');
    } catch (error) {
      console.error('[LandingPage] Logout error:', error);
    } finally {
      navigate('/');
    }
  };
  
  // Fetch published announcements
  useEffect(() => {
    const fetchPublishedAnnouncements = async () => {
      try {
        setLoadingAnnouncements(true);
        const response = await fetch(`${API_BASE_URL}/announcements/published`);
        
        if (response.ok) {
          const data = await response.json();
          setAnnouncements(data.announcements || []);
        } else {
          console.error('Failed to fetch announcements');
          setAnnouncements([]);
        }
      } catch (error) {
        console.error('Error fetching announcements:', error);
        setAnnouncements([]);
      } finally {
        setLoadingAnnouncements(false);
      }
    };

    fetchPublishedAnnouncements();
  }, []);

  useEffect(() => {
    try {
      const hash = window.location.hash || '';
      if (hash.startsWith('#')) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        if (token) {
          // Store in sessionStorage (secure) instead of localStorage
          sessionStorage.setItem('accessToken', token);
          // Also notify AuthContext about the new login so components update immediately
          try {
            const decoded = JSON.parse(atob(token.split('.')[1]));
            const userInfo = {
              id: decoded.id,
              role: decoded.role,
              name: decoded.name,
              accountType: decoded.accountType,
              hasOperator: decoded.hasOperator
            };
            // call AuthContext login if available
            if (typeof login === 'function') {
              login(token, userInfo);
            }
          } catch (e) {
            // ignore decode errors, token is still stored
            console.warn('Failed to decode token in landing page:', e);
          }
          // remove token from URL if available
          if (window.history && typeof window.history.replaceState === 'function') {
            try { window.history.replaceState(null, '', window.location.pathname); } catch (err) { console.warn('replaceState failed', err); }
          }
        }
      }
  } catch { /* ignore */ }
  }, [login]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  };
  
  // --- Added for mobile carousel navigation (Announcements)
  const handleAnnouncementNext = () => {
    setActiveAnnouncementStep((prevStep) => (prevStep + 1) % Math.max(announcements.length, 1));
  };

  const handleAnnouncementBack = () => {
    setActiveAnnouncementStep((prevStep) => (prevStep - 1 + Math.max(announcements.length, 1)) % Math.max(announcements.length, 1));
  };

  const handleAnnouncementStepChange = (step) => {
    setActiveAnnouncementStep(step);
  };
  
  // --- Added for mobile carousel navigation (Features)
  const handleFeatureNext = () => {
    setActiveFeatureStep((prevStep) => (prevStep + 1) % 3);
  };

  const handleFeatureBack = () => {
    setActiveFeatureStep((prevStep) => (prevStep - 1 + 3) % 3);
  };

  const handleFeatureStepChange = (step) => {
    setActiveFeatureStep(step);
  };
  
  // --- Features data (keeping existing content)
  const features = [
    {
      icon: '/Logos/2.png',
      title: 'TRICYCLE VERIFICATION',
      description: 'Instantly check if a tricycle is registered and franchised by scanning its QR code.'
    },
    {
      icon: '/Logos/4.png',
      title: 'FRANCHISE APPLICATION AND RENEWAL',
      description: 'Submit new franchise applications or renew your existing one online with ease.'
    },
    {
      icon: '/Logos/6.png',
      title: 'REPORTING FUNCTION',
      description: 'Report instances of overpricing or fare disputes, ensuring passengers are charged fairly.'
    }
  ];

  
  return (
    

     /* Navbar for landing - Responsive */  
    <div className="landing-root">
      {/* Header/Navbar - Fully responsive with MUI */}
      <Box
        component="header"
        sx={{
          background: '#083d77',
          py: { xs: 2, md: 2.5 },
          px: { xs: 2, sm: 3, md: 5 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: { xs: 2, md: 0 },
          }}
        >
          {/* Logo and Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              component="img"
              src="/Logos/TRC-vLogo.png"
              alt="TRC-V Logo"
              sx={{ width: { xs: 50, md: 60 }, height: { xs: 50, md: 60 } }}
            />
            <Box>
              <Typography
                sx={{
                  fontSize: { xs: '1.5rem', md: '2.2rem' },
                  fontWeight: 700,
                  color: '#ffe066',
                  letterSpacing: 2,
                  lineHeight: 1,
                  fontFamily: 'Montserrat, sans-serif',
                }}
              >
                TRC-V
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: '0.7rem', md: '0.9rem' },
                  fontWeight: 500,
                  color: '#fff',
                  letterSpacing: 1,
                  fontFamily: 'Montserrat, sans-serif',
                }}
              >
                TRICYCLE VERIFICATION SYSTEM
              </Typography>
            </Box>
          </Box>

          {/* Navigation - Responsive */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: { xs: 1, sm: 1.5, md: 2 },
              background: '#fff',
              borderRadius: 4,
              py: { xs: 1, md: 1.25 },
              px: { xs: 2, md: 3 },
              width: { xs: '100%', md: 'auto' },
              justifyContent: { xs: 'center', md: 'flex-start' },
            }}
          >
            <Button
              onClick={() => navigate('/')}
              sx={{
                fontSize: { xs: '0.85rem', md: '1.1rem' },
                color: '#222',
                fontWeight: 600,
                px: { xs: 1.5, md: 2.75 },
                py: { xs: 0.75, md: 1 },
                borderRadius: 2.5,
                textTransform: 'none',
                fontFamily: 'Poppins, sans-serif',
                '&:hover': {
                  background: '#ffe066',
                  color: '#143c6e',
                },
              }}
            >
              HOME
            </Button>

            {displayName ? (
              <Button
                onClick={() => userHasFranchise ? navigate('/operator/request-amendment') : navigate('/operator/franchise')}
                disabled={!userHasFranchise}
                title={!userHasFranchise ? 'Complete your franchise application first' : ''}
                sx={{
                  fontSize: { xs: '0.75rem', sm: '0.85rem', md: '1.1rem' },
                  color: '#222',
                  fontWeight: 600,
                  px: { xs: 1.5, md: 2.75 },
                  py: { xs: 0.75, md: 1 },
                  borderRadius: 2.5,
                  textTransform: 'none',
                  fontFamily: 'Poppins, sans-serif',
                  opacity: userHasFranchise ? 1 : 0.5,
                  '&:hover': {
                    background: userHasFranchise ? '#ffe066' : 'transparent',
                    color: userHasFranchise ? '#143c6e' : '#222',
                  },
                }}
              >
                REQUEST FOR AMENDMENT
              </Button>
            ) : (
              <Button
                onClick={() => navigate('/login')}
                sx={{
                  fontSize: { xs: '0.85rem', md: '1.1rem' },
                  color: '#222',
                  fontWeight: 600,
                  px: { xs: 1.5, md: 2.75 },
                  py: { xs: 0.75, md: 1 },
                  borderRadius: 2.5,
                  textTransform: 'none',
                  fontFamily: 'Poppins, sans-serif',
                  '&:hover': {
                    background: '#ffe066',
                    color: '#143c6e',
                  },
                }}
              >
                VERIFY TRICYCLE
              </Button>
            )}

            <Button
              onClick={() => navigate('/operator/franchise/application')}
              sx={{
                fontSize: { xs: '0.85rem', md: '1.1rem' },
                color: '#222',
                fontWeight: 600,
                px: { xs: 1.5, md: 2.75 },
                py: { xs: 0.75, md: 1 },
                borderRadius: 2.5,
                textTransform: 'none',
                fontFamily: 'Poppins, sans-serif',
                '&:hover': {
                  background: '#ffe066',
                  color: '#143c6e',
                },
              }}
            >
              NEW APPLICATION
            </Button>

            {displayName ? (
              <>
                <Button
                  onClick={handleMenuOpen}
                  sx={{
                    fontSize: { xs: '0.85rem', md: '1.1rem' },
                    color: '#fff',
                    background: '#143c6e',
                    fontWeight: 700,
                    px: { xs: 2, md: 2.75 },
                    py: { xs: 0.75, md: 1 },
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontFamily: 'Poppins, sans-serif',
                    border: '2px solid #fff',
                    ml: { xs: 0, md: 3 },
                    '&:hover': {
                      background: '#ffe066',
                      color: '#143c6e',
                      borderColor: '#ffe066',
                    },
                  }}
                >
                  {displayName}
                </Button>
                <Menu
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
                sx={{
                  fontSize: { xs: '0.85rem', md: '1.1rem' },
                  color: '#fff',
                  background: '#143c6e',
                  fontWeight: 600,
                  px: { xs: 2, md: 2.75 },
                  py: { xs: 0.75, md: 1 },
                  borderRadius: 2.5,
                  textTransform: 'none',
                  fontFamily: 'Poppins, sans-serif',
                  border: '2px solid #fff',
                  ml: { xs: 0, md: 3 },
                  '&:hover': {
                    background: '#ffe066',
                    color: '#143c6e',
                    borderColor: '#ffe066',
                  },
                }}
              >
                LOGIN
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* Warning Dialog for No Franchise */}
      <Dialog
        open={warningDialogOpen}
        onClose={handleWarningClose}
        PaperProps={{
          sx: {
            borderRadius: 3,
            padding: 2,
            maxWidth: 500,
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
              bgcolor: '#143c6e',
              '&:hover': { bgcolor: '#0a3970' }
            }}
          >
            Submit Application
          </Button>
        </DialogActions>
      </Dialog>
      <main className="landing-main">
        
        <div className="main-content">
          <h1>Tricycle Verification and<br />Hassle-Free Online<br />Franchise in Solano</h1>
           {/* For button  */}
          <div className="main-buttons">
            <button className="main-btn yellow" onClick={() => navigate('/login')}>RENEW A FRANCHISE</button>
          </div>
        </div>
        <div className="main-image" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <img
            src="/Logos/right-sideLanding.gif"
            alt="Landing Animation"
            style={{ width: '90%', maxWidth: '640px', height: 'auto', marginRight: '40px' }}
          />
        </div>
      </main>

            {/* Announcements Section - Dynamic with Mobile Carousel */}
      <section className="announcements-section">
        <div className="announcements-title">ANNOUNCEMENTS</div>
        
        {/* --- Mobile carousel wrapper (< md breakpoint) */}
        {isMobile ? (
          <Box sx={{ maxWidth: '100%', px: 2, position: 'relative' }}>
            {loadingAnnouncements ? (
              <div className="announcement-card">
                <div className="announcement-card-body" style={{ textAlign: 'center', padding: '40px' }}>
                  Loading announcements...
                </div>
              </div>
            ) : announcements.length > 0 ? (
              <>
                <AutoPlaySwipeableViews
                  axis={theme.direction === 'rtl' ? 'x-reverse' : 'x'}
                  index={activeAnnouncementStep}
                  onChangeIndex={handleAnnouncementStepChange}
                  enableMouseEvents
                  interval={5000}
                >
                  {announcements.map((announcement) => (
                    <Box key={announcement._id} sx={{ px: 1 }}>
                      <div className="announcement-card">
                        <div className="announcement-card-header">{announcement.title}</div>
                        <div className="announcement-card-date">{formatDate(announcement.date)}</div>
                        <div className="announcement-card-body">
                          {announcement.description}
                        </div>
                      </div>
                    </Box>
                  ))}
                </AutoPlaySwipeableViews>
                <MobileStepper
                  steps={announcements.length}
                  position="static"
                  activeStep={activeAnnouncementStep}
                  sx={{ 
                    background: 'transparent', 
                    justifyContent: 'center',
                    mt: 2,
                    '& .MuiMobileStepper-dot': {
                      backgroundColor: '#ddd'
                    },
                    '& .MuiMobileStepper-dotActive': {
                      backgroundColor: '#143c6e'
                    }
                  }}
                  nextButton={
                    <Button size="small" onClick={handleAnnouncementNext}>
                      <KeyboardArrowRight />
                    </Button>
                  }
                  backButton={
                    <Button size="small" onClick={handleAnnouncementBack}>
                      <KeyboardArrowLeft />
                    </Button>
                  }
                />
              </>
            ) : (
              <div className="announcement-card">
                <div className="announcement-card-body" style={{ textAlign: 'center', padding: '40px' }}>
                  No announcements at this time.
                </div>
              </div>
            )}
          </Box>
        ) : (
          // --- Desktop layout (>= md breakpoint) - unchanged
          <div className="announcements-list">
            {loadingAnnouncements ? (
              <div className="announcement-card">
                <div className="announcement-card-body" style={{ textAlign: 'center', padding: '40px' }}>
                  Loading announcements...
                </div>
              </div>
            ) : announcements.length > 0 ? (
              announcements.map((announcement) => (
                <div className="announcement-card" key={announcement._id}>
                  <div className="announcement-card-header">{announcement.title}</div>
                  <div className="announcement-card-date">{formatDate(announcement.date)}</div>
                  <div className="announcement-card-body">
                    {announcement.description}
                  </div>
                </div>
              ))
            ) : (
              <div className="announcement-card">
                <div className="announcement-card-body" style={{ textAlign: 'center', padding: '40px' }}>
                  No announcements at this time.
                </div>
              </div>
            )}
          </div>
        )}
      </section>






      <div className="min-h-screen bg-[#F4D77E]">
      

        {/* FEATURES Section with Mobile Carousel */}
        <div style={{ background: '#F4D77E', padding: '40px 0' }}>
          <div style={{ background: '#1B4B75', color: '#F4D77E', display: 'inline-block', padding: '10px 50px', borderRadius: '2px', fontWeight: 'bold', fontSize: '28px', boxShadow: '2px 2px 6px #b3a04a', fontFamily: 'Poppins, sans-serif' }}>
            FEATURES
          </div>
          
          {/* --- Mobile carousel wrapper (< md breakpoint) */}
          {isMobile ? (
            <Box sx={{ maxWidth: '100%', px: 2, mt: 3, position: 'relative' }}>
              <SwipeableViews
                axis={theme.direction === 'rtl' ? 'x-reverse' : 'x'}
                index={activeFeatureStep}
                onChangeIndex={handleFeatureStepChange}
                enableMouseEvents
              >
                {features.map((feature, index) => (
                  <Box key={index} sx={{ px: 2, display: 'flex', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', maxWidth: '320px', width: '100%' }}>
                      <div style={{ background: '#1B4B75', borderRadius: '50%', width: '170px', height: '170px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={feature.icon} alt={feature.title} style={{ width: '150px', height: '150px' }} />
                      </div>
                      <h3 style={{ fontWeight: 'bold', marginTop: '20px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>{feature.title}</h3>
                      <p style={{ fontSize: '15px', marginTop: '10px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>{feature.description}</p>
                    </div>
                  </Box>
                ))}
              </SwipeableViews>
              <MobileStepper
                steps={3}
                position="static"
                activeStep={activeFeatureStep}
                sx={{ 
                  background: 'transparent', 
                  justifyContent: 'center',
                  mt: 2,
                  '& .MuiMobileStepper-dot': {
                    backgroundColor: '#ddd'
                  },
                  '& .MuiMobileStepper-dotActive': {
                    backgroundColor: '#1B4B75'
                  }
                }}
                nextButton={
                  <Button size="small" onClick={handleFeatureNext}>
                    <KeyboardArrowRight />
                  </Button>
                }
                backButton={
                  <Button size="small" onClick={handleFeatureBack}>
                    <KeyboardArrowLeft />
                  </Button>
                }
              />
            </Box>
          ) : (
            // --- Desktop layout (>= md breakpoint) - unchanged
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '60px', maxWidth: '1100px', margin: '0 auto' }}>
              {features.map((feature, index) => (
                <div key={index} style={{ textAlign: 'center', width: '300px' }}>
                  <div style={{ background: '#1B4B75', borderRadius: '50%', width: '170px', height: '170px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={feature.icon} alt={feature.title} style={{ width: '150px', height: '150px' }} />
                  </div>
                  <h3 style={{ fontWeight: 'bold', marginTop: '20px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>{feature.title}</h3>
                  <p style={{ fontSize: '15px', marginTop: '10px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>{feature.description}</p>
                </div>
              ))}
            </div>
          )}
          <div style={{ textAlign: 'right', maxWidth: '1100px', margin: '20px auto 0' }}>
          
          </div>
        </div>
      
      </div> 

    {/* Footer Section - Responsive */}
    <Box
      component="footer"
      sx={{
        background: '#f7f7f7',
        py: { xs: 3, md: 4 },
        mt: 5,
        width: '100%',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'center', md: 'flex-start' },
          maxWidth: '1400px',
          margin: '0 auto',
          px: { xs: 2, sm: 3, md: 4 },
          gap: { xs: 4, md: 5 },
          textAlign: { xs: 'center', md: 'left' },
        }}
      >
        {/* Logo Section */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box
            component="img"
            src="/Logos/SBLogo.png"
            alt="SB Logo"
            sx={{ width: { xs: 70, md: 100 }, height: { xs: 70, md: 100 }, objectFit: 'contain' }}
          />
          <Box
            component="img"
            src="/Logos/TRC-vLogo.png"
            alt="TRC-V Logo"
            sx={{ width: { xs: 70, md: 100 }, height: { xs: 70, md: 100 }, objectFit: 'contain' }}
          />
          <Box
            component="img"
            src="/Logos/vm.png"
            alt="Vice Mayor Logo"
            sx={{ width: { xs: 70, md: 100 }, height: { xs: 70, md: 100 }, objectFit: 'contain' }}
          />
        </Box>

        {/* Main Info Section */}
        <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '300px' }, maxWidth: { xs: '100%', md: '500px' } }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
              fontSize: { xs: '18px', md: '24px' },
              color: '#111',
              mb: 1,
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            SANGGUNIANG BAYAN OF SOLANO
          </Typography>
          <Typography
            sx={{
              color: '#222',
              fontSize: { xs: '14px', md: '16px' },
              mb: 2,
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            All content is in the public domain unless otherwise stated.
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
              fontSize: { xs: '16px', md: '20px' },
              color: '#111',
              mb: 1,
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            ABOUT SB-SOLANO
          </Typography>
          <Typography
            sx={{
              color: '#222',
              fontSize: { xs: '14px', md: '16px' },
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            Learn more about the Sangguniang Bayan of Solano, its structure, how legislative works and the people behind it.
          </Typography>
        </Box>

        {/* Hotline Section */}
        <Box sx={{ minWidth: { xs: '100%', md: '300px' } }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
              fontSize: { xs: '16px', md: '20px' },
              color: '#111',
              mb: 1.5,
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            GOVERNMENT HOTLINE NUMBERS
          </Typography>
          <Box
            sx={{
              color: '#222',
              fontSize: { xs: '14px', md: '16px' },
              lineHeight: 2,
              fontFamily: 'Poppins, sans-serif',
              '& a': {
                color: '#222',
                textDecoration: 'none',
                '&:hover': {
                  color: '#143c6e',
                  textDecoration: 'underline',
                }
              }
            }}
          >
            Police Department - <a href="tel:09274008033">0927 400 8033</a><br />
            MSWDO - <a href="tel:09162840885">0916 284 0885</a><br />
            Fire Department - <a href="tel:09360620305">0936 062 0305</a><br />
            DILG Solano - <a href="tel:0906188086">0906 188 086</a><br />
            MDRRMO - <a href="tel:09263833744">0926 383 3744</a><br />
            R2TMC - <a href="tel:09068195569">0906 819 5569</a>
          </Box>
        </Box>
      </Box>
    </Box>

  </div> 
);
};

export default LandingPage;
