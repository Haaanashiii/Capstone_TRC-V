import React, { useEffect, useState } from "react";
import '../../Styles/LandingCss/LandingPage.css';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import websocketService from '../../services/websocket';
import UnifiedNavbar from '../../components/UnifiedNavbar';
import { Button, Typography, Box, useMediaQuery, useTheme, MobileStepper, Accordion, AccordionSummary, AccordionDetails, Dialog, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SwipeableViews from 'react-swipeable-views';
import { autoPlay } from 'react-swipeable-views-utils';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SBFareImage from '../../assets/SB Fare.jpeg';

// --- Added for mobile carousel auto-play
const AutoPlaySwipeableViews = autoPlay(SwipeableViews);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';

const Card = ({ children, className }) => (
  <div className={className}>{children}</div>
);

const LandingPage = () => {
  const { login } = useAuth();
  const { t } = useTranslation();
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [openFareModal, setOpenFareModal] = useState(false);
  
  // --- Added for responsiveness and carousel
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeAnnouncementStep, setActiveAnnouncementStep] = useState(0);
  const [activeFeatureStep, setActiveFeatureStep] = useState(0);
  
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

    // Connect to WebSocket for real-time announcement updates
    if (!websocketService.isConnected()) {
      console.log('[LandingPage] Connecting to WebSocket');
      websocketService.connect();  // Auto-joins 'announcements' room
    }

    // Subscribe to announcement updates
    const handleAnnouncementCreated = (newAnnouncement) => {
      if (newAnnouncement.published) {
        console.log('[LandingPage] WebSocket event - announcement-created', newAnnouncement);
        setAnnouncements(prev => [newAnnouncement, ...prev]);
      }
    };

    const handleAnnouncementUpdated = (updatedAnnouncement) => {
      console.log('[LandingPage] WebSocket event - announcement-updated', updatedAnnouncement);
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
      console.log('[LandingPage] WebSocket event - announcement-deleted', data);
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
  
  // --- Features data
  const features = [
    {
      icon: '/Logos/2.png',
      title: t("landing.feature1Title"),
      description: t("landing.feature1Description")
    },
    {
      icon: '/Logos/4.png',
      title: t("landing.feature2Title"),
      description: t("landing.feature2Description")
    },
    {
      icon: '/Logos/6.png',
      title: t("landing.feature3Title"),
      description: t("landing.feature3Description")
    }
  ];

  
  return (
    <div className="landing-root">
      {/* Use UnifiedNavbar - automatically handles landing page mode */}
      <UnifiedNavbar />

      {/* Main Content */}
      <main className="landing-main">
        
        <div className="main-content">
          <h1 dangerouslySetInnerHTML={{ __html: t("landing.heroSubtitle") }}></h1>
          <Button 
            variant="contained" 
            sx={{ 
              mt: 3, 
              backgroundColor: '#1B4B75',
              color: '#F4D77E',
              fontWeight: 'bold',
              padding: '12px 30px',
              fontSize: '16px',
              fontFamily: 'Poppins, sans-serif',
              '&:hover': {
                backgroundColor: '#143c6e'
              }
            }}
            onClick={() => setOpenFareModal(true)}
          >
            View Fare Matrix
          </Button>
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
      <section style={{ background: '#fff', padding: '60px 20px' }}>
        <Box sx={{ maxWidth: '1100px', margin: '0 auto' }}>
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
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>
                {t("landing.faq1Question")}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif' }}>
                {t("landing.faq1Answer")}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>
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
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>
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
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>
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
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>
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

      {/* Announcements Section - Dynamic with Mobile Carousel */}
      <section className="announcements-section">
        <div className="announcements-title">{t("landing.announcementsTitle")}</div>
        
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
                  {t("landing.loadingAnnouncements")}
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
                  {t("landing.noAnnouncements")}
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
            {t("landing.featuresTitle")}
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
      </Box>
    </Box>

    {/* Fare Matrix Modal */}
    <Dialog 
      open={openFareModal} 
      onClose={() => setOpenFareModal(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
          backgroundColor: '#f8f9fa',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogContent 
        sx={{
          position: 'relative',
          p: 0,
          backgroundColor: '#f8f9fa',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
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
            TRICYCLE FARE MATRIX
          </Typography>
          <Typography 
            sx={{ 
              color: '#E8E0D0',
              fontFamily: 'Poppins, sans-serif',
              fontSize: '14px'
            }}
          >
            Municipality of Solano
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

        {/* Image Container - Scrollable */}
        <Box sx={{ 
          width: '100%',
          p: { xs: 2, sm: 3 },
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          backgroundColor: '#fff',
          borderRadius: '0 0 16px 16px',
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1
        }}>
          <Box
            component="img"
            src={SBFareImage}
            alt="SB Fare Matrix"
            sx={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>

  </div> 
);
};

export default LandingPage;
