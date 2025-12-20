
import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, InputAdornment, IconButton, Divider, Paper, ThemeProvider, createTheme, FormControlLabel, Checkbox } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import GoogleIcon from "@mui/icons-material/Google";
import AccountVerificationModal from '../Services/AccountVerificationModal';
import TermsAndConditionsModal from '../../components/TermsAndConditionsModal';
import PrivacyPolicyModal from '../../components/PrivacyPolicyModal';
import api from '../Services/api';
import { logger } from '../../utils/logger';
import '../../Styles/SignupCss/signup.css';

const poppinsTheme = createTheme({
  typography: {
    fontFamily: 'Poppins, sans-serif',
  },
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;



const SignUp = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleClickShowPassword = () => setShowPassword((show) => !show);
  const handleClickShowConfirmPassword = () => setShowConfirmPassword((show) => !show);


  const validatePassword = (password) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must include at least one capital letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must include at least one number";
    }
    return "";
  };

 
  const validatePasswordMatch = (password, confirmPassword) => {
    if (confirmPassword && password !== confirmPassword) {
      return "Passwords do not match";
    }
    return "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    
    
    if (name === "password") {
      setPasswordError(validatePassword(value));
      // confimation check logic, pa check kung tama 
      if (form.confirmPassword) {
        setConfirmPasswordError(validatePasswordMatch(value, form.confirmPassword));
      }
    }
    
    
    if (name === "confirmPassword") {
      setConfirmPasswordError(validatePasswordMatch(form.password, value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    logger.log("Form submission started"); // Debug log
    
    // Pang Validate password 
    const passwordValidationError = validatePassword(form.password);
    if (passwordValidationError) {
      logger.log("Password validation failed:", passwordValidationError); // Debug log
      setError(passwordValidationError);
      return;
    }
    
    // Validate password match
    const passwordMatchError = validatePasswordMatch(form.password, form.confirmPassword);
    if (passwordMatchError) {
      logger.log("Password match failed:", passwordMatchError); // Debug log
      setError(passwordMatchError);
      return;
    }
    
    // Check if all fields are filled
    if (!form.fullName || !form.username || !form.email || !form.password || !form.confirmPassword) {
      logger.log("Missing fields:", form); // Debug log
      setError("Please fill out all fields");
      return;
    }

    // Validate checkbox
    if (!agreedToPrivacy || !agreedToTerms) {
      setError("You must agree to the Privacy Policy and Terms & Conditions to continue");
      return;
    }
    
    logger.log("All validations passed, making API call"); // Debug log
    
    try {
      // Instead of creating the account immediately, request an OTP first
      // and open the verification modal. Account creation will happen after
      // the OTP is successfully verified.
      logger.log("Requesting OTP for:", form.email);
      const otpResponse = await fetch(`${API_BASE_URL}/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, purpose: 'signup' })
      });
      const otpData = await otpResponse.json().catch(() => ({}));
      if (!otpResponse.ok) {
        // Still open the modal in some cases? For now show error to user
        setError(otpData.error || 'Failed to request verification code');
        return;
      }
      setShowVerificationModal(true);
    } catch (error) {
      logger.error("OTP request network error:", error);
      setError("Network error. Please try again.");
    }
  };

  const handleVerificationSuccess = () => {
    // After OTP verification, create the actual user account
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.fullName,
            username: form.username,
            email: form.email,
            password: form.password
          })
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Registration failed');
          } else {
            setSuccess('Account created and verified! You can now log in.');
            setForm({ fullName: '', username: '', email: '', password: '', confirmPassword: '' });
            setPasswordError('');
            setConfirmPasswordError('');
            // Sarap ni luke po, best green flag nang bayan
            navigate('/login');
          }
      } catch (err) {
        logger.error('Create user network error:', err);
        setError('Network error. Please try again.');
      }
    })();
    // Optionally redirect to login page
    // window.location.href = '/login';
  };
  
  return (
    <ThemeProvider theme={poppinsTheme}>
      <Box className="signup-root">
        <Paper elevation={0} className="signup-left">
          <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
            <img src="/Logos/SBLogos.png" alt="SBLogo" className="signup-logo" />
            <img src="/Logos/TRC-vLogo.png" alt="QR" className="signup-qr" />
          </Box>
          <Typography variant="h4" className="signup-title" style={{ textAlign: 'center' }}>Create your Account</Typography>
          {error && (
            <Typography color="error" style={{ textAlign: 'center', marginBottom: '16px', fontFamily: 'Poppins, sans-serif', fontSize: '14px' }}>
              {error}
            </Typography>
          )}
          {success && (
            <Typography color="success.main" style={{ textAlign: 'center', marginBottom: '16px', fontFamily: 'Poppins, sans-serif', fontSize: '14px' }}>
              {success}
            </Typography>
          )}
          <form onSubmit={handleSubmit}>
          <Box sx={{ maxWidth: '400px', margin: '0 auto', width: '100%', '@media (max-width: 768px)': { maxWidth: '100%', px: 0 } }}>
          <TextField 
            label="Full Name" 
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            variant="outlined" 
            fullWidth 
            margin="normal" 
            className="signup-input" 
            InputLabelProps={{ style: { fontFamily: 'Poppins, sans-serif' } }} 
          />
          <TextField 
            label="Username" 
            name="username"
            value={form.username}
            onChange={handleChange}
            variant="outlined" 
            fullWidth 
            margin="normal" 
            className="signup-input" 
            InputLabelProps={{ style: { fontFamily: 'Poppins, sans-serif' } }} 
          />
          <TextField 
            label="E-mail" 
            name="email"
            value={form.email}
            onChange={handleChange}
            variant="outlined" 
            fullWidth 
            margin="normal" 
            className="signup-input" 
            InputLabelProps={{ style: { fontFamily: 'Poppins, sans-serif' } }} 
          />
          <TextField
            label="Password"
            name="password"
            value={form.password}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            margin="normal"
            className="signup-input"
            type={showPassword ? "text" : "password"}
            error={!!passwordError}
            helperText={passwordError || "Must be at least 12 characters and include capital letters and numbers"}
            InputLabelProps={{ style: { fontFamily: 'Poppins, sans-serif' } }}
            FormHelperTextProps={{ style: { fontFamily: 'Poppins, sans-serif', fontSize: '12px' } }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleClickShowPassword} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="Confirm Password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            margin="normal"
            className="signup-input"
            type={showConfirmPassword ? "text" : "password"}
            error={!!confirmPasswordError}
            helperText={confirmPasswordError}
            InputLabelProps={{ style: { fontFamily: 'Poppins, sans-serif' } }}
            FormHelperTextProps={{ style: { fontFamily: 'Poppins, sans-serif', fontSize: '12px' } }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleClickShowConfirmPassword} edge="end">
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
                     <Box sx={{ mt: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Privacy Policy Checkbox */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={agreedToPrivacy}
                  onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                  sx={{
                    color: '#1976d2',
                    '&.Mui-checked': {
                      color: '#1B4B75'
                    }
                  }}
                />
              }
              label={
                <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontSize: '13px', color: '#333' }}>
                  I agree to the{' '}
                  <span
                    onClick={() => setShowPrivacyModal(true)}
                    style={{
                      color: '#1B4B75',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Privacy Policy
                  </span>
                </Typography>
              }
            />

            {/* Terms & Conditions Checkbox */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  sx={{
                    color: '#1976d2',
                    '&.Mui-checked': {
                      color: '#1B4B75'
                    }
                  }}
                />
              }
              label={
                <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontSize: '13px', color: '#333' }}>
                  I agree to the{' '}
                  <span
                    onClick={() => setShowTermsModal(true)}
                    style={{
                      color: '#1B4B75',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Terms & Conditions
                  </span>
                </Typography>
              }
            />
          </Box>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              className="signup-create-btn"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Create
            </Button>

            <Box sx={{ textAlign: 'center', mt: 2, mb: 2 }}>
              <Typography variant="body2" sx={{ fontFamily: 'Poppins, sans-serif', fontSize: { xs: '12px', sm: '13px', md: '14px' }, color: '#666' }}>
                Already have an account?{' '}
                <a href="/login" style={{ color: '#1B4B75', textDecoration: 'none', fontWeight: '600', cursor: 'pointer' }}>
                  Sign in
                </a>
              </Typography>
            </Box>
            
  
          </Box>
          </form>
        </Paper>
        <Box className="signup-right">
          <img src="/Logos/login-right.gif" alt="Sign Up Animation" className="signup-right-gif" />
        </Box>
        
        <AccountVerificationModal
          open={showVerificationModal}
          onClose={() => setShowVerificationModal(false)}
          email={form.email}
          purpose="signup"
          onVerificationSuccess={handleVerificationSuccess}
        />

        <TermsAndConditionsModal
          open={showTermsModal}
          onClose={() => setShowTermsModal(false)}
          onAgree={() => setAgreedToTerms(true)}
          onDecline={() => setAgreedToTerms(false)}
        />

        <PrivacyPolicyModal
          open={showPrivacyModal}
          onClose={() => setShowPrivacyModal(false)}
          onAgree={() => setAgreedToPrivacy(true)}
          onDecline={() => setAgreedToPrivacy(false)}
        />
      </Box>
    </ThemeProvider>
  );
};

export default SignUp;
