import React, { useState, useEffect } from "react";
import { Box, Typography, Button, Paper, Avatar, TextField } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import UnifiedSidebar from '../../components/UnifiedSidebar';

function DriverID() {
  const [user, setUser] = useState(null);
  const [language, setLanguage] = useState('en'); // Language state
  const [franchiseStatus, setFranchiseStatus] = useState(null); // Franchise status state
  
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
  
  // Check franchise status from localStorage or API
  const checkFranchiseStatus = () => {
    // Check if user has linked franchise (this could be stored in localStorage or fetched from API)
    const franchiseData = localStorage.getItem('userFranchiseInfo');
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
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch {
      return null;
    }
  };

  // Fetch full user details from the server
  const fetchUserDetails = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
      console.log('DriverID: Fetching user details from:', `${API_BASE_URL}/auth/me`);
      
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
        console.log('DriverID: API failed, using token data');
        // Fallback to token data if API fails
        const tokenUser = getUserInfo();
        if (tokenUser) {
          setUser(tokenUser);
        }
      }
    } catch (error) {
      console.error('DriverID: Error fetching user details:', error);
      // Fallback to token data
      const tokenUser = getUserInfo();
      if (tokenUser) {
        setUser(tokenUser);
      }
    }
  };

  // Fetch user details on component mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Get token user data immediately
      const tokenUser = getUserInfo();
      if (tokenUser) {
        setUser(tokenUser);
      }
      // Then try to fetch detailed user data
      fetchUserDetails();
    }
    // Check franchise status
    checkFranchiseStatus();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  
  // Validation state for number-only fields
  const [errors, setErrors] = useState({
    orNumber: false,
    franchiseNumber: false,
    sidecarNumber: false,
    plateNumber: false
  });

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
  const handleChange = (field) => (e) => {
    let value = e.target?.value ?? e;

    if (["orNumber", "franchiseNumber", "sidecarNumber", "plateNumber"].includes(field)) {
     
      if (!/^\d*$/.test(value)) {
        setErrors({ ...errors, [field]: true });
        value = value.replace(/[^\d]/g, "");
      } else {
        setErrors({ ...errors, [field]: false });
      }
    }
    setFields({ ...fields, [field]: value });
  };

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', maxWidth: '100vw', bgcolor: '#f5f7fa', overflowX: 'hidden' }}>
      {/* Unified Sidebar */}
      <UnifiedSidebar 
        userType="operator" 
        language={language}
        onLanguageToggle={() => setLanguage(language === 'en' ? 'tl' : 'en')}
        translations={t}
      />
      
      {/* Top Blue Bar */}
      <Box sx={{ background: '#0a3576', width: '100vw', minHeight: 340, position: 'relative', pt: 5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ position: 'relative', width: '100vw', mt: 4, display: 'flex', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 180 }}>
            <Avatar src="/public/Logos/clipboard.gif" alt="Profile" sx={{ width: 120, height: 120, mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.10)', border: '6px solid #fff' }} />
          </Box>

          <Box sx={{ ml: 4, pt: 2, flex: 1 }}>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
              {user?.name || 'User Name'}
            </Typography>
            <Typography sx={{ color: '#fff', fontWeight: 500, fontSize: 16 }}>
              {user?.address || t.addressNotProvided}
            </Typography>
            <Typography sx={{ color: '#fff', fontWeight: 500, fontSize: 16 }}>
              {t.singleNoCoOwner}
            </Typography>
            <Button 
              variant="contained" 
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
          </Box>
          <Box sx={{ background: '#ffe600', color: '#0a3576', fontWeight: 'bold', borderRadius: 1, px: 4, py: 2, fontSize: '1.2rem', position: 'absolute', right: 48, top: '100%', transform: 'translateY(-50%)', zIndex: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
            ID NO: {user?.operatorId || user?.id?.toString().slice(-4) || '0000'}
          </Box>
        </Box>
      </Box>

      {/* Main Content */}
  <Box sx={{ display: 'flex', gap: 0, mt: -5, px: -5, alignItems: 'flex-start', justifyContent: 'center', width: '124vw', boxSizing: 'border-box' }}>
        <Paper sx={{ flex: 10  , position: 'relative', borderRadius: 2, p: 5, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minWidth: 0 }}>
          {/* Main Content Section Start */}


            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontWeight: 700, color: '#0a3576', fontSize: '1.1rem', mb: 1 }}>MOTORIZED TRICYCLE OPERATORS FRANCHISE</Typography>
              <hr style={{ border: 'none', borderTop: '2px solid #222', margin: '8px 0 16px 0' }} />
              <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 500, mb: 1 }}>OR NUMBER</Typography>
                  <TextField 
                    value={fields.orNumber}
                    onChange={handleChange('orNumber')}
                    size="small"
                    fullWidth
                      type="text"
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 0 }}
                      error={errors.orNumber}
                      helperText={errors.orNumber ? "Please fill with numbers only" : ""}
                  />
                </Box>


                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 500, mb: 1 }}>FRANCHISE NUMBER</Typography>
                  <TextField 
                    value={fields.franchiseNumber}
                    onChange={handleChange('franchiseNumber')}
                    size="small"
                    fullWidth
                    type="text"
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 0 }}
                    error={errors.franchiseNumber}
                    helperText={errors.franchiseNumber ? "Please fill with numbers only" : ""}
                  />
                </Box>
              </Box>



              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 500, mb: 1 }}>DATE APPROVED</Typography>
                    <DatePicker
                      label="Select date approved"
                      value={fields.dateApproved}
                      onChange={(newValue) => setFields({ ...fields, dateApproved: newValue })}
                      slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    />
                  </Box>


                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 500, mb: 1 }}>EXPIRY DATE</Typography>
                    <DatePicker
                      label="Select expiry date"
                      value={fields.expiryDate}
                      onChange={(newValue) => setFields({ ...fields, expiryDate: newValue })}
                      slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    />
                  </Box>
                </Box>
              </LocalizationProvider>


              <Typography sx={{ fontWeight: 700, color: '#0a3576', fontSize: '1.1rem', mb: 1 }}>MOTORCYCLE INFORMATION</Typography>
              <hr style={{ border: 'none', borderTop: '2px solid #222', margin: '8px 0 16px 0' }} />
              <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 500, mb: 1 }}>MAKE</Typography>
                  <TextField 
                    value={fields.make}
                    onChange={handleChange('make')}
                    size="small"
                    fullWidth
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 500, mb: 1 }}>SIDECAR NUMBER</Typography>
                    <TextField 
                      value={fields.sidecarNumber}
                      onChange={handleChange('sidecarNumber')}
                      size="small"
                      fullWidth
                      type="text"
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 0 }}
                      error={errors.sidecarNumber}
                      helperText={errors.sidecarNumber ? "Please fill with numbers only" : ""}
                    />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 500, mb: 1 }}>PLATE NUMBER</Typography>
                    <TextField 
                      value={fields.plateNumber}
                      onChange={handleChange('plateNumber')}
                      size="small"
                      fullWidth
                      type="text"
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 0 }}
                      error={errors.plateNumber}
                      helperText={errors.plateNumber ? "Please fill with numbers only" : ""}
                    />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 500, mb: 1 }}>CHASSIS NUMBER</Typography>
                  <TextField 
                    value={fields.chassisNumber}
                    onChange={handleChange('chassisNumber')}
                    size="small"
                    error={errors.chassisNumber}
                    helperText={errors.chassisNumber ? "Please fill with numbers only" : ""}
                    fullWidth
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 500, mb: 1 }}>MOTOR NUMBER</Typography>
                  <TextField 
                    value={fields.motorNumber}
                    onChange={handleChange('motorNumber')}
                    size="small"
                    fullWidth
                  />
                </Box>
              </Box>
            </Box>
            {/* Removed duplicate MOTORCYCLE INFORMATION section and stray braces */}
          {/* Main Content Section End */}
        </Paper>
        <Box sx={{ width: 380, height: '100%', borderRadius: 3, background: '#0a3576', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', p: 2 }}>
          <img src="/public/Logos/SBLogo.png" alt="Seal" style={{ width: '80%', height: 'auto', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', position: 'absolute', right: 0, bottom: 0, opacity: 0.2 }} />
         
        </Box>
      </Box>
    </Box>
  );
}

export default DriverID;




