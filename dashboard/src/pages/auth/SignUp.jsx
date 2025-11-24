
import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, InputAdornment, IconButton, Divider, Paper, ThemeProvider, createTheme } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import AccountVerificationModal from '../Services/AccountVerificationModal';
import api from '../Services/api';
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
    confirmPassword: "",
    phoneNumber: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    
    console.log("Form submission started"); // Debug log
    
    // Pang Validate password 
    const passwordValidationError = validatePassword(form.password);
    if (passwordValidationError) {
      console.log("Password validation failed:", passwordValidationError); // Debug log
      setError(passwordValidationError);
      return;
    }
    
    // Validate password match
    const passwordMatchError = validatePasswordMatch(form.password, form.confirmPassword);
    if (passwordMatchError) {
      console.log("Password match failed:", passwordMatchError); // Debug log
      setError(passwordMatchError);
      return;
    }
    
    // Check if all fields are filled
    if (!form.fullName || !form.username || !form.email || !form.password || !form.confirmPassword) {
      console.log("Missing fields:", form); // Debug log
      setError("Please fill out all fields");
      return;
    }
    
    console.log("All validations passed, making API call"); // Debug log
    
    setIsLoading(true); // Disable button while loading
    try {
      // Instead of creating the account immediately, request an OTP first
      // and open the verification modal. Account creation will happen after
      // the OTP is successfully verified.
      console.log("Requesting OTP for:", form.email);
      const response = await api.post('/auth/request-otp', { 
        email: form.email 
      });
      
      if (response.data) {
        setShowVerificationModal(true);
      }
    } catch (error) {
      console.error("OTP request error:", error);
      setError(error.response?.data?.error || 'Failed to request verification code');
    } finally {
      setIsLoading(false); // Re-enable button
    }
  };

  const handleVerificationSuccess = () => {
    // After OTP verification, create the actual user account
    (async () => {
      setIsLoading(true); // Disable during account creation
      try {
        // Use /auth/signup endpoint instead of /users
        const response = await api.post('/auth/signup', {
          name: form.fullName,
          username: form.username,
          email: form.email,
          password: form.password,
          phoneNumber: form.phoneNumber || undefined
        });
        
        const data = response.data;
        if (data) {
          setSuccess('Account created and verified! You can now log in.');
          setForm({ fullName: '', username: '', email: '', password: '', confirmPassword: '', phoneNumber: '' });
          setPasswordError('');
          setConfirmPasswordError('');
          
          // Redirect to login after 2 seconds
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        }
      } catch (error) {
        console.error('Create user error:', error);
        setError(error.response?.data?.error || 'Registration failed');
        setIsLoading(false); // Re-enable button on error
      }
    })();
  };
  
  return (
    <ThemeProvider theme={poppinsTheme}>
      <Box className="signup-root">
        <Paper elevation={0} className="signup-left">
          <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
            <img src="/Logos/SBLogo.png" alt="SBLogo" className="signup-logo" />
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
          <Box style={{ maxWidth: '400px', margin: '0 auto' }}>
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
            label="Phone Number" 
            name="phoneNumber"
            value={form.phoneNumber}
            onChange={handleChange}
            variant="outlined" 
            fullWidth 
            margin="normal" 
            className="signup-input" 
            placeholder="+63"
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
                     <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              className="signup-create-btn"
              style={{ fontFamily: 'Poppins, sans-serif' }}
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Create'}
            </Button>
          </Box>
          </form>
          <Box style={{ textAlign: 'center', marginTop: '16px' }}>
            <Typography variant="body2" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.9rem' }}>
              Already have an account? <a href="/login" style={{ color: '#1976d2', textDecoration: 'none', fontWeight: '500' }}>Sign in</a>
            </Typography>
          </Box>
        </Paper>
        <Box className="signup-right">
          <img src="/Logos/login-right.gif" alt="Sign Up Animation" className="signup-right-gif" />
        </Box>
        
        <AccountVerificationModal
          open={showVerificationModal}
          onClose={() => setShowVerificationModal(false)}
          email={form.email}
          onVerificationSuccess={handleVerificationSuccess}
        />
      </Box>
    </ThemeProvider>
  );
};

export default SignUp;
