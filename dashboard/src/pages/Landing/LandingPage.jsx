import React, { useEffect, useState, useCallback } from "react";
import '../../Styles/LandingCss/LandingPage.css';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import websocketService from '../../services/websocket';
import announcementService from '../../services/announcementService';
import UnifiedNavbar from '../../components/UnifiedNavbar';
import AnimatedPage from '../../components/AnimatedPage';
import { logger } from '../../utils/logger';
import { Button, Typography, Box, useMediaQuery, useTheme, MobileStepper, Accordion, AccordionSummary, AccordionDetails, Dialog, DialogContent, IconButton, Menu, MenuItem, ListItemIcon, Drawer } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PermIdentityIcon from '@mui/icons-material/PermIdentity';
import LogoutIcon from '@mui/icons-material/Logout';
import SBFareImage from '../../assets/SB Fare.jpeg';

const Card = ({ children, className }) => (
  <div className={className}>{children}</div>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const { login, user, logout } = useAuth();
  const { t, loading: translationsLoading } = useTranslation();
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [openFareModal, setOpenFareModal] = useState(false);
  const [openAnnouncementModal, setOpenAnnouncementModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [activeTab, setActiveTab] = useState('documents');
  const [fareMatrixImage, setFareMatrixImage] = useState(SBFareImage); // Default to imported image
  const [fareMatrixDate, setFareMatrixDate] = useState('November 4, 2025');
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const [_announcementDirection, setAnnouncementDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // --- Added for responsiveness
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Determine display name from user
  const displayName = user?.full_name || user?.name || user?.username || null;
  
  // Fetch fare matrix from API (public endpoint, no auth required)
  useEffect(() => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
    fetch(`${API_BASE_URL}/api/fare-matrix`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.fareMatrix) {
          let imageUrl = data.fareMatrix.imageUrl;
          // Prepend API_BASE_URL if it's a relative path
          if (imageUrl && imageUrl.startsWith('/api/files/')) {
            imageUrl = `${API_BASE_URL}${imageUrl}`;
          }
          setFareMatrixImage(imageUrl);
          setFareMatrixDate(new Date(data.fareMatrix.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }));
        }
      })
      .catch(err => {
        logger.error('[LandingPage] Error fetching fare matrix:', err);
        // Keep default image on error
      });
  }, []);
  
  // Fetch published announcements
  useEffect(() => {
    const fetchPublishedAnnouncements = async () => {
      try {
        setLoadingAnnouncements(true);
        const data = await announcementService.getPublished();
        setAnnouncements(data.announcements || []);
      } catch (error) {
        logger.error('Error fetching announcements:', error);
        setAnnouncements([]);
      } finally {
        setLoadingAnnouncements(false);
      }
    };

    fetchPublishedAnnouncements();

    // Connect to WebSocket for real-time announcement updates
    if (!websocketService.isConnected()) {
      logger.log('[LandingPage] Connecting to WebSocket');
      websocketService.connect();  // Auto-joins 'announcements' room
    }

    // Subscribe to announcement updates
    const handleAnnouncementCreated = (newAnnouncement) => {
      if (newAnnouncement.published) {
        logger.log('[LandingPage] WebSocket event - announcement-created', newAnnouncement);
        setAnnouncements(prev => [newAnnouncement, ...prev]);
      }
    };

    const handleAnnouncementUpdated = (updatedAnnouncement) => {
      logger.log('[LandingPage] WebSocket event - announcement-updated', updatedAnnouncement);
      if (updatedAnnouncement.published) {
        // If it's now published, add/update it
        setAnnouncements(prev => {
          const exists = prev.some(a => a._id === updatedAnnouncement._id);
          if (exists) {
            return prev.map(a => a._id === updatedAnnouncement._id ? updatedAnnouncement : a);
          } else {
            return [updatedAnnouncement, ...prev];
          }
        });
      } else {
        // If it's unpublished, remove it
        setAnnouncements(prev => prev.filter(a => a._id !== updatedAnnouncement._id));
      }
    };

    const handleAnnouncementDeleted = (data) => {
      logger.log('[LandingPage] WebSocket event - announcement-deleted', data);
      setAnnouncements(prev => prev.filter(a => a._id !== data._id));
    };

    websocketService.on('announcement-created', handleAnnouncementCreated);
    websocketService.on('announcement-updated', handleAnnouncementUpdated);
    websocketService.on('announcement-deleted', handleAnnouncementDeleted);

    return () => {
      websocketService.off('announcement-created', handleAnnouncementCreated);
      websocketService.off('announcement-updated', handleAnnouncementUpdated);
      websocketService.off('announcement-deleted', handleAnnouncementDeleted);
    };
  }, []);

  useEffect(() => {
    try {
      const hash = window.location.hash || '';
      if (hash.startsWith('#')) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        if (token) {
          localStorage.setItem('accessToken', token);
          // Also notify AuthContext about the new login so components update immediately
          try {
            const decoded = JSON.parse(atob(token.split('.')[1]));
            const userInfo = {
              id: decoded.id,
              role: decoded.role,
              name: decoded.name || decoded.username || decoded.email,
              full_name: decoded.full_name || decoded.name || decoded.username,
              username: decoded.username,
            };
            // call AuthContext login if available
            if (typeof login === 'function') {
              login(token, userInfo);
            }
          } catch (e) {
            // ignore decode errors, token is still stored
            logger.warn('Failed to decode token in landing page:', e);
          }
          // remove token from URL if available
          if (window.history && typeof window.history.replaceState === 'function') {
            try { window.history.replaceState(null, '', window.location.pathname); } catch (err) { logger.warn('replaceState failed', err); }
          }
        }
      }
  } catch { /* ignore */ }
  }, [login]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  };
  
  // Group announcements into slides (2 per slide)
  const announcementSlides = [];
  for (let i = 0; i < announcements.length; i += 2) {
    announcementSlides.push(announcements.slice(i, i + 2));
  }

  const paginateAnnouncements = useCallback((newDirection) => {
    if (announcementSlides.length === 0) return;
    setAnnouncementDirection(newDirection);
    setCurrentAnnouncementIndex((prev) => {
      const next = prev + newDirection;
      return next < 0 ? announcementSlides.length - 1 : next % announcementSlides.length;
    });
  }, [announcementSlides.length]);

  const goToAnnouncementSlide = (index) => {
    setAnnouncementDirection(index > currentAnnouncementIndex ? 1 : -1);
    setCurrentAnnouncementIndex(index);
  };

  // Auto-slide announcements
  useEffect(() => {
    if (announcementSlides.length === 0 || isPaused || loadingAnnouncements) return;

    const interval = setInterval(() => {
      paginateAnnouncements(1);
    }, 5000);

    return () => clearInterval(interval);
  }, [announcementSlides.length, isPaused, loadingAnnouncements, paginateAnnouncements]);
  
  // Menu handlers
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    if (logout) logout();
    handleMenuClose();
    navigate('/');
  };

  const handleGoToId = () => {
    handleMenuClose();
    navigate('/operator/franchise');
  };

  const handleMobileMenuOpen = () => {
    setMobileMenuOpen(true);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
  };

  const handleMobileNavClick = (path) => {
    navigate(path);
    handleMobileMenuClose();
  };

  const handleAnnouncementClick = (announcement) => {
    setSelectedAnnouncement(announcement);
    setOpenAnnouncementModal(true);
  };

  const handleCloseAnnouncementModal = () => {
    setOpenAnnouncementModal(false);
    setTimeout(() => setSelectedAnnouncement(null), 300);
  };
  
  // Don't render content until translations are loaded to prevent showing raw translation keys
  if (translationsLoading) {
    return (
      <div className="landing-root" style={{ minHeight: '100vh' }}>
        <UnifiedNavbar />
      </div>
    );
  }

  
  return (
    <AnimatedPage animation="fadeInUp" duration={400}>
    <div className="landing-root">
      <header className="landing-header">
        <div className="logo-title">
          <img src="/Logos/TRC-vLogo.png" alt="TRC-V Logo" className="logo-img" />
          <div className="title-group">
            <span className="trc-title">TRC-V</span>
            <span className="trc-subtitle">TRICYCLE VERIFICATION SYSTEM</span>
          </div>
        </div>
        {isMobile ? (
          <>
            <IconButton onClick={handleMobileMenuOpen} sx={{ color: '#fff' }}>
              <MenuIcon />
            </IconButton>
            <Drawer anchor="right" open={mobileMenuOpen} onClose={handleMobileMenuClose}>
              <Box sx={{ width: 280, padding: 2, background: '#083d77', height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography sx={{ color: '#fff', fontWeight: 'bold' }}>Menu</Typography>
                  <IconButton onClick={handleMobileMenuClose} sx={{ color: '#fff' }}>
                    <CloseIcon />
                  </IconButton>
                </Box>
                {displayName && (
                  <Button fullWidth onClick={() => handleMobileNavClick('/operator/franchise')} sx={{ color: '#fff', justifyContent: 'flex-start', textTransform: 'none', fontSize: '16px' }}>
                    HOME
                  </Button>
                )}
            
                <Button fullWidth onClick={() => handleMobileNavClick(displayName ? '/operator/franchise/application' : '/signup')} sx={{ color: '#fff', justifyContent: 'flex-start', textTransform: 'none', fontSize: '16px' }}>
                  NEW APPLICATION
                </Button>
                {displayName ? (
                  <>
                    <Button fullWidth onClick={() => { navigate('/operator/franchise'); handleMobileMenuClose(); }} sx={{ color: '#FFD700', justifyContent: 'flex-start', textTransform: 'none', fontSize: '16px', mt: 2 }}>
                      {displayName} (Operator ID)
                    </Button>
                    <Button fullWidth onClick={handleLogout} sx={{ color: '#fff', justifyContent: 'flex-start', textTransform: 'none', fontSize: '16px' }}>
                      LOGOUT
                    </Button>
                  </>
                ) : (
                  <Button fullWidth onClick={() => handleMobileNavClick('/login')} sx={{ background: '#143c6e', color: '#fff', justifyContent: 'center', textTransform: 'none', fontSize: '16px', mt: 2, borderRadius: '20px' }}>
                    LOGIN
                  </Button>
                )}
              </Box>
            </Drawer>
          </>
        ) : (
          <nav className="landing-nav">
            {displayName && (
              <button className="nav-link" onClick={() => navigate('/operator/franchise')}>HOME</button>
            )}
            <button className="nav-link" onClick={() => navigate(displayName ? '/operator/franchise/application' : '/signup')}>NEW APPLICATION</button>
            {/* If user is logged in show name and menu, otherwise show Login button */}
            {displayName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: 'rgba(255,255,255,0.12)', padding: '4px 8px', borderRadius: 24, display: 'flex', alignItems: 'center' }}>
                  <button 
                    onClick={handleMenuOpen} 
                    className="nav-user"
                  >
                    {displayName}
                  </button>
                </div>
                <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} PaperProps={{ sx: { borderRadius: 2, minWidth: 200 } }}>
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
              </div>
            ) : (
              <button className="nav-login" onClick={() => navigate('/login')}>LOGIN</button>
            )}
          </nav>
        )}
      </header>
      <main className="landing-main">
        <div className="main-content">
          <h1>{t("landing.heroMainTitle")}</h1>
          <p className="main-hero-description">{t("landing.heroDescription")}</p>
          <div className="main-buttons-container">
            <div className="ready-to-apply-label">
              <span className="btn-main-text">{t("landing.readyToApplyBtn")}</span>
              <span className="btn-sub-text">{t("landing.viewRequirementsText")}</span>
            </div>
            <Button 
              className="main-btn-view"
              onClick={() => setOpenFareModal(true)}
            >
              {t("landing.viewBtn")}
            </Button>
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

      {/* FAQ Accordion Section */}
      <section style={{ background: '#fff', padding: '0 20px', width: '100%', boxSizing: 'border-box', margin: 0, display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ width: '100%', maxWidth: '1100px', padding: '60px 0' }}>
          <Typography 
            variant="h4" 
            sx={{ 
              textAlign: 'center', 
              fontWeight: 'bold', 
              color: '#174D7A', 
              mb: 4,
              fontFamily: 'Poppins, sans-serif'
            }}
          >
            {t("landing.faqTitle")}
          </Typography>
          
          <Accordion sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5', borderLeft: '4px solid #083d77' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif', color: '#083d77' }}>
                {t("landing.faq1Question")}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif', whiteSpace: 'pre-line' }}>
                {t("landing.faq1Answer")}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5', borderLeft: '4px solid #083d77' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif', color: '#083d77' }}>
                {t("landing.faq2Question")}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif', whiteSpace: 'pre-line' }}>
                {t("landing.faq2Answer")}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5', borderLeft: '4px solid #083d77' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif', color: '#083d77' }}>
                {t("landing.faq3Question")}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif' }}>
                {t("landing.faq3Answer")}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5', borderLeft: '4px solid #083d77' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif', color: '#083d77' }}>
                {t("landing.faq4Question")}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif' }}>
                {t("landing.faq4Answer")}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5', borderLeft: '4px solid #083d77' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif', color: '#083d77' }}>
                {t("landing.faq5Question")}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif' }}>
                {t("landing.faq5Answer")}
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Box>
      </section>

      {/* Announcements Section - Carousel with 2 per slide */}
      <section className="announcements-section" id="announcements" style={{ width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '80px' }}>
        <div className="announcements-title">{t("landing.announcementsTitle")}</div>
        
        <div
          style={{ width: '100%', maxWidth: '1200px', padding: '20px', boxSizing: 'border-box' }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Main Carousel Container */}
          <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
            {loadingAnnouncements ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <p style={{ color: '#666', fontSize: '16px' }}>Loading announcements...</p>
              </div>
            ) : announcementSlides.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '60px 20px',
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                border: '2px dashed #ddd'
              }}>
                <p style={{ color: '#666', fontSize: '16px', fontWeight: '500', margin: '0' }}>No announcements at this time.</p>
              </div>
            ) : (
              <>
                {/* Two-Column Grid for Announcements */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px', padding: '24px', animation: 'fadeIn 0.3s ease-in' }}>
                  {announcementSlides[currentAnnouncementIndex].map((announcement) => (
                    <div
                      key={announcement._id}
                      onClick={() => handleAnnouncementClick(announcement)}
                      style={{
                        backgroundColor: '#fff',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        overflow: 'hidden',
                        border: '1px solid #e5e5e5',
                        transition: 'box-shadow 0.3s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                    >
                      {/* Accent Bar */}
                      <div style={{ height: '6px', backgroundColor: '#083D77' }} />

                      {/* Card Header with Badge */}
                      <div style={{ padding: '24px 24px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a', margin: 0, lineHeight: '1.3', flex: 1 }}>
                            {announcement.title}
                          </h3>
                          <span style={{
                            display: 'inline-block',
                            backgroundColor: '#083D77',
                            color: '#FFEB62',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            NEW
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#888', fontWeight: '500', margin: 0 }}>
                          {formatDate(announcement.date)}
                        </p>
                      </div>

                      {/* Card Body */}
                      <div style={{ padding: '12px 24px 24px' }}>
                        <p style={{
                          fontSize: '14px',
                          color: '#444',
                          lineHeight: '1.5',
                          margin: 0,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {announcement.description}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Empty Placeholder if odd number of items */}
                  {announcementSlides[currentAnnouncementIndex].length === 1 && (
                    <div style={{
                      backgroundColor: '#f5f5f5',
                      borderRadius: '8px',
                      border: '2px dashed #d5d5d5'
                    }} />
                  )}
                </div>

                {/* Navigation Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}>
                  <button
                    onClick={() => paginateAnnouncements(-1)}
                    disabled={announcementSlides.length === 0}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #ccc',
                      backgroundColor: '#fff',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: announcementSlides.length === 0 ? 0.5 : 1,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => !announcementSlides.length === 0 && (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    <KeyboardArrowLeft style={{ fontSize: '20px', color: '#555' }} />
                  </button>

                  {/* Dots Navigation */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {announcementSlides.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => goToAnnouncementSlide(idx)}
                        style={{
                          height: '6px',
                          borderRadius: '50%',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          backgroundColor: idx === currentAnnouncementIndex ? '#083D77' : '#ddd',
                          width: idx === currentAnnouncementIndex ? '20px' : '6px'
                        }}
                        aria-label={`Go to slide ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => paginateAnnouncements(1)}
                    disabled={announcementSlides.length === 0}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #ccc',
                      backgroundColor: '#fff',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: announcementSlides.length === 0 ? 0.5 : 1,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => !announcementSlides.length === 0 && (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    <KeyboardArrowRight style={{ fontSize: '20px', color: '#555' }} />
                  </button>
                </div>

                {/* Progress Indicator */}
                <div style={{ padding: '0 16px 8px' }}>
                  <div style={{ height: '4px', backgroundColor: '#e5e5e5', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        backgroundColor: '#083D77',
                        width: `${((currentAnnouncementIndex + 1) / announcementSlides.length) * 100}%`,
                        transition: 'width 0.5s ease'
                      }}
                    />
                  </div>
                </div>

                {/* Slide Counter */}
                <div style={{ textAlign: 'center', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#888', fontWeight: '500' }}>
                    Slide {currentAnnouncementIndex + 1} of {announcementSlides.length}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>






      <div className="min-h-screen bg-[#F4D77E]" style={{ width: '100%', boxSizing: 'border-box', margin: 0, padding: 0 }}>
      

        {/* FEATURES Hatdog */}
        <div style={{ background: '#F4D77E', padding: '40px 0', width: '100%', boxSizing: 'border-box', margin: 0 }}>
             <div style={{ background: '#1B4B75', color: '#F4D77E', display: 'inline-block', padding: '10px 50px', borderRadius: '2px', fontWeight: 'bold', fontSize: '28px', boxShadow: '2px 2px 6px #b3a04a', fontFamily: 'Poppins, sans-serif', marginBottom: isMobile ? '30px' : '0' }}>
              FEATURES
            </div>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'center', alignItems: 'center', gap: isMobile ? '30px' : '60px', maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '0 20px' : '0' }}>
          
            <div style={{ textAlign: 'center', width: isMobile ? '100%' : '300px', maxWidth: '280px' }}>
              <div style={{ background: '#1B4B75', borderRadius: '50%', width: isMobile ? '120px' : '150px', height: isMobile ? '120px' : '150px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/Logos/2.png" alt="Tricycle Verification" style={{ width: isMobile ? '100px' : '130px', height: isMobile ? '100px' : '130px' }} />
              </div>
              <h3 style={{ fontWeight: 'bold', marginTop: '20px', color: '#111', fontFamily: 'Poppins, sans-serif', fontSize: isMobile ? '14px' : '16px' }}>TRICYCLE VERIFICATION</h3>
              <p style={{ fontSize: isMobile ? '13px' : '15px', marginTop: '10px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>Instantly check if a tricycle is registered and franchised by scanning its QR code.</p>
            </div>
           
            <div style={{ textAlign: 'center', width: isMobile ? '100%' : '300px', maxWidth: '280px' }}>
              <div style={{ background: '#1B4B75', borderRadius: '50%', width: isMobile ? '120px' : '150px', height: isMobile ? '120px' : '150px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/Logos/4.png" alt="Franchise Application" style={{ width: isMobile ? '100px' : '130px', height: isMobile ? '100px' : '130px' }} />
              </div>
              <h3 style={{ fontWeight: 'bold', marginTop: '20px', color: '#111', fontFamily: 'Poppins, sans-serif', fontSize: isMobile ? '14px' : '16px' }}>FRANCHISE APPLICATION AND RENEWAL</h3>
              <p style={{ fontSize: isMobile ? '13px' : '15px', marginTop: '10px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>Submit new franchise applications or renew your existing one online with ease.</p>
            </div>
           
            <div style={{ textAlign: 'center', width: isMobile ? '100%' : '300px', maxWidth: '280px' }}>
              <div style={{ background: '#1B4B75', borderRadius: '50%', width: isMobile ? '120px' : '150px', height: isMobile ? '120px' : '150px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/Logos/6.png" alt="Reporting Function" style={{ width: isMobile ? '100px' : '130px', height: isMobile ? '100px' : '130px' }} />
              </div>
              <h3 style={{ fontWeight: 'bold', marginTop: '20px', color: '#111', fontFamily: 'Poppins, sans-serif', fontSize: isMobile ? '14px' : '16px' }}>REPORTING FUNCTION</h3>
              <p style={{ fontSize: isMobile ? '13px' : '15px', marginTop: '10px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>Report instances of overpricing or fare disputes, ensuring passengers are charged fairly.</p>
            </div>
          </div>
          <div style={{ textAlign: 'right', maxWidth: '1100px', margin: '20px auto 0' }}>
          
          </div>
        </div>
      </div>

    {/* Footer Sectionsz */}
    <footer
  style={{
    background: "linear-gradient(90deg, #f7f7f7 0%, #f7f7f7 100%)",
    padding: "32px 0 24px 0",
    marginTop: "40px",
    width: "100%",
    boxSizing: "border-box",
    margin: 0,
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      maxWidth: "1400px",
      margin: "0 auto",
      flexWrap: "wrap",
      gap: "40px",
      width: "100%",
      boxSizing: "border-box",
      padding: "0 40px",
    }}
  >

    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "18px",
        minWidth: "300px",
      }}
    >
      <img
        src="/Logos/TRC-vLogo.png"
        alt="Vice Mayor Logo"
        style={{ width: "100px", height: "100px", objectFit: "contain" }}
      />
      <img
        src="/Logos/SBLogos.png"
        alt="Municipality Logo"
        style={{ width: "100px", height: "100px", objectFit: "contain" }}
      />
    </div>

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
            {t("landing.footerTitle")}
          </Typography>
          <Typography
            sx={{
              color: '#222',
              fontSize: { xs: '14px', md: '16px' },
              mb: 2,
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {t("landing.footerDisclaimer")}
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
            {t("landing.aboutTitle")}
          </Typography>
          <Typography
            sx={{
              color: '#222',
              fontSize: { xs: '14px', md: '16px' },
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {t("landing.aboutDescription")}
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
            {t("landing.hotlineTitle")}
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
            {t("landing.policeLabel")} - <a href="tel:09274008033">0927 400 8033</a><br />
            {t("landing.mswdoLabel")} - <a href="tel:09162840885">0916 284 0885</a><br />
            {t("landing.fireLabel")} - <a href="tel:09360620305">0936 062 0305</a><br />
            {t("landing.dilgLabel")} - <a href="tel:0906188086">0906 188 086</a><br />
            {t("landing.mdrrmoLabel")} - <a href="tel:09263833744">0926 383 3744</a><br />
            {t("landing.r2tmcLabel")} - <a href="tel:09068195569">0906 819 5569</a>
          </Box>
        </Box>
      </div>
    </footer>

    {/* Franchise Application Modal */}
    <Dialog 
      open={openFareModal} 
      onClose={() => setOpenFareModal(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
          backgroundColor: '#fff',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogContent 
        sx={{
          position: 'relative',
          p: 0,
          backgroundColor: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          maxHeight: '90vh',
          overflow: 'hidden'
        }}
      >
        {/* Header Section */}
        <Box sx={{ 
          width: '100%',
          background: 'linear-gradient(135deg, #1B4B75 0%, #143c6e 100%)',
          p: 3,
          textAlign: 'center',
          position: 'relative',
          borderRadius: '16px 16px 0 0',
          flexShrink: 0
        }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 'bold', 
              color: '#F4D77E',
              fontFamily: 'Poppins, sans-serif',
              fontSize: { xs: '18px', sm: '22px' },
              mb: 0.5
            }}
          >
            TRICYCLE FRANCHISE APPLICATION
          </Typography>
          <Typography 
            sx={{ 
              color: '#E8E0D0',
              fontFamily: 'Poppins, sans-serif',
              fontSize: '14px'
            }}
          >
            Complete all requirements below
          </Typography>
          
          {/* Close Button */}
          <IconButton
            onClick={() => setOpenFareModal(false)}
            sx={{
              position: 'absolute',
              right: 12,
              top: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: '#F4D77E',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.25)'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Tab Navigation */}
        <Box sx={{
          display: 'flex',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: '#f5f5f5',
          p: 2,
          gap: 2
        }}>
          <Button
            onClick={() => setActiveTab('documents')}
            sx={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '600',
              fontSize: '14px',
              color: activeTab === 'documents' ? '#1B4B75' : '#666',
              backgroundColor: activeTab === 'documents' ? '#fff' : 'transparent',
              border: activeTab === 'documents' ? '1px solid #ddd' : 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              textTransform: 'none',
              cursor: 'pointer'
            }}
          >
            📄 Documents
        
          </Button>
          <Button
            onClick={() => setActiveTab('fareMatrix')}
            sx={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '600',
              fontSize: '14px',
              color: activeTab === 'fareMatrix' ? '#1B4B75' : '#666',
              backgroundColor: activeTab === 'fareMatrix' ? '#fff' : 'transparent',
              border: activeTab === 'fareMatrix' ? '1px solid #ddd' : 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              textTransform: 'none',
              cursor: 'pointer'
            }}
          >
            📋 Fare Matrix
          </Button>
        </Box>

        {/* Content Section */}
        <Box sx={{ 
          width: '100%',
          p: { xs: 3, sm: 4 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          backgroundColor: '#fff',
          overflowY: 'auto',
          flex: 1,
          minHeight: '300px'
        }}>
          {activeTab === 'documents' ? (
            <>
              {/* Documents Tab Content - View Only */}
              <Box sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5
              }}>
                <Box sx={{
                  backgroundColor: '#E3F2FD',
                  border: '1px solid #BBDEFB',
                  borderRadius: '8px',
                  p: 2,
                  mb: 1
                }}>
                  <Typography sx={{ color: '#1976D2', fontSize: '14px', fontWeight: '600' }}>
                    ℹ️ Submission Location
                  </Typography>
                  <Typography sx={{ color: '#1976D2', fontSize: '12px', mt: 1 }}>
                    Business Permit & Licensing Section (BPLS)
                  </Typography>
                </Box>

                <Typography sx={{ fontSize: '13px', color: '#666', fontFamily: 'Poppins, sans-serif', fontWeight: '600', mb: 1 }}>
                  Required Documents:
                </Typography>

                {['Photocopy of Registration', 'Photocopy of Barangay Clearance', 'Photocopy of Cedula', 'Photocopy of Driver\'s License', 'Photocopy of Voters Affidavit', 'Stencil (Motor and Chassis Number)', '1 pc picture (1x1 or 2x2)', 'Long folder with fastener'].map((doc, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Typography sx={{ fontSize: '14px', color: '#333', fontFamily: 'Poppins, sans-serif', mt: 0.5 }}>•</Typography>
                    <Typography sx={{ fontSize: '14px', color: '#333', fontFamily: 'Poppins, sans-serif' }}>
                      {doc}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </>
          ) : (
            <>
              {/* Fare Matrix Tab - Image Display */}
              <Box sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'center',
                overflow: 'auto'
              }}>
                <Box
                  component="img"
                  src={fareMatrixImage}
                  alt="SB Fare Matrix"
                  sx={{
                    width: '100%',
                    height: 'auto',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    display: 'block'
                  }}
                />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    mt: 2, 
                    color: '#666',
                    fontStyle: 'italic'
                  }}
                >
                  Last updated: {fareMatrixDate}
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </DialogContent>

      {/* Modal Footer */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 2,
        p: 2,
        backgroundColor: '#f8f9fa',
        borderTop: '1px solid #eee'
      }}>
        <Button 
          onClick={() => setOpenFareModal(false)}
          sx={{
            color: '#333',
            fontFamily: 'Poppins, sans-serif',
            fontWeight: '600',
            textTransform: 'none',
            fontSize: '14px'
          }}
        >
          Cancel
        </Button>
      </Box>
    </Dialog>

    {/* Announcement Details Modal */}
    <Dialog
      open={openAnnouncementModal}
      onClose={handleCloseAnnouncementModal}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          maxHeight: '90vh'
        }
      }}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)'
          }
        }
      }}
    >
      {/* Modal Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 3,
        borderBottom: '2px solid #E5E7EB',
        background: 'linear-gradient(135deg, #083d77 0%, #0a3970 100%)'
      }}>
        <Typography 
          variant="h5" 
          component="h2" 
          sx={{ 
            fontWeight: 700, 
            color: '#fff',
            fontFamily: 'Poppins, sans-serif',
            fontSize: { xs: '1.25rem', sm: '1.5rem' },
            letterSpacing: '0.5px'
          }}
        >
          ANNOUNCEMENT DETAILS
        </Typography>
        <IconButton 
          onClick={handleCloseAnnouncementModal}
          sx={{ 
            color: '#fff',
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Modal Content */}
      <DialogContent sx={{ p: 0 }}>
        {selectedAnnouncement && (
          <Box sx={{ p: 4 }}>
            {/* Title Section */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700, 
                    color: '#1a1a1a',
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: { xs: '1.5rem', sm: '2rem' },
                    lineHeight: 1.3,
                    flex: 1
                  }}
                >
                  {selectedAnnouncement.title}
                </Typography>
                <Box
                  sx={{
                    display: 'inline-block',
                    backgroundColor: '#083D77',
                    color: '#FFEB62',
                    fontSize: '13px',
                    fontWeight: 700,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  NEW
                </Box>
              </Box>
              
              {/* Date Badge */}
              <Box
                sx={{
                  display: 'inline-block',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  padding: '6px 12px'
                }}
              >
                <Typography 
                  sx={{ 
                    fontSize: '14px', 
                    color: '#666',
                    fontWeight: 600,
                    fontFamily: 'Poppins, sans-serif'
                  }}
                >
                  {formatDate(selectedAnnouncement.date)}
                </Typography>
              </Box>
            </Box>

            {/* Divider */}
            <Box sx={{ 
              height: '2px', 
              background: 'linear-gradient(to right, #083d77, transparent)',
              mb: 3 
            }} />

            {/* Description Section */}
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="body1"
                sx={{
                  fontSize: '16px',
                  color: '#333',
                  lineHeight: 1.8,
                  fontFamily: 'Poppins, sans-serif',
                  whiteSpace: 'pre-line',
                  wordBreak: 'break-word'
                }}
              >
                {selectedAnnouncement.description}
              </Typography>
            </Box>

            {/* Additional Info if present */}
            {selectedAnnouncement.additionalInfo && (
              <Box
                sx={{
                  backgroundColor: '#f8f9fa',
                  borderLeft: '4px solid #083d77',
                  borderRadius: '4px',
                  p: 2.5,
                  mt: 3
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '14px',
                    color: '#555',
                    lineHeight: 1.6,
                    fontFamily: 'Poppins, sans-serif',
                    fontStyle: 'italic'
                  }}
                >
                  {selectedAnnouncement.additionalInfo}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      {/* Modal Footer */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 2,
        p: 3,
        backgroundColor: '#f8f9fa',
        borderTop: '1px solid #e0e0e0'
      }}>
        <Button 
          onClick={handleCloseAnnouncementModal}
          variant="contained"
          sx={{
            backgroundColor: '#083d77',
            color: '#fff',
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '14px',
            px: 4,
            py: 1,
            '&:hover': {
              backgroundColor: '#0a3970'
            }
          }}
        >
          Close
        </Button>
      </Box>
    </Dialog>

    </div>
    </AnimatedPage>
  );
};

export default LandingPage;
