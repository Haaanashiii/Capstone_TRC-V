
import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, InputAdornment, IconButton, Divider, Paper, ThemeProvider, createTheme } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import GoogleIcon from "@mui/icons-material/Google";
import AccountVerificationModal from '../Services/AccountVerificationModal';
import { authAPI, clearTokens } from '../Services/api';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClickShowPassword = () => setShowPassword((show) => !show);
  const handleClickShowConfirmPassword = () => setShowConfirmPassword((show) => !show);


  const validatePassword = (password) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must include at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must include at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must include at least one number";
    }
    // Check for common weak passwords
    const weakPasswords = ['password123', 'admin123', 'qwerty123', '123456789'];
    if (weakPasswords.some(weak => password.toLowerCase().includes(weak))) {
      return "Password is too common. Please choose a stronger password";
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
    
    // Prevent double submission
    if (isSubmitting) return;
    
    console.log("Form submission started");
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError("Please enter a valid email address");
      return;
    }
    
    // Username validation 
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(form.username)) {
      setError("Username must be 3-20 characters and contain only letters, numbers, and underscores");
      return;
    }
    
    // Validate password 
    const passwordValidationError = validatePassword(form.password);
    if (passwordValidationError) {
      console.log("Password validation failed:", passwordValidationError);
      setError(passwordValidationError);
      return;
    }
    
    // Validate password match
    const passwordMatchError = validatePasswordMatch(form.password, form.confirmPassword);
    if (passwordMatchError) {
      console.log("Password match failed:", passwordMatchError);
      setError(passwordMatchError);
      return;
    }
    
    // Check if all fields are filled
    if (!form.fullName || !form.username || !form.email || !form.password || !form.confirmPassword) {
      console.log("Missing fields:", form);
      setError("Please fill out all fields");
      return;
    }
    
    setIsSubmitting(true);
    
    console.log("All validations passed, requesting OTP");
    
    try {
      // Use secure authAPI method
      console.log("Requesting OTP for:", form.email);
      const response = await authAPI.requestOTP(form.email.trim().toLowerCase());
      
      if (response.data) {
        setShowVerificationModal(true);
      }
    } catch (error) {
      console.error("OTP request error:", error);
      
      if (error.response?.status === 429) {
        setError('Too many requests. Please try again later.');
      } else if (error.response?.status === 409) {
        setError('An account with this email already exists.');
      } else {
        setError(error.response?.data?.error || 'Failed to request verification code');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationSuccess = async () => {
    try {
      // Clear any existing tokens before signup (security best practice)
      clearTokens();
      
      // Use secure authAPI.signup method
      const response = await authAPI.signup({
        name: form.fullName,
        username: form.username,
        email: form.email.trim().toLowerCase(), // Normalize email
        password: form.password,
        role: 'operator' // Default role for new signups
      });
      
      const data = response.data;
      if (data.user || data.message) {
        setSuccess('Account created and verified! Redirecting to login...');
        
        // Clear sensitive form data from memory (security best practice)
        setForm({ fullName: '', username: '', email: '', password: '', confirmPassword: '' });
        setPasswordError('');
        setConfirmPasswordError('');
        
        // Redirect to login page after few seconds
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      } else {
        throw new Error('Unexpected response format from server');
      }
    } catch (error) {
      console.error('Signup error:', error);
      
      // Handle specific error cases
      if (error.response?.status === 409) {
        setError('An account with this email or username already exists.');
      } else if (error.response?.status === 422) {
        setError('Invalid data provided. Please check your information.');
      } else if (error.response?.status === 400) {
        setError(error.response?.data?.error || 'Please provide all required fields.');
      } else {
        setError(error.response?.data?.error || error.response?.data?.message || 'Registration failed. Please try again.');
      }
    }
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
            helperText={passwordError || "Must be at least 12 characters with uppercase, lowercase, numbers and special characters"}
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
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
            
            <Box className="signup-divider-box">
              <hr className="signup-divider-line" />
            <span className="signup-divider-text">⸻ OR ⸻</span>
            <hr className="signup-divider-line" />
                            </Box>
          <Button
            variant="outlined"
            startIcon={<GoogleIcon />}
            fullWidth
            className="signup-google-btn"
            style={{ fontFamily: 'Poppins, sans-serif' }}
            onClick={() => { window.location.href = `${API_BASE_URL}/auth/google`; }}
          >
            Continue with Google
          </Button>
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
          onVerificationSuccess={handleVerificationSuccess}
        />
      </Box>
    </ThemeProvider>
  );
};

export default SignUp;
