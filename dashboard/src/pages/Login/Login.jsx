
import React from "react";
import { Box, Button, TextField, Typography, InputAdornment, IconButton, Divider, Paper, ThemeProvider, createTheme, Checkbox, FormControlLabel } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import GoogleIcon from "@mui/icons-material/Google"; 
import AccountVerificationModal from './AccountVerificationModal';

import './Login.css';


const poppinsTheme = createTheme({
  typography: {
    fontFamily: 'Poppins, sans-serif',
  },
});

//papi luke pogi sana ma crush back sksk

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

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    console.log("Login form submission started"); 
    console.log("Login form data:", { email: form.email, hasPassword: !!form.password }); 
    
    try {
      console.log("Making login API call to:", `${API_BASE_URL}/auth/login`); 
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password
        })
      });
      
      console.log("Login API Response status:", res.status); 
      const data = await res.json();
      console.log("Login API Response data:", data); 
      
      if (!res.ok) {
        setError(data.error || "Login failed");
      } else {
        console.log("Login successful, requesting OTP..."); 
        
       
        try {
          const otpResponse = await fetch(`${API_BASE_URL}/auth/request-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email })
          });
          console.log("OTP request status:", otpResponse.status); 
        } catch (otpError) {
          console.log("OTP request failed:", otpError); 
          // Continue even if OTP request fails
        }
        
        console.log("Setting login modal to true"); 
        setShowVerificationModal(true);
      }
    } catch (error) {
      console.error("Login network error details:", error); 
      
      // Temporary lang for ui testing
      if (error.message.includes('fetch')) {
        console.log("Server seems to be down, showing login modal anyway for testing..."); 
        setShowVerificationModal(true);
        setError("Server connection failed, but showing verification modal for testing.");
      } else {
        setError("Network error. Please try again.");
      }
    }
  };

  const handleVerificationSuccess = () => {
    setSuccess("Login successful!");
    // redirect na kay dashboard if ever
   
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
                  label={<Typography variant="body2" style={{ fontSize: '0.9rem' }}>Remember me</Typography>}
                  className="login-remember"
                />
                <Typography variant="body2" className="login-forgot">
                  <a href="#">Forgot Password?</a>
                </Typography>
              </Box>
              {error && <Typography color="error">{error}</Typography>}
              {success && <Typography color="primary">{success}</Typography>}
              <Button type="submit" variant="contained" fullWidth className="login-signin-btn">Sign in</Button>
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
