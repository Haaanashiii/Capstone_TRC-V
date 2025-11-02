
import React from "react";
import { Box, Button, TextField, Typography, InputAdornment, IconButton, Divider, Paper, ThemeProvider, createTheme, Checkbox, FormControlLabel } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import GoogleIcon from "@mui/icons-material/Google"; 
import AccountVerificationModal from '../Services/AccountVerificationModal';
import { useNavigate } from 'react-router-dom';
import { authAPI, setTokens, decodeToken, clearTokens, getToken } from '../Services/api';

import '../../Styles/LoginCss/Login.css';


const poppinsTheme = createTheme({
  typography: {
    fontFamily: 'Poppins, sans-serif',
  },
});

//papi luke pogi sana ma crush back sksksk

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const Login = () => {
  const [showPassword, setShowPassword] = React.useState(false);
  const [form, setForm] = React.useState({
    email: "",
    password: ""
  });
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [showVerificationModal, setShowVerificationModal] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const navigate = useNavigate();

  // Security: Clear any stale tokens on component mount
  React.useEffect(() => {
    // Only clear if not already authenticated
    const token = getToken();
      if (token) {
        const decoded = decodeToken(token);
        if (!decoded || !decoded.role) {
        setError('Invalid token format');
        return;
        }
      // If token is valid, redirect to appropriate page
      if (decoded && decoded.exp && decoded.exp * 1000 > Date.now()) {
        console.log("User already authenticated, redirecting...");
        if (decoded.role === 'operator') {
          navigate('/operator/franchise', { replace: true });
        } else if (decoded.role === 'sb-admin') {
          navigate('/sb-admin', { replace: true });
        } else if (decoded.role === 'bplo-admin') {
          navigate('/bplo-admin', { replace: true });
        }
        return;
      }
    }
    // Clear stale/invalid tokens
    clearTokens();
  }, [navigate]);

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {   
    e.preventDefault();
    setError("");
    setSuccess("");
    
    // Prevent double submission
    if (isSubmitting) return;
    
    // Input validation
    if (!form.email || !form.password) {
      setError("Please enter both email and password");
      return;
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError("Please enter a valid email address");
      return;
    }
    
    setIsSubmitting(true);
    
    // Clear any existing tokens before login (security best practice)
    clearTokens();
    
    try {
      console.log("Initiating secure login...");
      
      // Use secure authAPI.login instead of direct api.post
      const response = await authAPI.login({
        email: form.email.trim().toLowerCase(), // Normalize email
        password: form.password
      });

      const data = response.data;

      // Secure token storage using setTokens (stores in sessionStorage only)
      if (data.accessToken) {
        setTokens(data.accessToken);
        
        // Validate token before proceeding
        const decoded = decodeToken(data.accessToken);
        if (!decoded || !decoded.exp) {
          throw new Error('Invalid token received from server');
        }
        
        console.log("Token validated successfully");
      } else {
        throw new Error('No access token received from server');
      }

      // Open verification modal for 2FA/OTP
      setShowVerificationModal(true);
    } catch (error) {
      console.error("Login error:", error);
      
      // Clear tokens on login failure
      clearTokens();
      
      // Provide user-friendly error messages
      if (error.response?.status === 401) {
        setError("Invalid email or password. Please try again.");
      } else if (error.response?.status === 429) {
        setError("Too many login attempts. Please try again later.");
      } else if (error.response?.status === 403) {
        setError("Your account has been locked. Please contact support.");
      } else if (error.message?.includes('Network')) {
        setError("Network error. Please check your connection.");
      } else {
        setError(error.response?.data?.error || error.response?.data?.message || "Login failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationSuccess = () => {
    setSuccess("Login successful!");
    
    // Use secure token retrieval (no localStorage fallback)
    const token = getToken();
    
    if (!token) {
      setError("Authentication failed. Please try logging in again.");
      clearTokens();
      return;
    }
    
    try {
      // Use secure decodeToken with validation
      const decoded = decodeToken(token);
      
      if (!decoded) {
        throw new Error('Invalid token structure');
      }
      
      // Validate token hasn't expired
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        throw new Error('Token has expired');
      }
      
      // Validate required fields
      if (!decoded.role || !decoded.id) {
        throw new Error('Token missing required fields');
      }
      
      console.log("Authentication verified, redirecting based on role:", decoded.role);
      
      // Role-based secure routing
      switch (decoded.role) {
        case 'operator':
          navigate('/operator/franchise', { replace: true });
          break;
        case 'sb-admin':
          navigate('/sb-admin', { replace: true });
          break;
        case 'bplo-admin':
          navigate('/bplo-admin', { replace: true });
          break;
        case 'admin':
          navigate('/admin', { replace: true });
          break;
        default:
          console.warn('Unknown role:', decoded.role);
          navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('Token validation error:', error);
      setError("Authentication error. Please try logging in again.");
      clearTokens();
      // Don't navigate, stay on login page
    }
  };

  return (
    <ThemeProvider theme={poppinsTheme}>
      <Box className="login-root">
        <Paper elevation={0} className="login-left">
          <Box className="login-header">
            <img src="/Logos/SBLogo.png" alt="SBLogo" className="login-logo" />
            <img src="/Logos/TRC-vLogo.png" alt="QR" className="login-qr" />
          </Box>
          <Typography variant="h4" className="login-title">Sign in</Typography>
          <Box className="login-form">
            <form onSubmit={handleSubmit}>
              <Typography variant="body2" className="login-label">E-mail</Typography>
              <TextField
                placeholder="example@gmail.com"
                variant="outlined"
                fullWidth
                className="login-input"
                name="email"
                value={form.email}
                onChange={handleChange}
                InputProps={{
                  classes: { root: "login-input-root" }
                }}
                required
              />
              <Typography variant="body2" className="login-label">Password</Typography>
              <TextField
                placeholder="@#*%"
                variant="outlined"
                fullWidth
                className="login-input"
                name="password"
                value={form.password}
                onChange={handleChange}
                type={showPassword ? "text" : "password"}
                InputProps={{
                  classes: { root: "login-input-root" },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={handleClickShowPassword} edge="end" size="small">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                required
              />
              <Box className="login-options">
                <FormControlLabel
                  control={<Checkbox size="small" className="login-checkbox" />}
                  label={<Typography variant="body2" style={{ fontSize: '0.9rem', fontFamily: 'Poppins, sans-serif' }}>Remember me</Typography>}
                  className="login-remember"
                />
                <Typography variant="body2" className="login-forgot">
                  <a href="#">Forgot Password?</a>
                </Typography>
              </Box>
              {error && <Typography color="error">{error}</Typography>}
              {success && <Typography color="primary">{success}</Typography>}
              <Button 
                type="submit" 
                variant="contained" 
                fullWidth 
                className="login-signin-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </Box>
          <Box className="login-divider-box">
            <hr className="login-divider-line" />
            <span className="login-divider-text">OR</span>
            <hr className="login-divider-line" />
          </Box>
          <Button
            variant="outlined"
            startIcon={<GoogleIcon />}
            fullWidth
            className="login-google-btn"
            onClick={() => { window.location.href = `${API_BASE_URL}/auth/google`; }}
          >
            Continue with Google
          </Button>
          <Box className="login-create-account">
            <Typography variant="body2" className="login-no-account">
              Don't have an account? <a href="signup" className="login-create-link" >Create now</a>
            </Typography>
          </Box>
        </Paper>
        <Box className="login-right">
          <img src="/Logos/login-right.gif" alt="Login Right" className="login-right-gif" />
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

export default Login;
