import React, { useState, useEffect } from "react";
import { useParams } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  Avatar, 
  Chip,
  Dialog,
  DialogContent,
  IconButton,
  TextField,
  FormControlLabel,
  Checkbox,
  MenuItem,
  Select,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import dayjs from 'dayjs';
import swal from '../../utils/sweetAlert';
import SBFareImage from '../../assets/SB Fare.jpeg';

function QROperatorID() {
  const { operatorId } = useParams();
  const [user, setUser] = useState(null);
  const [matchedFranchise, setMatchedFranchise] = useState(null);
  const [storedFranchiseNumber, setStoredFranchiseNumber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fareMatrixOpen, setFareMatrixOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportStep, setReportStep] = useState(0); // 0: Category, 1: Details, 2: Terms & Conditions
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [reportData, setReportData] = useState({
    fullName: '',
    contactNumber: '',
    amountCharged: '',
    expectedFare: '',
    description: ''
  });

  const reportCategories = [
    { value: 'fare-issues', label: 'Fare-Related Issues', example: 'ex.: fare overpricing' },
    { value: 'driver-conduct', label: 'Driver Conduct & Behavior', example: 'ex.: rude behavior, refusal to convey' },
    { value: 'vehicle-condition', label: 'Vehicle Condition & Roadworthiness', example: 'ex.: smoke belching' },
    { value: 'franchise-violations', label: 'Franchise & Permit Violations', example: 'ex.: colorum, expired franchise' },
    { value: 'safety-violations', label: 'Safety Violations', example: 'ex.: overloading, traffic violation' },
    { value: 'other-concerns', label: 'Other Concerns', example: 'ex.: lost item' }
  ];

  // Fetch franchise info by hashed MTOP (operatorId)
  useEffect(() => {
    if (!operatorId) return;
    setLoading(true);
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
    fetch(`${API_BASE_URL}/api/franchise-information/qr/hash/${operatorId}`)
      .then(res => res.json())
      .then(data => {
        console.log('[QROperatorID] API response:', data);
        if (data.error || !data.data) {
          setUser(null);
          setMatchedFranchise({
            address: '',
            expiryDate: '',
            status: '',
            notLinked: true,
            message: data.message || 'Franchise not linked'
          });
        } else {
          const franchiseData = data.data;
          // Parse operator name into first/middle/last if possible
          let firstName = '', middleName = '', lastName = '';
          if (franchiseData.operatorName) {
            const parts = franchiseData.operatorName.split(' ');
            firstName = parts.shift() || '';
            lastName = parts.pop() || '';
            middleName = parts.join(' ');
          }
          setUser({
            firstName,
            middleName,
            lastName,
            operatorId: franchiseData.franchiseNumber,
            address: franchiseData.operatorAddress,
            profilePhoto: franchiseData.operatorPictureObj,
            operatorPictureObj: franchiseData.operatorPictureObj
          });
          setMatchedFranchise({
            franchiseNumber: franchiseData.franchiseNumber,
            franchiseChainId: franchiseData.franchiseChainId,
            address: franchiseData.operatorAddress,
            barangay: franchiseData.operatorBarangay,
            expiryDate: franchiseData.expiryDate || '', 
            status: franchiseData.franchiseStatus,
            notLinked: !franchiseData.franchiseNumber,
            message: !franchiseData.franchiseNumber ? 'Franchise not linked' : '',
            profilePhoto: franchiseData.operatorPictureObj,
            operatorPictureObj: franchiseData.operatorPictureObj,
            documents: {
              operatorPictureObj: franchiseData.operatorPictureObj
            }
          });
          setStoredFranchiseNumber(franchiseData.franchiseNumber);
          console.log('[QROperatorID] Operator picture URL:', franchiseData.operatorPictureObj);
          console.log('[QROperatorID] Franchise Number:', franchiseData.franchiseNumber);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('[QROperatorID] Fetch error:', err);
        setUser(null);
        setMatchedFranchise({
          address: '',
          expiryDate: '',
          status: '',
          notLinked: true,
          message: 'Franchise not linked'
        });
        setLoading(false);
      });
  }, [operatorId]);

  // Store operatorId in state before URL changes (for report submission)
  const [storedOperatorId] = useState(operatorId);

  // Change URL to show only the base URL immediately after data loads
  useEffect(() => {
    if (!loading && (user || matchedFranchise)) {
      const homeUrl = import.meta.env.VITE_CLIENT_REDIRECT || 'http://localhost:5173';
      // Use replaceState to change URL without navigating away
      window.history.replaceState(null, '', homeUrl);
    }
  }, [loading, user, matchedFranchise]);

  // Check if franchise is expired or inactive
  const isFranchiseExpired = () => {
    if (!matchedFranchise?.status) return false;
    return matchedFranchise.status === 'expired' || matchedFranchise.status === 'inactive';
  };


  // Profile photo blob state and PDF detection
  const [profilePhotoBlobUrl, setProfilePhotoBlobUrl] = useState(null);
  const profilePhotoBlobRef = React.useRef(null);
  const [profilePhotoIsPdf, setProfilePhotoIsPdf] = useState(false);

  // Candidate list for possible photo fields - ONLY operatorPictureObj
  const pickProfilePhotoCandidate = () => {
    const mf = matchedFranchise || {};
    const candidates = [
      // ONLY operatorPictureObj
      mf?.documents?.operatorPictureObj,
      mf?.operatorPictureObj,
      mf?.profilePhoto
    ];
    for (const c of candidates) {
      if (!c) continue;
      if (typeof c === 'string') {
        return c;
      }
      if (typeof c === 'object') {
        const path = c.path || c.url;
        if (path) {
          return path;
        }
      }
    }
    return null;
  };

  // Normalize and resolve the photo URL
  const resolveProfilePhotoUrl = (raw) => {
    if (!raw) return null;
    try {
      if (/^https?:\/\//i.test(raw)) return raw;
      if (raw.startsWith('/public/')) return raw;
      const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170').replace(/\/$/, '');
      if (raw.startsWith('/')) return base + raw;
      return base + '/' + raw;
    } catch {
      return raw;
    }
  };

  // Get profile photo URL (prefer blob if available)
  const getProfilePhotoUrl = () => {
    if (profilePhotoBlobUrl) return profilePhotoBlobUrl;
    const raw = pickProfilePhotoCandidate();
    return resolveProfilePhotoUrl(raw);
  };

  // Fetch profile photo as blob and create object URL
  useEffect(() => {
    // Clean up previous blob
    if (profilePhotoBlobRef.current) {
      URL.revokeObjectURL(profilePhotoBlobRef.current);
      profilePhotoBlobRef.current = null;
    }
    setProfilePhotoBlobUrl(null);
    setProfilePhotoIsPdf(false);

    const rawPath = pickProfilePhotoCandidate();
    if (!rawPath) return;
    const path = resolveProfilePhotoUrl(rawPath);
    if (!path) return;

    const isImage = /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(path) || String(matchedFranchise?.type || user?.type || '').includes('image');
    const isPdf = /\.pdf$/i.test(path) || String(matchedFranchise?.type || user?.type || '').includes('pdf');

    if (!isImage && !isPdf) {
      setProfilePhotoBlobUrl(null);
      setProfilePhotoIsPdf(false);
      return;
    }

    (async () => {
      try {
        const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170');
        let fetchUrl = path;
        // Route R2 or Cloudflare public URLs through the backend proxy
        if (rawPath && (rawPath.startsWith('r2://') || /^https?:\/\/pub-[a-f0-9]+\.r2\.dev/i.test(rawPath))) {
          fetchUrl = API_BASE_URL.replace(/\/$/, '') + '/api/franchise-applications/proxy-file?url=' + encodeURIComponent(rawPath);
        }
        const resp = await fetch(fetchUrl, { mode: 'cors' });
        if (!resp.ok) throw new Error('Failed fetching profile photo: ' + resp.status);
        const blob = await resp.blob();
        const obj = URL.createObjectURL(blob);
        profilePhotoBlobRef.current = obj;
        setProfilePhotoBlobUrl(obj);
        // detect if PDF
        const mime = blob.type || '';
        setProfilePhotoIsPdf(mime.includes('pdf') || /\.pdf$/i.test(rawPath || ''));
      } catch (err) {
        setProfilePhotoBlobUrl(null);
        setProfilePhotoIsPdf(false);
      }
    })();

    return () => {
      if (profilePhotoBlobRef.current) {
        URL.revokeObjectURL(profilePhotoBlobRef.current);
        profilePhotoBlobRef.current = null;
      }
      setProfilePhotoBlobUrl(null);
      setProfilePhotoIsPdf(false);
    };
  }, [user, matchedFranchise]);

  if (loading) {
    return (
      <Box sx={{ 
        minHeight: '100vh', 
        bgcolor: '#083d77', 
        display: 'flex', 
        alignments: 'center', 
        justifyContent: 'center',
        p: 2
      }}>
        <Typography sx={{ color: 'white' }}>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: '#2c5f8d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 2,
      boxSizing: 'border-box'
    }}>
      {/* Main Card - Mobile Optimized */}
      <Box
        sx={{
          width: '100%',
          maxWidth: '425px',
          bgcolor: 'white',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}
      >
        {/* Header with title */}
        <Box 
          sx={{ 
            bgcolor: '#083d77',
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderRadius: '12px 12px 0 0'
          }}
        >
          {/* Logos on the left inside header - Horizontal */}
          <Box 
            sx={{ 
              display: 'flex', 
              gap: 1.5, 
              alignItems: 'center'
            }}
          >
            <Box 
              component="img" 
              src="/Logos/SBLogo.png" 
              alt="Solano Logo"
              sx={{ 
                width: { xs: 35, sm: 40 }, 
                height: { xs: 35, sm: 40 }, 
                objectFit: 'contain'
              }}
            />
            <Box 
              component="img" 
              src="/Logos/TRC-vLogo.png" 
              alt="TRC-V Logo"
              sx={{ 
                width: { xs: 35, sm: 40 }, 
                height: { xs: 35, sm: 40 }, 
                objectFit: 'contain'
              }}
            />
          </Box>
          
          {/* Title on the right */}
          <Typography 
            sx={{ 
              color: 'white', 
              fontWeight: 'bold',
              fontSize: { xs: '0.7rem', sm: '0.8rem' },
              textAlign: 'right',
              lineHeight: 1.3,
              letterSpacing: '0.5px'
            }}
          >
            OPERATOR'S<br/>IDENTIFICATION
          </Typography>
        </Box>

        {/* Card Content */}
        <Box sx={{ p: 3, textAlign: 'center', bgcolor: '#f5f5f5' }}>
          {/* Profile Photo (image or PDF) */}
          {profilePhotoBlobUrl && profilePhotoIsPdf ? (
            <Avatar
              onClick={() => window.open(profilePhotoBlobUrl, '_blank')}
              sx={{ width: { xs: 140, sm: 160 }, height: { xs: 140, sm: 160 }, margin: '0 auto 16px', border: '5px solid #d0d0d0', bgcolor: '#fff', color: '#d32f2f', cursor: 'pointer' }}
            >
              PDF
            </Avatar>
          ) : (
            <Avatar
              src={getProfilePhotoUrl()}
              sx={{ 
                width: { xs: 140, sm: 160 },
                height: { xs: 140, sm: 160 },
                margin: '0 auto 16px',
                border: '5px solid #d0d0d0',
                bgcolor: '#d0d0d0'
              }}
              imgProps={{
                onError: (e) => {
                  console.error('[QROperatorID] Avatar image failed to load:', getProfilePhotoUrl());
                  // Do not set display:none; just log the error
                },
                onLoad: () => {
                }
              }}
            >
              {!getProfilePhotoUrl() && (
                <Typography variant="h2" sx={{ color: '#999' }}>
                  {user?.firstName?.charAt(0) || 'M'}
                </Typography>
              )}
            </Avatar>
          )}

          {/* ID Badge - Centered and visually improved */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2, px: 2 }}>
            <Box
              sx={{ 
                bgcolor: '#003d77',
                color: 'white',
                fontWeight: 'bold',
                fontSize: { xs: '1rem', sm: '1.1rem' },
                px: 4,
                py: 1.5,
                borderRadius: '8px',
                boxShadow: 1,
                letterSpacing: '1px',
                textAlign: 'center',
                minWidth: '220px'
              }}
              >
              ID NO: {storedFranchiseNumber || storedOperatorId}
            </Box>
          </Box>

          {/* Name */}
          <Typography 
            sx={{ 
              fontWeight: 'bold',
              fontSize: { xs: '1.1rem', sm: '1.3rem' },
              mb: 1,
              textTransform: 'uppercase',
              color: '#000'
            }}
          >
            {user?.firstName} {user?.middleName ? user.middleName.charAt(0) + '.' : ''} {user?.lastName}
          </Typography>

          {/* Barangay */}
          {matchedFranchise?.barangay && (
            <Typography 
              sx={{ 
                color: '#000',
                fontWeight: 'bold',
                fontSize: { xs: '0.9rem', sm: '1rem' },
                px: 2
              }}
            >
              Brgy. {matchedFranchise.barangay}
            </Typography>
          )}

          {/* Address */}
          <Typography 
            sx={{ 
              color: '#000',
              mb: 2,
              fontSize: { xs: '0.85rem', sm: '0.95rem' },
              px: 2
            }}
          >
            {matchedFranchise?.address || user?.address || ''}
          </Typography>

          {/* Franchise Status Badge - Green for active, red for expired/inactive, gray for not linked */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3, gap: 2 }}>
            {matchedFranchise?.notLinked ? (
              <Box
                sx={{ 
                  bgcolor: '#e74c3c',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: { xs: '0.75rem', sm: '0.85rem' },
                  px: 3,
                  py: 1,
                  borderRadius: '4px',
                  border: '2px solid #c0392b'
                }}
              >
                {matchedFranchise.message || 'Franchise not linked'}
              </Box>
            ) : matchedFranchise?.status === 'Active' ? (
              <Box
                sx={{ 
                  bgcolor: '#43a047', // Green
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: { xs: '0.85rem', sm: '0.95rem' },
                  px: 4,
                  py: 1.5,
                  borderRadius: '6px',
                  border: '2px solid #388e3c',
                  boxShadow: 1,
                  letterSpacing: '1px',
                  textAlign: 'center',
                  minWidth: '180px'
                }}
              >
                ACTIVE FRANCHISE
              </Box>
            ) : matchedFranchise?.status === 'Expired' ? (
              <Box
                sx={{ 
                  bgcolor: '#d32f2f', // Red for expired
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: { xs: '0.85rem', sm: '0.95rem' },
                  px: 4,
                  py: 1.5,
                  borderRadius: '6px',
                  border: '2px solid #b71c1c',
                  boxShadow: 1,
                  letterSpacing: '1px',
                  textAlign: 'center',
                  minWidth: '180px'
                }}
              >
                EXPIRED FRANCHISE
              </Box>
            ) : (
              <Box
                sx={{ 
                  bgcolor: '#757575', // Gray for inactive
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: { xs: '0.85rem', sm: '0.95rem' },
                  px: 4,
                  py: 1.5,
                  borderRadius: '6px',
                  border: '2px solid #616161',
                  boxShadow: 1,
                  letterSpacing: '1px',
                  textAlign: 'center',
                  minWidth: '180px'
                }}
              >
                INACTIVE FRANCHISE
              </Box>
            )}
            
            {/* Warning for expired/inactive franchises */}
            {(matchedFranchise?.status === 'expired' || matchedFranchise?.status === 'inactive') && (
              <Box
                sx={{
                  bgcolor: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '4px',
                  p: 2,
                  width: '100%',
                  textAlign: 'center'
                }}
              >
                <Typography sx={{ fontSize: '0.85rem', color: '#856404', fontWeight: 'bold' }}>
                  ⚠️ Warning
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#856404', mt: 0.5 }}>
                  This operator's franchise is {matchedFranchise?.status}. They may not be authorized to operate.
                </Typography>
              </Box>
            )}
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', px: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Button
              fullWidth
              variant="contained"
              sx={{
                bgcolor: '#FFC107',
                color: 'black',
                fontWeight: 'bold',
                textTransform: 'none',
                py: { xs: 3.5, sm: 2 },
                fontSize: { xs: '1.15rem', sm: '1rem' },
                boxShadow: 2,
                letterSpacing: '0.5px',
                '&:hover': {
                  bgcolor: '#FFB300'
                }
              }}
              onClick={() => {
                setReportStep(0);
                setSelectedCategory('');
                setReportData({
                  fullName: '',
                  contactNumber: '',
                  amountCharged: '',
                  expectedFare: '',
                  description: ''
                });
                setAgreeTerms(false);
                setAgreePrivacy(false);
                setReportSuccess(false);
                setReportModalOpen(true);
              }}
            >
              REPORT INCIDENT
            </Button>
            <Button
              fullWidth
              variant="contained"
              sx={{
                bgcolor: '#003d77',
                color: 'white',
                fontWeight: 'bold',
                textTransform: 'none',
                py: { xs: 3.5, sm: 2 },
                fontSize: { xs: '1.15rem', sm: '1rem' },
                boxShadow: 2,
                letterSpacing: '0.5px',
                '&:hover': {
                  bgcolor: '#002850'
                }
              }}
              onClick={() => setFareMatrixOpen(true)}
            >
              VIEW FARE MATRIX
            </Button>
          </Box>


        </Box>
      </Box>

      {/* Report Incident Modal - Multi-Step */}
      <Dialog
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '90vh'
          }
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <IconButton
            onClick={() => setReportModalOpen(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              zIndex: 1,
              color: '#666'
            }}
          >
            <CloseIcon />
          </IconButton>
          <DialogContent sx={{ p: 4, pt: 3 }}>
            
            {/* Step 1: Select Incident Category */}
            {reportStep === 0 && (
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#083d77' }}>
                  Report an Incident
                </Typography>
                <Typography variant="body2" sx={{ mb: 4, color: 'text.secondary' }}>
                  What type of incident are you reporting? Please select the category that best describes your concern.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {reportCategories.map((category) => (
                    <Box
                      key={category.value}
                      onClick={() => setSelectedCategory(category.value)}
                      sx={{
                        p: 2,
                        border: '2px solid',
                        borderColor: selectedCategory === category.value ? '#083d77' : '#E0E0E0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        bgcolor: selectedCategory === category.value ? 'rgba(8, 61, 119, 0.05)' : 'white',
                        '&:hover': {
                          borderColor: '#083d77',
                          bgcolor: 'rgba(8, 61, 119, 0.03)',
                          transform: 'translateX(4px)'
                        },
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2
                      }}
                    >
                      <Box sx={{ fontSize: '1.5rem' }}>
                        {selectedCategory === category.value ? (
                          <CheckCircleIcon sx={{ color: '#083d77', fontSize: '1.5rem' }} />
                        ) : (
                          <RadioButtonUncheckedIcon sx={{ color: '#BDBDBD', fontSize: '1.5rem' }} />
                        )}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 'bold', color: '#000', fontSize: '0.95rem' }}>
                          {category.label}
                        </Typography>
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                          {category.example}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>

                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 4, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <Button
                    variant="contained"
                    onClick={() => setReportModalOpen(false)}
                    sx={{
                      bgcolor: '#9E9E9E',
                      color: 'white',
                      textTransform: 'none',
                      px: { xs: 3, sm: 4 },
                      py: { xs: 2, sm: 1.2 },
                      fontSize: { xs: '1rem', sm: '0.95rem' },
                      fontWeight: 'bold',
                      '&:hover': {
                        bgcolor: '#757575'
                      }
                    }}
                  >
                    CANCEL
                  </Button>
                  <Button
                    variant="contained"
                    disabled={!selectedCategory}
                    onClick={() => setReportStep(1)}
                    sx={{
                      bgcolor: selectedCategory ? '#083d77' : '#BDBDBD',
                      color: 'white',
                      textTransform: 'none',
                      px: { xs: 3, sm: 4 },
                      py: { xs: 2, sm: 1.2 },
                      fontSize: { xs: '1rem', sm: '0.95rem' },
                      fontWeight: 'bold',
                      '&:hover': {
                        bgcolor: selectedCategory ? '#062847' : '#BDBDBD'
                      }
                    }}
                  >
                    NEXT
                  </Button>
                </Box>
              </Box>
            )}

            {/* Step 2: Fill in Report Details */}
            {reportStep === 1 && (
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#083d77' }}>
                  Report Details
                </Typography>
                <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                  Please provide information about your incident. The more details you share, the better we can help.
                </Typography>

                {/* HIDDEN HONEYPOT FIELDS */}
                <TextField
                  id="honeypot_email"
                  type="email"
                  placeholder="Leave blank"
                  sx={{ display: 'none' }}
                  tabIndex="-1"
                  autoComplete="off"
                />
                <TextField
                  id="honeypot_phone"
                  type="tel"
                  placeholder="Leave blank"
                  sx={{ display: 'none' }}
                  tabIndex="-1"
                  autoComplete="off"
                />

                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: '#000' }}>
                  Your Contact Information
                </Typography>

                <TextField
                  fullWidth
                  label="Name (Optional)"
                  placeholder="Your name (optional)"
                  value={reportData.fullName}
                  onChange={(e) => setReportData({ ...reportData, fullName: e.target.value })}
                  inputProps={{ maxLength: 100 }}
                  sx={{ 
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      padding: { xs: '16px 14px', sm: '8px 14px' }
                    },
                    '& .MuiInputBase-input': {
                      fontSize: { xs: '1rem', sm: '0.875rem' }
                    }
                  }}
                />

                <TextField
                  fullWidth
                  label="Contact Number *"
                  placeholder="09123456789"
                  value={reportData.contactNumber}
                  onChange={(e) => setReportData({ ...reportData, contactNumber: e.target.value })}
                  inputProps={{ maxLength: 20 }}
                  sx={{ 
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      padding: { xs: '16px 14px', sm: '8px 14px' }
                    },
                    '& .MuiInputBase-input': {
                      fontSize: { xs: '1rem', sm: '0.875rem' }
                    }
                  }}
                />

                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: '#000' }}>
                  Incident Details
                </Typography>

                {selectedCategory === 'fare-issues' && (
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                        Amount Charged
                      </Typography>
                      <TextField
                        fullWidth
                        value={reportData.amountCharged}
                        onChange={(e) => setReportData({ ...reportData, amountCharged: e.target.value })}
                        InputProps={{
                          startAdornment: (
                            <Typography sx={{ color: 'text.primary', mr: 1, fontWeight: 500 }}>
                              ₱
                            </Typography>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '& input': {
                              pl: 0
                            }
                          }
                        }}
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                        Expected Fare
                      </Typography>
                      <TextField
                        fullWidth
                        value={reportData.expectedFare}
                        onChange={(e) => setReportData({ ...reportData, expectedFare: e.target.value })}
                        InputProps={{
                          startAdornment: (
                            <Typography sx={{ color: 'text.primary', mr: 1, fontWeight: 500 }}>
                              ₱
                            </Typography>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '& input': {
                              pl: 0
                            }
                          }
                        }}
                      />
                    </Box>
                  </Box>
                )}

                <TextField
                  fullWidth
                  label="Brief description of what happened *"
                  placeholder="Tell us briefly what happened..."
                  value={reportData.description}
                  onChange={(e) => setReportData({ ...reportData, description: e.target.value })}
                  multiline
                  rows={4}
                  inputProps={{ maxLength: 1000 }}
                  helperText={`${reportData.description.length}/1000 characters`}
                  sx={{ 
                    mb: 4,
                    '& .MuiOutlinedInput-root': {
                      padding: { xs: '12px 14px', sm: '8px 14px' }
                    },
                    '& .MuiInputBase-input': {
                      fontSize: { xs: '1rem', sm: '0.875rem' }
                    }
                  }}
                />

                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexDirection: { xs: 'column', sm: 'row' }, mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={() => setReportStep(0)}
                    sx={{
                      bgcolor: '#083d77',
                      color: 'white',
                      textTransform: 'none',
                      px: { xs: 3, sm: 4 },
                      py: { xs: 2, sm: 1.2 },
                      fontSize: { xs: '1rem', sm: '0.95rem' },
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: '#062847'
                      }
                    }}
                  >
                    BACK
                  </Button>
                  <Button
                    variant="contained"
                    disabled={!reportData.contactNumber || !reportData.description}
                    onClick={() => setReportStep(2)}
                    sx={{
                      bgcolor: (reportData.contactNumber && reportData.description) ? '#FFC107' : '#BDBDBD',
                      color: (reportData.contactNumber && reportData.description) ? 'black' : 'white',
                      textTransform: 'none',
                      px: { xs: 3, sm: 4 },
                      py: { xs: 2, sm: 1.2 },
                      fontSize: { xs: '1rem', sm: '0.95rem' },
                      fontWeight: 'bold',
                      '&:hover': {
                        bgcolor: (reportData.contactNumber && reportData.description) ? '#FFB300' : '#BDBDBD'
                      }
                    }}
                  >
                    NEXT
                  </Button>
                </Box>
              </Box>
            )}

            {/* Step 3: Terms & Conditions */}
            {reportStep === 2 && !reportSuccess && (
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#083d77' }}>
                  Terms & Conditions
                </Typography>
                <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                  Please review and accept our terms and privacy policy before submitting your report.
                </Typography>

                <Box
                  sx={{
                    bgcolor: '#f5f5f5',
                    border: '2px solid #083d77',
                    borderRadius: '8px',
                    p: 2.5,
                    mb: 2,
                    maxHeight: '280px',
                    overflowY: 'auto',
                    '&::-webkit-scrollbar': {
                      width: '8px'
                    },
                    '&::-webkit-scrollbar-track': {
                      backgroundColor: '#f1f1f1',
                      borderRadius: '8px'
                    },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: '#083d77',
                      borderRadius: '8px',
                      '&:hover': {
                        backgroundColor: '#062847'
                      }
                    }
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5, color: '#083d77', fontSize: '1rem' }}>
                    Terms of Service
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#333', lineHeight: 1.7, mb: 2.5, fontSize: '0.9rem' }}>
                    By submitting this report, you confirm that all information provided is accurate and truthful to the best of your knowledge. 
                    False or malicious reports may result in legal consequences. This report will be used solely for regulatory and quality assurance purposes 
                    by the Municipality of Solano Transportation Regulatory Commission. We appreciate your cooperation in maintaining service quality.
                  </Typography>

                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5, color: '#083d77', fontSize: '1rem', mt: 2.5 }}>
                    Privacy Policy
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#333', lineHeight: 1.7, fontSize: '0.9rem' }}>
                    Your personal information will be kept confidential and used only for investigating your report. 
                    We will not share your contact details with unauthorized parties. Your data is protected under applicable data privacy laws and regulations. 
                    All reports are treated with strict confidentiality and are accessible only to authorized personnel.
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        sx={{
                          color: '#083d77',
                          '&.Mui-checked': {
                            color: '#083d77'
                          }
                        }}
                      />
                    }
                    label={
                      <Typography sx={{ color: '#000', fontSize: '0.9rem' }}>
                        I agree to the Terms of Service
                      </Typography>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={agreePrivacy}
                        onChange={(e) => setAgreePrivacy(e.target.checked)}
                        sx={{
                          color: '#083d77',
                          '&.Mui-checked': {
                            color: '#083d77'
                          }
                        }}
                      />
                    }
                    label={
                      <Typography sx={{ color: '#000', fontSize: '0.9rem' }}>
                        I agree to the Privacy Policy
                      </Typography>
                    }
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexDirection: { xs: 'column', sm: 'row' } }}>
                  <Button
                    variant="contained"
                    onClick={() => setReportStep(1)}
                    sx={{
                      bgcolor: '#083d77',
                      color: 'white',
                      textTransform: 'none',
                      px: { xs: 3, sm: 4 },
                      py: { xs: 2, sm: 1.2 },
                      fontSize: { xs: '1rem', sm: '0.95rem' },
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: '#062847'
                      }
                    }}
                  >
                    BACK
                  </Button>
                  <Button
                    variant="contained"
                    disabled={!agreeTerms || !agreePrivacy || submittingReport}
                    onClick={async () => {
                      // ANTI-BOT: Check honeypot fields
                      const honeypotEmail = document.getElementById('honeypot_email')?.value;
                      const honeypotPhone = document.getElementById('honeypot_phone')?.value;
                      
                      if (honeypotEmail || honeypotPhone) {
                        console.warn('[FRAUD] Honeypot triggered');
                        swal.success('Thank you! Your report has been submitted.');
                        setReportModalOpen(false);
                        return;
                      }

                      // Validate name format (if provided)
                      if (reportData.fullName && !/^[a-zA-Z\s\-.']+$/.test(reportData.fullName)) {
                        swal.warning('Please enter a valid name (letters only)');
                        return;
                      }

                      // Validate phone number
                      const phoneClean = reportData.contactNumber.replace(/[\s\-]/g, '');
                      if (!/^(\+63|0)?9\d{9}$/.test(phoneClean)) {
                        swal.warning('Please enter a valid Philippine mobile number (e.g., 09123456789)');
                        return;
                      }

                      // Validate fare amounts if fare-related
                      if (selectedCategory === 'fare-issues') {
                        const charged = parseFloat(reportData.amountCharged);
                        const expected = parseFloat(reportData.expectedFare);

                        if (isNaN(charged) || charged <= 0 || charged > 10000) {
                          swal.warning('Please enter a valid amount charged (1-10000)');
                          return;
                        }

                        if (isNaN(expected) || expected <= 0 || expected > 10000) {
                          swal.warning('Please enter a valid expected fare (1-10000)');
                          return;
                        }

                        if (charged <= expected) {
                          swal.warning('Amount charged must be higher than expected fare');
                          return;
                        }
                      }

                      setSubmittingReport(true);

                      try {
                        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
                        const payload = {
                          operatorId: storedOperatorId,
                          category: selectedCategory,
                          fullName: reportData.fullName.trim(),
                          contactNumber: reportData.contactNumber.trim(),
                          description: reportData.description.trim()
                        };

                        if (selectedCategory === 'fare-issues') {
                          payload.amountCharged = parseFloat(reportData.amountCharged);
                          payload.expectedFare = parseFloat(reportData.expectedFare);
                        }

                        const response = await fetch(`${API_BASE_URL}/api/reports/public`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify(payload)
                        });

                        const result = await response.json();

                        if (response.ok && result.success) {
                          setReportSuccess(true);
                          swal.success('Thank you! Your report has been submitted successfully.');
                          setTimeout(() => {
                            setReportModalOpen(false);
                            setReportSuccess(false);
                            setReportStep(0);
                            setSelectedCategory('');
                            setAgreeTerms(false);
                            setAgreePrivacy(false);
                            setReportData({
                              fullName: '',
                              contactNumber: '',
                              amountCharged: '',
                              expectedFare: '',
                              description: ''
                            });
                          }, 2000);
                        } else {
                          swal.error(result.error || 'Failed to submit report. Please try again.');
                        }
                      } catch (error) {
                        console.error('Error submitting report:', error);
                        swal.error('Failed to submit report. Please check your connection and try again.');
                      } finally {
                        setSubmittingReport(false);
                      }
                    }}
                    sx={{
                      bgcolor: (agreeTerms && agreePrivacy) ? '#4CAF50' : '#BDBDBD',
                      color: 'white',
                      textTransform: 'none',
                      px: { xs: 3, sm: 4 },
                      py: { xs: 2, sm: 1.2 },
                      fontSize: { xs: '1rem', sm: '0.95rem' },
                      fontWeight: 'bold',
                      '&:hover': {
                        bgcolor: (agreeTerms && agreePrivacy) ? '#45a049' : '#BDBDBD'
                      }
                    }}
                  >
                    {submittingReport ? 'SUBMITTING...' : 'SUBMIT REPORT'}
                  </Button>
                </Box>
              </Box>
            )}

            {/* Success State */}
            {reportStep === 2 && reportSuccess && (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <CheckCircleIcon sx={{ fontSize: '4rem', color: '#4CAF50', mb: 2 }} />
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#4CAF50' }}>
                  Report Submitted Successfully!
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                  Thank you for helping us maintain service quality in Solano. Your report has been recorded and will be investigated.
                </Typography>
              </Box>
            )}
          </DialogContent>
        </Box>
      </Dialog>

      {/* Fare Matrix Modal */}
      <Dialog
        open={fareMatrixOpen}
        onClose={() => setFareMatrixOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '90vh'
          }
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <IconButton
            onClick={() => setFareMatrixOpen(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              zIndex: 1,
              bgcolor: 'rgba(255, 255, 255, 0.9)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 1)',
              }
            }}
          >
            <CloseIcon />
          </IconButton>
          <DialogContent sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center' }}>
              Fare Matrix
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, textAlign: 'center', color: 'text.secondary' }}>
              View the approved tricycle fare rates set by the Municipality of Solano. Please refer to these rates before reporting any overpricing.
            </Typography>
            
            {/* Fare Matrix Image */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                bgcolor: '#f5f5f5',
                borderRadius: 2,
                p: 2
              }}
            >
              <Box
                component="img"
                src={SBFareImage}
                alt="Tricycle Fare Matrix"
                sx={{
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: 1,
                  boxShadow: 2
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">Fare matrix image not available</div>';
                }}
              />
            </Box>
            
            <Typography variant="caption" sx={{ display: 'block', mt: 2, textAlign: 'center', color: 'text.secondary' }}>
              Last updated: November 4, 2025
            </Typography>
          </DialogContent>
        </Box>
      </Dialog>
    </Box>
  );
}

export default QROperatorID;
