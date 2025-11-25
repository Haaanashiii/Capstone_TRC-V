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
        
        // First check if franchise data was passed via navigation state
        const passedFranchiseChainId = location.state?.franchiseChainId;
        const passedFranchise = location.state?.franchise;
        
        console.log('[RequestAmendment] Navigation state:', { 
          amendmentType: location.state?.amendmentType,
          hasPassedFranchise: !!passedFranchise,
          franchiseChainId: passedFranchiseChainId
        });
        
        // If franchise data was passed from navigation, use it as immediate fallback
        if (passedFranchise && passedFranchise.franchiseNumber) {
          console.log('[RequestAmendment] Using franchise from navigation state:', {
            franchiseNumber: passedFranchise.franchiseNumber,
            operatorName: passedFranchise.operatorName || passedFranchise.fullName,
            franchiseChainId: passedFranchiseChainId
          });
          
          // Populate form immediately with passed franchise data
          setFormData({
            date: dayjs(),
            fullName: passedFranchise.operatorName || passedFranchise.fullName || '',
            address: passedFranchise.operatorAddress || passedFranchise.address || '',
            civilStatus: passedFranchise.operatorCivilStatus || passedFranchise.civilStatus || '',
            coOwner: passedFranchise.coOwnerName || passedFranchise.coOwner || '',
            orNumber: passedFranchise.franchiseNumber || '',
            franchiseNumber: passedFranchise.franchiseNumber || '',
            dateApproved: passedFranchise.approvedAt 
              ? new Date(passedFranchise.approvedAt).toISOString().split('T')[0]
              : passedFranchise.dateApproved || '',
            expiryDate: passedFranchise.expiryDate 
              ? new Date(passedFranchise.expiryDate).toISOString().split('T')[0]
              : '',
            franchiseStatus: passedFranchise.franchiseStatus || 'Active',
            make: passedFranchise.unitModel || passedFranchise.make || '',
            sidecarNumber: passedFranchise.sideCarPlateNumber || passedFranchise.sidecarNumber || '',
            plateNumber: passedFranchise.mvPlateNo || passedFranchise.plateNumber || '',
            chassisNumber: passedFranchise.chasisNo || passedFranchise.chassisNumber || '',
            motorNumber: passedFranchise.motorEngineNo || passedFranchise.motorNumber || ''
          });
        }
        
        // Get token
        const token = sessionStorage.getItem('accessToken');
        if (!token) {
          console.log('[RequestAmendment] No token found, using passed data as final');
          setIsLoading(false);
          return;
        }

        console.log('[RequestAmendment] Fetching user data from /auth/me');
        
        // Fetch user data with franchise information from /auth/me
        const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!userResponse.ok) {
          console.error('[RequestAmendment] Failed to fetch user data:', userResponse.status);
          console.log('[RequestAmendment] Will use data from navigation state');
          setIsLoading(false);
          return;
        }

        const userData = await userResponse.json();
        console.log('[RequestAmendment] User data received:', userData);
        
        // Get franchise information from user data
        const userFranchise = userData.user?.franchise;
        
        if (!userFranchise) {
          console.warn('[RequestAmendment] No franchise found in user data');
          setIsLoading(false);
          return;
        }

        console.log('[RequestAmendment] Found franchise:', {
          franchiseChainId: userFranchise.franchiseChainId,
          franchiseNumber: userFranchise.franchiseNumber,
          operatorName: userFranchise.operatorName,
          status: userFranchise.franchiseStatus
        });

        // If we have a franchiseChainId, fetch the complete franchise history to get the latest version
        if (userFranchise.franchiseChainId) {
          try {
            console.log('[RequestAmendment] Fetching franchise chain history:', userFranchise.franchiseChainId);
            
            const chainResponse = await fetch(
              `${API_BASE_URL}/api/franchise-information/chain/${userFranchise.franchiseChainId}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (chainResponse.ok) {
              const chainData = await chainResponse.json();
              console.log('[RequestAmendment] Chain data received:', chainData);
              
              // Get the latest version (last item in the data array)
              if (chainData.data && chainData.data.length > 0) {
                const latestFranchise = chainData.data[chainData.data.length - 1];
                
                console.log('[RequestAmendment] Latest franchise version:', {
                  version: latestFranchise.version,
                  operatorName: latestFranchise.operatorName,
                  operatorAddress: latestFranchise.operatorAddress,
                  driverName: latestFranchise.driverName,
                  franchiseStatus: latestFranchise.franchiseStatus
                });

                // Pre-populate form with latest franchise data
                setFormData({
                  date: dayjs(),
                  fullName: latestFranchise.operatorName || '',
                  address: latestFranchise.operatorAddress || '',
                  civilStatus: latestFranchise.operatorCivilStatus || '',
                  coOwner: latestFranchise.coOwnerName || '',
                  orNumber: latestFranchise.franchiseNumber || '',
                  franchiseNumber: latestFranchise.franchiseNumber || '',
                  dateApproved: latestFranchise.approvedAt 
                    ? new Date(latestFranchise.approvedAt).toISOString().split('T')[0]
                    : '',
                  expiryDate: latestFranchise.expiryDate 
                    ? new Date(latestFranchise.expiryDate).toISOString().split('T')[0]
                    : '',
                  franchiseStatus: latestFranchise.franchiseStatus || 'Active',
                  make: latestFranchise.unitModel || '',
                  sidecarNumber: latestFranchise.sideCarPlateNumber || '',
                  plateNumber: latestFranchise.mvPlateNo || '',
                  chassisNumber: latestFranchise.chasisNo || '',
                  motorNumber: latestFranchise.motorEngineNo || ''
                });
                
                console.log('[RequestAmendment] Form populated successfully');
              }
            } else {
              console.warn('[RequestAmendment] Failed to fetch franchise chain:', chainResponse.status);
              // Fallback: populate with basic franchise data
              setFormData({
                date: dayjs(),
                fullName: userFranchise.operatorName || '',
                address: userFranchise.operatorAddress || '',
                civilStatus: userFranchise.operatorCivilStatus || '',
                coOwner: userFranchise.coOwnerName || '',
                orNumber: userFranchise.franchiseNumber || '',
                franchiseNumber: userFranchise.franchiseNumber || '',
                dateApproved: userFranchise.approvedAt 
                  ? new Date(userFranchise.approvedAt).toISOString().split('T')[0]
                  : '',
                expiryDate: userFranchise.expiryDate 
                  ? new Date(userFranchise.expiryDate).toISOString().split('T')[0]
                  : '',
                franchiseStatus: userFranchise.franchiseStatus || 'Active',
                make: userFranchise.unitModel || '',
                sidecarNumber: userFranchise.sideCarPlateNumber || '',
                plateNumber: userFranchise.mvPlateNo || '',
                chassisNumber: userFranchise.chasisNo || '',
                motorNumber: userFranchise.motorEngineNo || ''
              });
            }
          } catch (chainError) {
            console.error('[RequestAmendment] Error fetching franchise chain:', chainError);
            // Fallback: use franchise data from /auth/me
            setFormData({
              date: dayjs(),
              fullName: userFranchise.operatorName || '',
              address: userFranchise.operatorAddress || '',
              civilStatus: userFranchise.operatorCivilStatus || '',
              coOwner: userFranchise.coOwnerName || '',
              orNumber: userFranchise.franchiseNumber || '',
              franchiseNumber: userFranchise.franchiseNumber || '',
              dateApproved: userFranchise.approvedAt 
                ? new Date(userFranchise.approvedAt).toISOString().split('T')[0]
                : '',
              expiryDate: userFranchise.expiryDate 
                ? new Date(userFranchise.expiryDate).toISOString().split('T')[0]
                : '',
              franchiseStatus: userFranchise.franchiseStatus || 'Active',
              make: userFranchise.unitModel || '',
              sidecarNumber: userFranchise.sideCarPlateNumber || '',
              plateNumber: userFranchise.mvPlateNo || '',
              chassisNumber: userFranchise.chasisNo || '',
              motorNumber: userFranchise.motorEngineNo || ''
            });
          }
        } else {
          // No franchiseChainId, use basic franchise data
          setFormData({
            date: dayjs(),
            fullName: userFranchise.operatorName || '',
            address: userFranchise.operatorAddress || '',
            civilStatus: userFranchise.operatorCivilStatus || '',
            coOwner: userFranchise.coOwnerName || '',
            orNumber: userFranchise.franchiseNumber || '',
            franchiseNumber: userFranchise.franchiseNumber || '',
            dateApproved: userFranchise.approvedAt 
              ? new Date(userFranchise.approvedAt).toISOString().split('T')[0]
              : '',
            expiryDate: userFranchise.expiryDate 
              ? new Date(userFranchise.expiryDate).toISOString().split('T')[0]
              : '',
            franchiseStatus: userFranchise.franchiseStatus || 'Active',
            make: userFranchise.unitModel || '',
            sidecarNumber: userFranchise.sideCarPlateNumber || '',
            plateNumber: userFranchise.mvPlateNo || '',
            chassisNumber: userFranchise.chasisNo || '',
            motorNumber: userFranchise.motorEngineNo || ''
          });
        }
      } catch (error) {
        console.error('[RequestAmendment] Error fetching franchise data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFranchiseData();
  }, [navigate, location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Prevent duplicate submissions
    
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
      
      // Determine application type based on amendment type
      let applicationType = 'renewal'; // default
      if (amendmentType === 'owner') {
        applicationType = 'update_ownership';
      } else if (amendmentType === 'motor') {
        applicationType = 'change_unit';
      }
      
      console.log('[RequestAmendment] Submitting with applicationType:', applicationType);
      
      // Add application type
      formDataToSend.append('applicationType', applicationType);
      
      // Personal/Operator Information
      formDataToSend.append('operatorName', formData.fullName || '');
      formDataToSend.append('operatorAddress', formData.address || '');
      formDataToSend.append('operatorCivilStatus', formData.civilStatus || '');
      formDataToSend.append('coOwnerName', formData.coOwner || '');
      
      // Franchise Information (read from form - user can edit these)
      formDataToSend.append('orNumber', formData.orNumber || '');
      formDataToSend.append('franchiseNumber', formData.franchiseNumber || '');
      
      // Motorcycle Information
      formDataToSend.append('unitModel', formData.make || '');
      formDataToSend.append('sideCarPlateNumber', formData.sidecarNumber || '');
      formDataToSend.append('mvPlateNo', formData.plateNumber || '');
      formDataToSend.append('chasisNo', formData.chassisNumber || '');
      formDataToSend.append('motorEngineNo', formData.motorNumber || '');
      
      // Add uploaded documents for owner amendment
      if (amendmentType === 'owner') {
        const uploadHelper = async (fieldName, key) => {
          if (uploads[key]) {
            formDataToSend.append(fieldName, uploads[key]);
          }
        };
        
        await uploadHelper('motorRegistrationObj', 'registration');
        await uploadHelper('barangayClearanceObj', 'barangay');
        await uploadHelper('cedulaObj', 'cedula');
        await uploadHelper('driversLicenseObj', 'license');
        await uploadHelper('votersAffidavitObj', 'affidavit');
        await uploadHelper('motorChassisStencilObj', 'stencil');
        await uploadHelper('driverPictureObj', 'picture');
      }
      
      console.log('[RequestAmendment] Submitting amendment request...');
      console.log('[RequestAmendment] Amendment type:', amendmentType);
      
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
      setUploads({
        registration: null,
        barangay: null,
        cedula: null,
        license: null,
        affidavit: null,
        picture: null,
        stencil: null
      });
      
      // Redirect to franchisee list after 2 seconds
      setTimeout(() => {
        navigate('/operator/franchisee-list');
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