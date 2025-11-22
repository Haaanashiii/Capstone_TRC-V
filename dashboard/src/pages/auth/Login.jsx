
import React from "react";
import { Box, Button, TextField, Typography, InputAdornment, IconButton, Divider, Paper, ThemeProvider, createTheme, Checkbox, FormControlLabel } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import AccountVerificationModal from '../Services/AccountVerificationModal';
import { useNavigate } from 'react-router-dom';
import api, { TokenManager } from '../Services/api';
import { useAuth } from '../../contexts/AuthContext';

import '../../Styles/LoginCss/Login.css';


const poppinsTheme = createTheme({
  typography: {
    fontFamily: 'Poppins, sans-serif',
  },
});

//papi luke pogi sana ma crush back sksksk

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';

const Login = () => {
  const [showPassword, setShowPassword] = React.useState(false);
  const [form, setForm] = React.useState({
    email: "",
    password: ""
  });
  const [rememberMe, setRememberMe] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [showVerificationModal, setShowVerificationModal] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();
  
  // Check for OAuth error in URL params on mount
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    const messageParam = urlParams.get('message');
    
    if (errorParam === 'admin_oauth_not_allowed' && messageParam) {
      setError(decodeURIComponent(messageParam));
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {   
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);
    
    try {
      console.log("Making login API call");
      // Backend accepts 'identifier' which can be username or email
      // rememberMe flag tells backend to use 30-day refresh token instead of 7-day
      const response = await api.post('/auth/login', {
        identifier: form.email,
        password: form.password,
        rememberMe: rememberMe
      });

      const data = response.data;

      // Save accessToken using TokenManager (stores in sessionStorage)
      if (data.accessToken) {
        TokenManager.setTokens(data.accessToken);
        console.log('[Login] Access token stored');
        
        const tokenData = TokenManager.decodeToken(data.accessToken);
        console.log('[Login] JWT contains:', tokenData);
      }

      console.log('[Login] Refresh token stored in HTTP-only cookie by backend');

      // Check if OTP should be skipped (trusted device from previous login)
      if (data.skipOTP) {
        console.log('[Login] Trusted device - skipping OTP verification');
        handleVerificationSuccess();
      } else {
        // Open OTP verification modal
        setShowVerificationModal(true);
      }
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
    
    console.log('[Login] OTP verification successful, checking stored token...');
    
    // Verify token is still in storage
    const token = TokenManager.getAccessToken();
    console.log('[Login] Access token present:', !!token);
    
    if (!token) {
      console.error('[Login] ERROR: No token found after OTP verification!');
      setError('Session expired. Please login again.');
      setIsLoading(false);
      return;
    }
    
    // Decode JWT to get user data (only source of truth)
    let userData = null;
    try {
      userData = TokenManager.decodeToken(token);
      console.log('[Login] Decoded JWT data:', userData);
    } catch (err) {
      console.error('[Login] Failed to decode JWT:', err.message);
      setError('Invalid session. Please login again.');
      setIsLoading(false);
      return;
    }
    
    // Update AuthContext with user data
    if (userData && userData.role) {
      console.log('[Login] Updating AuthContext with user data');
      login(token, {
        id: userData.id,
        role: userData.role,
        name: userData.name,
        firstName: userData.firstName,
        accountType: userData.accountType,
        hasFranchise: userData.hasFranchise,
        hasOperator: userData.hasOperator
      });
    }
    
    // Redirect based on role from JWT
    if (userData && userData.role) {
      console.log('[Login] Role:', userData.role, 'AccountType:', userData.accountType, 'HasFranchise:', userData.hasFranchise);
      console.log('[Login] Attempting navigation to role-based route...');
      
      if (userData.role === 'operator' || userData.role === 'user') {
        // Check if operator has franchise - redirect accordingly
        if (userData.hasFranchise === true) {
          console.log('[Login] Operator has franchise, navigating to /operator/id');
          navigate('/operator/id', { replace: true });
        } else {
          console.log('[Login] Operator has no franchise, navigating to /operator/franchise');
          navigate('/operator/franchise', { replace: true });
        }
      } else if (userData.role === 'sb-admin' || userData.role === 'bplo-admin' || userData.role === 'super-admin') {
        // All admin roles go to /dashboard
        console.log('[Login] Admin role detected, navigating to /dashboard');
        navigate('/dashboard', { replace: true });
      } else {
        console.log('[Login] Unknown role, navigating to /dashboard');
        navigate('/dashboard', { replace: true });
      }
    } else {
      // Fallback if role is not found
      console.error('[Login] ERROR: No role found in JWT!');
      console.error('[Login] JWT payload:', userData);
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
                  control={
                    <Checkbox 
                      size="small" 
                      className="login-checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                  }
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
          rememberMe={rememberMe}
          onVerificationSuccess={handleVerificationSuccess}
        />
      </Box>
    </ThemeProvider>
  );
};

export default Login;
