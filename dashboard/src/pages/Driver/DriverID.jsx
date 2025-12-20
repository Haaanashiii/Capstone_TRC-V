import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Avatar } from '@mui/material';
import UnifiedNavbar from '../../components/UnifiedNavbar';
import './DriverID.css';
import dayjs from 'dayjs';
import { logger } from '../../utils/logger';
import { useTokenUser, useFranchiseStatus, useDriverTranslations, useServerUrl, useBlobUrl } from '../../hooks/useDriverUtils';
import '../../Styles/animations.css';

function DriverID() {
  const navigate = useNavigate();
  const tokenUser = useTokenUser();
  const { franchiseStatus, checkFranchiseStatus, setFranchiseStatus } = useFranchiseStatus();
  const resolveServerUrl = useServerUrl();
  
  const [user, setUser] = useState(null);
  const [language, setLanguage] = useState('en');
  const [matchedFranchise, setMatchedFranchise] = useState(null);
  
  // Use memoized translations from hook
  const t = useDriverTranslations(language);

  // Memoized function to clear franchise storage
  const clearFranchiseStorage = useCallback(() => {
    sessionStorage.removeItem('userFranchiseInfo');
    sessionStorage.removeItem('franchiseLinked');
    sessionStorage.removeItem('franchiseMenuReplaced');
    sessionStorage.removeItem('franchiseOwnerUserId');
    setFranchiseStatus(null);
  }, [setFranchiseStatus]);

  // Fetch full user details from the server
  const fetchUserDetails = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      if (!token) return;

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
      
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        logger.log('[DriverID] User details received');
        setUser(data.user);
      } else {
        logger.log('[DriverID] /auth/me returned non-ok.');
        clearFranchiseStorage();
        setUser(tokenUser || null);
      }
    } catch (error) {
      logger.error('[DriverID] Error fetching user details:', error);
      clearFranchiseStorage();
      setUser(tokenUser || null);
    }
  }, [tokenUser, clearFranchiseStorage]);

  // Fetch user details on component mount
  useEffect(() => {
    if (!tokenUser) {
      logger.warn('[DriverID] No token found');
      navigate('/login');
      return;
    }

    // GATE-KEEPING: Check if user has franchise
    if (!tokenUser.hasFranchise) {
      logger.warn('[DriverID] User does not have franchise yet');
      navigate('/operator/franchise');
      return;
    }

    logger.log('[DriverID] Initializing user data...');
    setUser(tokenUser);
    fetchUserDetails();
  }, [tokenUser, navigate, fetchUserDetails]);

  
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
                logger.debug('[DriverID] matched application from /mine', matched);
           
                if (matched && matched.id) {
                  logger.log('[DriverID] Matched franchise data:', {
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
                  
                  logger.log('[DriverID] Date parsing:', { approvedRaw, expiryRaw });
                  
                  const parsedApproved = approvedRaw ? dayjs(approvedRaw) : null;
                  const parsedExpiry = expiryRaw ? dayjs(expiryRaw) : null;
                  
                  logger.log('[DriverID] Parsed dates:', {
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
                  
                  logger.log('[DriverID] Successfully linked franchise via /mine endpoint with userId:', userId);
                  return; 
                }
              }
            } catch (e) {
              logger.warn('DriverID: /mine lookup failed', e)
            }
          }

         
          const resp = await fetch(`${API_BASE_URL}/api/franchise-applications?status=approved`)
          if (!resp.ok) return
          const apps = await resp.json()
          logger.debug('[DriverID] approved applications fetched', Array.isArray(apps) ? apps.length : 'not-array', apps)
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
              logger.warn('[DriverID] matching error', e);
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
            if (tokenUser?.id) sessionStorage.setItem('franchiseOwnerUserId', tokenUser.id);

            setMatchedFranchise(matched);
    
            try {
              // Debug: log raw date fields
              logger.debug('DriverID: matched raw dates ->', { approvedAt: matched.approvedAt, expiryDate: matched.expiryDate });


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
              logger.debug('DriverID: parsed dates valid ->', { approved: parsedApproved ? parsedApproved.isValid() : false, expiry: parsedExpiry ? parsedExpiry.isValid() : false });

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
          }
          else {
          
            setMatchedFranchise(null);
            setFranchiseStatus(null);
          
          }
        } catch (err) {
          logger.warn('DriverID: error fetching approved franchises', err)
        }
      })()
    } catch {
      // ignore
    }
  }, [user, tokenUser]);

  // Use custom hook for QR blob URL management
  const qrCodePath = user?.franchise?.qrCode;
  const { blobUrl: qrBlobUrl } = useBlobUrl(qrCodePath, [qrCodePath]);

  // Refresh user details when page becomes visible
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

  // Select the best candidate for profile photo
  const profilePhotoPath = useMemo(() => {
    const mf = matchedFranchise || null;
    const u = user || null;

    // PRIORITY 1: FranchiseInformation profilePhoto
    // PRIORITY 2: FranchiseApplication documents.picture
    // PRIORITY 3: User-level photos
    const candidates = [
      u?.franchise?.profilePhoto,
      mf?.profilePhoto,
      mf?.documents?.picture,
      mf?.documents?.picture?.path,
      mf?.documents?.picture?.url,
      mf?.documents?.photo,
      mf?.documents?.photo?.path,
      mf?.documentPicture,
      mf?.documentPicture?.path,
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
      if (typeof c === 'string') return c;
      if (typeof c === 'object') {
        const path = c.path || c.pathname || c.url;
        if (path) return path;
      }
    }
    return null;
  }, [user, matchedFranchise]);

  // Use custom hook for profile photo blob management
  const { blobUrl: idBlobUrl, isPdf: idBlobIsPdf } = useBlobUrl(profilePhotoPath, [profilePhotoPath]);


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
        <div className="driver-id-badge">ID NO: {user?.operatorId || user?.id?.toString().slice(-4) || '0000'}</div>
      </div>
    </Box>
  );
}

export default DriverID;




