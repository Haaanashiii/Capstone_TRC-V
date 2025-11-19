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
  TextField
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import dayjs from 'dayjs';

function QROperatorID() {
  const { operatorId } = useParams();
  const [user, setUser] = useState(null);
  const [matchedFranchise, setMatchedFranchise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fareMatrixOpen, setFareMatrixOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportData, setReportData] = useState({
    fullName: '',
    contactNumber: '',
    amountCharged: '',
    expectedFare: '',
    description: ''
  });

  // Fetch franchise info by hashed MTOP (operatorId)
  useEffect(() => {
    if (!operatorId) return;
    setLoading(true);
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
    fetch(`${API_BASE_URL}/api/franchise-information/mtop-hash/${operatorId}`)
      .then(res => res.json())
      .then(data => {
        console.log('[QROperatorID] API response:', data);
        if (data.error) {
          setUser(null);
          setMatchedFranchise({
            address: '',
            expiryDate: '',
            status: '',
            notLinked: true,
            message: data.message || 'Franchise not linked'
          });
        } else {
          // Parse name into first/middle/last if possible
          let firstName = '', middleName = '', lastName = '';
          if (data.name) {
            const parts = data.name.split(' ');
            firstName = parts.shift() || '';
            lastName = parts.pop() || '';
            middleName = parts.join(' ');
          }
          setUser({
            firstName,
            middleName,
            lastName,
            operatorId: data.mtopNumber,
            address: data.address,
            profilePhoto: data.profilePhoto
          });
          setMatchedFranchise({
            address: data.address,
            expiryDate: '', // Not provided in API, can be added if needed
            status: data.franchiseStatus,
            statusColor: data.statusColor,
            notLinked: !data.linked,
            message: data.message,
            profilePhoto: data.profilePhoto
          });
          console.log('[QROperatorID] Profile photo URL:', data.profilePhoto);
        }
        setLoading(false);
      })
      .catch((err) => {
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

  // Check if franchise is expired
  const isFranchiseExpired = () => {
    if (!matchedFranchise?.expiryDate) return false;
    return dayjs(matchedFranchise.expiryDate).isBefore(dayjs());
  };


  // Profile photo blob state and PDF detection
  const [profilePhotoBlobUrl, setProfilePhotoBlobUrl] = useState(null);
  const profilePhotoBlobRef = React.useRef(null);
  const [profilePhotoIsPdf, setProfilePhotoIsPdf] = useState(false);

  // Candidate list for possible photo fields (like DriverID.jsx)
  const pickProfilePhotoCandidate = () => {
    const mf = matchedFranchise || {};
    const u = user || {};
    const candidates = [
      mf?.profilePhoto,
      mf?.profile_photo,
      mf?.picture,
      mf?.photoUrl,
      mf?.photo_url,
      mf?.image,
      mf?.avatar,
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
              ID NO: {user?.operatorId || operatorId}
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

          {/* Franchise Status Badge - Green for active, blue for inactive, red for not linked */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
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
            ) : matchedFranchise?.status === 'active' ? (
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
            ) : (
              <Box
                sx={{ 
                  bgcolor: '#083d77', // Blue for inactive
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: { xs: '0.85rem', sm: '0.95rem' },
                  px: 4,
                  py: 1.5,
                  borderRadius: '6px',
                  border: '2px solid #083d77',
                  boxShadow: 1,
                  letterSpacing: '1px',
                  textAlign: 'center',
                  minWidth: '180px'
                }}
              >
                INACTIVE FRANCHISE
              </Box>
            )}
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', px: 2 }}>
            <Button
              fullWidth
              variant="contained"
              sx={{
                bgcolor: '#FFC107',
                color: 'black',
                fontWeight: 'bold',
                textTransform: 'none',
                py: 1.5,
                fontSize: { xs: '0.75rem', sm: '0.85rem' },
                boxShadow: 2,
                '&:hover': {
                  bgcolor: '#FFB300'
                }
              }}
              onClick={() => setReportModalOpen(true)}
            >
              REPORT OVERPRICING
            </Button>
            <Button
              fullWidth
              variant="contained"
              sx={{
                bgcolor: '#003d77',
                color: 'white',
                fontWeight: 'bold',
                textTransform: 'none',
                py: 1.5,
                fontSize: { xs: '0.75rem', sm: '0.85rem' },
                boxShadow: 2,
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

      {/* Report Overpricing Modal */}
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
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
              Report Overpricing
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
              Help maintain fair fare practices in Solano. Please provide accurate details of your overpricing experience.
            </Typography>

            {/* Your Contact Information */}
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }}>
              Your Contact Information
            </Typography>

            <TextField
              fullWidth
              label="Full Name"
              value={reportData.fullName}
              onChange={(e) => setReportData({ ...reportData, fullName: e.target.value })}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Contact Number"
              value={reportData.contactNumber}
              onChange={(e) => setReportData({ ...reportData, contactNumber: e.target.value })}
              sx={{ mb: 3 }}
            />

            {/* Report Details */}
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }}>
              Report Details
            </Typography>

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

            <TextField
              fullWidth
              label="Description"
              value={reportData.description}
              onChange={(e) => setReportData({ ...reportData, description: e.target.value })}
              multiline
              rows={4}
              sx={{ mb: 3 }}
            />

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={() => setReportModalOpen(false)}
                sx={{
                  bgcolor: '#9E9E9E',
                  color: 'white',
                  textTransform: 'none',
                  px: 4,
                  py: 1.5,
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
                onClick={() => {
                  console.log('Report submitted:', reportData);
                  // Handle report submission here
                  setReportModalOpen(false);
                  // Reset form
                  setReportData({
                    fullName: '',
                    contactNumber: '',
                    amountCharged: '',
                    expectedFare: '',
                    description: ''
                  });
                }}
                sx={{
                  bgcolor: '#FFA726',
                  color: 'white',
                  textTransform: 'none',
                  px: 4,
                  py: 1.5,
                  fontWeight: 'bold',
                  '&:hover': {
                    bgcolor: '#FF9800'
                  }
                }}
              >
                SUBMIT
              </Button>
            </Box>
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
                src="/fare-matrix.jpg"
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
