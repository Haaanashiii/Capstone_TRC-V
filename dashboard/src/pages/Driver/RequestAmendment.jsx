import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Grid, 
  Paper, 
  Select, 
  MenuItem, 
  FormControl, 
  FormHelperText,
  Alert, 
  Snackbar, 
  CircularProgress,
  Divider,
  InputLabel
} from '@mui/material';
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { useNavigate, useLocation } from 'react-router-dom';
import UnifiedNavbar from '../../components/UnifiedNavbar';
import { franchiseAPI, API_BASE_URL } from '../Services/api';
import { validateFile } from '../../utils/fileValidation';
import { compressFile } from '../../utils/compressFile';
import "../../Styles/Operator's_CSS/FranchiseApplication.css";

// Constants
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Divorced', 'Separated'];

const INITIAL_FORM_STATE = {
  date: dayjs(),
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
};

const FIELD_LABELS = {
  date: 'Date',
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

export default function RequestAmendment() {
  const navigate = useNavigate();
  const location = useLocation();
  const [language, setLanguage] = useState('en');
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({ open: false, message: '', severity: 'error' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  
  // Get amendment type from navigation state
  const amendmentType = location.state?.amendmentType || 'motor'; // 'owner' or 'motor'
  
  // Document uploads for owner amendment
  const [uploads, setUploads] = useState({
    registration: null,
    barangay: null,
    cedula: null,
    license: null,
    affidavit: null,
    picture: null,
    stencil: null
  });

  const translations = {
    en: { 
      title: 'AMENDMENT REQUEST', 
      toggleLanguage: 'Tagalog',
      subtitle: 'Update your franchise information',
      date: 'DATE'
    },
    tl: { 
      title: 'HILING PARA SA PAG-AAYOS', 
      toggleLanguage: 'English',
      subtitle: 'I-update ang iyong impormasyon ng franchise',
      date: 'PETSA'
    }
  };

  const t = translations[language];

  // Memoized handlers for performance
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setErrors(prev => ({
      ...prev,
      [name]: ''
    }));
  }, []);

  const handleCloseToast = useCallback(() => {
    setToast(prev => ({ ...prev, open: false }));
  }, []);

  // Fetch existing franchise data on component mount
  useEffect(() => {
    const fetchFranchiseData = async () => {
      try {
        setIsLoading(true);
        
        // Get token
        const token = sessionStorage.getItem('accessToken');
        if (!token) {
          console.log('[RequestAmendment] No token found, skipping data fetch');
          setIsLoading(false);
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
          // Don't block - just log and continue
          setIsLoading(false);
          return;
        }

        const userData = await userResponse.json();
        console.log('[RequestAmendment] User data received:', userData);
        console.log('[RequestAmendment] Franchise data:', userData.user?.franchise);

        const userFranchise = userData.user?.franchise;

        // Comment out validation - allow access for UI testing
        // if (!userFranchise || !userFranchise.franchiseStatus || userFranchise.franchiseStatus !== 'active') {
        //   console.error('[RequestAmendment] No active franchise found');
        //   setToast({
        //     open: true,
        //     message: 'No active franchise found. Please apply for a franchise first.',
        //     severity: 'error'
        //   });
        //   setTimeout(() => navigate('/operator/franchise'), 2000);
        //   return;
        // }

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

        // Pre-populate form with existing data if available (prioritize franchiseApp data, fallback to userFranchise)
        if (userFranchise || franchiseApp) {
          setFormData({
            date: dayjs(), // Keep today's date as the amendment request date
            fullName: userFranchise?.operatorName || '',
            address: userFranchise?.address || '',
            civilStatus: userFranchise?.civilStatus || '',
            coOwner: franchiseApp?.coOwner || '',
            orNumber: franchiseApp?.orNumber || '',
            franchiseNumber: userFranchise?.mtopNumber || '',
            dateApproved: userFranchise?.approvedAt ? new Date(userFranchise.approvedAt).toISOString().split('T')[0] : '',
            expiryDate: userFranchise?.expiryDate ? new Date(userFranchise.expiryDate).toISOString().split('T')[0] : '',
            franchiseStatus: userFranchise?.franchiseStatus || 'active',
            make: franchiseApp?.unitModel || '',
            sidecarNumber: franchiseApp?.sideCar || '',
            plateNumber: franchiseApp?.mvPlateNo || '',
            chassisNumber: franchiseApp?.chasisNo || '',
            motorNumber: franchiseApp?.motorEngineNo || ''
          });
          console.log('[RequestAmendment] Form populated with franchise data');
        }
      } catch (error) {
        console.error('[RequestAmendment] Error fetching franchise data:', error);
        // Don't show error toast - just log it for UI testing
        console.log('[RequestAmendment] Continuing without franchise data for UI testing');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFranchiseData();
  }, [navigate]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    
    // Comment out validation for UI testing
    // Validate all required fields
    // Object.keys(FIELD_LABELS).forEach(field => {
    //   if (!formData[field] || !formData[field].toString().trim()) {
    //     newErrors[field] = `${FIELD_LABELS[field]} is required`;
    //   }
    // });

    setErrors(newErrors);
    
    // Show toast with first missing field
    if (Object.keys(newErrors).length > 0) {
      const firstErrorField = Object.keys(newErrors)[0];
      const fieldName = FIELD_LABELS[firstErrorField];
      setToast({ 
        open: true, 
        message: `${fieldName} is required`,
        severity: 'error'
      });
    }
    
    return Object.keys(newErrors).length === 0;
  }, []);

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
        
        // Submit using the renew-amend endpoint
        const response = await franchiseAPI.createRenewAmend(formDataToSend);
        
        if (!response.data) throw new Error('No response data received');
        
        console.log('[RequestAmendment] Amendment submitted successfully:', response.data);
        
        // Show success message
        setToast({ 
          open: true, 
          message: 'Amendment request submitted successfully!', 
          severity: 'success' 
        });
        
        // Reset form
        setFormData(INITIAL_FORM_STATE);
        
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
    <div>
      <UnifiedNavbar 
        userType="operator" 
        language={language} 
        onLanguageToggle={() => setLanguage(language === 'en' ? 'tl' : 'en')} 
        translations={t} 
      />

      <div className="franchise-app-bg">
        <div className="franchise-app-paper">
          
          {/* Logo Section */}
          <div className="franchise-app-logo">
            <img src="/public/Logos/SBLogo.png" alt="Seal" />
            <img src="/public/Logos/TRC-vLogo.png" alt="TRC-V Logo" />
          </div>

          {/* Title */}
          <div className="franchise-app-title">{t.title}</div>
          
          {/* Date Field */}
          <div className="franchise-app-date-row">
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontWeight: 700, marginBottom: 4 }}>{t.date}</label>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  value={formData.date || dayjs()}
                  onChange={(newValue) => setFormData({ ...formData, date: newValue })}
                  disabled
                  readOnly
                  disableFuture
                  slotProps={{ textField: { size: 'small', className: 'franchise-app-input', disabled: true, InputProps: { readOnly: true } } }}
                />
              </LocalizationProvider>
            </div>
          </div>

          {/* Loading Overlay */}
          {isLoading && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              padding: '64px 0',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <CircularProgress size={40} />
              <Typography sx={{ color: '#64748b' }}>Loading franchise information...</Typography>
            </div>
          )}

          {/* Form Container */}
          {!isLoading && (
            <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
            
            {/* Franchisee Information Section */}
            <Grid item xs={12}>
            <div className="franchise-app-section">
              FRANCHISEE INFORMATION
              <div className="franchise-app-section-line" />
            </div>
            </Grid>
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="FULL NAME"
                    size="small"
                    className="franchise-app-input"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    error={!!errors.fullName}
                    helperText={errors.fullName}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <FormControl size="small" className="franchise-app-input" error={!!errors.civilStatus}>
                    <InputLabel>CIVIL STATUS</InputLabel>
                    <Select
                      label="CIVIL STATUS"
                      name="civilStatus"
                      value={formData.civilStatus || ''}
                      onChange={handleChange}
                    >
                      {CIVIL_STATUS_OPTIONS.map(status => (
                        <MenuItem key={status} value={status}>{status}</MenuItem>
                      ))}
                    </Select>
                    {errors.civilStatus && (
                      <FormHelperText>{errors.civilStatus}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="CO-OWNER"
                    size="small"
                    className="franchise-app-input"
                    name="coOwner"
                    value={formData.coOwner}
                    onChange={handleChange}
                    error={!!errors.coOwner}
                    helperText={errors.coOwner}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="ADDRESS"
                    size="small"
                    className="franchise-app-input"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    error={!!errors.address}
                    helperText={errors.address}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Franchise Information Section */}
            <Grid item xs={12}>
            <div className="franchise-app-section">
              MOTORIZED TRICYCLE OPERATORS FRANCHISE
              <div className="franchise-app-section-line" />
            </div>
            </Grid>

            <Grid item xs={12}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="OR NUMBER"
                    size="small"
                    className="franchise-app-input"
                    name="orNumber"
                    value={formData.orNumber}
                    onChange={handleChange}
                    error={!!errors.orNumber}
                    helperText={errors.orNumber}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="FRANCHISE NUMBER"
                    size="small"
                    className="franchise-app-input"
                    name="franchiseNumber"
                    value={formData.franchiseNumber}
                    onChange={handleChange}
                    InputProps={{
                      readOnly: true,
                    }}
                    helperText="Auto-loaded from franchise record"
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="DATE APPROVED"
                    size="small"
                    className="franchise-app-input"
                    name="dateApproved"
                    value={formData.dateApproved}
                    onChange={handleChange}
                    InputProps={{
                      readOnly: true,
                    }}
                    helperText="Auto-loaded from franchise record"
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="EXPIRY DATE"
                    size="small"
                    className="franchise-app-input"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleChange}
                    InputProps={{
                      readOnly: true,
                    }}
                    helperText="Auto-loaded from franchise record"
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="FRANCHISE STATUS"
                    size="small"
                    className="franchise-app-input"
                    name="franchiseStatus"
                    value={formData.franchiseStatus?.toUpperCase() || ''}
                    onChange={handleChange}
                    InputProps={{
                      readOnly: true,
                    }}
                    helperText="Auto-loaded from franchise record"
                  />
                </Grid>
              </Grid>

            </Grid>

            {/* Motorcycle Information Section */}
            <Grid item xs={12}>
            <div className="franchise-app-section">
              MOTORCYCLE INFORMATION
              <div className="franchise-app-section-line" />
            </div>
            </Grid>

            <Grid item xs={12}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="MAKE/MODEL"
                    size="small"
                    className="franchise-app-input"
                    name="make"
                    value={formData.make}
                    onChange={handleChange}
                    error={!!errors.make}
                    helperText={errors.make}
                    placeholder="e.g., Honda TMX 155"
                  />
                </Grid>

                {[
                  { name: 'sidecarNumber', label: 'SIDECAR NUMBER', placeholder: 'Enter sidecar number' },
                  { name: 'plateNumber', label: 'PLATE NUMBER', placeholder: 'e.g., ABC-1234' },
                  { name: 'chassisNumber', label: 'CHASSIS NUMBER', placeholder: 'Enter chassis number' },
                  { name: 'motorNumber', label: 'MOTOR NUMBER', placeholder: 'Enter motor/engine number' }
                ].map(field => (
                  <Grid item xs={12} sm={6} md={field.name === 'motorNumber' ? 4 : 4} key={field.name}>
                    <TextField
                      label={field.label}
                      size="small"
                      className="franchise-app-input"
                      name={field.name}
                      value={formData[field.name]}
                      onChange={handleChange}
                      error={!!errors[field.name]}
                      helperText={errors[field.name]}
                      placeholder={field.placeholder}
                    />
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {/* Documentary Requirements Section - Only for Owner Amendment */}
            {amendmentType === 'owner' && (
              <>
              <Grid item xs={12}>
                <div className="franchise-app-section">
                  DOCUMENTARY REQUIREMENTS
                  <div className="franchise-app-section-line" />
                </div>

                <Box sx={{ mb: 3, mt: 2 }}>
                  <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 1, color: '#475569' }}>
                    Please upload clear scanned copies or photos of the following documents.
                  </Typography>
                  <ul style={{ marginLeft: 24, color: '#64748b', fontSize: '0.875rem' }}>
                    <li>Accepted formats: JPG, PNG, or PDF</li>
                    <li>Maximum file size: 10MB per file (will be compressed to ~300KB)</li>
                    <li>All documents must be valid, complete, and readable</li>
                    <li>Files will be automatically optimized for quality and size</li>
                  </ul>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  {[
                    { key: 'registration', label: 'PHOTOCOPY OF REGISTRATION' },
                    { key: 'barangay', label: 'PHOTOCOPY OF BARANGAY CLEARANCE' },
                    { key: 'cedula', label: 'PHOTOCOPY OF CEDULA' },
                    { key: 'license', label: "PHOTOCOPY OF DRIVER'S LICENSE" },
                    { key: 'stencil', label: 'PHOTOCOPY OF MOTOR CHASSIS STENCIL' },
                    { key: 'affidavit', label: "PHOTOCOPY OF VOTER'S AFFIDAVIT" },
                    { key: 'picture', label: '1X1 PICTURE' }
                  ].map((doc) => (
                    <Box key={doc.key} sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Box sx={{ minWidth: '300px', maxWidth: '300px' }}>
                        <Typography
                          sx={{
                            fontWeight: 700,
                            color: '#222',
                            fontSize: '1rem',
                            letterSpacing: 0.5
                          }}
                        >
                          {doc.label}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Button
                          variant="outlined"
                          component="label"
                          fullWidth
                          sx={{
                            borderRadius: '8px',
                            backgroundColor: '#eaf1ff',
                            borderColor: 'transparent',
                            color: '#222',
                            textTransform: 'none',
                            py: 1.5,
                            fontWeight: 500,
                            fontSize: '1rem',
                            justifyContent: 'flex-start',
                            px: 2,
                            '&:hover': {
                              borderColor: '#174D7A',
                              backgroundColor: '#d4e4ff'
                            }
                          }}
                        >
                          {uploads[doc.key] ? uploads[doc.key].name : 'No selected File -'}
                          <input
                            type="file"
                            hidden
                            accept="image/*,.pdf"
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const validation = validateFile(file);
                                if (!validation.success) {
                                  setToast({ open: true, message: validation.message, severity: 'error' });
                                  return;
                                }
                                try {
                                  const processedFile = await compressFile(file);
                                  setUploads({ ...uploads, [doc.key]: processedFile });
                                  setToast({ open: true, message: 'File uploaded successfully', severity: 'success' });
                                } catch {
                                  setUploads({ ...uploads, [doc.key]: file });
                                  setToast({ open: true, message: 'File uploaded', severity: 'success' });
                                }
                              }
                            }}
                          />
                        </Button>
                      </Box>
                    </Box>
                  ))}
                </Box>
                
                {/* Submit Button - Moved inside documentary requirements section */}
                <Box sx={{ mt: 4 }}>
                  <Divider sx={{ mb: 3 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={() => navigate('/operator/franchise')}
                      disabled={isSubmitting}
                      sx={{
                        px: 6,
                        py: 1.5,
                        fontSize: '1rem',
                        fontWeight: 600,
                        borderRadius: '8px',
                        textTransform: 'none',
                        borderColor: '#083d77',
                        color: '#083d77',
                        '&:hover': {
                          borderColor: '#062d5a',
                          backgroundColor: '#f1f5f9'
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={isSubmitting}
                      sx={{
                        background: 'linear-gradient(135deg, #083d77 0%, #0a4d8f 100%)',
                        color: 'white',
                        px: 8,
                        py: 1.5,
                        fontSize: '1rem',
                        fontWeight: 700,
                        borderRadius: '8px',
                        textTransform: 'none',
                        boxShadow: '0 4px 6px rgba(8, 61, 119, 0.2)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #062d5a 0%, #083d77 100%)',
                          boxShadow: '0 6px 8px rgba(8, 61, 119, 0.3)'
                        },
                        '&:disabled': {
                          backgroundColor: '#cbd5e1',
                          color: '#94a3b8',
                          boxShadow: 'none'
                        }
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                          Submitting...
                        </>
                      ) : (
                        'Submit Amendment Request'
                      )}
                    </Button>
                  </Box>
                </Box>
              </Grid>
              </>
            )}

            {/* Submit Button for non-owner amendments - stays in original position */}
            {amendmentType !== 'owner' && (
              <Grid item xs={12}>
                <Divider sx={{ my: 3 }} />
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/operator/franchise')}
                    disabled={isSubmitting}
                    sx={{
                      px: 6,
                      py: 1.5,
                      fontSize: '1rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      textTransform: 'none',
                      borderColor: '#083d77',
                      color: '#083d77',
                      '&:hover': {
                        borderColor: '#062d5a',
                        backgroundColor: '#f1f5f9'
                      }
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isSubmitting}
                    sx={{
                      background: 'linear-gradient(135deg, #083d77 0%, #0a4d8f 100%)',
                      color: 'white',
                      px: 8,
                      py: 1.5,
                      fontSize: '1rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      textTransform: 'none',
                      boxShadow: '0 4px 6px rgba(8, 61, 119, 0.2)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #062d5a 0%, #083d77 100%)',
                        boxShadow: '0 6px 8px rgba(8, 61, 119, 0.3)'
                      },
                      '&:disabled': {
                        backgroundColor: '#cbd5e1',
                        color: '#94a3b8',
                        boxShadow: 'none'
                      }
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                        Submitting...
                      </>
                    ) : (
                      'Submit Amendment Request'
                    )}
                  </Button>
                </Box>
              </Grid>
            )}
          </form>
          )}
        </div>
      </div>

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
          variant="filled"
          sx={{ 
            width: '100%',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </div>
  );
}