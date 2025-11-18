import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper, Avatar, TextField } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import UnifiedSidebar from '../../components/UnifiedSidebar';
import './DriverID.css';
import dayjs from 'dayjs';

function DriverID() {
  const navigate = useNavigate(); // Must be declared at the top before any useEffect that uses it
  
  const [user, setUser] = useState(null);
  const [language, setLanguage] = useState('en'); // Language state
  const [franchiseStatus, setFranchiseStatus] = useState(null); // Franchise status state
  const [matchedFranchise, setMatchedFranchise] = useState(null);
  
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
      console.log('[DriverID] Fetching user details from:', `${API_BASE_URL}/auth/me`);
      
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('DriverID: Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('DriverID: User details received:', data);
        setUser(data.user);
      } else {
        console.log('DriverID: /auth/me returned non-ok. Clearing any stored franchise info to avoid stale data.');
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
      console.error('DriverID: Error fetching user details:', error);
     
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
      console.log('[DriverID] Token found, initializing user data...');
      const tokenUser = getUserInfo();
      if (tokenUser) {
        console.log('[DriverID] User from token:', tokenUser);
        
        // GATE-KEEPING: Check if user has franchise
        if (!tokenUser.hasFranchise) {
          console.warn('[DriverID] User does not have franchise yet, redirecting to Franchise page');
          navigate('/operator/franchise');
          return;
        }
        
        setUser(tokenUser);
      }
    
      fetchUserDetails();
    } else {
      console.warn('[DriverID] No token found in sessionStorage');
      navigate('/login');
    }
    // Check franchise status
    checkFranchiseStatus();
   
  }, [fetchUserDetails, navigate]);

  
  useEffect(() => {
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
                console.debug('[DriverID] matched application from /mine', matched);
           
                if (matched) {
                  const franchiseInfo = {
                    orNumber: matched.franchiseNumber,
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
                  const parsedApproved = approvedRaw ? dayjs(approvedRaw) : null;
                  const parsedExpiry = expiryRaw ? dayjs(expiryRaw) : null;
                  setFields(prev => ({
                    ...prev,
                    orNumber: matched.orNumber || matched.franchiseNumber || '',
                    franchiseNumber: matched.franchiseNumber || matched.orNumber || '',
                    dateApproved: parsedApproved,
                    expiryDate: parsedExpiry,
                    make: matched.make || '',
                    sidecarNumber: matched.sidecarPlateNumber || '',
                    plateNumber: matched.plateNumber || matched.plateNumber || matched.mvPlate || '',
                    chassisNumber: matched.chassisNumber || '',
                    motorNumber: matched.motorEngineNumber || ''
                  }))
                  return; 
                }
              }
            } catch (e) {
              console.warn('DriverID: /mine lookup failed', e)
            }
          }

         
          const resp = await fetch(`${API_BASE_URL}/api/franchise-applications?status=approved`)
          if (!resp.ok) return
          const apps = await resp.json()
          console.debug('[DriverID] approved applications fetched', Array.isArray(apps) ? apps.length : 'not-array', apps)
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
              console.warn('[DriverID] matching error', e);
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
              console.debug('DriverID: matched raw dates ->', { approvedAt: matched.approvedAt, expiryDate: matched.expiryDate });


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
              console.debug('DriverID: parsed dates valid ->', { approved: parsedApproved ? parsedApproved.isValid() : false, expiry: parsedExpiry ? parsedExpiry.isValid() : false });

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
          console.warn('DriverID: error fetching approved franchises', err)
        }
      })()
    } catch {
      // ignore
    }
  }, [user])

  // When the authenticated user changes, load QR from user.franchise.qrCode (do not regenerate)
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
      const raw = user?.franchise?.qrCode;
      if (!raw) {
        // No qr on user's franchise info; clear any existing blob
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
        console.warn('DriverID: failed to fetch qr blob from user.franchise.qrCode', err);
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
  }, [user?.franchise?.qrCode]);

  
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
      if (/^https?:\/\//i.test(raw)) return raw;
      // Do not route public client assets through API server. Keep them as-is so Vite serves them.
      if (raw.startsWith('/public/')) return raw;
      const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170').replace(/\/$/, '');
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
        console.debug('[DriverID] matchedFranchise sample ->', mf);
        console.debug('[DriverID] user sample ->', u);
      }

      // Expanded candidate list: include common shapes returned by backend
      const candidates = [
        // direct picture/profile keys on franchise
        mf?.profilePhoto,
        mf?.profile_photo,
        mf?.picture,
        mf?.photoUrl,
        mf?.photo_url,
        mf?.image,
        mf?.avatar,
        // nested documents object commonly used in server
        mf?.documents?.picture,
        mf?.documents?.picture?.path,
        mf?.documents?.picture?.url,
        mf?.documents?.photo,
        mf?.documents?.photo?.path,
        mf?.documentPicture,
        mf?.documentPicture?.path,
        mf?.documentDriversLicense,
        mf?.documentDriversLicense?.path,
        mf?.documentCedula,
        mf?.documentCedula?.path,
        mf?.documentRegistration,
        mf?.documentRegistration?.path,
        // fallback to user-level photos
        u?.profilePicture,
        u?.profile_picture,
        u?.photoUrl,
        u?.photo_url,
        u?.avatar,
        u?.image,
        u?.picture,
        // franchise nested under user (as returned by /auth/me)
        u?.franchise?.profilePhoto,
        u?.franchise?.documents?.picture,
        u?.franchise?.documents?.picture?.path,
        u?.franchise?.profile_photo,
        u?.franchise?.profilePhoto?.path,
      ];

      for (const c of candidates) {
        if (!c) continue;
        if (typeof c === 'string') {
          console.debug('[DriverID] pickCandidate selected string path from', c && c.substring(0, 80));
          return c;
        }
        if (typeof c === 'object') {
          const path = c.path || c.pathname || c.url;
          if (path) {
            console.debug('[DriverID] pickCandidate selected object path from', path && path.substring(0, 80));
            return path;
          }
        }
      }
      return null;
    }

    const rawPath = pickCandidate();
    const path = resolveServerUrl(rawPath);
    console.debug('[DriverID] candidate rawPath ->', rawPath, 'resolved ->', path);
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
          console.debug('[DriverID] routing id fetch through proxy ->', fetchUrl)
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
        console.warn('DriverID: failed to fetch id blob, using direct path fallback', err);
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

  // Palagay muna for dev test 

  const handleResetFranchiseDev = () => {
    try { localStorage.removeItem('franchiseMenuReplaced'); } catch { /* ignore */ }
    try { localStorage.removeItem('franchiseLinked'); } catch { /* ignore */ }
    try { localStorage.removeItem('userFranchiseInfo'); } catch { /* ignore */ }
    try { localStorage.removeItem('franchiseOwnerEmail'); } catch { /* ignore */ }
    setFranchiseStatus(null);
    navigate('/operator/franchise');
  }

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', maxWidth: '100vw', bgcolor: '#f5f7fa', overflowX: 'hidden' }}>
   
      <UnifiedSidebar 
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
                    // prefer matchedFranchise picture/document, then user photo
                    (matchedFranchise && (matchedFranchise.documentPicture?.path || matchedFranchise.documentPicture || matchedFranchise.photoUrl || matchedFranchise.picture || matchedFranchise.avatar)) ||
                    (user && (user.photoUrl || user.avatar || user.image)) ||
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
            <Button 
              variant="contained" 
              onClick={handleOpenFranchisePage}
              sx={{ 
                background: franchiseStatus ? '#2ecc71' : '#e74c3c', 
                color: '#fff', 
                fontWeight: 700, 
                borderRadius: 2, 
                mt: 1, 
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
            {/* Temporary dev-only control to reset franchise state for testing */}
            {import.meta.env && import.meta.env.DEV && (
              <Button
                variant="outlined"
                onClick={handleResetFranchiseDev}
                sx={{ ml: 2, mt: 1, color: '#fff', borderColor: '#fff', textTransform: 'none' }}
              >
                DEV: Reset Franchise
              </Button>
            )}
          </Box>
          {/* ID badge moved below into the card area for precise alignment */}
        </Box>
      </Box>

      {/* Main Content - redesigned to match provided card layout */}
      <div className="driver-id-wrapper">
        <div className="driver-id-card">
          <div className="id-left">
            <h3 className="id-title">MOTORIZED TRICYCLE OPERATORS FRANCHISE</h3>
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
            <div className="qr-container" aria-hidden={user?.franchise?.qrCode ? 'false' : 'true'}>
              {user?.franchise?.qrCode ? (
                (() => {
                  const raw = user.franchise.qrCode;
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
        <div className="driver-id-badge">ID NO: {user?.operatorId || user?.id?.toString().slice(-4) || '0000'}</div>
      </div>
    </Box>
  );
}

export default DriverID;




