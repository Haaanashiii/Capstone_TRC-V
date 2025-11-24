import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import '../../Styles/LandingCss/LandingPage.css';
import { useAuth } from '../../contexts/AuthContext';
import UnifiedNavbar from '../../components/UnifiedNavbar';
import { Button, Typography, Box, useMediaQuery, useTheme, MobileStepper, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import SwipeableViews from 'react-swipeable-views';
import { autoPlay } from 'react-swipeable-views-utils';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// --- Added for mobile carousel auto-play
const AutoPlaySwipeableViews = autoPlay(SwipeableViews);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';

const Card = ({ children, className }) => (
  <div className={className}>{children}</div>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  
  // --- Added for responsiveness and carousel
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeAnnouncementStep, setActiveAnnouncementStep] = useState(0);
  const [activeFeatureStep, setActiveFeatureStep] = useState(0);
  
  // Get display name from AuthContext user or fallback to token decode
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

  const handleRenewFranchise = () => {
    if (displayName && userHasFranchise) {
      // User is logged in and has an active franchise - show message or navigate
      // For now, just navigate to login (can be enhanced later)
      navigate('/login');
    } else {
      // User is not logged in or doesn't have a franchise
      navigate('/login');
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
    <div className="landing-root">
      {/* Use UnifiedNavbar - automatically handles landing page mode */}
      <UnifiedNavbar />

      {/* Main Content */}
      <main className="landing-main">
        
        <div className="main-content">
          <h1>Tricycle Verification and<br />Hassle-Free Online<br />Franchise in Solano</h1>
           {/* For button  */}
          <div className="main-buttons">
            <button className="main-btn yellow" onClick={handleRenewFranchise}>RENEW A FRANCHISE</button>
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
            Frequently Asked Questions
          </Typography>
          
          <Accordion sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>
                How do I apply for a tricycle franchise?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif' }}>
                To apply for a tricycle franchise, register an account on our platform, complete the online application form with all required documents, and submit it for BPLO review. You'll be notified of the approval status through the system.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>
                What documents are required for franchise application?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif' }}>
                Required documents include: Motor registration (OR/CR), Barangay clearance, Cedula, Driver's license, Motor chassis stencil rubbing, and operator/driver photos (1x1). All documents can be uploaded directly through the online form.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>
                How long does the approval process take?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif' }}>
                The approval process typically takes 5-10 business days. First, BPLO reviews your application, then it's forwarded to the Sangguniang Bayan for final approval. You can track your application status in real-time through your dashboard.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>
                How does the QR code verification system work?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif' }}>
                Once your franchise is approved, a unique QR code is generated for your tricycle. Passengers can scan this code to instantly verify your franchise status, view driver information, and confirm that your vehicle is legally registered and compliant.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ background: '#f5f5f5' }}>
              <Typography sx={{ fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>
                What if my application is disapproved?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif' }}>
                If your application is disapproved, you'll receive a notification with the specific reason. You can then edit and resubmit your application with the necessary corrections through your operator dashboard. All your previous data will be prefilled for easy editing.
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Box>
      </section>

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
