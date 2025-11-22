import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import UnifiedNavbar from "../../components/UnifiedNavbar";
import { useAuth } from "../../contexts/AuthContext";
import "../../Styles/Operator's_CSS/OperatorHomePage.css";
import { Link2, PlusCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Modal,
  Box,
  IconButton,
  Chip,
  Button,
  Dialog,
  DialogContent,
  TextField
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { franchiseAPI } from '../Services/api';

const OperatorHomePage = () => {
  // Use AuthContext for user data (consistent with UnifiedSidebar)
  const { user: authUser } = useAuth();
  
  // Get user data from AuthContext or fallback to direct token decode
  const getUser = () => {
    if (authUser) return authUser;
    
    // Fallback: decode token directly (same approach as Admin Sidebar)
    try {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        return decoded;
      }
    } catch (error) {
      console.error('[OperatorHomePage] Error decoding token:', error);
    }
    
    return null;
  };
  
  const currentUser = getUser();
  
  // Use authUser from context instead of fetching separately
  useEffect(() => {
    if (currentUser) {
      console.log('[OperatorHomePage] User data:', currentUser);
    }
    
    // Use sessionStorage for franchise info (cleared on tab close - more secure)
    const savedFranchiseInfo = sessionStorage.getItem('userFranchiseInfo');
    const savedFranchiseLinked = sessionStorage.getItem('franchiseLinked');
    const savedOwnerUserId = sessionStorage.getItem('franchiseOwnerUserId');

    // Only restore saved franchise info if it belongs to the currently logged-in user
    try {
      const token = sessionStorage.getItem('accessToken');
      let tokenUserId = null;
      if (token) {
        try { tokenUserId = JSON.parse(atob(token.split('.')[1])).id } catch { tokenUserId = null }
      }

      if (savedFranchiseInfo && savedFranchiseLinked === 'true' && savedOwnerUserId && tokenUserId && savedOwnerUserId === tokenUserId) {
        try {
          const parsedInfo = JSON.parse(savedFranchiseInfo);
          setUserFranchiseInfo(parsedInfo);
          setFranchiseLinked(true);
        } catch (error) {
          console.error('Error parsing saved franchise info:', error);
        }
      }
    } catch {
      console.warn('Error while restoring franchise info from storage')
    }
  }, [authUser]);

  // Fetch approved franchises and auto-link if the logged-in operator has one
  useEffect(() => {
    const tryFetchApproved = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170'
        const resp = await fetch(`${API_BASE_URL}/api/franchise-applications?status=approved`)
        if (!resp.ok) return
        const apps = await resp.json()
        if (!Array.isArray(apps) || !apps.length) return

        // Try to match by user ID from JWT
        const token = sessionStorage.getItem('accessToken')
        let userId = null
        if (token) {
          try { userId = JSON.parse(atob(token.split('.')[1])).id } catch { /* ignore */ }
        }

        const matched = apps.find(a => {
          if (!a || !a.userId) return false
          // Match franchise to logged-in user by userId
          return a.userId === userId
        })

        if (matched) {
          const franchiseInfo = {
            orNumber: matched.franchiseNumber,
            status: 'ACTIVE',
            linkedDate: matched.approvedAt || new Date().toLocaleDateString(),
            franchiseNumber: matched.franchiseNumber,
            make: matched.unitModel || matched.make,
            plateNumber: matched.plateNumber || matched.mvPlate,
            sidecarNumber: matched.sidecarPlateNumber,
            expiryDate: matched.expiryDate
          }
          setUserFranchiseInfo(franchiseInfo)
          setFranchiseLinked(true)
          sessionStorage.setItem('userFranchiseInfo', JSON.stringify(franchiseInfo))
          sessionStorage.setItem('franchiseLinked', 'true')
          // persist owner userId so only that user is recognized as linked
          try {
            if (userId) sessionStorage.setItem('franchiseOwnerUserId', userId)
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.warn('Error fetching approved franchises', err)
      }
    }

    tryFetchApproved()
  }, [])
  
  // Language state
  const [language, setLanguage] = useState('en'); // 'en' for English, 'tl' for Tagalog
  

  const translations = {
    en: {
      user: "USER",
      franchiseLinked: "FRANCHISE LINKED",
      noFranchise: "NO FRANCHISE",
      franchiseDetails: "FRANCHISE DETAILS",
      orNumber: "O.R. Number",
      status: "Status",
      linkedOn: "Linked on",
      franchiseApplication: "FRANCHISE APPLICATION",
      questionText: "Do you already have a franchise with us?",
      yesLink: "Yes, Link my franchise",
      noApply: "No, apply for a new franchise",
      franchiseLinkTitle: "Franchise Link",
      franchiseLinkDesc: "Link your existing franchise to TRC-V for easy management of tricycle franchise",
      orNumberLabel: "Franchise Number",
      orNumberPlaceholder: "Enter Franchise Number",
      uploadMtop: "Upload MTOF Document",
      browseFiles: "Browse Files to upload",
      noFileSelected: "No selected File -",
      numbersOnlyWarning: "Numbers only are accepted",
      pleaseProvideWarning: "Please provide both O.R. Number and MTOP document",
      cancel: "Cancel",
      submit: "Submit",
      toggleLanguage: "Tagalog"
    },
    tl: {
      user: "USER",
      franchiseLinked: "NAKAUGNAY NA ANG PRANGKISA",
      noFranchise: "WALANG PRANGKISA",
      franchiseDetails: "MGA DETALYE NG PRANGKISA",
      orNumber: "Numero ng O.R.",
      status: "Katayuan",
      linkedOn: "Naikaugnay noong",
      franchiseApplication: "APLIKASYON PARA SA PRANGKISA",
      questionText: "Mayroon ka na bang prangkisa sa amin?",
      yesLink: "Oo, Iugnay ang aking prangkisa",
      noApply: "Hindi, mag-apply para sa bagong prangkisa",
      franchiseLinkTitle: "Pag-uugnay ng Prangkisa",
      franchiseLinkDesc: "Iugnay ang inyong kasalukuyang prangkisa sa TRC-V para sa madaling pamamahala ng tricycle franchise",
      orNumberLabel: "Numero ng O.R.",
      orNumberPlaceholder: "Ilagay ang Numero ng O.R.",
      uploadMtop: "Mag-upload ng MTOP Document",
      browseFiles: "Mag-browse ng mga file para i-upload",
      noFileSelected: "Walang napiling File -",
      numbersOnlyWarning: "Mga numero lamang ang tatanggapin",
      pleaseProvideWarning: "Mangyaring magbigay ng O.R. Number at MTOP document",
      cancel: "Kanselahin",
      submit: "Ipasa",
      toggleLanguage: "English"
    }
  };
  
  const t = translations[language];

  const [showModal, setShowModal] = useState(false);
  const [orNumber, setOrNumber] = useState("");
  const [mtopFile, setMtopFile] = useState(null);
  const [orWarning, setOrWarning] = useState("");
  const [franchiseLinked, setFranchiseLinked] = useState(false);
  const [userFranchiseInfo, setUserFranchiseInfo] = useState(null);
  const [openNoticeModal, setOpenNoticeModal] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState('');
  const [userApplications, setUserApplications] = useState([]);
  const [openORModal, setOpenORModal] = useState(false);
  const [selectedAppForOR, setSelectedAppForOR] = useState(null);
  const [orNumberInput, setOrNumberInput] = useState('');
  const [orFileInput, setOrFileInput] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // Fetch user's franchise applications
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const response = await franchiseAPI.getMyApplications();
        if (response.data?.success && Array.isArray(response.data.data)) {
          setUserApplications(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching applications:', error);
      }
    };
    
    if (currentUser) {
      fetchApplications();
    }
  }, [currentUser]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Update greeting based on time of day
  useEffect(() => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting('GOOD MORNING');
    } else if (hour >= 12 && hour < 18) {
      setGreeting('GOOD AFTERNOON');
    } else {
      setGreeting('GOOD EVENING');
    }
  }, [currentTime]);

  // Format time as HH:MM:SS AM/PM
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    });
  };

  // Format date as MONTH DD, YYYY
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  useEffect(() => {
    console.log('[OperatorHomePage] Checking user franchise status');
    // Check if user already has franchise in JWT
    try {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        if (decoded.hasFranchise === true) {
          console.log('[OperatorHomePage] User has franchise, showing home page');
        } else {
          console.log('[OperatorHomePage] User has no franchise, showing application options');
        }
      }
    } catch (e) {
      console.error('[OperatorHomePage] Error checking franchise status:', e);
    }
  }, [navigate])

  const handleSubmitFranchiseLink = () => {
    if (!orNumber || !mtopFile) {
      alert(t.pleaseProvideWarning);
      return;
    }

    // API call
    const franchiseInfo = {
      orNumber: orNumber,
      status: "ACTIVE",
      linkedDate: new Date().toLocaleDateString()
    };

    setUserFranchiseInfo(franchiseInfo);
    setFranchiseLinked(true);
    
    // Store franchise info in sessionStorage so FranchiseeListOperatorSide can access it
    try { sessionStorage.setItem('userFranchiseInfo', JSON.stringify(franchiseInfo)) } catch { /* ignore */ }
    try { sessionStorage.setItem('franchiseLinked', 'true') } catch { /* ignore */ }
    // persist owner userId so other users won't pick up this data
    try {
      const token = sessionStorage.getItem('accessToken')
      if (token) {
        try { const payload = JSON.parse(atob(token.split('.')[1])); if (payload?.id) sessionStorage.setItem('franchiseOwnerUserId', payload.id) } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    
    setShowModal(false);
    
    // For reset 
    setOrNumber("");
    setMtopFile(null);
    setOrWarning("");
  };


  const handleLinkFranchise = () => setShowModal(true);
  const handleApplyNew = () => navigate('/operator/franchise/application');

  const handleOpenNoticeModal = (application) => {
    // Create notice object from application data
    const notice = {
      id: application._id,
      application: application,
      noticeType: application.statusOfBPLO === 'bplo-disapproved' ? 'BPLO Disapproval' : 
                  application.statusOfBPLO === 'bplo-approved' ? 'BPLO Approval' : 'Application Status',
      message: application.statusOfBPLO === 'bplo-disapproved' ? 
                `Your application requires attention. Reason: ${application.bploDisapprovedReason}` : 
                application.statusOfBPLO === 'bplo-approved' ?
                'Your application has been approved by BPLO. Please submit your Official Receipt.' :
                'Your application is being processed.',
      date: application.bploApprovedAt || application.submittedAt,
      status: application.statusOfBPLO
    };
    setSelectedNotice(notice);
    setOpenNoticeModal(true);
  };

  const handleCloseNoticeModal = () => {
    setOpenNoticeModal(false);
    setSelectedNotice(null);
  };

  const handleOpenORModal = (application) => {
    setSelectedAppForOR(application);
    setOrNumberInput('');
    setOrFileInput(null);
    setOpenORModal(true);
  };

  const handleCloseORModal = () => {
    setOpenORModal(false);
    setSelectedAppForOR(null);
    setOrNumberInput('');
    setOrFileInput(null);
  };

  const handleSubmitOR = async () => {
    if (!orNumberInput.trim() || !orFileInput) {
      alert('Please provide both OR Number and OR Document');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('officialReceiptNumber', orNumberInput.trim());
      formData.append('oRTreasurerOfficeObj', orFileInput);

      await franchiseAPI.submitOR(selectedAppForOR._id, formData);

      alert('OR submitted successfully! Your application will now proceed to SB for final approval.');
      
      // Refresh applications
      const response = await franchiseAPI.getMyApplications();
      if (response.data?.success && Array.isArray(response.data.data)) {
        setUserApplications(response.data.data);
      }

      handleCloseORModal();
    } catch (error) {
      console.error('Error submitting OR:', error);
      alert(error.response?.data?.error || 'Failed to submit OR. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="franchise-bg">
      <UnifiedNavbar 
        userType="operator"
        language={language}
        onLanguageToggle={() => setLanguage(language === 'en' ? 'tl' : 'en')}
        translations={t}
      />

      <div className="franchise-page-content" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
      }}>
          {/* Yellow Header Card with Date/Time */}
          <Box sx={{ 
            background: '#FEDE05', 
            borderRadius: '16px', 
            padding: { xs: '20px', sm: '28px', md: '32px' }, 
            marginBottom: '32px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            width: '100%',
            maxWidth: '900px'
          }}>
            <Typography variant="h4" sx={{ 
              color: '#174D7A', 
              fontWeight: 700, 
              textAlign: 'center',
              fontFamily: 'Poppins, sans-serif',
              marginBottom: '8px',
              fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
            }}>
              {greeting}, {(currentUser?.full_name || currentUser?.name || 'USER').toUpperCase()}
            </Typography>
            <Typography sx={{ 
              color: '#174D7A', 
              fontSize: '14px',
              fontFamily: 'Poppins, sans-serif',
              textAlign: 'center',
              fontWeight: 400
            }}>
              Today is {formatDate(currentTime)} {formatTime(currentTime)}
            </Typography>
          </Box>

          {/* White Card Section */}
          <Box sx={{ 
            background: '#fff', 
            borderRadius: '16px', 
            padding: { xs: '24px', sm: '32px', md: '40px' }, 
            marginBottom: '32px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            width: '100%',
            maxWidth: '900px'
          }}>
            <Typography variant="h4" sx={{ 
              color: '#174D7A', 
              fontWeight: 700, 
              textAlign: 'center',
              marginBottom: '16px',
              fontFamily: 'Poppins, sans-serif',
              fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
            }}>
              FRANCHISE APPLICATION
            </Typography>
            <Typography sx={{ 
              color: '#000', 
              fontWeight: 500, 
              textAlign: 'center',
              marginBottom: '40px',
              fontSize: { xs: '16px', sm: '17px', md: '18px' },
              fontFamily: 'Poppins, sans-serif'
            }}>
              Do you already have a franchise with us?
            </Typography>

      
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, 
              gap: '20px',
              maxWidth: '700px',
              margin: '0 auto'
            }}>
             
              <Box sx={{ 
                background: '#FEDE05', 
                borderRadius: '12px', 
                padding: { xs: '24px', sm: '28px', md: '32px' },
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.15)'
                }
              }}
              onClick={handleLinkFranchise}
              >
                <Box sx={{ marginBottom: '16px' }}>
                  <Link2 style={{ width: 32, height: 32, color: '#174D7A' }} />
                </Box>
                <Typography variant="h6" sx={{ 
                  color: '#174D7A', 
                  fontWeight: 700,
                  marginBottom: '8px',
                  fontFamily: 'Poppins, sans-serif'
                }}>
                  Yes, Link my franchise
                </Typography>
                <Typography sx={{ 
                  color: '#174D7A', 
                  fontSize: '14px',
                  fontFamily: 'Poppins, sans-serif'
                }}>
                  Connect your existing franchise.
                </Typography>
              </Box>

              {/* No, apply for a new franchise */}
              <Box sx={{ 
                background: '#FEDE05', 
                borderRadius: '12px', 
                padding: { xs: '24px', sm: '28px', md: '32px' },
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.15)'
                }
              }}
              onClick={handleApplyNew}
              >
                <Box sx={{ marginBottom: '16px' }}>
                  <PlusCircle style={{ width: 32, height: 32, color: '#174D7A' }} />
                </Box>
                <Typography variant="h6" sx={{ 
                  color: '#174D7A', 
                  fontWeight: 700,
                  marginBottom: '8px',
                  fontFamily: 'Poppins, sans-serif'
                }}>
                  No, apply for a new franchise
                </Typography>
                <Typography sx={{ 
                  color: '#174D7A', 
                  fontSize: '14px',
                  fontFamily: 'Poppins, sans-serif'
                }}>
                  Apply your franchise now.
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Active Franchises Table */}
          <Box sx={{ width: '100%', maxWidth: '900px' }}>
            <Typography variant="h6" sx={{ 
              color: '#fff', 
              fontWeight: 700, 
              marginBottom: '16px',
              marginTop: '32px',
              fontFamily: 'Poppins, sans-serif',
              fontSize: { xs: '1.125rem', sm: '1.25rem' }
            }}>
              ACTIVE FRANCHISES
            </Typography>
            
            <TableContainer component={Paper} sx={{ 
              marginBottom: '32px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            '& .MuiTableCell-head': {
              backgroundColor: '#174D7A',
              color: '#fff',
              fontWeight: 700,
              fontSize: { xs: '12px', sm: '13px', md: '14px' },
              position: 'sticky',
              top: 0,
              zIndex: 10,
              fontFamily: 'Poppins, sans-serif'
            },
            '& .MuiTableCell-body': {
              fontSize: { xs: '12px', sm: '13px', md: '14px' },
              fontFamily: 'Poppins, sans-serif'
            },
            '& .MuiTableRow-root': {
              '&:hover': {
                backgroundColor: '#f5f7fa'
              }
            }
          }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>No.</TableCell>
                  <TableCell>Franchise Number</TableCell>
                  <TableCell>Make</TableCell>
                  <TableCell>Plate Number</TableCell>
                  <TableCell>Sidecar Number</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Expiry Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {franchiseLinked && userFranchiseInfo ? (
                  <TableRow>
                    <TableCell>1</TableCell>
                    <TableCell>{userFranchiseInfo.franchiseNumber || userFranchiseInfo.orNumber || 'N/A'}</TableCell>
                    <TableCell>{userFranchiseInfo.make || 'N/A'}</TableCell>
                    <TableCell>{userFranchiseInfo.plateNumber || 'N/A'}</TableCell>
                    <TableCell>{userFranchiseInfo.sidecarNumber || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={userFranchiseInfo.status}
                        size="small"
                        sx={{
                          backgroundColor: '#2ecc71',
                          color: '#fff',
                          fontWeight: 600
                        }}
                      />
                    </TableCell>
                    <TableCell>{userFranchiseInfo.expiryDate ? new Date(userFranchiseInfo.expiryDate).toLocaleDateString() : 'N/A'}</TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                      No active franchise
                    </TableCell>
                  </TableRow>
                )}  
              </TableBody>
            </Table>
          </TableContainer>
          </Box>

          {/* Franchise Information Table */}
          {franchiseLinked && userFranchiseInfo && (
            <Box sx={{ width: '100%', maxWidth: '900px' }}>
              <Typography variant="h6" sx={{
                color: '#fff', 
                fontWeight: 700, 
                marginBottom: '16px',
                marginTop: '32px',
                fontFamily: 'Poppins, sans-serif',
                fontSize: { xs: '1.125rem', sm: '1.25rem' }
              }}>
                MY FRANCHISE INFORMATION
              </Typography>
              
              <TableContainer component={Paper} sx={{ 
                marginBottom: '32px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                '& .MuiTableCell-head': {
                  backgroundColor: '#174D7A',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: { xs: '12px', sm: '13px', md: '14px' },
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  fontFamily: 'Poppins, sans-serif'
                },
                '& .MuiTableCell-body': {
                  fontSize: { xs: '12px', sm: '13px', md: '14px' },
                  fontFamily: 'Poppins, sans-serif'
                },
                '& .MuiTableRow-root': {
                  '&:hover': {
                    backgroundColor: '#f5f7fa'
                  }
                }
              }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Franchise Number</TableCell>
                      <TableCell>Make</TableCell>
                      <TableCell>Plate Number</TableCell>
                      <TableCell>Sidecar Number</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Expiry Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>{userFranchiseInfo.franchiseNumber || userFranchiseInfo.orNumber || 'N/A'}</TableCell>
                      <TableCell>{userFranchiseInfo.make || 'N/A'}</TableCell>
                      <TableCell>{userFranchiseInfo.plateNumber || 'N/A'}</TableCell>
                      <TableCell>{userFranchiseInfo.sidecarNumber || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip 
                          label={userFranchiseInfo.status}
                          size="small"
                          sx={{
                            backgroundColor: '#2ecc71',
                            color: '#fff',
                            fontWeight: 600
                          }}
                        />
                      </TableCell>
                      <TableCell>{userFranchiseInfo.expiryDate ? new Date(userFranchiseInfo.expiryDate).toLocaleDateString() : 'N/A'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Pending Applications Section */}
          <Box sx={{ width: '100%', maxWidth: '900px' }}>
            <Typography variant="h6" sx={{ 
              color: '#fff',
            fontWeight: 700, 
            marginBottom: '16px',
            marginTop: '32px',
            fontFamily: 'Poppins, sans-serif',
            fontSize: { xs: '1.125rem', sm: '1.25rem' }
          }}>
            MY APPLICATIONS
          </Typography>

          {userApplications.length > 0 ? (
            <TableContainer component={Paper} sx={{ 
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              '& .MuiTableCell-head': {
                backgroundColor: '#174D7A',
                color: '#fff',
                fontWeight: 700,
                fontSize: { xs: '12px', sm: '13px', md: '14px' },
                position: 'sticky',
                top: 0,
                zIndex: 10,
                fontFamily: 'Poppins, sans-serif'
              },
              '& .MuiTableCell-body': {
                fontSize: { xs: '12px', sm: '13px', md: '14px' },
                fontFamily: 'Poppins, sans-serif'
              },
              '& .MuiTableRow-root': {
                '&:hover': {
                  backgroundColor: '#f5f7fa'
                }
              }
            }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>No.</TableCell>
                    <TableCell>Plate Number</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Submitted</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userApplications.map((app, index) => (
                    <TableRow key={app._id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{app.mvPlateNo}</TableCell>
                      <TableCell>
                        <Chip 
                          label={
                            app.statusOfBPLO === 'pending' ? 'Pending Review' :
                            app.statusOfBPLO === 'bplo-approved' ? 'BPLO Approved - Submit OR' :
                            app.statusOfBPLO === 'bplo-disapproved' ? 'Disapproved' :
                            app.statusOfBPLO === 'awaiting-sb' ? 'Awaiting SB Approval' :
                            app.statusOfBPLO === 'sb-approved' ? 'Finally Approved' :
                            app.statusOfBPLO
                          }
                          size="small"
                          sx={{
                            backgroundColor: 
                              app.statusOfBPLO === 'bplo-disapproved' ? '#e74c3c' :
                              app.statusOfBPLO === 'bplo-approved' ? '#f39c12' :
                              app.statusOfBPLO === 'awaiting-sb' ? '#3498db' :
                              app.statusOfBPLO === 'sb-approved' ? '#2ecc71' :
                              '#95a5a6',
                            color: '#fff',
                            fontWeight: 600
                          }}
                        />
                      </TableCell>
                      <TableCell>{new Date(app.submittedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {app.statusOfBPLO === 'bplo-approved' && !app.officialReceiptNumber && (
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleOpenORModal(app)}
                            sx={{
                              backgroundColor: '#FEDE05',
                              color: '#174D7A',
                              fontWeight: 600,
                              fontSize: '12px',
                              '&:hover': {
                                backgroundColor: '#e5c900'
                              }
                            }}
                          >
                            Submit OR
                          </Button>
                        )}
                        {(app.statusOfBPLO === 'bplo-disapproved' || app.statusOfBPLO === 'bplo-approved') && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleOpenNoticeModal(app)}
                            sx={{
                              ml: app.statusOfBPLO === 'bplo-approved' && !app.officialReceiptNumber ? 1 : 0,
                              borderColor: '#174D7A',
                              color: '#174D7A',
                              fontSize: '12px',
                              '&:hover': {
                                borderColor: '#0f3a5f',
                                backgroundColor: 'rgba(23, 77, 122, 0.04)'
                              }
                            }}
                          >
                            View Details
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ 
              background: '#fff', 
              borderRadius: '12px', 
              padding: '40px', 
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <Typography sx={{ 
                color: '#666', 
                fontSize: '16px',
                fontFamily: 'Poppins, sans-serif'
              }}>
                You do not have any applications yet.
              </Typography>
            </Box>
          )}
          </Box>
        </div>

      {/* Link Franchise Modal */}
      <Dialog
        open={showModal}
        onClose={() => setShowModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '550px'
          }
        }}
      >
        <DialogContent sx={{ padding: 0 }}>
          {/* Modal Header */}
          <Box sx={{ marginBottom: '8px' }}>
            <Typography
              sx={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#000',
                fontFamily: 'Poppins, sans-serif',
                marginBottom: '4px'
              }}
            >
              Franchise Link
            </Typography>
            <Typography
              sx={{
                fontSize: '14px',
                color: '#6b7280',
                fontFamily: 'Poppins, sans-serif',
                marginBottom: '24px'
              }}
            >
              Link your existing franchise to TRC-V for easy management of tricycle franchise
            </Typography>
          </Box>

          {/* Franchise Number Input */}
          <Box sx={{ marginBottom: '24px' }}>
            <Typography
              sx={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#000',
                fontFamily: 'Poppins, sans-serif',
                marginBottom: '8px'
              }}
            >
              Franchise Number
            </Typography>
            <TextField
              fullWidth
              value={orNumber}
              onChange={e => {
                const val = e.target.value;
                if (/[^0-9]/.test(val)) {
                  setOrWarning(t.numbersOnlyWarning);
                } else {
                  setOrWarning("");
                }
                setOrNumber(val.replace(/[^0-9]/g, ""));
              }}
              placeholder="Enter Franchise Number"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  fontFamily: 'Poppins, sans-serif',
                  '& fieldset': {
                    borderColor: '#e5e7eb',
                  },
                  '&:hover fieldset': {
                    borderColor: '#d1d5db',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#174D7A',
                  }
                }
              }}
            />
            {orWarning && (
              <Typography sx={{ color: '#b71c1c', fontSize: '14px', marginTop: '4px', fontFamily: 'Poppins, sans-serif' }}>
                ⚠️ {orWarning}
              </Typography>
            )}
          </Box>

          {/* Upload MTOF Document */}
          <Box sx={{ marginBottom: '32px' }}>
            <Typography
              sx={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#000',
                fontFamily: 'Poppins, sans-serif',
                marginBottom: '8px'
              }}
            >
              Upload MTOF Document
            </Typography>
            
            {/* Upload Box */}
            <Box
              sx={{
                border: '2px dashed #174D7A',
                borderRadius: '12px',
                padding: '32px',
                textAlign: 'center',
                backgroundColor: '#f9fafb',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: '#f3f4f6',
                  borderColor: '#0f3a5f'
                }
              }}
              onClick={() => document.getElementById('mtop-upload').click()}
            >
              <CloudUploadIcon sx={{ fontSize: 48, color: '#174D7A', marginBottom: '8px' }} />
              <Typography
                sx={{
                  fontSize: '14px',
                  color: '#174D7A',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500
                }}
              >
                Browse Files to upload
              </Typography>
              <input
                id="mtop-upload"
                type="file"
                style={{ display: "none" }}
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setMtopFile(e.target.files[0])}
              />
            </Box>
            
            {/* File name display */}
            <Box
              sx={{
                marginTop: '12px',
                padding: '12px 16px',
                backgroundColor: '#e8f4f8',
                borderRadius: '8px',
                textAlign: 'center'
              }}
            >
              <Typography
                sx={{
                  fontSize: '14px',
                  color: '#374151',
                  fontFamily: 'Poppins, sans-serif'
                }}
              >
                {mtopFile ? mtopFile.name : 'No selected File -'}
              </Typography>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="outlined"
              onClick={() => setShowModal(false)}
              sx={{
                borderRadius: '8px',
                padding: '12px 32px',
                fontSize: '16px',
                fontWeight: 600,
                fontFamily: 'Poppins, sans-serif',
                textTransform: 'none',
                borderColor: '#d1d5db',
                color: '#6b7280',
                minWidth: '120px',
                '&:hover': {
                  borderColor: '#9ca3af',
                  backgroundColor: '#f9fafb'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmitFranchiseLink}
              sx={{
                borderRadius: '8px',
                padding: '12px 32px',
                fontSize: '16px',
                fontWeight: 600,
                fontFamily: 'Poppins, sans-serif',
                textTransform: 'none',
                backgroundColor: '#174D7A',
                minWidth: '120px',
                '&:hover': {
                  backgroundColor: '#0f3a5f'
                }
              }}
            >
              Submit
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Notice Modal */}
      <Modal
        open={openNoticeModal}
        onClose={handleCloseNoticeModal}
        aria-labelledby="notice-modal-title"
      >
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 550,
          bgcolor: 'background.paper',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          overflow: 'hidden'
        }}>
          {/* Modal Header */}
          <Box sx={{ 
            background: '#174D7A', 
            padding: '24px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography id="notice-modal-title" variant="h5" component="h2" sx={{ 
              color: '#fff', 
              fontWeight: 700,
              fontFamily: 'Poppins, sans-serif'
            }}>
              {selectedNotice?.noticeType || 'BPLO Notice'}
            </Typography>
            <IconButton 
              onClick={handleCloseNoticeModal}
              sx={{ 
                color: '#fff',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.1)'
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          
          {/* Modal Body */}
          <Box sx={{ padding: '32px' }}>
            <Box sx={{
              backgroundColor: '#FEDE05',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <Typography sx={{ 
                color: '#174D7A',
                fontSize: '16px',
                fontWeight: 600,
                fontFamily: 'Poppins, sans-serif',
                lineHeight: 1.6
              }}>
                {selectedNotice?.message || 'You are required to proceed to BPLO for motorcycle information.'}
              </Typography>
            </Box>

            {/* Location Note */}
            <Box sx={{ 
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: '#f0f8ff',
              borderLeft: '4px solid #174D7A',
              borderRadius: '4px'
            }}>
              <Typography sx={{ 
                color: '#174D7A',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'Poppins, sans-serif'
              }}>
                📍 Location: Business Permit and Licensing Office, 2nd Floor
              </Typography>
            </Box>
            
            {/* Additional Info */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <Box>
                <Typography sx={{ 
                  color: '#666',
                  fontSize: '12px',
                  fontFamily: 'Poppins, sans-serif',
                  marginBottom: '4px',
                  textTransform: 'uppercase'
                }}>
                  Date
                </Typography>
                <Typography sx={{ 
                  color: '#174D7A',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: 'Poppins, sans-serif'
                }}>
                  {selectedNotice?.date ? new Date(selectedNotice.date).toLocaleDateString() : 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ 
                  color: '#666',
                  fontSize: '12px',
                  fontFamily: 'Poppins, sans-serif',
                  marginBottom: '4px',
                  textTransform: 'uppercase'
                }}>
                  Status
                </Typography>
                <Chip 
                  label={selectedNotice?.status || 'Pending'}
                  size="small"
                  sx={{
                    backgroundColor: '#f39c12',
                    color: '#fff',
                    fontWeight: 600,
                    fontFamily: 'Poppins, sans-serif'
                  }}
                />
              </Box>
            </Box>
            
            {/* Action Buttons */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
              <Button
                onClick={() => {
                  handleCloseNoticeModal();
                  navigate('/operator/franchise/application');
                }}
                sx={{
                  backgroundColor: '#FEDE05',
                  color: '#174D7A',
                  padding: '10px 32px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontFamily: 'Poppins, sans-serif',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: '#e5c900'
                  }
                }}
              >
                Edit Franchise Application
              </Button>
              <Button
                onClick={handleCloseNoticeModal}
                sx={{
                  backgroundColor: '#174D7A',
                  color: '#fff',
                  padding: '10px 32px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontFamily: 'Poppins, sans-serif',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: '#0f2d52'
                  }
                }}
              >
                Close
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal>

      {/* OR Submission Modal */}
      <Modal
        open={openORModal}
        onClose={handleCloseORModal}
        aria-labelledby="or-modal-title"
      >
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 550,
          bgcolor: 'background.paper',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          overflow: 'hidden'
        }}>
          {/* Modal Header */}
          <Box sx={{ 
            background: '#174D7A', 
            padding: '24px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography id="or-modal-title" variant="h5" component="h2" sx={{ 
              color: '#fff', 
              fontWeight: 700,
              fontFamily: 'Poppins, sans-serif'
            }}>
              Submit Official Receipt
            </Typography>
            <IconButton 
              onClick={handleCloseORModal}
              sx={{ 
                color: '#fff',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.1)'
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          
          {/* Modal Body */}
          <Box sx={{ padding: '32px' }}>
            {selectedAppForOR && (
              <Box sx={{ 
                bgcolor: '#e3f2fd', 
                p: 2, 
                borderRadius: 1, 
                mb: 3 
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Application Details:
                </Typography>
                <Typography variant="body2">
                  Plate Number: {selectedAppForOR.mvPlateNo}
                </Typography>
                <Typography variant="body2">
                  Operator: {selectedAppForOR.operatorName}
                </Typography>
              </Box>
            )}

            <Box sx={{ 
              backgroundColor: '#fff4e6', 
              padding: '16px', 
              borderRadius: '8px',
              marginBottom: '24px',
              borderLeft: '4px solid #FEDE05'
            }}>
              <Typography sx={{ 
                color: '#174D7A',
                fontSize: '14px',
                fontFamily: 'Poppins, sans-serif',
                lineHeight: 1.6
              }}>
                ℹ️ Your application has been approved by BPLO. Please submit your Official Receipt information to proceed to SB for final approval.
              </Typography>
            </Box>

            <TextField
              label="Official Receipt Number"
              fullWidth
              value={orNumberInput}
              onChange={(e) => setOrNumberInput(e.target.value)}
              placeholder="Enter OR Number"
              sx={{ mb: 3 }}
              required
            />

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Official Receipt Document
              </Typography>
              <TextField
                type="file"
                fullWidth
                onChange={(e) => setOrFileInput(e.target.files[0])}
                inputProps={{ 
                  accept: "application/pdf,image/jpeg,image/png"
                }}
                helperText="Upload OR document (PDF, JPG, or PNG)"
                required
              />
              {orFileInput && (
                <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'success.main' }}>
                  ✓ Selected: {orFileInput.name}
                </Typography>
              )}
            </Box>
            
            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <Button
                onClick={handleCloseORModal}
                disabled={isSubmitting}
                sx={{
                  flex: 1,
                  backgroundColor: '#e0e0e0',
                  color: '#666',
                  padding: '12px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontFamily: 'Poppins, sans-serif',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: '#d0d0d0'
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitOR}
                disabled={isSubmitting || !orNumberInput.trim() || !orFileInput}
                sx={{
                  flex: 1,
                  backgroundColor: '#FEDE05',
                  color: '#174D7A',
                  padding: '12px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontFamily: 'Poppins, sans-serif',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: '#e5c900'
                  },
                  '&:disabled': {
                    backgroundColor: '#f0f0f0',
                    color: '#999'
                  }
                }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit OR'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal>
    </div>
  );
};

export default OperatorHomePage;
