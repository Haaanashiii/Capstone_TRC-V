import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, TextField, Button, Grid, Paper, Select, MenuItem, FormControl, Alert, Snackbar, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import UnifiedSidebar from '../../components/UnifiedSidebar';
import { franchiseAPI, API_BASE_URL } from '../Services/api';

export default function RequestAmendment() {
  const [language, setLanguage] = useState('en');
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({ open: false, message: '', severity: 'error' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    address: '',
    civilStatus: '',
    coOwner: '',
    orNumber: '',
    franchiseNumber: '',
    dateApproved: '',
    expiryDate: '',
    franchiseStatus: '',
    make: '',
    sidecarNumber: '',
    plateNumber: '',
    chassisNumber: '',
    motorNumber: ''
  });

  const translations = {
    en: { title: 'AMENDMENT REQUEST', toggleLanguage: 'Tagalog' },
    tl: { title: 'HILING PARA SA PAG-AAYOS', toggleLanguage: 'English' }
  };

  const t = translations[language];

  // Fetch existing franchise data on component mount
  useEffect(() => {
    const fetchFranchiseData = async () => {
      try {
        setIsLoading(true);
        
        // Get token
        const token = sessionStorage.getItem('accessToken');
        if (!token) {
          setToast({
            open: true,
            message: 'Session expired. Please log in again.',
            severity: 'error'
          });
          setTimeout(() => navigate('/login'), 2000);
          return;
        }

        // Fetch user data with franchise information from /auth/me
        console.log('[RequestAmendment] Fetching user data from /auth/me');
        console.log('[RequestAmendment] Using token:', token ? 'Token exists' : 'No token');
        console.log('[RequestAmendment] API URL:', `${API_BASE_URL}/auth/me`);
        
        const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include' // Include cookies for refresh token
        });

        console.log('[RequestAmendment] Response status:', userResponse.status);

        if (!userResponse.ok) {
          const errorText = await userResponse.text();
          console.error('[RequestAmendment] Error response:', errorText);
          throw new Error(`Failed to fetch user data: ${userResponse.status} ${errorText}`);
        }

        const userData = await userResponse.json();
        console.log('[RequestAmendment] User data received:', userData);
        console.log('[RequestAmendment] Franchise data:', userData.user?.franchise);

        const userFranchise = userData.user?.franchise;

        // Check if user has an active franchise
        if (!userFranchise || !userFranchise.franchiseStatus || userFranchise.franchiseStatus !== 'active') {
          console.error('[RequestAmendment] No active franchise found');
          setToast({
            open: true,
            message: 'No active franchise found. Please apply for a franchise first.',
            severity: 'error'
          });
          setTimeout(() => navigate('/operator/franchise'), 2000);
          return;
        }

        // Fetch complete franchise application data (includes motorcycle info)
        console.log('[RequestAmendment] Fetching franchise application data...');
        const userId = JSON.parse(atob(token.split('.')[1])).id;
        const appResponse = await fetch(`${API_BASE_URL}/api/franchise-applications?status=approved`);
        
        let franchiseApp = null;
        if (appResponse.ok) {
          const apps = await appResponse.json();
          franchiseApp = apps.find(app => app.userId === userId || app.userId?._id === userId);
          console.log('[RequestAmendment] Franchise application found:', franchiseApp);
        }

        // Pre-populate form with existing data (prioritize franchiseApp data, fallback to userFranchise)
        setFormData({
          fullName: userFranchise.operatorName || '',
          address: userFranchise.address || '',
          civilStatus: userFranchise.civilStatus || '',
          coOwner: franchiseApp?.coOwner || '',
          orNumber: franchiseApp?.orNumber || '',
          franchiseNumber: userFranchise.mtopNumber || '',
          dateApproved: userFranchise.approvedAt ? new Date(userFranchise.approvedAt).toISOString().split('T')[0] : '',
          expiryDate: userFranchise.expiryDate ? new Date(userFranchise.expiryDate).toISOString().split('T')[0] : '',
          franchiseStatus: userFranchise.franchiseStatus || 'active',
          make: franchiseApp?.unitModel || '',
          sidecarNumber: franchiseApp?.sideCar || '',
          plateNumber: franchiseApp?.mvPlateNo || '',
          chassisNumber: franchiseApp?.chasisNo || '',
          motorNumber: franchiseApp?.motorEngineNo || ''
        });

        console.log('[RequestAmendment] Form populated with franchise data');
      } catch (error) {
        console.error('[RequestAmendment] Error fetching franchise data:', error);
        setToast({
          open: true,
          message: 'Failed to load franchise data. Please try again.',
          severity: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchFranchiseData();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const fieldLabels = {
      fullName: 'Full Name',
      address: 'Address',
      civilStatus: 'Civil Status',
      coOwner: 'Co-owner',
      orNumber: 'OR Number',
      franchiseNumber: 'Franchise Number',
      dateApproved: 'Date Approved',
      expiryDate: 'Expiry Date',
      franchiseStatus: 'Franchise Status',
      make: 'Make',
      sidecarNumber: 'Sidecar Number',
      plateNumber: 'Plate Number',
      chassisNumber: 'Chassis Number',
      motorNumber: 'Motor Number'
    };
    
    // Check all fields
    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.civilStatus) newErrors.civilStatus = 'Civil status is required';
    if (!formData.coOwner.trim()) newErrors.coOwner = 'Co-owner is required';
    if (!formData.orNumber.trim()) newErrors.orNumber = 'OR number is required';
    if (!formData.franchiseNumber.trim()) newErrors.franchiseNumber = 'Franchise number is required';
    if (!formData.dateApproved.trim()) newErrors.dateApproved = 'Date approved is required';
    if (!formData.expiryDate.trim()) newErrors.expiryDate = 'Expiry date is required';
    if (!formData.franchiseStatus.trim()) newErrors.franchiseStatus = 'Franchise status is required';
    if (!formData.make.trim()) newErrors.make = 'Make is required';
    if (!formData.sidecarNumber.trim()) newErrors.sidecarNumber = 'Sidecar number is required';
    if (!formData.plateNumber.trim()) newErrors.plateNumber = 'Plate number is required';
    if (!formData.chassisNumber.trim()) newErrors.chassisNumber = 'Chassis number is required';
    if (!formData.motorNumber.trim()) newErrors.motorNumber = 'Motor number is required';

    setErrors(newErrors);
    
    // Show toast with first missing field
    if (Object.keys(newErrors).length > 0) {
      const firstErrorField = Object.keys(newErrors)[0];
      const fieldName = fieldLabels[firstErrorField];
      setToast({ 
        open: true, 
        message: `${fieldName} is required` 
      });
    }
    
    return Object.keys(newErrors).length === 0;
  };

  const handleCloseToast = () => {
    setToast({ ...toast, open: false });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Prevent duplicate submissions
    
    if (validateForm()) {
      setIsSubmitting(true);
      
      try {
        // Get token to check user info
        const token = sessionStorage.getItem('accessToken');
        
        if (!token) {
          setToast({ 
            open: true, 
            message: 'Session expired. Please log in again.', 
            severity: 'error' 
          });
          setTimeout(() => navigate('/login'), 2000);
          setIsSubmitting(false);
          return;
        }
        
        // Build FormData for submission
        const formDataToSend = new FormData();
        
        // Add actionType as AMMENDMENTS (backend expects this exact spelling with double M)
        formDataToSend.append('actionType', 'AMMENDMENTS');
        
        // Personal Information
        formDataToSend.append('operatorName', formData.fullName || '');
        formDataToSend.append('operatorContact', ''); // Add empty contact if not collected
        formDataToSend.append('operatorAddress', formData.address || '');
        formDataToSend.append('driversID', formData.fullName || ''); // Use same as operator name
        formDataToSend.append('driversAddress', formData.address || '');
        formDataToSend.append('civilStatus', formData.civilStatus || '');
        formDataToSend.append('birthPlace', ''); // Not collected in amendment
        formDataToSend.append('birthDate', ''); // Not collected in amendment
        formDataToSend.append('citizenship', ''); // Not collected in amendment
        formDataToSend.append('todaMembership', ''); // Not collected in amendment
        formDataToSend.append('barangay', ''); // Not collected in amendment
        
        // Franchise Information
        formDataToSend.append('orNumber', formData.orNumber || '');
        formDataToSend.append('franchiseNumber', formData.franchiseNumber || '');
        formDataToSend.append('dateApproved', formData.dateApproved || '');
        formDataToSend.append('expiryDate', formData.expiryDate || '');
        formDataToSend.append('franchiseStatus', formData.franchiseStatus || '');
        
        // Motorcycle Information
        formDataToSend.append('unitModel', formData.make || '');
        formDataToSend.append('colorMotor', ''); // Not collected in amendment
        formDataToSend.append('sideCar', formData.sidecarNumber || '');
        formDataToSend.append('mvPlateNo', formData.plateNumber || '');
        formDataToSend.append('chasisNo', formData.chassisNumber || '');
        formDataToSend.append('motorEngineNo', formData.motorNumber || '');
        
        // Additional info
        formDataToSend.append('coOwner', formData.coOwner || '');
        
        console.log('[RequestAmendment] Submitting amendment request...');
        console.log('[RequestAmendment] FormData contents:');
        for (let pair of formDataToSend.entries()) {
          console.log(pair[0] + ': ' + pair[1]);
        }
        
        // Submit using the same franchise API endpoint
        const response = await franchiseAPI.create(formDataToSend);
        
        if (!response.data) throw new Error('No response data received');
        
        console.log('[RequestAmendment] Amendment submitted successfully:', response.data);
        
        // Show success message
        setToast({ 
          open: true, 
          message: 'Amendment request submitted successfully!', 
          severity: 'success' 
        });
        
        // Reset form
        setFormData({
          fullName: '',
          address: '',
          civilStatus: '',
          coOwner: '',
          orNumber: '',
          franchiseNumber: '',
          dateApproved: '',
          expiryDate: '',
          franchiseStatus: '',
          make: '',
          sidecarNumber: '',
          plateNumber: '',
          chassisNumber: '',
          motorNumber: ''
        });
        
        // Redirect to franchise page after 2 seconds
        setTimeout(() => {
          navigate('/operator/franchise');
        }, 2000);
        
      } catch (error) {
        console.error('[RequestAmendment] Error submitting amendment:', error);
        console.error('[RequestAmendment] Error response:', error.response);
        
        let errorMessage = 'Failed to submit amendment request. Please try again.';
        
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.response?.data) {
          errorMessage = JSON.stringify(error.response.data);
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        console.error('[RequestAmendment] Error message:', errorMessage);
        
        setToast({ 
          open: true, 
          message: errorMessage, 
          severity: 'error' 
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <UnifiedSidebar 
        userType="operator" 
        language={language} 
        onLanguageToggle={() => setLanguage(language === 'en' ? 'tl' : 'en')} 
        translations={t} 
      />
      
      {/* Header Banner */}
      <Box 
        sx={{ 
          backgroundColor: '#083d77', 
          color: 'white', 
          py: 3, 
          textAlign: 'center',
          mb: 0
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: 1.5 }}>
          AMENDMENT REQUEST
        </Typography>
      </Box>

      <Box sx={{ backgroundColor: 'white', width: '100%' }}>
        {/* Loading Overlay */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8, backgroundColor: 'white' }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Loading franchise information...</Typography>
          </Box>
        )}

        {/* Form Container */}
        {!isLoading && (
          <Box sx={{ maxWidth: '1400px', mx: 'auto', p: 3 }}>
            <form onSubmit={handleSubmit}>
            <Grid container spacing={2.5}>
            
            {/* Left Column - Franchisee Information */}
            <Grid item xs={12} md={5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, fontSize: '0.95rem' }}>
                FRANCHISEE INFORMATION
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, minHeight: '20px' }}>
                  FULL NAME
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  variant="outlined"
                  error={!!errors.fullName}
                  helperText={errors.fullName}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '20px',
                      backgroundColor: 'white'
                    }
                  }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, minHeight: '20px' }}>
                  ADDRESS
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  variant="outlined"
                  error={!!errors.address}
                  helperText={errors.address}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '20px',
                      backgroundColor: 'white'
                    }
                  }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, minHeight: '20px' }}>
                  CIVIL STATUS
                </Typography>
                <FormControl fullWidth size="small" error={!!errors.civilStatus}>
                  <Select
                    name="civilStatus"
                    value={formData.civilStatus}
                    onChange={handleChange}
                    displayEmpty
                    sx={{ 
                      borderRadius: '20px',
                      backgroundColor: 'white'
                    }}
                  >
                    <MenuItem value="" disabled>
                      <em>Select Civil Status</em>
                    </MenuItem>
                    <MenuItem value="Single">Single</MenuItem>
                    <MenuItem value="Married">Married</MenuItem>
                    <MenuItem value="Widowed">Widowed</MenuItem>
                    <MenuItem value="Divorced">Divorced</MenuItem>
                    <MenuItem value="Separated">Separated</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, minHeight: '20px' }}>
                  CO-OWNER
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  name="coOwner"
                  value={formData.coOwner}
                  onChange={handleChange}
                  variant="outlined"
                  error={!!errors.coOwner}
                  helperText={errors.coOwner}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '20px',
                      backgroundColor: 'white'
                    }
                  }}
                />
              </Box>
            </Grid>

            {/* Right Column - Franchise & Motorcycle Info */}
            <Grid item xs={12} md={7}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, fontSize: '0.95rem' }}>
                MOTORIZED TRICYCLE OPERATORS FRANCHISE
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, minHeight: '20px' }}>
                    OR NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    name="orNumber"
                    value={formData.orNumber}
                    onChange={handleChange}
                    variant="outlined"
                    error={!!errors.orNumber}
                    helperText={errors.orNumber}
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '20px',
                        backgroundColor: 'white'
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, minHeight: '20px' }}>
                    FRANCHISE NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    name="franchiseNumber"
                    value={formData.franchiseNumber}
                    onChange={handleChange}
                    variant="outlined"
                    InputProps={{
                      readOnly: true,
                    }}
                    helperText="Auto-loaded from franchise record"
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '20px',
                        backgroundColor: '#f5f5f5'
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, minHeight: '20px' }}>
                    DATE APPROVED
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    name="dateApproved"
                    value={formData.dateApproved}
                    onChange={handleChange}
                    variant="outlined"
                    InputProps={{
                      readOnly: true,
                    }}
                    helperText="Auto-loaded from franchise record"
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '20px',
                        backgroundColor: '#f5f5f5'
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, minHeight: '20px' }}>
                    EXPIRY DATE
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleChange}
                    variant="outlined"
                    InputProps={{
                      readOnly: true,
                    }}
                    helperText="Auto-loaded from franchise record"
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '20px',
                        backgroundColor: '#f5f5f5'
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, minHeight: '20px' }}>
                    FRANCHISE STATUS
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    name="franchiseStatus"
                    value={formData.franchiseStatus}
                    onChange={handleChange}
                    variant="outlined"
                    InputProps={{
                      readOnly: true,
                    }}
                    helperText="Auto-loaded from franchise record"
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '20px',
                        backgroundColor: '#f5f5f5'
                      },
                      '& .MuiInputBase-input': {
                        color: formData.franchiseStatus === 'active' ? '#2ecc71 !important' : '#e74c3c !important',
                        fontWeight: '700 !important',
                        fontSize: '0.95rem',
                        WebkitTextFillColor: formData.franchiseStatus === 'active' ? '#2ecc71 !important' : '#e74c3c !important'
                      }
                    }}
                  />
                </Grid>
              </Grid>

              {/* Motorcycle Information */}
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, mt: 3, fontSize: '0.95rem' }}>
                MOTORCYCLE INFORMATION
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, minHeight: '20px' }}>
                    MAKE
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    name="make"
                    value={formData.make}
                    onChange={handleChange}
                    variant="outlined"
                    error={!!errors.make}
                    helperText={errors.make}
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '20px',
                        backgroundColor: 'white'
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, minHeight: '20px' }}>
                    SIDECAR NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    name="sidecarNumber"
                    value={formData.sidecarNumber}
                    onChange={handleChange}
                    variant="outlined"
                    error={!!errors.sidecarNumber}
                    helperText={errors.sidecarNumber}
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '20px',
                        backgroundColor: 'white'
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, minHeight: '20px' }}>
                    PLATE NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    name="plateNumber"
                    value={formData.plateNumber}
                    onChange={handleChange}
                    variant="outlined"
                    error={!!errors.plateNumber}
                    helperText={errors.plateNumber}
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '20px',
                        backgroundColor: 'white'
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, minHeight: '20px' }}>
                    CHASSIS NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    name="chassisNumber"
                    value={formData.chassisNumber}
                    onChange={handleChange}
                    variant="outlined"
                    error={!!errors.chassisNumber}
                    helperText={errors.chassisNumber}
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '20px',
                        backgroundColor: 'white'
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5, minHeight: '20px' }}>
                    MOTOR NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    name="motorNumber"
                    value={formData.motorNumber}
                    onChange={handleChange}
                    variant="outlined"
                    error={!!errors.motorNumber}
                    helperText={errors.motorNumber}
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '20px',
                        backgroundColor: 'white'
                      }
                    }}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Submit Button */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                sx={{
                  backgroundColor: '#083d77',
                  color: 'white',
                  px: 8,
                  py: 1.2,
                  fontSize: '1rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: '#062d5a'
                  },
                  '&:disabled': {
                    backgroundColor: '#cccccc',
                    color: '#666666'
                  }
                }}
              >
                {isSubmitting ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                    Submitting...
                  </>
                ) : (
                  'Submit'
                )}
              </Button>
            </Box>
            </Grid>
            </Grid>
          </form>
        </Box>
        )}
      </Box>

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseToast} 
          severity={toast.severity || 'error'}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
