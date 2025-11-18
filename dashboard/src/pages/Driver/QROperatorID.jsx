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

  // TODO: Replace with backend QR endpoint once ready
  // Expected endpoint: GET /operators/qr/:operatorId
  // This will fetch operator data from the franchise application record, NOT from auth/me
  useEffect(() => {
    // Mock data for UI testing - will be replaced with actual QR data fetch
    setUser({
      firstName: 'MARLA RIHANA',
      middleName: 'V',
      lastName: 'JOSE',
      operatorId: '02612',
      address: '#72 Baccara St. Brgy. Quezon, Solano Nueva Vizcaya',
      profilePhoto: null // Will come from franchise application record
    });
    setMatchedFranchise({
      address: '#72 Baccara St. Brgy. Quezon, Solano Nueva Vizcaya',
      expiryDate: '2026-12-31', // Active franchise for testing
      status: 'ACTIVE'
    });
    setLoading(false);
  }, [operatorId]); // operatorId from URL params will be used in future API call

  // Check if franchise is expired
  const isFranchiseExpired = () => {
    if (!matchedFranchise?.expiryDate) return false;
    return dayjs(matchedFranchise.expiryDate).isBefore(dayjs());
  };

  // Get profile photo URL
  // TODO: Will be constructed from franchise application data once backend is ready
  const getProfilePhotoUrl = () => {
    if (user?.profilePhoto) {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
      return `${API_BASE_URL}${user.profilePhoto}`;
    }
    return null;
  };

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
          {/* Profile Photo */}
          <Avatar
            src={getProfilePhotoUrl()}
            sx={{ 
              width: { xs: 140, sm: 160 },
              height: { xs: 140, sm: 160 },
              margin: '0 auto 16px',
              border: '5px solid #d0d0d0',
              bgcolor: '#d0d0d0'
            }}
          >
            {!getProfilePhotoUrl() && (
              <Typography variant="h2" sx={{ color: '#999' }}>
                {user?.firstName?.charAt(0) || 'M'}
              </Typography>
            )}
          </Avatar>

          {/* ID Badge */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2, px: 2 }}>
            <Box
              sx={{ 
                bgcolor: '#003d77',
                color: 'white',
                fontWeight: 'bold',
                fontSize: { xs: '0.9rem', sm: '1rem' },
                px: 3,
                py: 1,
                borderRadius: '6px'
              }}
            >
              ID NO: {user?.operatorId || '02612'}
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
            {user?.firstName || 'MARLA RIHANA'} {user?.middleName?.charAt(0) || 'V'}. {user?.lastName || 'JOSE'}
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
            {matchedFranchise?.address || user?.address || '#72 Baccara St. Brgy. Quezon, Solano Nueva Vizcaya'}
          </Typography>

          {/* Franchise Status Badge */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            {isFranchiseExpired() ? (
              <Box
                sx={{ 
                  bgcolor: '#ffcdd2',
                  color: '#c62828',
                  fontWeight: 'bold',
                  fontSize: { xs: '0.75rem', sm: '0.85rem' },
                  px: 3,
                  py: 1,
                  borderRadius: '4px',
                  border: '2px solid #c62828'
                }}
              >
                EXPIRED FRANCHISE
              </Box>
            ) : (
              <Box
                sx={{ 
                  bgcolor: '#4caf50',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: { xs: '0.75rem', sm: '0.85rem' },
                  px: 3,
                  py: 1,
                  borderRadius: '4px',
                  border: '2px solid #2e7d32'
                }}
              >
                ACTIVE FRANCHISE
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
