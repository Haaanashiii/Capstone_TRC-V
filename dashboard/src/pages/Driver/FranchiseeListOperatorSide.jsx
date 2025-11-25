import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Button, Paper, Avatar, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Menu, MenuItem } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import EditIcon from '@mui/icons-material/Edit';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import UnifiedNavbar from '../../components/UnifiedNavbar';
import '../../Styles/Operator\'s_CSS/FranchiseeListOperatorSide.css';
import dayjs from 'dayjs';
import { franchiseInformationAPI } from '../Services/api';

function FranchiseeListOperatorSide() {
  const navigate = useNavigate();
  const location = useLocation();
  const franchiseFromState = location.state?.franchise; // Get franchise from navigation state
  
  const [user, setUser] = useState(null);
  const [language, setLanguage] = useState('en'); // Language state
  const [franchiseStatus, setFranchiseStatus] = useState(null); // Franchise status state
  const [matchedFranchise, setMatchedFranchise] = useState(franchiseFromState || null);
  
  // Modal states
  const [franchiseListModalOpen, setFranchiseListModalOpen] = useState(false);
  const [amendmentModalOpen, setAmendmentModalOpen] = useState(false);
  
  // User's franchises list (fetched from API)
  const [franchiseList, setFranchiseList] = useState([]);
  const [loadingFranchises, setLoadingFranchises] = useState(false);
  
  // Translation object
  const translations = {
    en: {
      activeFranchise: "ACTIVE FRANCHISE",
      noFranchise: "NO FRANCHISE",
      addressNotProvided: "Address not provided",
      singleNoCoOwner: "SINGLE | NO CO-OWNER",
      toggleLanguage: "Tagalog"
    },
    tl: {
      activeFranchise: "AKTIBONG PRANGKISA",
      noFranchise: "WALANG PRANGKISA",
      addressNotProvided: "Walang nakalagay na address",
      singleNoCoOwner: "NAG-IISA | WALANG KASAMA",
      toggleLanguage: "English"
    }
  };
  
  const t = translations[language];
  
  // Check franchise status from sessionStorage or API
  const checkFranchiseStatus = () => {
    // Check if user has linked franchise (stored in sessionStorage - cleared on tab close)
    const franchiseData = sessionStorage.getItem('userFranchiseInfo');
    if (franchiseData) {
      try {
        const parsedData = JSON.parse(franchiseData);
        setFranchiseStatus(parsedData.status || 'ACTIVE');
      } catch (error) {
        console.error('Error parsing franchise data:', error);
        setFranchiseStatus(null);
      }
    } else {
      setFranchiseStatus(null);
    }
  };
  
  // Get user info from token
  const getUserInfo = () => {
    // Token is stored in sessionStorage (secure, cleared on tab close)
    const token = sessionStorage.getItem('accessToken');
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch {
      return null;
    }
  };

  // Fetch full user details from the server
  const fetchUserDetails = React.useCallback(async () => {
    try {
      // Token is stored in sessionStorage
      const token = sessionStorage.getItem('accessToken');
      if (!token) return;

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
      console.log('[FranchiseeListOperatorSide] Fetching user details from:', `${API_BASE_URL}/auth/me`);
      
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('FranchiseeListOperatorSide: Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('FranchiseeListOperatorSide: User details received:', data);
        console.log('FranchiseeListOperatorSide: QR Code from user.franchise:', data.user?.franchise?.qrCode);
        console.log('FranchiseeListOperatorSide: Profile photo from user.franchise:', data.user?.franchise?.profilePhoto);
        setUser(data.user);
      } else {
        console.log('FranchiseeListOperatorSide: /auth/me returned non-ok. Clearing any stored franchise info to avoid stale data.');
        // If server says the user is not available (e.g., deleted), clear any stored franchise
        sessionStorage.removeItem('userFranchiseInfo');
        sessionStorage.removeItem('franchiseLinked');
        sessionStorage.removeItem('franchiseMenuReplaced');
        sessionStorage.removeItem('franchiseOwnerUserId');
        setFranchiseStatus(null);
        // Do not blindly trust token fallback when server indicates user missing. Use token data only as display fallback.
        const tokenUser = getUserInfo();
        setUser(tokenUser || null);
      }
    } catch (error) {
      console.error('FranchiseeListOperatorSide: Error fetching user details:', error);
     
      sessionStorage.removeItem('userFranchiseInfo');
      sessionStorage.removeItem('franchiseLinked');
      sessionStorage.removeItem('franchiseOwnerUserId');
      setFranchiseStatus(null);
      const tokenUser = getUserInfo();
      setUser(tokenUser || null);
    }
  }, []);

  // Fetch user details on component mount
  useEffect(() => {
    // Token is only in sessionStorage (secure storage)
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      console.log('[FranchiseeListOperatorSide] Token found, initializing user data...');
      const tokenUser = getUserInfo();
      if (tokenUser) {
        console.log('[FranchiseeListOperatorSide] User from token:', tokenUser);
        setUser(tokenUser);
      }
    
      fetchUserDetails();
    }
    // Check franchise status
    checkFranchiseStatus();
   
  }, [fetchUserDetails]);

  
  useEffect(() => {
    // If franchise data was passed via navigation state, use it directly
    if (franchiseFromState) {
      console.log('[FranchiseeListOperatorSide] Using franchise from navigation state:', franchiseFromState);
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
      if (!user) return;
      const storedOwnerUserId = sessionStorage.getItem('franchiseOwnerUserId');
      const userId = user.id;
      if (!storedOwnerUserId || storedOwnerUserId !== userId) {
        // clear any stale franchise info for other users
        sessionStorage.removeItem('userFranchiseInfo');
        sessionStorage.removeItem('franchiseLinked');
      }


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
                console.debug('[FranchiseeListOperatorSide] matched application from /mine', matched);
           
                if (matched && matched.id) {
                  console.log('[FranchiseeListOperatorSide] Matched franchise data:', {
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
                  
                  console.log('[FranchiseeListOperatorSide] Date parsing:', { approvedRaw, expiryRaw });
                  
                  const parsedApproved = approvedRaw ? dayjs(approvedRaw) : null;
                  const parsedExpiry = expiryRaw ? dayjs(expiryRaw) : null;
                  
                  console.log('[FranchiseeListOperatorSide] Parsed dates:', {
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
                  
                  console.log('[FranchiseeListOperatorSide] Successfully linked franchise via /mine endpoint with userId:', userId);
                  return; 
                }
              }
            } catch (e) {
              console.warn('FranchiseeListOperatorSide: /mine lookup failed', e)
            }
          }

         
          const resp = await fetch(`${API_BASE_URL}/api/franchise-applications?status=approved`)
          if (!resp.ok) return
          const apps = await resp.json()
          console.debug('[FranchiseeListOperatorSide] approved applications fetched', Array.isArray(apps) ? apps.length : 'not-array', apps)
          if (!Array.isArray(apps) || !apps.length) return
        
          const userIdentifiers = new Set();
          if (user.email) userIdentifiers.add(String(user.email).toLowerCase());
          if (user.username) userIdentifiers.add(String(user.username).toLowerCase());
          if (user.name) userIdentifiers.add(String(user.name).toLowerCase());
          if (user.operatorId) userIdentifiers.add(String(user.operatorId).toLowerCase());
          if (user.driversID) userIdentifiers.add(String(user.driversID).toLowerCase());
          if (user.driverId) userIdentifiers.add(String(user.driverId).toLowerCase());
          if (user.mvPlate) userIdentifiers.add(String(user.mvPlate).toLowerCase());
          if (user.plateNumber) userIdentifiers.add(String(user.plateNumber).toLowerCase());
          if (user.mvPlateNo) userIdentifiers.add(String(user.mvPlateNo).toLowerCase());

          // Prefer strong exact identifier matches (email, driver id, plate). If none, fall back
          // to a name-based match only when it yields a single unique candidate.
          const matched = (() => {
            try {
              const toLower = s => (s || '').toLowerCase();
              const emailMap = new Map();
              const driverIdMap = new Map();
              const plateMap = new Map();

              for (const a of apps) {
                if (!a) continue;
                const appEmail = toLower(a.operatorEmail || a.email || '');
                if (appEmail) emailMap.set(appEmail, a);
                const appDriverId = toLower(a.driverName || a.driversID || a.driverId || '');
                if (appDriverId) driverIdMap.set(appDriverId, a);
                const appPlate = toLower(a.plateNumber || a.mvPlate || a.mvPlateNo || a.sidecarPlateNumber || '');
                if (appPlate) plateMap.set(appPlate, a);
              }

              // Try exact matches using the collected user identifiers
              for (const id of userIdentifiers) {
                if (emailMap.has(id)) return emailMap.get(id);
                if (driverIdMap.has(id)) return driverIdMap.get(id);
                if (plateMap.has(id)) return plateMap.get(id);
              }

              // Name fallback: only accept if it uniquely identifies a single application
              const uname = toLower(user.name || '');
              if (uname && uname.length > 3) {
                const nameMatches = apps.filter(a => {
                  const nm = toLower(a.name || a.operatorName || a.driverName || '');
                  return nm && nm.includes(uname);
                });
                if (nameMatches.length === 1) return nameMatches[0];
              }

            } catch (e) {
              console.warn('[FranchiseeListOperatorSide] matching error', e);
            }
            return null;
          })();

          if (matched) {
            const franchiseInfo = {
              orNumber: matched.franchiseNumber,
              status: 'ACTIVE',
              linkedDate: matched.approvedAt || new Date().toLocaleDateString()
            }
            setFranchiseStatus('ACTIVE')
           
            sessionStorage.setItem('userFranchiseInfo', JSON.stringify(franchiseInfo));
            sessionStorage.setItem('franchiseLinked', 'true');
            const tokenUserId = getUserInfo()?.id;
            if (tokenUserId) sessionStorage.setItem('franchiseOwnerUserId', tokenUserId);

            setMatchedFranchise(matched);
    
            try {
              // Debug: log raw date fields
              console.debug('FranchiseeListOperatorSide: matched raw dates ->', { approvedAt: matched.approvedAt, expiryDate: matched.expiryDate });


              const approvedRaw = matched.approvedAt || matched.approved_at || matched.approved_at_string || '';
              const expiryRaw = matched.expiryDate || matched.expiry_date || matched.expiry_date_string || '';

              const parseToDayjs = (raw) => {
                if (!raw && raw !== 0) return null;
           
                try {
                  const asDay = dayjs(raw);
                  if (asDay && asDay.isValid && asDay.isValid()) return asDay;
                } catch {
                  // fallthrough
                }
                // numeric timestamp
                if (!isNaN(Number(raw))) {
                  try {
                    const asNum = dayjs(Number(raw));
                    if (asNum && asNum.isValid && asNum.isValid()) return asNum;
                  } catch {
                    // fallthrough
                  }
                }
              
                try {
                  const d = new Date(String(raw));
                  if (!isNaN(d.getTime())) return dayjs(d);
                } catch {
                  // give up
                }
                return null;
              };

              let parsedApproved = parseToDayjs(approvedRaw);
              let parsedExpiry = parseToDayjs(expiryRaw);
              
              if (!parsedApproved && (approvedRaw || approvedRaw === 0)) {
                try { parsedApproved = dayjs(new Date(String(approvedRaw))); } catch { /* ignore */ }
              }
              if (!parsedExpiry && (expiryRaw || expiryRaw === 0)) {
                try { parsedExpiry = dayjs(new Date(String(expiryRaw))); } catch { /* ignore */ }
              }
              console.debug('FranchiseeListOperatorSide: parsed dates valid ->', { approved: parsedApproved ? parsedApproved.isValid() : false, expiry: parsedExpiry ? parsedExpiry.isValid() : false });

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
              console.debug('Failed to populate franchise fields from matched application', e)
            }
          }
          else {
          
            setMatchedFranchise(null);
            setFranchiseStatus(null);
          
          }
        } catch (err) {
          console.warn('FranchiseeListOperatorSide: error fetching approved franchises', err)
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
      console.warn('Failed to revoke previous driver qr blob', e);
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

        // If raw is an R2 scheme or Cloudflare public URL, route through backend proxy
        let fetchUrl = raw;
        if (raw.startsWith('r2://') || /^https?:\/\/pub-[a-f0-9]+\.r2\.dev/i.test(raw) || (import.meta.env.VITE_CLOUDFLARE_R2_PUBLIC_URL && raw.startsWith(import.meta.env.VITE_CLOUDFLARE_R2_PUBLIC_URL))) {
          fetchUrl = API_BASE_URL + '/api/franchise-applications/proxy-file?url=' + encodeURIComponent(raw);
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
        console.warn('FranchiseeListOperatorSide: failed to fetch qr blob', err);
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
        console.warn('Failed to revoke driver qr blob on cleanup', e);
      }
      setQrBlobUrl(null);
    };
  }, [matchedFranchise?.qrCode, user?.franchise?.qrCode]);

  
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
       
        fetchUserDetails().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [fetchUserDetails]);
  


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

  const resolveServerUrl = (raw) => {
    if (!raw) return null;
    try {
      // Do not route public client assets through API server. Keep them as-is so Vite serves them.
      if (raw.startsWith('/public/')) return raw;
      
      const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170').replace(/\/$/, '');
      
      // Route R2 URLs through backend proxy
      if (raw.startsWith('r2://') || /^https?:\/\/pub-[a-f0-9]+\.r2\.dev/i.test(raw)) {
        return base + '/api/franchise-applications/proxy-file?url=' + encodeURIComponent(raw);
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
      console.warn('Failed to revoke previous id blob', e);
    }

    const pickCandidate = () => {
      // Prefer matchedFranchise documents (normalized by backend in FranchiseMgmt)
      // Use matchedFranchise when available — matching logic earlier already
      // attempts to find the correct franchise for this user.
      const mf = matchedFranchise || null;
      const u = user || null;

      if (import.meta.env && import.meta.env.DEV) {
        console.debug('[FranchiseeListOperatorSide] matchedFranchise sample ->', mf);
        console.debug('[FranchiseeListOperatorSide] user sample ->', u);
      }

      // PRIORITY 1: Use profilePhoto from FranchiseInformation (via /mine or /auth/me)
      // PRIORITY 2: Use documents.picture from FranchiseApplication
      // PRIORITY 3: Fallback to user-level photos
      const candidates = [
        // Highest priority: FranchiseInformation profilePhoto
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
          console.debug('[FranchiseeListOperatorSide] pickCandidate selected string path from', c && c.substring(0, 80));
          return c;
        }
        if (typeof c === 'object') {
          const path = c.path || c.pathname || c.url;
          if (path) {
            console.debug('[FranchiseeListOperatorSide] pickCandidate selected object path from', path && path.substring(0, 80));
            return path;
          }
        }
      }
      return null;
    }

    const rawPath = pickCandidate();
    const path = resolveServerUrl(rawPath);
    console.debug('[FranchiseeListOperatorSide] candidate rawPath ->', rawPath, 'resolved ->', path);
    if (!path) {
      setIdBlobUrl(null);
      return () => {};
    }

    const isImage = /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(path) || String((matchedFranchise?.type || user?.type) || '').includes('image');
    const isPdf = /\.pdf$/i.test(path) || String((matchedFranchise?.type || user?.type) || '').includes('pdf');

    if (!isImage && !isPdf) {
      // Not an image/pdf — don't fetch; let Avatar use resolved URL fallback
      setIdBlobUrl(null);
      return () => {};
    }

    (async () => {
      try {
        const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170')
        let fetchUrl = path;

        // Route R2 or Cloudflare public URLs through the backend proxy to avoid CORS/auth problems
        if (rawPath && (rawPath.startsWith('r2://') || /^https?:\/\/pub-[a-f0-9]+\.r2\.dev/i.test(rawPath))) {
          fetchUrl = API_BASE_URL.replace(/\/$/, '') + '/api/franchise-applications/proxy-file?url=' + encodeURIComponent(rawPath)
          console.debug('[FranchiseeListOperatorSide] routing id fetch through proxy ->', fetchUrl)
        }

        const resp = await fetch(fetchUrl, { mode: 'cors' });
        if (!resp.ok) throw new Error('Failed fetching id file: ' + resp.status);
        const blob = await resp.blob();
        if (cancelled) return;
        const obj = URL.createObjectURL(blob);
        idBlobRef.current = obj;
        setIdBlobUrl(obj);
        // detect if PDF
        const mime = blob.type || '';
        setIdBlobIsPdf(mime.includes('pdf') || /\.pdf$/i.test(rawPath || ''));
      } catch (err) {
        console.warn('FranchiseeListOperatorSide: failed to fetch id blob, using direct path fallback', err);
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
        console.warn('Failed to revoke id blob on cleanup', e);
      }
      setIdBlobUrl(null);
    };
  }, [user, matchedFranchise]);


  const handleOpenFranchisePage = () => {
    navigate('/operator/franchise');
  }

  const handleAmendmentChoice = (choice) => {
    setAmendmentModalOpen(false);
    if (choice === 'owner') {
      navigate('/operator/request-amendment', { state: { amendmentType: 'owner' } });
    } else if (choice === 'motor') {
      navigate('/operator/request-amendment', { state: { amendmentType: 'motor' } });
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
      

  <Box sx={{ background: '#083d77', width: '100vw', minHeight: 220, position: 'relative', pt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ position: 'relative', width: '100vw', mt: 4, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', pl: '120px' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 200 }}>
            {/* If blob is a PDF we can't render it inside Avatar - show a PDF placeholder and allow preview on click */}
            {idBlobUrl && idBlobIsPdf ? (
              <Avatar
                onClick={() => window.open(idBlobUrl, '_blank')}
                sx={{ width: 140, height: 140, mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.10)', border: '6px solid #fff', bgcolor: '#fff', color: '#d32f2f', cursor: 'pointer' }}
              >
                PDF
              </Avatar>
            ) : (
              <Avatar
                src={
                  idBlobUrl ||
                  resolveServerUrl(
                    // PRIORITY: FranchiseInformation profilePhoto > FranchiseApplication documents.picture > user photo
                    (user && user.franchise && user.franchise.profilePhoto) ||
                    (matchedFranchise && matchedFranchise.profilePhoto) ||
                    (matchedFranchise && matchedFranchise.documents && matchedFranchise.documents.picture) ||
                    (matchedFranchise && (matchedFranchise.documentPicture?.path || matchedFranchise.documentPicture)) ||
                    (user && (user.profilePicture || user.photoUrl || user.avatar || user.image)) ||
                    '/public/Logos/clipboard.gif'
                  )
                }
                alt="Profile"
                sx={{ width: 140, height: 140, mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.10)', border: '6px solid #fff' }}
              />
            )}
          </Box>

          {/* Dev debug panel for chosen ID file */}
            {/* DEV debug UI removed - debug info is logged to console only */}

          <Box sx={{ ml: 4, pt: 2, flex: '0 0 auto' }}>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
              {user?.name || 'User Name'}
            </Typography>
            <Typography sx={{ color: '#fff', fontWeight: 500, fontSize: 16 }}>
             
              {user?.address || matchedFranchise?.address || matchedFranchise?.driverAddress || t.addressNotProvided}
            </Typography>
            <Typography sx={{ color: '#fff', fontWeight: 500, fontSize: 16 }}>
              
              { (
                  (user && (user.civilStatus || user.civil_status)) ||
                  (matchedFranchise && (matchedFranchise.civilStatus || matchedFranchise.civil_status))
                ) ?
                String(user?.civilStatus || user?.civil_status || matchedFranchise?.civilStatus || matchedFranchise?.civil_status).toUpperCase()
                : t.singleNoCoOwner
              }
            </Typography>
            {/* QR is displayed on the right panel (see the blue card area) */}
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button 
                variant="contained" 
                onClick={handleOpenFranchisePage}
                sx={{ 
                  background: franchiseStatus ? '#2ecc71' : '#e74c3c', 
                  color: '#fff', 
                  fontWeight: 700, 
                  borderRadius: 2, 
                  px: 3, 
                  boxShadow: 2, 
                  textTransform: 'none', 
                  '&:hover': { 
                    background: franchiseStatus ? '#27ae60' : '#c0392b' 
                  } 
                }}
              >
                {franchiseStatus ? t.activeFranchise : t.noFranchise}
              </Button>
              {franchiseStatus && (
                <IconButton
                  onClick={() => setFranchiseListModalOpen(true)}
                  sx={{
                    background: '#2ecc71',
                    color: '#fff',
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    '&:hover': {
                      background: '#27ae60'
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

      {/* Main Content - redesigned to match provided card layout */}
      <div className="driver-id-wrapper">
        <div className="driver-id-card">
          <div className="id-left">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 className="id-title">MOTORIZED TRICYCLE OPERATORS FRANCHISE</h3>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {/* Show Renewal button if franchise expires within 3 months or is expired */}
                {(() => {
                  const expiryDate = fields.expiryDate && fields.expiryDate.isValid && fields.expiryDate.isValid() 
                    ? fields.expiryDate 
                    : (matchedFranchise?.expiryDate ? dayjs(matchedFranchise.expiryDate) : null);
                  
                  if (expiryDate && expiryDate.isValid()) {
                    const today = dayjs();
                    const threeMonthsFromNow = today.add(3, 'month');
                    const isExpiringSoon = expiryDate.isBefore(threeMonthsFromNow) || expiryDate.isSame(threeMonthsFromNow, 'day');
                    
                    if (isExpiringSoon) {
                      return (
                        <Button
                          variant="contained"
                          startIcon={<AutorenewIcon />}
                          onClick={() => {
                            // Navigate to franchise application with renewal data
                            navigate('/operator/franchise', {
                              state: {
                                applicationType: 'renewal',
                                previousFranchiseId: matchedFranchise?._id,
                                franchiseNumber: fields.franchiseNumber,
                                dateApproved: fields.dateApproved,
                                expiryDate: fields.expiryDate,
                                make: fields.make,
                                sidecarNumber: fields.sidecarNumber,
                                plateNumber: fields.plateNumber,
                                chassisNumber: fields.chassisNumber,
                                motorNumber: fields.motorNumber
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
            </div>
            <div className="divider" />

            <div className="fields-grid">
              <div className="field-group">
                <div className="label">OR NUMBER</div>
                <div className="value">{fields.orNumber || ''}</div>
              </div>
              <div className="field-group">
                <div className="label">FRANCHISE NUMBER</div>
                <div className="value">{fields.franchiseNumber || ''}</div>
              </div>

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
                  // If R2 scheme or public R2 URL, point to backend proxy URL as fallback
                  if (raw.startsWith('r2://') || /^https?:\/\/pub-[a-f0-9]+\.r2\.dev/i.test(raw) || (import.meta.env.VITE_CLOUDFLARE_R2_PUBLIC_URL && raw.startsWith(import.meta.env.VITE_CLOUDFLARE_R2_PUBLIC_URL))) {
                    serverUrl = API_BASE_URL + '/api/franchise-applications/proxy-file?url=' + encodeURIComponent(raw);
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
        maxWidth="md"
        fullWidth
        onTransitionEnter={() => {
          // Fetch franchises when modal opens
          const userId = user?._id || user?.id;
          if (userId) {
            setLoadingFranchises(true);
            franchiseInformationAPI.getByUser(userId)
              .then(response => {
                if (response.data?.success && Array.isArray(response.data.data)) {
                  setFranchiseList(response.data.data);
                }
              })
              .catch(err => console.error('Failed to fetch franchises:', err))
              .finally(() => setLoadingFranchises(false));
          }
        }}
      >
        <DialogTitle sx={{ bgcolor: '#083d77', color: '#fff', fontWeight: 700 }}>
          Active Franchises
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {loadingFranchises ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">Loading franchises...</Typography>
            </Box>
          ) : franchiseList.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">No franchises found</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {franchiseList.map((franchise) => {
                const isCurrentFranchise = matchedFranchise?._id === franchise._id || 
                                          matchedFranchise?.franchiseNumber === franchise.franchiseNumber;
                return (
                  <Paper
                    key={franchise._id}
                    elevation={isCurrentFranchise ? 4 : 2}
                    onClick={() => {
                      // Switch to this franchise
                      setMatchedFranchise(franchise);
                      setFranchiseStatus(franchise.franchiseStatus);
                      
                      // Update form fields
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
                      p: 2,
                      borderRadius: 2,
                      border: isCurrentFranchise ? '2px solid #083d77' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      bgcolor: isCurrentFranchise ? '#f0f7ff' : 'transparent',
                      '&:hover': {
                        borderColor: '#083d77',
                        boxShadow: 4
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography sx={{ fontSize: 12, color: '#666', mb: 0.5 }}>
                          Franchise Number
                        </Typography>
                        <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#083d77' }}>
                          {franchise.franchiseNumber}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: 'inline-block',
                          color: franchise.franchiseStatus === 'Active' ? '#2ecc71' : '#e74c3c',
                          fontWeight: 600,
                          padding: '6px 16px',
                          borderRadius: 1,
                          backgroundColor: franchise.franchiseStatus === 'Active' ? '#e8f8f0' : '#ffe8e8',
                          fontSize: 14
                        }}
                      >
                        {franchise.franchiseStatus || 'Active'}
                      </Box>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                      <Box>
                        <Typography sx={{ fontSize: 12, color: '#666', mb: 0.5 }}>
                          Date Approved
                        </Typography>
                        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                          {franchise.approvedAt ? new Date(franchise.approvedAt).toLocaleDateString() : 'N/A'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 12, color: '#666', mb: 0.5 }}>
                          Expiry Date
                        </Typography>
                        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                          {franchise.expiryDate ? new Date(franchise.expiryDate).toLocaleDateString() : 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
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
