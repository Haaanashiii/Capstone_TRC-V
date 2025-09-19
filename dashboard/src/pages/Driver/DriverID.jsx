import React, { useState } from "react";
import { Box, Typography, Button, Paper, Avatar, TextField } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

function DriverID() {
  // Validation state for number-only fields
  const [errors, setErrors] = useState({
    orNumber: false,
    franchiseNumber: false,
    sidecarNumber: false,
    plateNumber: false
  });

  // Helper to check if value is numeric
  const isNumeric = (value) => /^\d*$/.test(value);
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
      {/* Top Blue Bar */}
      <Box sx={{ background: '#0a3576', width: '100vw', minHeight: 340, position: 'relative', pt: 5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
  <Box sx={{ width: '100vw', px: 6, pt: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexDirection: 'row' }}>
            <img src="/public/Logos/TRC-vLogo.png" alt="TRC-V Logo" style={{ height: 58, marginRight: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <Box sx={{ color: '#ffe600', fontWeight: 900, fontSize: 32, letterSpacing: 2, lineHeight: 1 }}>TRC<span style={{ color: '#fff', fontWeight: 700 }}>-V</span></Box>
              <Typography sx={{ color: '#fff', fontWeight: 500, fontSize: 13, letterSpacing: 1, mt: 0.5 }}>TRICYCLE VERIFICATION SYSTEM</Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <Box sx={{ background: '#fff', borderRadius: 40, boxShadow: '0 4px 12px rgba(0,0,0,0.10)', display: 'flex', alignItems: 'center', p: '6px 32px', gap: 2, minWidth: 420, maxWidth: 500, mr: 8 }}>
              <Typography sx={{ color: '#222', fontWeight: 700, fontSize: 12, mx: 2 }}>HOME</Typography>
              <Typography sx={{ color: '#222', fontWeight: 700, fontSize: 12, mx: 2 }}>MY FRANCHISE</Typography>
              <Button startIcon={<PersonIcon />} sx={{ bgcolor: '#0a3576', color: '#fff', borderRadius: 40, px: 3, fontWeight: 700, boxShadow: 2, textTransform: 'none', mx: 2 }}>Marla Rihana</Button>
            </Box>
          </Box>
        </Box>

        <Box sx={{ position: 'relative', width: '100vw', mt: 4, display: 'flex', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 180 }}>
            <Avatar src="/public/Logos/clipboard.gif" alt="Profile" sx={{ width: 120, height: 120, mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.10)', border: '6px solid #fff' }} />
          </Box>

          <Box sx={{ ml: 4, pt: 2, flex: 1 }}>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>Papi Luke </Typography>
            <Typography sx={{ color: '#fff', fontWeight: 500, fontSize: 16 }}>#72 Baccara St. Brgy. Quezon, Solano Nueva Vizcaya</Typography>
            <Typography sx={{ color: '#fff', fontWeight: 500, fontSize: 16 }}>SINGLE | NO CO-OWNER</Typography>
            <Button variant="contained" sx={{ background: '#2ecc71', color: '#fff', fontWeight: 700, borderRadius: 2, mt: 1, px: 3, boxShadow: 2, textTransform: 'none', '&:hover': { background: '#27ae60' } }}>ACTIVE FRANCHISE</Button>
          </Box>
          <Box sx={{ background: '#ffe600', color: '#0a3576', fontWeight: 'bold', borderRadius: 1, px: 4, py: 2, fontSize: '1.2rem', position: 'absolute', right: 48, top: '100%', transform: 'translateY(-50%)', zIndex: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>ID NO: 02612</Box>
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




