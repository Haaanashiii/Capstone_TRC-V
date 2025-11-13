
import React from "react";
import { Box, Button, TextField, Typography, InputAdornment, IconButton, Divider, Paper, ThemeProvider, createTheme, Checkbox, FormControlLabel } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import GoogleIcon from "@mui/icons-material/Google"; 
import AccountVerificationModal from '../Services/AccountVerificationModal';
import { useNavigate } from 'react-router-dom';
import api, { TokenManager } from '../Services/api';

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
  const [isLoading, setIsLoading] = React.useState(false);

  const navigate = useNavigate();

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {   
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);
    
    // login attempt started (no sensitive data logged)
    
    try {
      console.log("Making login API call");
      // Backend accepts 'identifier' which can be username or email
      const response = await api.post('/auth/login', {
        identifier: form.email, // Can be email or username
        password: form.password
      });

      const data = response.data;

      // Save accessToken using TokenManager (stores in sessionStorage)
      if (data.accessToken) {
        TokenManager.setTokens(data.accessToken);
        console.log('[Login] Access token stored in sessionStorage');
        
        // Store user info in sessionStorage (matching token storage location)
        if (data.user) {
          try {
            sessionStorage.setItem('user', JSON.stringify(data.user));
            console.log('[Login] User data stored:', data.user);
            
            // Log operator info if available
            if (data.user.operator) {
              console.log('[Login] Operator info available:', data.user.operator);
            }
          } catch (err) {
            console.warn('[Login] Failed to store user data:', err);
          }
        }
      }

      // Refresh token is automatically stored in HTTP-only cookie by backend
      console.log('[Login] Refresh token stored in HTTP-only cookie by backend');

      // Open verification modal. The backend has attempted to send the OTP
      // to the user's email on record; the modal will POST to /auth/verify-otp.
      setShowVerificationModal(true);
    } catch (error) {
      console.error("Login error:", error);
      setError(error.response?.data?.error || error.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationSuccess = () => {
    setSuccess("Login successful!");
    setIsLoading(true);
    
    console.log('[Login] OTP verification successful, checking stored data...');
    
    // Verify token is still in storage
    const token = TokenManager.getAccessToken();
    console.log('[Login] Access token present:', !!token);
    
    if (!token) {
      console.error('[Login] ERROR: No token found after OTP verification!');
      setError('Session expired. Please login again.');
      setIsLoading(false);
      return;
    }
    
    // Get user data from sessionStorage (matching token storage location)
    let userData = null;
    try {
      const storedUser = sessionStorage.getItem('user');
      console.log('[Login] Stored user data:', storedUser);
      if (storedUser) {
        userData = JSON.parse(storedUser);
      }
    } catch (err) {
      console.warn('[Login] Failed to parse stored user data:', err.message);
    }
    
    // Fallback to decoding JWT if user data not in sessionStorage
    if (!userData) {
      console.log('[Login] No stored user data, decoding from JWT...');
      try {
        userData = TokenManager.decodeToken(token);
        console.log('[Login] Decoded user data:', userData);
      } catch (err) {
        console.error('[Login] Failed to decode JWT:', err.message);
      }
    }
    
    // Redirect based on role
    if (userData && userData.role) {
      console.log('[Login] User data found. Role:', userData.role, 'Full data:', userData);
      console.log('[Login] Attempting navigation to role-based route...');
      
      if (userData.role === 'operator') {
        console.log('[Login] Navigating to /operator/franchise');
        navigate('/operator/franchise', { replace: true });
      } else if (userData.role === 'sb-admin') {
        navigate('/sb-admin', { replace: true });
      } else if (userData.role === 'bplo-admin') {
        navigate('/bplo-admin', { replace: true });
      } else if (userData.role === 'super-admin') {
        navigate('/sb-admin', { replace: true });
      } else {
        console.log('[Login] Unknown role, navigating to /dashboard');
        navigate('/dashboard', { replace: true });
      }
    } else {
      // Fallback if role is not found
      console.error('[Login] ERROR: No user data or role found!');
      console.error('[Login] userData:', userData);
      setError('Unable to determine user role. Please login again.');
      setIsLoading(false);
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
              <Button type="submit" variant="contained" fullWidth className="login-signin-btn" disabled={isLoading}>
                {isLoading ? 'Signing In...' : 'Sign in'}
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
            disabled={isLoading}
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
