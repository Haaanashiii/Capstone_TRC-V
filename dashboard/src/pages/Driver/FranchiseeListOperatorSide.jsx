import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getUserId, verifyFranchiseOwnership } from '../../utils/userUtils';
import { Box, Typography, Button, Paper, Avatar, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Menu, MenuItem, Chip, Alert, AlertTitle } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import EditIcon from '@mui/icons-material/Edit';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import UnifiedNavbar from '../../components/UnifiedNavbar';
import '../../Styles/Operator\'s_CSS/FranchiseeListOperatorSide.css';
import dayjs from 'dayjs';
import { franchiseInformationAPI } from '../Services/api';
import { logger } from '../../utils/logger';
import websocketService from '../../services/websocket';
import { useTokenUser, useFranchiseStatus, useDriverTranslations } from '../../hooks/useDriverUtils';
import '../../Styles/animations.css';

function FranchiseeListOperatorSide() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();
  const user = authUser; // Alias for backward compatibility
  const tokenUser = useTokenUser();
  const { franchiseStatus, setFranchiseStatus } = useFranchiseStatus();
  const franchiseFromState = location.state?.franchise;
  
  const [language, setLanguage] = useState('en');
  const [matchedFranchise, setMatchedFranchise] = useState(franchiseFromState || null);
  
  // Modal states
  const [franchiseListModalOpen, setFranchiseListModalOpen] = useState(false);
  const [amendmentModalOpen, setAmendmentModalOpen] = useState(false);
  
  // User's franchises list (fetched from API)
  const [allUserFranchises, setAllUserFranchises] = useState([]);
  const [loadingFranchises, setLoadingFranchises] = useState(false);
  
  // Use memoized translations from hook
  const t = useDriverTranslations(language);

  // Fields state - MUST be declared before useMemo/useCallback that reference it
  const [fields, setFields] = useState({
    orNumber: '',
    franchiseNumber: '',
    dateApproved: null,
    expiryDate: null,
    make: '',
    sidecarNumber: '',
    plateNumber: '',
    chassisNumber: '',
    motorNumber: ''
  });

  const [qrBlobUrl, setQrBlobUrl] = useState(null);
  const qrBlobRef = React.useRef(null);

  // Blob URL for driver's uploaded ID/photo (1x1) preview
  const [idBlobUrl, setIdBlobUrl] = useState(null);
  const idBlobRef = React.useRef(null);
  const [idBlobIsPdf, setIdBlobIsPdf] = useState(false);

  // Helper function to calculate expiry status
  // PRIORITY: Use backend franchiseStatus field, fallback to date calculation
  const calculateExpiryStatus = useCallback((expiryDate, franchiseStatus) => {
    // STEP 1: Check backend franchiseStatus (source of truth)
    const isExpiredByBackend = franchiseStatus === 'Expired';
    
    // STEP 2: Calculate date-based status (for expiring soon detection)
    let daysUntilExpiry = null;
    let expiryDateFormatted = null;
    
    if (expiryDate) {
      const today = dayjs();
      const expiry = dayjs(expiryDate);
      daysUntilExpiry = expiry.diff(today, 'days');
      expiryDateFormatted = expiry.format('MMMM D, YYYY');
    }
    
    // STEP 3: Determine final status
    // Backend status takes precedence, date is secondary
    const isExpired = isExpiredByBackend || (daysUntilExpiry !== null && daysUntilExpiry < 0);
    const isExpiringSoon = !isExpired && daysUntilExpiry !== null && daysUntilExpiry <= 90 && daysUntilExpiry >= 0;
    
    return {
      daysUntilExpiry,
      isExpired,
      isExpiringSoon,
      expiryDate: expiryDateFormatted,
      backendStatus: franchiseStatus, // Include backend status for debugging
      calculatedFromBackend: isExpiredByBackend // Flag to show if status came from backend
    };
  }, []);

  // Calculate expiry status for current franchise
  const currentExpiryStatus = useMemo(() => {
    const expiryDate = fields.expiryDate && fields.expiryDate.isValid && fields.expiryDate.isValid()
      ? fields.expiryDate
      : (matchedFranchise?.expiryDate ? dayjs(matchedFranchise.expiryDate) : null);
    
    // Pass both expiryDate AND franchiseStatus from backend
    const backendFranchiseStatus = matchedFranchise?.franchiseStatus || franchiseStatus;
    
    return calculateExpiryStatus(expiryDate, backendFranchiseStatus);
  }, [matchedFranchise, fields.expiryDate, franchiseStatus, calculateExpiryStatus]);

  // Fetch full user details from the server
  const fetchUserDetails = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      if (!token) return;

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
      logger.log('[FranchiseeListOperatorSide] Fetching user details');
      
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        logger.log('[FranchiseeListOperatorSide] User details received');
      } else {
        logger.log('[FranchiseeListOperatorSide] /auth/me returned non-ok');
      }
    } catch (error) {
      logger.error('[FranchiseeListOperatorSide] Error fetching user details:', error);
    }
  }, []);

  
  // Simple dependency on authUser for WebSocket subscription
  useEffect(() => {
    if (!authUser?.id) return;

    // Connect to WebSocket if not already connected
    if (!websocketService.isConnected()) {
      websocketService.connect('operators-room');
    }

    // Also join user-specific room for personal updates
    websocketService.emit('join', { userId: authUser.id });

    return () => {
      websocketService.off('franchise-updated', () => {});
    };
  }, [authUser?.id]);

  
  useEffect(() => {
    // If franchise data was passed via navigation state, use it directly
    if (franchiseFromState) {
      logger.log('[FranchiseeListOperatorSide] Using franchise from navigation state:', franchiseFromState);
      setMatchedFranchise(franchiseFromState);
      setFranchiseStatus(franchiseFromState.franchiseStatus || 'Active');
      
      // Set form fields from franchise data
      const parsedApproved = franchiseFromState.approvedAt ? dayjs(franchiseFromState.approvedAt) : null;
      const parsedExpiry = franchiseFromState.expiryDate ? dayjs(franchiseFromState.expiryDate) : null;
      
      setFields(prev => ({
        ...prev,
        orNumber: franchiseFromState.franchiseNumber || '',
        franchiseNumber: franchiseFromState.franchiseNumber || '',
        dateApproved: parsedApproved,
        expiryDate: parsedExpiry,
        make: franchiseFromState.unitModel || '',
        sidecarNumber: franchiseFromState.sideCarPlateNumber || '',
        plateNumber: franchiseFromState.mvPlateNo || '',
        chassisNumber: franchiseFromState.chasisNo || '',
        motorNumber: franchiseFromState.motorEngineNo || ''
      }));
      
      return; // Skip the API fetch since we already have the data
    }

    // Otherwise, fetch from API (original logic)
    try {
      // Wait for user to be loaded before attempting to fetch franchise data
      if (!user) {
        logger.log('[FranchiseeListOperatorSide] User not loaded yet, waiting...');
        return;
      }
      
      logger.log('[FranchiseeListOperatorSide] User loaded, fetching franchise data for user:', getUserId(user));
      
      // Use standardized user ID extraction
      const userId = getUserId(user);
      if (!userId) {
        logger.warn('[FranchiseeListOperatorSide] No user ID found');
        return;
      }
      
      // Verify franchise ownership
      verifyFranchiseOwnership(user);


      (async () => {
        try {
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170'
          // Token is only in sessionStorage (secure storage)
          const token = sessionStorage.getItem('accessToken');
        
          if (token) {
            try {
              const mineRes = await fetch(`${API_BASE_URL}/api/franchise-applications/mine`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (mineRes.ok) {
                const matched = await mineRes.json();
                logger.debug('[FranchiseeListOperatorSide] matched application from /mine', matched);
           
                if (matched && matched.id) {
                  logger.log('[FranchiseeListOperatorSide] Matched franchise data:', {
                    hasApprovedAt: !!matched.approvedAt,
                    approvedAt: matched.approvedAt,
                    hasExpiryDate: !!matched.expiryDate,
                    expiryDate: matched.expiryDate,
                    hasProfilePhoto: !!matched.profilePhoto,
                    profilePhoto: matched.profilePhoto
                  });
                  
                  const franchiseInfo = {
                    orNumber: matched.franchiseNumber || matched.orNumber,
                    status: 'ACTIVE',
                    linkedDate: matched.approvedAt || new Date().toLocaleDateString()
                  }
                  setFranchiseStatus('ACTIVE')
                  sessionStorage.setItem('userFranchiseInfo', JSON.stringify(franchiseInfo));
                  sessionStorage.setItem('franchiseLinked', 'true');
                  sessionStorage.setItem('franchiseOwnerUserId', userId);
                  setMatchedFranchise(matched);
            
                  const approvedRaw = matched.approvedAt || '';
                  const expiryRaw = matched.expiryDate || '';
                  
                  logger.log('[FranchiseeListOperatorSide] Date parsing:', { approvedRaw, expiryRaw });
                  
                  const parsedApproved = approvedRaw ? dayjs(approvedRaw) : null;
                  const parsedExpiry = expiryRaw ? dayjs(expiryRaw) : null;
                  
                  logger.log('[FranchiseeListOperatorSide] Parsed dates:', {
                    approvedValid: parsedApproved && parsedApproved.isValid(),
                    expiryValid: parsedExpiry && parsedExpiry.isValid()
                  });
                  
                  // Updated field mapping based on backend normalization
                  setFields(prev => ({
                    ...prev,
                    orNumber: matched.orNumber || matched.franchiseNumber || '',
                    franchiseNumber: matched.franchiseNumber || matched.orNumber || '',
                    dateApproved: parsedApproved,
                    expiryDate: parsedExpiry,
                    make: matched.unitModel || matched.make || '',
                    sidecarNumber: matched.sidecarPlateNumber || '',
                    plateNumber: matched.plateNumber || matched.mvPlateNo || '',
                    chassisNumber: matched.chassisNumber || matched.chasisNo || '',
                    motorNumber: matched.motorEngineNumber || matched.motorEngineNo || ''
                  }))
                  
                  logger.log('[FranchiseeListOperatorSide] Successfully linked franchise via /mine endpoint with userId:', userId);
                  // REMOVED: return; - DO NOT EXIT, continue to fetch ALL franchises below
                }
              }
            } catch (e) {
              logger.warn('FranchiseeListOperatorSide: /mine lookup failed', e)
            }
          }

         
          // Get ALL approved franchise applications (not just linked franchises)
          logger.log('[FranchiseeListOperatorSide] Fetching ALL approved franchise applications...');
          const resp = await fetch(`${API_BASE_URL}/api/franchise-applications?status=approved`)
          if (!resp.ok) {
            logger.error('[FranchiseeListOperatorSide] Failed to fetch:', resp.status);
            return;
          }
          const appsResponse = await resp.json()
          
          let allFranchises = Array.isArray(appsResponse) ? appsResponse : (appsResponse?.data || [])
          
          logger.log('[FranchiseeListOperatorSide] ========== APPROVED APPLICATIONS FROM API ==========');
          logger.log('[FranchiseeListOperatorSide] Total approved applications:', allFranchises.length);
          allFranchises.forEach((f, idx) => {
            logger.log(`[${idx}] ${f.franchiseNumber} | Email: ${f.operatorEmail || f.email} | Name: ${f.operatorName || f.name}`);
          });
          
          if (!allFranchises.length) {
            logger.warn('[FranchiseeListOperatorSide] No approved franchises found');
            return;
          }
          
          // Store ALL approved franchises for the modal (show all of them)
          logger.log('[FranchiseeListOperatorSide] ⚠️ ABOUT TO SET allUserFranchises');
          logger.log('[FranchiseeListOperatorSide] allFranchises to be stored:', allFranchises.length, 'items');
          logger.log('[FranchiseeListOperatorSide] allFranchises details:', allFranchises.map(f => f.franchiseNumber));
          setAllUserFranchises(allFranchises);
          logger.log('[FranchiseeListOperatorSide] ✓✓✓ Called setAllUserFranchises with', allFranchises.length, 'approved franchises');

          // Use the first one as the "current" matched franchise
          const matched = allFranchises.length > 0 ? allFranchises[0] : null;

          if (matched) {
            const franchiseInfo = {
              orNumber: matched.franchiseNumber,
              status: 'ACTIVE',
              linkedDate: matched.approvedAt || new Date().toLocaleDateString()
            }
            setFranchiseStatus('ACTIVE')
           
            sessionStorage.setItem('userFranchiseInfo', JSON.stringify(franchiseInfo));
            sessionStorage.setItem('franchiseLinked', 'true');
            if (tokenUser?.id) sessionStorage.setItem('franchiseOwnerUserId', tokenUser.id);

            setMatchedFranchise(matched);
    
            try {
              logger.debug('FranchiseeListOperatorSide: matched raw dates ->', { approvedAt: matched.approvedAt, expiryDate: matched.expiryDate });

              const approvedRaw = matched.approvedAt || matched.approved_at || matched.approved_at_string || '';
              const expiryRaw = matched.expiryDate || matched.expiry_date || matched.expiry_date_string || '';

              const parseToDayjs = (raw) => {
                if (!raw && raw !== 0) return null;
                try {
                  const asDay = dayjs(raw);
                  if (asDay && asDay.isValid && asDay.isValid()) return asDay;
                } catch { }
                if (!isNaN(Number(raw))) {
                  try {
                    const asNum = dayjs(Number(raw));
                    if (asNum && asNum.isValid && asNum.isValid()) return asNum;
                  } catch { }
                }
                try {
                  const d = new Date(String(raw));
                  if (!isNaN(d.getTime())) return dayjs(d);
                } catch { }
                return null;
              };

              let parsedApproved = parseToDayjs(approvedRaw);
              let parsedExpiry = parseToDayjs(expiryRaw);
              
              if (!parsedApproved && (approvedRaw || approvedRaw === 0)) {
                try { parsedApproved = dayjs(new Date(String(approvedRaw))); } catch { }
              }
              if (!parsedExpiry && (expiryRaw || expiryRaw === 0)) {
                try { parsedExpiry = dayjs(new Date(String(expiryRaw))); } catch { }
              }

              setFields(prev => ({
                ...prev,
                orNumber: matched.orNumber || matched.franchiseNumber || '',
                franchiseNumber: matched.franchiseNumber || matched.orNumber || '',
                dateApproved: parsedApproved,
                expiryDate: parsedExpiry,
                make: matched.unitModel || matched.make || '',
                sidecarNumber: matched.sidecarPlateNumber || matched.sideCar || '',
                plateNumber: matched.mvPlate || matched.plateNumber || matched.mvPlateNo || '',
                chassisNumber: matched.chassisNumber || matched.chasisNo || '',
                motorNumber: matched.motorEngineNumber || matched.motorEngineNo || ''
              }))
            } catch (e) {
              logger.debug('Failed to populate franchise fields from matched application', e)
            }
          } else {
            setMatchedFranchise(null);
            setFranchiseStatus(null);
          }
        } catch (err) {
          logger.warn('FranchiseeListOperatorSide: error fetching approved franchises', err)
        }
      })()
    } catch {
      // ignore
    }
  }, [user, franchiseFromState])

  // When the authenticated user changes or matchedFranchise changes, load QR code
  useEffect(() => {
    let cancelled = false;
    // revoke previous
    try {
      if (qrBlobRef.current) {
        URL.revokeObjectURL(qrBlobRef.current);
        qrBlobRef.current = null;
      }
    } catch (e) {
      logger.warn('Failed to revoke previous driver qr blob', e);
    }

    const fetchQr = async () => {
      const raw = matchedFranchise?.qrCode || user?.franchise?.qrCode;
      if (!raw) {
        // No qr available; clear any existing blob
        setQrBlobUrl(null);
        return;
      }

      try {
        const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170').replace(/\/$/, '');

        let fetchUrl = raw;
        // Handle GridFS URLs: gridfs://fileId -> /api/files/fileId
        if (raw.startsWith('gridfs://')) {
          const fileId = raw.substring(9);
          fetchUrl = API_BASE_URL + '/api/files/' + fileId;
        } else if (!/^https?:\/\//i.test(raw)) {
          // Treat as server-relative path and prefix API base
          fetchUrl = API_BASE_URL + (raw.startsWith('/') ? raw : '/' + raw);
        }

        const resp = await fetch(fetchUrl, { mode: 'cors' });
        if (!resp.ok) throw new Error('Failed fetching driver QR image: ' + resp.status);
        const blob = await resp.blob();
        if (cancelled) return;
        const obj = URL.createObjectURL(blob);
        qrBlobRef.current = obj;
        setQrBlobUrl(obj);
      } catch (err) {
        logger.warn('FranchiseeListOperatorSide: failed to fetch qr blob', err);
        setQrBlobUrl(null);
      }
    };

    fetchQr();

    return () => {
      cancelled = true;
      try {
        if (qrBlobRef.current) {
          URL.revokeObjectURL(qrBlobRef.current);
          qrBlobRef.current = null;
        }
      } catch (e) {
        logger.warn('Failed to revoke driver qr blob on cleanup', e);
      }
      setQrBlobUrl(null);
    };
  }, [matchedFranchise?.qrCode, user?.franchise?.qrCode]);

  // Fetch ALL active franchises for modal display (same logic as OperatorHomePage)
  useEffect(() => {
    if (!authUser?._id && !authUser?.id) return;
    
    logger.log('[FranchiseeListOperatorSide] Starting fetch of ALL active franchises for user:', authUser);
    setLoadingFranchises(true);
    
    const fetchAllFranchises = async () => {
      try {
        const userId = authUser._id || authUser.id; // Prefer _id (MongoDB ObjectId) for linkedUser lookup
        
        logger.log('[FranchiseeListOperatorSide] Fetching franchises with userId:', userId);
        
        // Use the same API as OperatorHomePage
        const response = await franchiseInformationAPI.getByUser(userId);
        
        logger.log('[FranchiseeListOperatorSide] ========== API RESPONSE ==========');
        logger.log('[FranchiseeListOperatorSide] Response status:', response?.status);
        logger.log('[FranchiseeListOperatorSide] Response data:', response?.data);
        logger.log('[FranchiseeListOperatorSide] Franchise count:', response?.data?.count);
        logger.log('[FranchiseeListOperatorSide] Franchises array:', response?.data?.data);
        
        if (response.data?.success && Array.isArray(response.data.data)) {
          // Filter to show active and expired franchises (exclude only revoked)
          const activeFranchises = response.data.data.filter(f => 
            f.franchiseStatus !== 'Revoked'
          );
          logger.log('[FranchiseeListOperatorSide] Total franchises:', response.data.data.length, 'Non-revoked franchises (Active/Expired):', activeFranchises.length);
          setAllUserFranchises(activeFranchises);
        } else {
          logger.warn('[FranchiseeListOperatorSide] No franchises data or invalid format:', response.data);
          setAllUserFranchises([]);
        }
      } catch (err) {
        logger.error('[FranchiseeListOperatorSide] Error fetching franchises:', err);
        setAllUserFranchises([]);
      } finally {
        setLoadingFranchises(false);
      }
    };
    
    fetchAllFranchises();
  }, [authUser]);

  
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
       
        fetchUserDetails().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [fetchUserDetails]);

  const resolveServerUrl = (raw) => {
    if (!raw) return null;
    try {
      // Do not route public client assets through API server. Keep them as-is so Vite serves them.
      if (raw.startsWith('/public/')) return raw;
      
      const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170').replace(/\/$/, '');
      
      // Handle GridFS URLs: gridfs://fileId -> /api/files/fileId
      if (raw.startsWith('gridfs://')) {
        const fileId = raw.substring(9); // Remove 'gridfs://' prefix
        return base + '/api/files/' + fileId;
      }
      
      // Handle full HTTP URLs
      if (/^https?:\/\//i.test(raw)) return raw;
      
      // If path already absolute on the backend (starts with '/'), prefix with API base
      if (raw.startsWith('/')) return base + raw;
      return base + '/' + raw;
    } catch {
      return raw;
    }
  }

  // Fetch driver's uploaded ID/photo (image or PDF) and create object URL for same-origin preview
  useEffect(() => {
    let cancelled = false;

    // revoke previous id blob
    try {
      if (idBlobRef.current) {
        URL.revokeObjectURL(idBlobRef.current);
        idBlobRef.current = null;
      }
    } catch (e) {
      logger.warn('Failed to revoke previous id blob', e);
    }

    const pickCandidate = () => {
      // Prefer matchedFranchise documents (normalized by backend in FranchiseMgmt)
      // Use matchedFranchise when available — matching logic earlier already
      // attempts to find the correct franchise for this user.
      const mf = matchedFranchise || null;
      const u = user || null;

      if (import.meta.env && import.meta.env.DEV) {
        logger.debug('[FranchiseeListOperatorSide] matchedFranchise sample ->', mf);
        logger.debug('[FranchiseeListOperatorSide] user sample ->', u);
      }

      // PRIORITY 1: Use operatorPictureObj from FranchiseInformation documents
      // PRIORITY 2: Use profilePhoto from FranchiseInformation (via /mine or /auth/me)
      // PRIORITY 3: Use documents.picture from FranchiseApplication
      // PRIORITY 4: Fallback to user-level photos
      const candidates = [
        // Highest priority: FranchiseInformation documents.operatorPictureObj
        mf?.documents?.operatorPictureObj,
        u?.franchise?.documents?.operatorPictureObj,
        // FranchiseInformation profilePhoto
        u?.franchise?.profilePhoto,
        mf?.profilePhoto,
        // FranchiseApplication documents.picture
        mf?.documents?.picture,
        // Other nested document variations
        mf?.documents?.picture?.path,
        mf?.documents?.picture?.url,
        mf?.documents?.photo,
        mf?.documents?.photo?.path,
        mf?.documentPicture,
        mf?.documentPicture?.path,
        // User-level fallbacks
        u?.profilePicture,
        u?.profile_picture,
        u?.photoUrl,
        u?.photo_url,
        u?.avatar,
        u?.image,
        u?.picture,
      ];

      for (const c of candidates) {
        if (!c) continue;
        if (typeof c === 'string') {
          logger.debug('[FranchiseeListOperatorSide] pickCandidate selected string path from', c && c.substring(0, 80));
          return c;
        }
        if (typeof c === 'object') {
          const path = c.path || c.pathname || c.url;
          if (path) {
            logger.debug('[FranchiseeListOperatorSide] pickCandidate selected object path from', path && path.substring(0, 80));
            return path;
          }
        }
      }
      return null;
    }

    const rawPath = pickCandidate();
    const path = resolveServerUrl(rawPath);
    logger.debug('[FranchiseeListOperatorSide] candidate rawPath ->', rawPath, 'resolved ->', path);
    if (!path) {
      setIdBlobUrl(null);
      return () => {};
    }

    // Check for file extension OR /api/files/ path (GridFS files don't have extensions)
    const hasExtension = /\.(png|jpe?g|webp|gif|bmp|svg|pdf)$/i.test(path);
    const isApiFilesPath = /\/api\/files\/[a-f0-9]+/i.test(path);
    const hasTypeHint = String((matchedFranchise?.type || user?.type) || '').includes('image') ||
                        String((matchedFranchise?.type || user?.type) || '').includes('pdf');

    // If no extension AND not an /api/files/ path AND no type hint, skip
    if (!hasExtension && !isApiFilesPath && !hasTypeHint) {
      setIdBlobUrl(null);
      return () => {};
    }

    (async () => {
      try {
        const resp = await fetch(path, { mode: 'cors' });
        if (!resp.ok) throw new Error('Failed fetching id file: ' + resp.status);
        const blob = await resp.blob();
        if (cancelled) return;
        const obj = URL.createObjectURL(blob);
        idBlobRef.current = obj;
        setIdBlobUrl(obj);
        // Detect if PDF from response content-type
        const contentType = resp.headers.get('Content-Type') || blob.type || '';
        setIdBlobIsPdf(contentType.includes('pdf') || /\.pdf$/i.test(rawPath || ''));
      } catch (err) {
        logger.warn('FranchiseeListOperatorSide: failed to fetch id blob, using direct path fallback', err);
        setIdBlobUrl(null);
        setIdBlobIsPdf(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (idBlobRef.current) {
          URL.revokeObjectURL(idBlobRef.current);
          idBlobRef.current = null;
        }
      } catch (e) {
        logger.warn('Failed to revoke id blob on cleanup', e);
      }
      setIdBlobUrl(null);
    };
  }, [user, matchedFranchise]);


  const handleOpenFranchisePage = () => {
    navigate('/operator/franchise');
  }

  const handleAmendmentChoice = (choice) => {
    setAmendmentModalOpen(false);
    
    // Prepare state with amendment type and franchise data
    const navigationState = { 
      amendmentType: choice,
      franchise: matchedFranchise || fields, // Pass matched franchise or form fields
      franchiseChainId: matchedFranchise?.franchiseChainId
    };
    
    if (choice === 'owner') {
      navigate('/operator/request-amendment', { state: navigationState });
    } else if (choice === 'motor') {
      navigate('/operator/request-amendment', { state: navigationState });
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', maxWidth: '100vw', bgcolor: '#f5f7fa', overflowX: 'hidden' }}>
   
      <UnifiedNavbar 
        userType="operator" 
        language={language}
        onLanguageToggle={() => setLanguage(language === 'en' ? 'tl' : 'en')}
        translations={t}
      />
      

  <Box sx={{ background: '#083d77', width: '100%', minHeight: 'auto', position: 'relative', pt: { xs: 3, sm: 4, md: 6 }, pb: { xs: 2, sm: 3, md: 3 }, display: 'flex', flexDirection: 'column', alignItems: 'center', mt: { xs: '80px', sm: '85px', md: '20px' }, px: { xs: 1, sm: 2, md: 0 } }}>
        <Box sx={{ position: 'relative', width: '100%', maxWidth: '1400px', mt: { xs: 2, sm: 3, md: 4 }, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'center', md: 'flex-start' }, justifyContent: { xs: 'center', md: 'flex-start' }, pl: { xs: '16px', sm: '20px', md: '120px' }, pr: { xs: '16px', sm: '20px', md: '0px' }, gap: { xs: 2, sm: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: { xs: 'auto', md: 200 } }}>
            {/* If blob is a PDF we can't render it inside Avatar - show a PDF placeholder and allow preview on click */}
            {idBlobUrl && idBlobIsPdf ? (
              <Avatar
                onClick={() => window.open(idBlobUrl, '_blank')}
                sx={{ width: { xs: 100, sm: 120, md: 140 }, height: { xs: 100, sm: 120, md: 140 }, mb: { xs: 0.5, sm: 1, md: 2 }, boxShadow: '0 2px 8px rgba(0,0,0,0.10)', border: '4px solid #fff', bgcolor: '#fff', color: '#d32f2f', cursor: 'pointer', fontSize: { xs: '1.5rem', md: '2.5rem' } }}
              >
                PDF
              </Avatar>
            ) : (
              <Avatar
                src={
                  idBlobUrl ||
                  resolveServerUrl(
                    // PRIORITY: operatorPictureObj > FranchiseInformation profilePhoto > FranchiseApplication documents.picture > user photo
                    (matchedFranchise && matchedFranchise.documents && matchedFranchise.documents.operatorPictureObj) ||
                    (user && user.franchise && user.franchise.documents && user.franchise.documents.operatorPictureObj) ||
                    (user && user.franchise && user.franchise.profilePhoto) ||
                    (matchedFranchise && matchedFranchise.profilePhoto) ||
                    (matchedFranchise && matchedFranchise.documents && matchedFranchise.documents.picture) ||
                    (matchedFranchise && (matchedFranchise.documentPicture?.path || matchedFranchise.documentPicture)) ||
                    (user && (user.profilePicture || user.photoUrl || user.avatar || user.image)) ||
                    '/public/Logos/clipboard.gif'
                  )
                }
                alt="Profile"
                sx={{ width: { xs: 100, sm: 120, md: 140 }, height: { xs: 100, sm: 120, md: 140 }, mb: { xs: 0.5, sm: 1, md: 2 }, boxShadow: '0 2px 8px rgba(0,0,0,0.10)', border: '4px solid #fff' }}
              />
            )}
          </Box>

          {/* Dev debug panel for chosen ID file */}
            {/* DEV debug UI removed - debug info is logged to console only */}

          <Box sx={{ ml: { xs: 0, md: 4 }, pt: { xs: 0, md: 2 }, flex: '0 0 auto', textAlign: { xs: 'center', md: 'left' }, width: { xs: '100%', md: 'auto' } }}>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: { xs: 0.5, sm: 0.75, md: 1 }, fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' } }}>
              {authUser?.name || 'User Name'}
            </Typography>
            <Typography sx={{ color: '#fff', fontWeight: 500, fontSize: { xs: '0.875rem', sm: '1rem', md: '1rem' }, mb: { xs: 0.5, md: 0 } }}>
             
              {matchedFranchise?.operatorAddress || user?.address || matchedFranchise?.address || matchedFranchise?.driverAddress || t.addressNotProvided}
            </Typography>
            <Typography sx={{ color: '#fff', fontWeight: 500, fontSize: { xs: '0.875rem', sm: '1rem', md: '1rem' } }}>
              
              { 
                // Check if coOwnerName exists and is not empty
                (matchedFranchise?.coOwnerName && matchedFranchise.coOwnerName.trim() !== '') ||
                (user?.franchise?.coOwnerName && user.franchise.coOwnerName.trim() !== '') ?
                (language === 'en' ? 'WITH CO-OWNER' : 'MAY KASAMA') :
                (
                  (user && (user.civilStatus || user.civil_status)) ||
                  (matchedFranchise && (matchedFranchise.civilStatus || matchedFranchise.civil_status || matchedFranchise.operatorCivilStatus))
                ) ?
                String(user?.civilStatus || user?.civil_status || matchedFranchise?.civilStatus || matchedFranchise?.civil_status || matchedFranchise?.operatorCivilStatus).toUpperCase()
                : t.singleNoCoOwner
              }
            </Typography>
            {/* QR is displayed on the right panel (see the blue card area) */}
            <Box sx={{ display: 'flex', gap: 1, mt: { xs: 1.5, md: 1 }, flexDirection: { xs: 'column', sm: 'row' }, width: { xs: '100%', md: 'auto' }, alignItems: { xs: 'center', md: 'flex-start' } }}>
              <Button 
                variant="contained" 
                onClick={handleOpenFranchisePage}
                sx={{ 
                  background: franchiseStatus ? (matchedFranchise?.franchiseStatus === 'Expired' ? '#f39c12' : '#2ecc71') : '#e74c3c', 
                  color: '#fff', 
                  fontWeight: 700, 
                  borderRadius: 2, 
                  px: { xs: 2, md: 3 }, 
                  py: { xs: 1, md: 'auto' },
                  boxShadow: 2, 
                  textTransform: 'none',
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  width: { xs: '100%', sm: 'auto' },
                  '&:hover': { 
                    background: franchiseStatus ? (matchedFranchise?.franchiseStatus === 'Expired' ? '#e67e22' : '#27ae60') : '#c0392b' 
                  } 
                }}
              >
                {franchiseStatus ? (
                  matchedFranchise?.franchiseStatus === 'Expired' ? t.expiredFranchise : t.activeFranchise
                ) : t.noFranchise}
              </Button>
              {franchiseStatus && (
                <IconButton
                  onClick={() => setFranchiseListModalOpen(true)}
                  sx={{
                    background: matchedFranchise?.franchiseStatus === 'Expired' ? '#f39c12' : '#2ecc71',
                    color: '#fff',
                    width: { xs: '100%', sm: 40 },
                    height: 40,
                    borderRadius: 2,
                    '&:hover': {
                      background: matchedFranchise?.franchiseStatus === 'Expired' ? '#e67e22' : '#27ae60'
                    }
                  }}
                >
                  <ArrowDropDownIcon />
                </IconButton>
              )}
            </Box>
          </Box>
          {/* ID badge moved below into the card area for precise alignment */}
        </Box>
      </Box>

      {/* Expiry Alerts */}
      {currentExpiryStatus && (currentExpiryStatus.isExpired || currentExpiryStatus.isExpiringSoon) && (
        <Box sx={{ maxWidth: '1400px', mx: 'auto', px: { xs: 2, md: 4 }, mt: 2 }}>
          <Alert 
            severity={currentExpiryStatus.isExpired ? "error" : "warning"}
            icon={<EventBusyIcon />}
            sx={{ 
              bgcolor: currentExpiryStatus.isExpired ? '#fee' : '#fef3c7',
              borderLeft: `4px solid ${currentExpiryStatus.isExpired ? '#dc2626' : '#f59e0b'}`,
              '& .MuiAlert-icon': {
                color: currentExpiryStatus.isExpired ? '#dc2626' : '#f59e0b'
              }
            }}
            action={
              <Button
                size="small"
                variant="contained"
                startIcon={<AutorenewIcon />}
                onClick={() => {
                  // Pre-fill all franchise data for renewal (similar to amendment workflow)
                  navigate('/operator/franchise/application', {
                    state: {
                      applicationType: 'renewal',
                      franchise: matchedFranchise,
                      previousFranchiseId: matchedFranchise?._id,
                      franchiseChainId: matchedFranchise?.franchiseChainId,
                      // Operator information
                      operatorName: matchedFranchise?.operatorName || user?.name || '',
                      operatorContactNumber: matchedFranchise?.operatorContactNumber || user?.phoneNumber || '',
                      operatorAddress: matchedFranchise?.operatorAddress || '',
                      operatorBarangay: matchedFranchise?.operatorBarangay || '',
                      operatorCivilStatus: matchedFranchise?.operatorCivilStatus || '',
                      operatorBirthPlace: matchedFranchise?.operatorBirthPlace || '',
                      operatorBirthDate: matchedFranchise?.operatorBirthDate || '',
                      operatorCitizenship: matchedFranchise?.operatorCitizenship || '',
                      operatorEmail: matchedFranchise?.operatorEmail || user?.email || '',
                      // Co-owner information
                      coOwnerName: matchedFranchise?.coOwnerName || '',
                      coOwnerAddress: matchedFranchise?.coOwnerAddress || '',
                      coOwnerRelationship: matchedFranchise?.coOwnerRelationship || '',
                      // Driver information
                      driverName: matchedFranchise?.driverName || '',
                      driversAddress: matchedFranchise?.driversAddress || '',
                      // TODA membership
                      todaMembership: matchedFranchise?.todaMembership || '',
                      // Motorcycle information
                      unitModel: matchedFranchise?.unitModel || fields.make || '',
                      colorMotor: matchedFranchise?.colorMotor || '',
                      sideCarColor: matchedFranchise?.sideCarColor || '',
                      sideCarPlateNumber: matchedFranchise?.sideCarPlateNumber || fields.sidecarNumber || '',
                      mvPlateNo: matchedFranchise?.mvPlateNo || fields.plateNumber || '',
                      motorEngineNo: matchedFranchise?.motorEngineNo || fields.motorNumber || '',
                      chasisNo: matchedFranchise?.chasisNo || fields.chassisNumber || '',
                      // Franchise details (for reference, but system generates new dates)
                      franchiseNumber: matchedFranchise?.franchiseNumber || fields.franchiseNumber || '',
                      dateApproved: fields.dateApproved,
                      expiryDate: fields.expiryDate
                      // Note: Documents are NOT pre-filled - user must upload new ones
                    }
                  });
                }}
                sx={{
                  bgcolor: currentExpiryStatus.isExpired ? '#dc2626' : '#f59e0b',
                  '&:hover': { 
                    bgcolor: currentExpiryStatus.isExpired ? '#b91c1c' : '#d97706' 
                  },
                  textTransform: 'none',
                  fontWeight: 600
                }}
              >
                {currentExpiryStatus.isExpired ? 'Renew Now' : 'Renew Early'}
              </Button>
            }
          >
            <AlertTitle sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
              {currentExpiryStatus.isExpired ? '⚠️ Franchise Expired' : '📅 Franchise Expiring Soon'}
            </AlertTitle>
            <Typography sx={{ fontSize: '0.95rem' }}>
              {currentExpiryStatus.isExpired ? (
                <>
                  Your franchise expired {Math.abs(currentExpiryStatus.daysUntilExpiry)} days ago on{' '}
                  {currentExpiryStatus.expiryDate}. Immediate renewal is required to continue operations.
                </>
              ) : (
                <>
                  Your franchise will expire in {currentExpiryStatus.daysUntilExpiry} days on{' '}
                  {currentExpiryStatus.expiryDate}. Please renew before expiry to avoid service interruption.
                </>
              )}
            </Typography>
          </Alert>
        </Box>
      )}

      {/* Main Content - redesigned to match provided card layout */}
      <div className="driver-id-wrapper">
        <div className="driver-id-card" id="franchise-card">
          <div className="id-left">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'center', sm: 'center', md: 'center' }, marginBottom: 1, flexDirection: { xs: 'row', md: 'row' }, gap: { xs: 1, md: 1 }, flexWrap: 'wrap' }}>
              <h3 className="id-title" style={{ flex: '0 0 auto', minWidth: 'auto' }}>TRICYCLE OPERATORS FRANCHISE</h3>
              <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'row', md: 'row' }, width: { xs: 'auto', md: 'auto' } }}>
                {/* Show Renewal button if franchise expires within 3 months or is expired or status is expired */}
                {(() => {
                  const expiryDate = fields.expiryDate && fields.expiryDate.isValid && fields.expiryDate.isValid() 
                    ? fields.expiryDate 
                    : (matchedFranchise?.expiryDate ? dayjs(matchedFranchise.expiryDate) : null);
                  
                  const franchiseStatus = matchedFranchise?.franchiseStatus || 'Active';
                  const isExpired = franchiseStatus === 'Expired';
                  
                  let shouldShowRenew = isExpired;
                  
                  if (!isExpired && expiryDate && expiryDate.isValid()) {
                    const today = dayjs();
                    const threeMonthsFromNow = today.add(3, 'month');
                    const isExpiringSoon = expiryDate.isBefore(threeMonthsFromNow) || expiryDate.isSame(threeMonthsFromNow, 'day');
                    shouldShowRenew = isExpiringSoon;
                  }
                  
                  if (shouldShowRenew) {
                    return (
                      <Button
                        variant="contained"
                        startIcon={<AutorenewIcon />}
                        onClick={() => {
                          // Pre-fill all franchise data for renewal (similar to amendment workflow)
                          navigate('/operator/franchise/application', {
                            state: {
                              applicationType: 'renewal',
                              franchise: matchedFranchise,
                              previousFranchiseId: matchedFranchise?._id,
                              franchiseChainId: matchedFranchise?.franchiseChainId,
                              // Operator information
                              operatorName: matchedFranchise?.operatorName || user?.name || '',
                              operatorContactNumber: matchedFranchise?.operatorContactNumber || user?.phoneNumber || '',
                              operatorAddress: matchedFranchise?.operatorAddress || '',
                              operatorBarangay: matchedFranchise?.operatorBarangay || '',
                              operatorCivilStatus: matchedFranchise?.operatorCivilStatus || '',
                              operatorBirthPlace: matchedFranchise?.operatorBirthPlace || '',
                              operatorBirthDate: matchedFranchise?.operatorBirthDate || '',
                              operatorCitizenship: matchedFranchise?.operatorCitizenship || '',
                              operatorEmail: matchedFranchise?.operatorEmail || user?.email || '',
                              // Co-owner information
                              coOwnerName: matchedFranchise?.coOwnerName || '',
                              coOwnerAddress: matchedFranchise?.coOwnerAddress || '',
                              coOwnerRelationship: matchedFranchise?.coOwnerRelationship || '',
                              // Driver information
                              driverName: matchedFranchise?.driverName || '',
                              driversAddress: matchedFranchise?.driversAddress || '',
                              // TODA membership
                              todaMembership: matchedFranchise?.todaMembership || '',
                              // Motorcycle information
                              unitModel: matchedFranchise?.unitModel || fields.make || '',
                              colorMotor: matchedFranchise?.colorMotor || '',
                              sideCarColor: matchedFranchise?.sideCarColor || '',
                              sideCarPlateNumber: matchedFranchise?.sideCarPlateNumber || fields.sidecarNumber || '',
                              mvPlateNo: matchedFranchise?.mvPlateNo || fields.plateNumber || '',
                              motorEngineNo: matchedFranchise?.motorEngineNo || fields.motorNumber || '',
                              chasisNo: matchedFranchise?.chasisNo || fields.chassisNumber || '',
                              // Franchise details (for reference, but system generates new dates)
                              franchiseNumber: matchedFranchise?.franchiseNumber || fields.franchiseNumber || '',
                              dateApproved: fields.dateApproved,
                              expiryDate: fields.expiryDate
                              // Note: Documents are NOT pre-filled - user must upload new ones
                            }
                          });
                        }}
                        sx={{
                          bgcolor: '#27ae60',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: 12,
                          textTransform: 'none',
                          borderRadius: 1,
                          px: 2,
                          py: 0.5,
                          '&:hover': {
                            bgcolor: '#229954'
                          }
                        }}
                      >
                        Renew Franchise
                      </Button>
                    );
                  }
                  return null;
                })()}
                
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={() => setAmendmentModalOpen(true)}
                  sx={{
                    bgcolor: '#083d77',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 12,
                    textTransform: 'none',
                    borderRadius: 1,
                    px: 2,
                    py: 0.5,
                    '&:hover': {
                      bgcolor: '#062d5c'
                    }
                  }}
                >
                  Make Amendment
                </Button>
              </Box>
            </Box>
            <div className="divider" />

            <div className="fields-grid">
              <div className="field-group">
                <div className="label">DATE APPROVED</div>
                <div className="value">{(fields.dateApproved && fields.dateApproved.isValid && fields.dateApproved.isValid()) ? fields.dateApproved.format('MM/DD/YYYY') : (matchedFranchise?.approvedAt ? new Date(matchedFranchise.approvedAt).toLocaleDateString() : '')}</div>
              </div>
              <div className="field-group">
                <div className="label">EXPIRY DATE</div>
                <div className="value">{(fields.expiryDate && fields.expiryDate.isValid && fields.expiryDate.isValid()) ? fields.expiryDate.format('MM/DD/YYYY') : (matchedFranchise?.expiryDate ? new Date(matchedFranchise.expiryDate).toLocaleDateString() : '')}</div>
              </div>

              <div className="subheading">MOTORCYCLE INFORMATION</div>

              <div className="field-group wide">
                <div className="label">MAKE</div>
                <div className="value">{fields.make || ''}</div>
              </div>
              <div className="field-group">
                <div className="label">SIDECAR NUMBER</div>
                <div className="value">{fields.sidecarNumber || ''}</div>
              </div>
              <div className="field-group">
                <div className="label">PLATE NUMBER</div>
                <div className="value">{fields.plateNumber || ''}</div>
              </div>

              <div className="field-group">
                <div className="label">CHASSIS NUMBER</div>
                <div className="value">{fields.chassisNumber || ''}</div>
              </div>
              <div className="field-group">
                <div className="label">MOTOR NUMBER</div>
                <div className="value">{fields.motorNumber || ''}</div>
              </div>
            </div>
          </div>

          <div className="id-right">
            <div className="qr-container" aria-hidden={(matchedFranchise?.qrCode || user?.franchise?.qrCode) ? 'false' : 'true'}>
              {(matchedFranchise?.qrCode || user?.franchise?.qrCode) ? (
                (() => {
                  const raw = matchedFranchise?.qrCode || user?.franchise?.qrCode;
                  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170').replace(/\/$/, '');
                  let serverUrl = /^https?:\/\//i.test(raw) ? raw : (API_BASE_URL + (raw.startsWith('/') ? raw : '/' + raw));
                  // Handle GridFS URLs: gridfs://fileId -> /api/files/fileId
                  if (raw.startsWith('gridfs://')) {
                    const fileId = raw.substring(9);
                    serverUrl = API_BASE_URL + '/api/files/' + fileId;
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <img
                        src={qrBlobUrl || serverUrl}
                        alt="QR Code"
                        style={{ width: 260, height: 260, objectFit: 'contain', background: '#fff', padding: 12, borderRadius: 8 }}
                      />
                    </div>
                  )
                })()
              ) : (
                <div style={{ color: '#fff', fontWeight: 700 }}>QR not available</div>
              )}
            </div>
          </div>
        </div>
        {/* external badge: positioned relative to the wrapper so its right edge matches the card's right edge */}
        <div className="driver-id-badge">ID NO: {matchedFranchise?.franchiseNumber || fields.franchiseNumber || '0000'}</div>
      </div>

      {/* Franchise List Modal */}
      <Dialog
        open={franchiseListModalOpen}
        onClose={() => setFranchiseListModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#083d77', color: '#fff', fontWeight: 700 }}>
          Active Franchises
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {/* Desktop Table View */}
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <TableContainer component={Paper}>
              <Table>
                <TableHead sx={{ bgcolor: '#083d77' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#fff', fontWeight: 700 }}>NO.</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 700 }}>FRANCHISE NUMBER</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 700 }}>MAKE</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 700 }}>PLATE NUMBER</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 700 }}>STATUS</TableCell>
                    <TableCell sx={{ color: '#fff', fontWeight: 700 }}>EXPIRY DATE</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingFranchises ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                        Loading franchises...
                      </TableCell>
                    </TableRow>
                  ) : allUserFranchises && allUserFranchises.length > 0 ? (
                    allUserFranchises.map((franchise, index) => (
                      <TableRow 
                        key={franchise._id || index}
                        onClick={() => {
                          setMatchedFranchise(franchise);
                          setFranchiseStatus(franchise.franchiseStatus);
                          
                          const parsedApproved = franchise.approvedAt ? dayjs(franchise.approvedAt) : null;
                          const parsedExpiry = franchise.expiryDate ? dayjs(franchise.expiryDate) : null;
                          
                          setFields({
                            orNumber: franchise.franchiseNumber || '',
                            franchiseNumber: franchise.franchiseNumber || '',
                            dateApproved: parsedApproved,
                            expiryDate: parsedExpiry,
                            make: franchise.unitModel || '',
                            sidecarNumber: franchise.sideCarPlateNumber || '',
                            plateNumber: franchise.mvPlateNo || '',
                            chassisNumber: franchise.chasisNo || '',
                            motorNumber: franchise.motorEngineNo || ''
                          });
                          
                          setFranchiseListModalOpen(false);
                        }}
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: 'rgba(8, 61, 119, 0.08)'
                          }
                        }}
                      >
                        <TableCell>{index + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: '#083d77' }}>{franchise.franchiseNumber || 'N/A'}</TableCell>
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
                      <TableCell colSpan={6} sx={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                        No active franchise
                      </TableCell>
                    </TableRow>
                  )}  
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Mobile Card View */}
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            {loadingFranchises ? (
              <Paper elevation={2} sx={{ p: 3, textAlign: 'center', color: '#666' }}>
                <Typography>Loading franchises...</Typography>
              </Paper>
            ) : allUserFranchises && allUserFranchises.length > 0 ? (
              allUserFranchises.map((franchise, index) => (
                <Paper
                  key={franchise._id || index}
                  elevation={3}
                  onClick={() => {
                    setMatchedFranchise(franchise);
                    setFranchiseStatus(franchise.franchiseStatus);
                    
                    const parsedApproved = franchise.approvedAt ? dayjs(franchise.approvedAt) : null;
                    const parsedExpiry = franchise.expiryDate ? dayjs(franchise.expiryDate) : null;
                    
                    setFields({
                      orNumber: franchise.franchiseNumber || '',
                      franchiseNumber: franchise.franchiseNumber || '',
                      dateApproved: parsedApproved,
                      expiryDate: parsedExpiry,
                      make: franchise.unitModel || '',
                      sidecarNumber: franchise.sideCarPlateNumber || '',
                      plateNumber: franchise.mvPlateNo || '',
                      chassisNumber: franchise.chasisNo || '',
                      motorNumber: franchise.motorEngineNo || ''
                    });
                    
                    setFranchiseListModalOpen(false);
                  }}
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
                    <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#083d77' }}>
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
              <Paper elevation={2} sx={{ p: 3, textAlign: 'center', color: '#666' }}>
                <Typography>No active franchise</Typography>
              </Paper>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setFranchiseListModalOpen(false)}
            sx={{ 
              color: '#083d77',
              fontWeight: 600,
              textTransform: 'none'
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Amendment Choice Modal */}
      <Dialog
        open={amendmentModalOpen}
        onClose={() => setAmendmentModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#083d77', color: '#fff', fontWeight: 700 }}>
          Select Amendment Type
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          <Typography sx={{ mb: 3, color: '#666' }}>
            Choose what you would like to update:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => handleAmendmentChoice('owner')}
              sx={{
                py: 2,
                justifyContent: 'flex-start',
                borderColor: '#083d77',
                color: '#083d77',
                fontWeight: 600,
                fontSize: 16,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: '#f5f7fa',
                  borderColor: '#062d5c'
                }
              }}
            >
              Update Franchise Owner
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleAmendmentChoice('motor')}
              sx={{
                py: 2,
                justifyContent: 'flex-start',
                borderColor: '#083d77',
                color: '#083d77',
                fontWeight: 600,
                fontSize: 16,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: '#f5f7fa',
                  borderColor: '#062d5c'
                }
              }}
            >
              Update Motor Information
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setAmendmentModalOpen(false)}
            sx={{ 
              color: '#666',
              fontWeight: 600,
              textTransform: 'none'
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default FranchiseeListOperatorSide;
