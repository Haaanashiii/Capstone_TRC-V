import React, { useState, useEffect } from "react";
import Swal from 'sweetalert2';
import { useNavigate } from "react-router-dom";
import UnifiedNavbar from "../../components/UnifiedNavbar";
import { useAuth } from "../../contexts/AuthContext";
import { logger } from '../../utils/logger';
import "../../Styles/Operator's_CSS/OperatorHomePage.css";
import "../../Styles/Operator's_CSS/TableResponsive.css";
import { Link2, PlusCircle } from 'lucide-react';
import websocketService from '../../services/websocket';
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
import { franchiseAPI, franchiseInformationAPI } from '../Services/api';

// SweetAlert styling utility
const alertStyle = {
  successAlert: {
    icon: 'success',
    iconColor: '#10b981',
    confirmButtonColor: '#174D7A',
    customClass: {
      container: 'swal-container',
      popup: 'swal-popup',
      title: 'swal-title',
      htmlContainer: 'swal-text',
      confirmButton: 'swal-confirm-btn'
    },
    showConfirmButton: true,
    confirmButtonText: 'OK',
    didOpen: (modal) => {
      modal.style.borderRadius = '12px';
      modal.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.15)';
    }
  },
  errorAlert: {
    icon: 'error',
    iconColor: '#ef4444',
    confirmButtonColor: '#174D7A',
    customClass: {
      container: 'swal-container',
      popup: 'swal-popup',
      title: 'swal-title',
      htmlContainer: 'swal-text',
      confirmButton: 'swal-confirm-btn'
    },
    showConfirmButton: true,
    confirmButtonText: 'OK',
    didOpen: (modal) => {
      modal.style.borderRadius = '12px';
      modal.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.15)';
    }
  },
  warningAlert: {
    icon: 'warning',
    iconColor: '#f59e0b',
    confirmButtonColor: '#174D7A',
    customClass: {
      container: 'swal-container',
      popup: 'swal-popup',
      title: 'swal-title',
      htmlContainer: 'swal-text',
      confirmButton: 'swal-confirm-btn'
    },
    showConfirmButton: true,
    confirmButtonText: 'OK',
    didOpen: (modal) => {
      modal.style.borderRadius = '12px';
      modal.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.15)';
    }
  }
};

const OperatorHomePage = () => {
  // Use AuthContext for user data (consistent with UnifiedSidebar)
  const { user: authUser } = useAuth();
  
  // Track if component is mounted to prevent animation flicker on updates
  const isInitialMountRef = React.useRef(true);
  
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
      logger.error('[OperatorHomePage] Error decoding token:', error);
    }
    
    return null;
  };
  
  const currentUser = getUser();
  
  // Mark component as mounted after initial render
  useEffect(() => {
    isInitialMountRef.current = false;
  }, []);
  
  // Use authUser from context instead of fetching separately
  useEffect(() => {
    if (authUser) {
      logger.log('[OperatorHomePage] User data:', authUser);
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
          logger.error('Error parsing saved franchise info:', error);
        }
      }
    } catch {
      logger.warn('Error while restoring franchise info from storage')
    }
  }, [authUser]); // Only depend on authUser

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
        logger.warn('Error fetching approved franchises', err)
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
  const [orFileObjectUrl, setOrFileObjectUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFranchises, setActiveFranchises] = useState([]);
  const [loadingFranchises, setLoadingFranchises] = useState(true);
  const [openORConfirmModal, setOpenORConfirmModal] = useState(false);
  const navigate = useNavigate();

  // Fetch user's active franchises from franchiseInformation collection
  useEffect(() => {
    const fetchUserFranchises = async () => {
      // Use _id from token (MongoDB ObjectId) since linkedUser in DB stores ObjectId
      const userId = currentUser?._id || currentUser?.id;
      if (!userId) {
        logger.log('[OperatorHomePage] No user ID found, skipping franchise fetch');
        logger.log('[OperatorHomePage] currentUser:', currentUser);
        setLoadingFranchises(false);
        return;
      }

      try {
        logger.log('[OperatorHomePage] ========== FRANCHISE FETCH START ==========');
        logger.log('[OperatorHomePage] Fetching franchises for user ID:', userId);
        logger.log('[OperatorHomePage] Current user object:', { 
          id: currentUser?.id, 
          _id: currentUser?._id, 
          userId: currentUser?.userId,
          name: currentUser?.name,
          email: currentUser?.email
        });
        
        const response = await franchiseInformationAPI.getByUser(userId);
        
        logger.log('[OperatorHomePage] ========== API RESPONSE ==========');
        logger.log('[OperatorHomePage] Response status:', response?.status);
        logger.log('[OperatorHomePage] Response data:', response?.data);
        logger.log('[OperatorHomePage] Franchise count:', response?.data?.count);
        logger.log('[OperatorHomePage] Franchises array:', response?.data?.data);
        
        if (response.data?.success && Array.isArray(response.data.data)) {
          // Filter to show active and expired franchises (exclude only revoked)
          const activeFranchises = response.data.data.filter(f => 
            f.franchiseStatus !== 'Revoked'
          );
          logger.log('[OperatorHomePage] Total franchises:', response.data.data.length, 'Non-revoked franchises (Active/Expired):', activeFranchises.length);
          setActiveFranchises(activeFranchises);
          
          // If user has active/expired franchises, update the franchise linked state
          if (activeFranchises.length > 0) {
            setFranchiseLinked(true);
            // Store first active franchise as primary
            const primaryFranchise = activeFranchises[0];
            const franchiseInfo = {
              orNumber: primaryFranchise.franchiseNumber,
              status: primaryFranchise.franchiseStatus,
              linkedDate: primaryFranchise.approvedAt ? new Date(primaryFranchise.approvedAt).toLocaleDateString() : 'N/A',
              franchiseNumber: primaryFranchise.franchiseNumber,
              make: primaryFranchise.unitModel,
              plateNumber: primaryFranchise.mvPlateNo,
              sidecarNumber: primaryFranchise.sideCarPlateNumber,
              expiryDate: primaryFranchise.expiryDate
            };
            setUserFranchiseInfo(franchiseInfo);
          }
        } else {
          logger.warn('[OperatorHomePage] No franchises data or invalid format:', response.data);
          setActiveFranchises([]);
        }
      } catch (error) {
        logger.error('[OperatorHomePage] Error fetching franchises:', error);
        logger.error('[OperatorHomePage] Error details:', error.response?.data);
        setActiveFranchises([]);
      } finally {
        setLoadingFranchises(false);
      }
    };

    fetchUserFranchises();
  }, [currentUser]);

  // Fetch user's franchise applications
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        logger.log('[OperatorHomePage] Fetching applications for user:', currentUser);
        const response = await franchiseAPI.getMyApplications();
        logger.log('[OperatorHomePage] API response:', response.data);
        if (response.data?.success && Array.isArray(response.data.data)) {
          logger.log('[OperatorHomePage] Setting applications:', response.data.data.length, 'items');
          setUserApplications(response.data.data);
        } else {
          logger.warn('[OperatorHomePage] No applications data or invalid format:', response.data);
        }
      } catch (error) {
        logger.error('[OperatorHomePage] Error fetching applications:', error);
        logger.error('[OperatorHomePage] Error details:', error.response?.data);
      }
    };
    
    if (currentUser) {
      fetchApplications();
    }
  }, [currentUser]);

  // Setup WebSocket listeners for BPLO notifications
  useEffect(() => {
    // Connect using the websocketService (with auth token)
    if (!websocketService.isConnected()) {
      websocketService.connect('operators-room');
    } else {
      websocketService.joinRoom('operators-room');
    }
    
    // Also join user-specific room for personal notifications
    if (currentUser?.id) {
      websocketService.emit('join', { userId: currentUser.id, userType: 'operator' });
    }

    // Listen for BPLO disapproval notifications
    const handleBploDisapproval = (data) => {
      logger.log('[OperatorHomePage] Received BPLO disapproval:', data);
      Swal.fire({
        ...alertStyle.errorAlert,
        title: 'Application Disapproved',
        text: `Your application has been disapproved. Reason: ${data.reason}`
      });
      // Refresh applications list
      const fetchApplications = async () => {
        try {
          const response = await franchiseAPI.getMyApplications();
          if (response.data?.success && Array.isArray(response.data.data)) {
            setUserApplications(response.data.data);
          }
        } catch (error) {
          logger.error('Error fetching applications:', error);
        }
      };
      fetchApplications();
    };

    // Listen for BPLO approval notifications
    const handleBploApproval = (data) => {
      logger.log('[OperatorHomePage] Received BPLO approval:', data);
      Swal.fire({
        ...alertStyle.successAlert,
        title: 'BPLO Approved!',
        text: 'Your application has been approved by BPLO. Please submit your Official Receipt.'
      });
      // Refresh applications list
      const fetchApplications = async () => {
        try {
          const response = await franchiseAPI.getMyApplications();
          if (response.data?.success && Array.isArray(response.data.data)) {
            setUserApplications(response.data.data);
          }
        } catch (error) {
          logger.error('Error fetching applications:', error);
        }
      };
      fetchApplications();
    };

    // Listen for SB approval notifications
    const handleSbApproval = (data) => {
      logger.log('[OperatorHomePage] Received SB approval:', data);
      Swal.fire({
        ...alertStyle.successAlert,
        title: 'Congratulations!',
        text: 'Your application has been finally approved. You can now claim your certificate.'
      });
      // Refresh applications list
      const fetchApplications = async () => {
        try {
          const response = await franchiseAPI.getMyApplications();
          if (response.data?.success && Array.isArray(response.data.data)) {
            setUserApplications(response.data.data);
          }
        } catch (error) {
          logger.error('Error fetching applications:', error);
        }
      };
      fetchApplications();
    };
    
    // Listen for franchise updates (for FranchiseeListOperatorSide sync)
    const handleFranchiseUpdated = (data) => {
      logger.log('[OperatorHomePage] Received franchise update:', data);
      // Could trigger a refresh if needed
    };

    websocketService.on('bplo-disapproval', handleBploDisapproval);
    websocketService.on('bplo-approval', handleBploApproval);
    websocketService.on('sb-approval', handleSbApproval);
    websocketService.on('franchise-updated', handleFranchiseUpdated);

    return () => {
      websocketService.off('bplo-disapproval', handleBploDisapproval);
      websocketService.off('bplo-approval', handleBploApproval);
      websocketService.off('sb-approval', handleSbApproval);
      websocketService.off('franchise-updated', handleFranchiseUpdated);
    };
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

  // Manage object URL for file preview - prevents flickering by creating URL once
  useEffect(() => {
    if (orFileInput) {
      // Create object URL once and store it
      const url = URL.createObjectURL(orFileInput);
      setOrFileObjectUrl(url);
      
      // Cleanup on unmount or when file changes
      return () => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      };
    } else {
      // Clear URL when file is cleared
      setOrFileObjectUrl(null);
    }
  }, [orFileInput]);

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
    logger.log('[OperatorHomePage] Checking user franchise status');
    // Check if user already has franchise in JWT
    try {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        if (decoded.hasFranchise === true) {
          logger.log('[OperatorHomePage] User has franchise, showing home page');
        } else {
          logger.log('[OperatorHomePage] User has no franchise, showing application options');
        }
      }
    } catch (e) {
      logger.error('[OperatorHomePage] Error checking franchise status:', e);
    }
  }, [navigate])

  const handleSubmitFranchiseLink = async () => {
    if (!orNumber || !mtopFile) {
      Swal.fire({
        ...alertStyle.warningAlert,
        title: t.warning || 'Missing Information',
        text: t.pleaseProvideWarning || 'Please provide both franchise number and MTOP document'
      });
      return;
    }

    try {
      // Call the backend API to link franchise
      logger.log('[OperatorHomePage] Linking franchise:', orNumber);
      
      const response = await franchiseInformationAPI.linkFranchise({
        franchiseNumber: orNumber.trim(),
        mtofDocument: mtopFile
      });

      if (response.data && response.data.success) {
        const linkedFranchise = response.data.data;
        
        logger.log('[OperatorHomePage] Franchise linked successfully:', linkedFranchise);
        
        // Update local state
        const franchiseInfo = {
          franchiseNumber: linkedFranchise.franchiseNumber,
          franchiseChainId: linkedFranchise.franchiseChainId,
          status: linkedFranchise.franchiseStatus,
          linkedDate: new Date().toLocaleDateString(),
          operatorName: linkedFranchise.operatorName
        };

        setUserFranchiseInfo(franchiseInfo);
        setFranchiseLinked(true);
        
        // Store franchise info in sessionStorage
        try { 
          sessionStorage.setItem('userFranchiseInfo', JSON.stringify(franchiseInfo));
          sessionStorage.setItem('franchiseLinked', 'true');
          
          // Persist owner userId
          const token = sessionStorage.getItem('accessToken');
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload?.id) sessionStorage.setItem('franchiseOwnerUserId', payload.id);
          }
        } catch (e) {
          logger.error('[OperatorHomePage] Error storing franchise info:', e);
        }
        
        setShowModal(false);
        
        // Reset form
        setOrNumber("");
        setMtopFile(null);
        setOrWarning("");
        
        // Show success message
        Swal.fire({
          ...alertStyle.successAlert,
          title: 'Franchise Linked Successfully!',
          text: `Franchise #${linkedFranchise.franchiseNumber} has been linked to your account.`
        });
        
        // Refresh franchise data
        fetchUserFranchises();
        
      } else {
        throw new Error(response.data?.message || 'Failed to link franchise');
      }
      
    } catch (error) {
      logger.error('[OperatorHomePage] Error linking franchise:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to link franchise. Please check your franchise number and try again.';
      
      Swal.fire({
        ...alertStyle.errorAlert,
        title: 'Linking Failed',
        text: errorMessage
      });
    }
  };


  const handleLinkFranchise = () => setShowModal(true);
  const handleApplyNew = () => {
    // Check if user is authenticated before navigating
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
      logger.warn('[OperatorHomePage] No authentication token found, redirecting to login');
      navigate('/login');
      return;
    }
    // User is authenticated, proceed to franchise application
    navigate('/operator/franchise/application');
  };

  const handleOpenNoticeModal = (application) => {
    // If application is disapproved, show alert with reason then navigate to resubmission form
    if (application.statusOfBPLO === 'bplo-disapproved') {
      const reason = application.bploDisapprovedReason || 'Your application requires revision.';
      const confirmed = window.confirm(
        `YOUR APPLICATION HAS BEEN DISAPPROVED\n\n` +
        `Reason: ${reason}\n\n` +
        `You are required to resubmit all information. Click OK to proceed to the application form.`
      );
      
      if (confirmed) {
        // Navigate to franchise application form with resubmission flag
        navigate(`/operator/franchise/application?resubmit=${application._id}`);
      }
      return;
    }
    
    // For other statuses, show notice modal with appropriate message
    const notice = {
      id: application._id,
      application: application,
      noticeType: 
        application.statusOfBPLO === 'pending' ? 'Application Under Review' :
        application.statusOfBPLO === 'bplo-approved' ? 'BPLO Approval' : 
        application.statusOfBPLO === 'awaiting-sb' ? 'Awaiting SB Approval' :
        application.statusOfBPLO === 'sb-approved' ? 'Finally Approved' :
        'Application Status',
      message: 
        application.statusOfBPLO === 'pending' ? 
          'Your application is currently under review by BPLO. We will notify you once a decision has been made.' :
        application.statusOfBPLO === 'bplo-approved' ?
          'Your application has been approved by BPLO. Please submit your Official Receipt to proceed.' :
        application.statusOfBPLO === 'awaiting-sb' ?
          'Your application has been forwarded to the Sangguniang Bayan for final approval.' :
        application.statusOfBPLO === 'sb-approved' ?
          'Congratulations! Your application has been finally approved.' :
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
    logger.log('[OperatorHomePage] Opening OR modal for application:', application);
    logger.log('[OperatorHomePage] Application _id:', application._id, 'type:', typeof application._id);
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

  const handleSubmitOR = () => {
    if (!orNumberInput.trim() || !orFileInput) {
      Swal.fire({
        ...alertStyle.warningAlert,
        title: 'Missing Information',
        text: 'Please provide both OR Number and OR Document'
      });
      return;
    }

    // Show confirmation modal instead of submitting directly
    setOpenORConfirmModal(true);
  };

  const handleConfirmORSubmit = async () => {
    setIsSubmitting(true);
    setOpenORConfirmModal(false);

    try {
      const formData = new FormData();
      formData.append('officialReceiptNumber', orNumberInput.trim());
      formData.append('oRTreasurerOfficeObj', orFileInput);

      // Extract the ID - handle MongoDB Binary/Buffer format
      let applicationId = null;
      const rawId = selectedAppForOR._id;
      
      if (typeof rawId === 'string') {
        applicationId = rawId;
      } else if (rawId && rawId.buffer) {
        // MongoDB Binary format - convert buffer bytes to hex string
        const bytes = Object.values(rawId.buffer);
        applicationId = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
      } else if (rawId && typeof rawId === 'object') {
        applicationId = rawId.$oid || rawId.toString();
      } else if (selectedAppForOR.id) {
        applicationId = String(selectedAppForOR.id);
      }
      
      logger.log('[SubmitOR] Extracted Application ID:', applicationId);
      
      if (!applicationId || applicationId === '[object Object]') {
        throw new Error('Could not extract valid application ID');
      }
      
      await franchiseAPI.submitOR(applicationId, formData);

      // Close modal immediately, then reload page after showing success
      handleCloseORModal();
      
      // Show success without refreshing the page state
      Swal.fire({
        ...alertStyle.successAlert,
        title: 'Success!',
        text: 'OR submitted successfully! Your application will now proceed to SB for final approval.',
        didClose: () => {
          // Reload page after success alert is closed to show updated data
          window.location.reload();
        }
      });
    } catch (error) {
      logger.error('Error submitting OR:', error);
      Swal.fire({
        ...alertStyle.errorAlert,
        title: 'Error',
        text: error.response?.data?.error || 'Failed to submit OR. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelORConfirm = () => {
    setOpenORConfirmModal(false);
  };



  return (
    <div className={`franchise-bg ${!isInitialMountRef.current ? 'no-animate' : ''}`}>
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
        paddingTop: '120px',
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
                  {franchiseLinked ? 'Create new application' : 'No, apply for a new franchise'}
                </Typography>
                <Typography sx={{ 
                  color: '#174D7A', 
                  fontSize: '14px',
                  fontFamily: 'Poppins, sans-serif'
                }}>
                  {franchiseLinked ? 'Apply for additional franchise.' : 'Apply your franchise now.'}
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
            
            {/* Desktop Table View */}
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <TableContainer component={Paper} sx={{ 
              marginBottom: '32px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              overflowX: 'auto',
              width: '100%',
            '& .MuiTableCell-head': {
              backgroundColor: '#174D7A',
              color: '#fff',
              fontWeight: 700,
              fontSize: 'clamp(10px, 2vw, 14px)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              fontFamily: 'Poppins, sans-serif',
              whiteSpace: 'nowrap',
              padding: 'clamp(6px, 1.5vw, 16px)'
            },
            '& .MuiTableCell-body': {
              fontSize: 'clamp(10px, 2vw, 14px)',
              fontFamily: 'Poppins, sans-serif',
              whiteSpace: 'nowrap',
              padding: 'clamp(6px, 1.5vw, 16px)'
            },
            '& .MuiTableRow-root': {
              '&:hover': {
                backgroundColor: '#f5f7fa'
              }
            },
            '& .MuiTable-root': {
              width: '100%',
              tableLayout: 'auto'
            }
          }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>No.</TableCell>
                  <TableCell>Franchise Number</TableCell>
                  <TableCell>Make</TableCell>
                  <TableCell>Plate Number</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Expiry Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingFranchises ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                      Loading franchises...
                    </TableCell>
                  </TableRow>
                ) : activeFranchises && activeFranchises.length > 0 ? (
                  activeFranchises.map((franchise, index) => (
                    <TableRow 
                      key={franchise._id || index}
                      onClick={() => navigate('/operator/franchisee-list', { state: { franchise } })}
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'rgba(23, 77, 122, 0.08)'
                        }
                      }}
                    >
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{franchise.franchiseNumber || 'N/A'}</TableCell>
                      <TableCell>{franchise.unitModel || 'N/A'}</TableCell>
                      <TableCell>{franchise.mvPlateNo || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip 
                          label={franchise.franchiseStatus || 'Active'}
                          size="small"
                          sx={{
                            backgroundColor: franchise.franchiseStatus === 'Active' ? '#2ecc71' : '#e74c3c',
                            color: '#fff',
                            fontWeight: 600
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {franchise.expiryDate ? new Date(franchise.expiryDate).toLocaleDateString() : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
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

          {/* Mobile Card View */}
          <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 4 }}>
            {loadingFranchises ? (
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  color: '#666'
                }}
              >
                <Typography>Loading franchises...</Typography>
              </Paper>
            ) : activeFranchises && activeFranchises.length > 0 ? (
              activeFranchises.map((franchise, index) => (
                <Paper
                  key={franchise._id || index}
                  elevation={3}
                  onClick={() => navigate('/operator/franchisee-list', { state: { franchise } })}
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: '#fff',
                    mb: 2,
                    cursor: 'pointer',
                    '&:hover': {
                      boxShadow: 6,
                      transform: 'translateY(-2px)',
                      transition: 'all 0.2s'
                    }
                  }}
                >
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: 12, color: '#666', mb: 0.5 }}>
                      Franchise Number
                    </Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#174D7A' }}>
                      {franchise.franchiseNumber || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: 12, color: '#666', mb: 0.5 }}>
                      Make
                    </Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                      {franchise.unitModel || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: 12, color: '#666', mb: 0.5 }}>
                      Plate Number
                    </Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                      {franchise.mvPlateNo || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: 12, color: '#666', mb: 0.5 }}>
                      Status
                    </Typography>
                    <Chip 
                      label={franchise.franchiseStatus || 'Active'}
                      size="small"
                      sx={{
                        backgroundColor: franchise.franchiseStatus === 'Active' ? '#2ecc71' : '#e74c3c',
                        color: '#fff',
                        fontWeight: 600,
                        mt: 0.5
                      }}
                    />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 12, color: '#666', mb: 0.5 }}>
                      Expiry Date
                    </Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                      {franchise.expiryDate ? new Date(franchise.expiryDate).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </Box>
                </Paper>
              ))
            ) : (
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  color: '#666'
                }}
              >
                <Typography>No active franchise</Typography>
              </Paper>
            )}
          </Box>
          </Box>

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
            <>
              {/* Desktop Table View */}
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <TableContainer component={Paper} sx={{ 
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              overflowX: 'auto',
              width: '100%',
              '& .MuiTableCell-head': {
                backgroundColor: '#174D7A',
                color: '#fff',
                fontWeight: 700,
                fontSize: 'clamp(10px, 2vw, 14px)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                fontFamily: 'Poppins, sans-serif',
                whiteSpace: 'nowrap',
                padding: 'clamp(6px, 1.5vw, 16px)'
              },
              '& .MuiTableCell-body': {
                fontSize: 'clamp(10px, 2vw, 14px)',
                fontFamily: 'Poppins, sans-serif',
                padding: 'clamp(6px, 1.5vw, 16px)'
              },
              '& .MuiTableRow-root': {
                '&:hover': {
                  backgroundColor: '#f5f7fa'
                }
              },
              '& .MuiTable-root': {
                width: '100%',
                tableLayout: 'auto'
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
                        {app.statusOfBPLO === 'pending' && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleOpenNoticeModal(app)}
                            sx={{
                              borderColor: '#95a5a6',
                              color: '#95a5a6',
                              fontSize: '12px',
                              '&:hover': {
                                borderColor: '#7f8c8d',
                                backgroundColor: 'rgba(149, 165, 166, 0.04)'
                              }
                            }}
                          >
                            View Status
                          </Button>
                        )}
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
                        {app.statusOfBPLO === 'bplo-disapproved' && (
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleOpenNoticeModal(app)}
                            sx={{
                              backgroundColor: '#e74c3c',
                              color: '#fff',
                              fontWeight: 600,
                              fontSize: '12px',
                              '&:hover': {
                                backgroundColor: '#c0392b'
                              }
                            }}
                          >
                            Resubmit
                          </Button>
                        )}
                        {(app.statusOfBPLO === 'awaiting-sb' || app.statusOfBPLO === 'sb-approved') && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleOpenNoticeModal(app)}
                            sx={{
                              borderColor: '#3498db',
                              color: '#3498db',
                              fontSize: '12px',
                              '&:hover': {
                                borderColor: '#2980b9',
                                backgroundColor: 'rgba(52, 152, 219, 0.04)'
                              }
                            }}
                          >
                            View Details
                          </Button>
                        )}
                        {app.statusOfBPLO === 'bplo-approved' && app.officialReceiptNumber && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleOpenNoticeModal(app)}
                            sx={{
                              ml: 1,
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
            </Box>

            {/* Mobile Card View */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
              {userApplications.map((app, index) => (
                <Paper
                  key={app._id}
                  elevation={3}
                  sx={{
                    p: 2.5,
                    mb: 2,
                    borderRadius: 2,
                    cursor: 'pointer',
                    '&:hover': {
                      boxShadow: 4
                    }
                  }}
                >
                  <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid #e0e0e0' }}>
                    <Typography sx={{ fontSize: 12, color: '#666', mb: 0.5 }}>
                      Application #{index + 1}
                    </Typography>
                    <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#174D7A' }}>
                      {app.mvPlateNo}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: 12, color: '#666', mb: 1 }}>
                      Status
                    </Typography>
                    <Chip 
                      label={
                        app.statusOfBPLO === 'pending' ? 'Pending Review' :
                        app.statusOfBPLO === 'bplo-approved' ? 'BPLO Approved - Submit OR' :
                        app.statusOfBPLO === 'bplo-disapproved' ? 'Disapproved' :
                        app.statusOfBPLO === 'awaiting-sb' ? 'Awaiting SB Approval' :
                        app.statusOfBPLO === 'sb-approved' ? 'Finally Approved' :
                        app.statusOfBPLO
                      }
                      sx={{
                        backgroundColor: 
                          app.statusOfBPLO === 'bplo-disapproved' ? '#e74c3c' :
                          app.statusOfBPLO === 'bplo-approved' ? '#f39c12' :
                          app.statusOfBPLO === 'awaiting-sb' ? '#3498db' :
                          app.statusOfBPLO === 'sb-approved' ? '#2ecc71' :
                          '#95a5a6',
                        color: '#fff',
                        fontWeight: 600,
                        height: '32px'
                      }}
                    />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: 12, color: '#666', mb: 0.5 }}>
                      Submitted Date
                    </Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                      {new Date(app.submittedAt).toLocaleDateString()}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                    {app.statusOfBPLO === 'pending' && (
                      <Button
                        variant="outlined"
                        size="medium"
                        fullWidth
                        onClick={() => handleOpenNoticeModal(app)}
                        sx={{
                          borderColor: '#95a5a6',
                          color: '#95a5a6',
                          fontWeight: 600,
                          '&:hover': {
                            borderColor: '#7f8c8d',
                            backgroundColor: 'rgba(149, 165, 166, 0.04)'
                          }
                        }}
                      >
                        View Status
                      </Button>
                    )}
                    {app.statusOfBPLO === 'bplo-approved' && !app.officialReceiptNumber && (
                      <Button
                        variant="contained"
                        size="medium"
                        fullWidth
                        onClick={() => handleOpenORModal(app)}
                        sx={{
                          backgroundColor: '#FEDE05',
                          color: '#174D7A',
                          fontWeight: 600,
                          '&:hover': {
                            backgroundColor: '#e5c900'
                          }
                        }}
                      >
                        Submit OR
                      </Button>
                    )}
                    {app.statusOfBPLO === 'bplo-disapproved' && (
                      <Button
                        variant="contained"
                        size="medium"
                        fullWidth
                        onClick={() => handleOpenNoticeModal(app)}
                        sx={{
                          backgroundColor: '#e74c3c',
                          color: '#fff',
                          fontWeight: 600,
                          '&:hover': {
                            backgroundColor: '#c0392b'
                          }
                        }}
                      >
                        Resubmit
                      </Button>
                    )}
                    {(app.statusOfBPLO === 'awaiting-sb' || app.statusOfBPLO === 'sb-approved') && (
                      <Button
                        variant="outlined"
                        size="medium"
                        fullWidth
                        onClick={() => handleOpenNoticeModal(app)}
                        sx={{
                          borderColor: '#3498db',
                          color: '#3498db',
                          fontWeight: 600,
                          '&:hover': {
                            borderColor: '#2980b9',
                            backgroundColor: 'rgba(52, 152, 219, 0.04)'
                          }
                        }}
                      >
                        View Details
                      </Button>
                    )}
                    {app.statusOfBPLO === 'bplo-approved' && app.officialReceiptNumber && (
                      <Button
                        variant="outlined"
                        size="medium"
                        fullWidth
                        onClick={() => handleOpenNoticeModal(app)}
                        sx={{
                          borderColor: '#174D7A',
                          color: '#174D7A',
                          fontWeight: 600,
                          '&:hover': {
                            borderColor: '#0f3a5f',
                            backgroundColor: 'rgba(23, 77, 122, 0.04)'
                          }
                        }}
                      >
                        View Details
                      </Button>
                    )}
                  </Box>
                </Paper>
              ))}
            </Box>
            </>
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
            padding: '48px',
            maxWidth: '500px',
            boxShadow: '0 20px 60px rgba(23, 77, 122, 0.3)',
            animation: 'slideUp 0.3s ease-out'
          }
        }}
      >
        <DialogContent sx={{ padding: 0 }}>
          {/* Modal Header */}
          <Box sx={{ marginBottom: '12px' }}>
            <Typography
              sx={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#0A356B',
                fontFamily: 'Poppins, sans-serif',
                marginBottom: '8px',
                letterSpacing: '-0.5px'
              }}
            >
              Franchise Link
            </Typography>
            <Typography
              sx={{
                fontSize: '14px',
                color: '#666',
                fontFamily: 'Poppins, sans-serif',
                marginBottom: '32px'
              }}
            >
              Link your existing franchise to TRC-V for easy management of tricycle franchise
            </Typography>
          </Box>

          {/* Franchise Number Input */}
          <Box sx={{ marginBottom: '32px' }}>
            <Typography
              sx={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#222',
                fontFamily: 'Poppins, sans-serif',
                marginBottom: '10px'
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
                  borderRadius: '12px',
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '15px',
                  '& fieldset': {
                    borderColor: '#e0e0e0',
                  },
                  '&:hover fieldset': {
                    borderColor: '#d0d0d0',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#174D7A',
                    borderWidth: '2px'
                  }
                }
              }}
            />
            {orWarning && (
              <Typography sx={{ color: '#b71c1c', fontSize: '13px', marginTop: '6px', fontFamily: 'Poppins, sans-serif' }}>
                ⚠️ {orWarning}
              </Typography>
            )}
          </Box>

          {/* Upload MTOF Document */}
          <Box sx={{ marginBottom: '32px' }}>
            <Typography
              sx={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#222',
                fontFamily: 'Poppins, sans-serif',
                marginBottom: '10px'
              }}
            >
              Upload MTOF Document
            </Typography>
            
            {/* Upload Box */}
            <Box
              sx={{
                border: '2.5px dashed #174D7A',
                borderRadius: '20px',
                padding: '48px 32px',
                textAlign: 'center',
                background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f1ff 100%)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: 'inset 0 2px 8px rgba(23, 77, 122, 0.05)',
                '&:hover': {
                  backgroundColor: 'rgba(224, 242, 255, 0.9)',
                  borderColor: '#0A356B',
                  boxShadow: 'inset 0 2px 12px rgba(23, 77, 122, 0.1), 0 4px 12px rgba(23, 77, 122, 0.1)'
                }
              }}
              onClick={() => document.getElementById('mtop-upload').click()}
            >
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="iconGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{stopColor: '#174D7A'}} />
                    <stop offset="100%" style={{stopColor: '#0A356B'}} />
                  </linearGradient>
                </defs>
                {/* Cloud shape */}
                <path d="M19 13c1.1 0 2-.9 2-2 0-1.05-.84-1.9-1.9-1.95C18.6 5.9 16 3 13 3c-2.5 0-4.6 1.7-5.1 4-.05.02-.1.02-.15.02C5.6 7 4 8.6 4 10.5 4 12.4 5.5 14 7.1 14" stroke="url(#iconGrad2)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                {/* Upload arrow */}
                <g stroke="url(#iconGrad2)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="10" x2="12" y2="18" />
                  <polyline points="9 15 12 18 15 15" />
                </g>
              </svg>
              <Typography
                sx={{
                  fontSize: '17px',
                  color: '#174D7A',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 700,
                  marginBottom: '6px'
                }}
              >
                Browse Files to upload
              </Typography>
              <Typography
                sx={{
                  fontSize: '13px',
                  color: '#999',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 400
                }}
              >
                or drag and drop
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
                padding: '14px 16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '12px',
                textAlign: 'center',
                border: '1px solid #e0e0e0'
              }}
            >
              <Typography
                sx={{
                  fontSize: '15px',
                  color: '#333',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500
                }}
              >
                {mtopFile ? mtopFile.name : 'No selected File -'}
              </Typography>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => setShowModal(false)}
              sx={{
                borderRadius: '12px',
                padding: '12px 28px',
                fontSize: '15px',
                fontWeight: 600,
                fontFamily: 'Poppins, sans-serif',
                textTransform: 'none',
                borderColor: '#e0e0e0',
                color: '#666',
                minWidth: '110px',
                '&:hover': {
                  borderColor: '#d0d0d0',
                  backgroundColor: '#f5f5f5'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmitFranchiseLink}
              sx={{
                borderRadius: '12px',
                padding: '12px 28px',
                fontSize: '15px',
                fontWeight: 600,
                fontFamily: 'Poppins, sans-serif',
                textTransform: 'none',
                backgroundColor: '#174D7A',
                minWidth: '110px',
                boxShadow: '0 4px 12px rgba(23, 77, 122, 0.3)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: '#0f3a5f',
                  boxShadow: '0 6px 16px rgba(23, 77, 122, 0.4)',
                  transform: 'translateY(-1px)'
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
          width: { xs: 'calc(100vw - 32px)', sm: 500, md: 550 },
          maxWidth: '550px',
          maxHeight: { xs: 'calc(100vh - 64px)', sm: '90vh' },
          overflow: 'auto',
          bgcolor: 'background.paper',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>
          {/* Modal Header */}
          <Box sx={{ 
            background: '#174D7A', 
            padding: { xs: '16px 20px', sm: '24px 32px' },
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography id="notice-modal-title" variant="h5" component="h2" sx={{ 
              color: '#fff', 
              fontWeight: 700,
              fontFamily: 'Poppins, sans-serif',
              fontSize: { xs: '1.25rem', sm: '1.5rem' }
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
          <Box sx={{ padding: { xs: '20px', sm: '32px' } }}>
            <Box sx={{
              backgroundColor: '#FEDE05',
              borderRadius: '12px',
              padding: { xs: '16px', sm: '20px' },
              marginBottom: { xs: '20px', sm: '24px' }
            }}>
              <Typography sx={{ 
                color: '#174D7A',
                fontSize: { xs: '14px', sm: '16px' },
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
              {selectedNotice?.status !== 'awaiting-sb' && selectedNotice?.status !== 'sb-approved' && (
                <Button
                  onClick={() => {
                    handleCloseNoticeModal();
                    // Navigate with the application ID for editing/resubmission
                    const appId = selectedNotice?.application?._id || selectedNotice?.id;
                    navigate(`/operator/franchise/application?resubmit=${appId}`);
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
              )}
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
          width: { xs: 'calc(100vw - 32px)', sm: 500, md: 550 },
          maxWidth: '550px',
          maxHeight: { xs: 'calc(100vh - 64px)', sm: '90vh' },
          overflow: 'auto',
          bgcolor: 'background.paper',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>
          {/* Modal Header */}
          <Box sx={{ 
            background: '#174D7A', 
            padding: { xs: '16px 20px', sm: '24px 32px' },
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography id="or-modal-title" variant="h5" component="h2" sx={{ 
              color: '#fff', 
              fontWeight: 700,
              fontFamily: 'Poppins, sans-serif',
              fontSize: { xs: '1.25rem', sm: '1.5rem' }
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
          <Box sx={{ padding: { xs: '20px', sm: '32px' } }}>
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
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              gap: '12px', 
              marginTop: '24px' 
            }}>
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
                  minHeight: '48px',
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
                  minHeight: '48px',
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

      {/* OR Confirmation Modal */}
      <Modal
        open={openORConfirmModal}
        onClose={handleCancelORConfirm}
        aria-labelledby="or-confirm-modal-title"
      >
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: 'calc(100vw - 32px)', sm: 500, md: 550 },
          maxWidth: '550px',
          maxHeight: { xs: 'calc(100vh - 64px)', sm: '90vh' },
          overflow: 'auto',
          bgcolor: 'background.paper',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>
          {/* Modal Header */}
          <Box sx={{ 
            background: '#174D7A', 
            padding: { xs: '16px 20px', sm: '24px 32px' },
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography id="or-confirm-modal-title" variant="h5" component="h2" sx={{ 
              color: '#fff', 
              fontWeight: 700,
              fontFamily: 'Poppins, sans-serif',
              fontSize: { xs: '1.25rem', sm: '1.5rem' }
            }}>
              Verify Information
            </Typography>
            <IconButton 
              onClick={handleCancelORConfirm}
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
          <Box sx={{ padding: { xs: '20px', sm: '32px' } }}>
            {/* Warning Box */}
            <Box sx={{ 
              backgroundColor: '#FFF3CD', 
              padding: '16px', 
              borderRadius: '8px',
              marginBottom: '24px',
              borderLeft: '4px solid #FFC107',
              display: 'flex',
              gap: '12px'
            }}>
              <Typography sx={{ 
                color: '#856404',
                fontSize: '20px',
                lineHeight: 1
              }}>
                ⚠️
              </Typography>
              <Typography sx={{ 
                color: '#856404',
                fontSize: '14px',
                fontFamily: 'Poppins, sans-serif',
                lineHeight: 1.6
              }}>
                Please make sure the Official Receipt number you have inputted is correct. Review it carefully before proceeding.
              </Typography>
            </Box>

            {/* Application Details */}
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

            {/* OR Number Display */}
            <Box sx={{ 
              bgcolor: '#f5f5f5', 
              p: 3, 
              borderRadius: '8px',
              marginBottom: '24px',
              border: '2px solid #FEDE05'
            }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#666', mb: 1 }}>
                Official Receipt Number:
              </Typography>
              <Typography variant="h6" sx={{ 
                color: '#174D7A', 
                fontWeight: 700,
                fontFamily: 'Poppins, sans-serif',
                fontSize: '18px',
                wordBreak: 'break-word'
              }}>
                {orNumberInput}
              </Typography>
            </Box>

            {/* File Info */}
            {orFileInput && (
              <Box sx={{ 
                bgcolor: '#f0f7ff', 
                p: 2, 
                borderRadius: '8px',
                marginBottom: '24px',
                border: '1px solid #B3E5FC'
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#666', mb: 2 }}>
                  Official Receipt Document:
                </Typography>
                <Typography variant="body2" sx={{ color: '#174D7A', mb: 2 }}>
                  ✓ {orFileInput.name}
                </Typography>
                
                {/* Document Preview */}
                <Box sx={{ 
                  bgcolor: '#fff', 
                  p: 2, 
                  borderRadius: '8px',
                  border: '1px solid #E0E0E0',
                  overflow: 'hidden'
                }}>
                  {orFileInput.type.startsWith('image/') ? (
                    // Image Preview
                    <img 
                      src={orFileObjectUrl} 
                      alt="OR Preview"
                      style={{
                        width: '100%',
                        maxHeight: '400px',
                        borderRadius: '4px',
                        objectFit: 'contain'
                      }}
                    />
                  ) : orFileInput.type === 'application/pdf' ? (
                    // PDF Preview - Embedded iframe (view only, no download)
                    <iframe
                      src={`${orFileObjectUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                      type="application/pdf"
                      width="100%"
                      height="400px"
                      style={{ borderRadius: '4px', border: 'none' }}
                      title="OR PDF Preview"
                    />
                  ) : (
                    // Unsupported format
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography sx={{ fontSize: '48px', mb: 1 }}>📁</Typography>
                      <Typography variant="body2" sx={{ color: '#666' }}>
                        {orFileInput.name}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* Confirmation Question */}
            <Box sx={{ 
              backgroundColor: '#e8f5e9', 
              padding: '16px', 
              borderRadius: '8px',
              marginBottom: '24px',
              borderLeft: '4px solid #4CAF50'
            }}>
              <Typography sx={{ 
                color: '#2e7d32',
                fontSize: '14px',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                lineHeight: 1.6
              }}>
                Is the information above correct?
              </Typography>
            </Box>
            
            {/* Action Buttons */}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              gap: '12px', 
              marginTop: '24px' 
            }}>
              <Button
                onClick={handleCancelORConfirm}
                disabled={isSubmitting}
                sx={{
                  flex: 1,
                  backgroundColor: '#f44336',
                  color: '#fff',
                  padding: '12px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontFamily: 'Poppins, sans-serif',
                  textTransform: 'none',
                  minHeight: '48px',
                  '&:hover': {
                    backgroundColor: '#d32f2f'
                  },
                  '&:disabled': {
                    backgroundColor: '#f0f0f0',
                    color: '#999'
                  }
                }}
              >
                No, Edit OR Number
              </Button>
              <Button
                onClick={handleConfirmORSubmit}
                disabled={isSubmitting}
                sx={{
                  flex: 1,
                  backgroundColor: '#4CAF50',
                  color: '#fff',
                  padding: '12px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontFamily: 'Poppins, sans-serif',
                  textTransform: 'none',
                  minHeight: '48px',
                  '&:hover': {
                    backgroundColor: '#388E3C'
                  },
                  '&:disabled': {
                    backgroundColor: '#f0f0f0',
                    color: '#999'
                  }
                }}
              >
                {isSubmitting ? 'Submitting...' : 'Yes, It\'s Correct'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal>
    </div>
  );
};

export default OperatorHomePage;
