
import React, { useState } from "react";
import { Box, Button, TextField, Typography, InputAdornment, IconButton, Divider, Paper, ThemeProvider, createTheme } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import GoogleIcon from "@mui/icons-material/Google";
import AccountVerificationModal from '../AccountVerificationModal';
import './SignUp.css';

const poppinsTheme = createTheme({
  typography: {
    fontFamily: 'Poppins, sans-serif',
  },
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;



const SignUp = () => {
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

  const handleClickShowPassword = () => setShowPassword((show) => !show);
  const handleClickShowConfirmPassword = () => setShowConfirmPassword((show) => !show);


  const validatePassword = (password) => {
    if (password.length < 12) {
      return "Password must be at least 12 characters long";
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
    
    try {
      console.log("Making API call to:", `${API_BASE_URL}/users`); // Debug log
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.fullName,
          username: form.username,
          email: form.email,
          password: form.password
        })
      });
      
      console.log("API Response status:", res.status); // Debug log
      const data = await res.json();
      console.log("API Response data:", data); // Debug log
      
      if (!res.ok) {
        setError(data.error || "Registration failed");
      } else {
        console.log("Registration successful, requesting OTP..."); // Debug log
        
        // If registration is successful, request OTP and show verification modal
        try {
          const otpResponse = await fetch(`${API_BASE_URL}/auth/request-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email })
          });
          console.log("OTP request status:", otpResponse.status); // Debug log
        } catch (otpError) {
          console.log("OTP request failed:", otpError); // Debug log
          // Continue even if OTP request fails
        }
        
        console.log("Setting modal to true"); // Debug log
        setShowVerificationModal(true);
      }
    } catch (error) {
      console.error("Network error details:", error); // Debug log
      
      // Temporary: Show modal even if server is down (for testing)
      if (error.message.includes('fetch')) {
        console.log("Server seems to be down, showing modal anyway for testing..."); // Debug log
        setShowVerificationModal(true);
        setError("Server connection failed, but showing verification modal for testing.");
      } else {
        setError("Network error. Please try again.");
      }
    }
  };

  const handleVerificationSuccess = () => {
    setSuccess("Account created and verified! You can now log in.");
    setForm({ fullName: "", username: "", email: "", password: "", confirmPassword: "" });
    setPasswordError("");
    setConfirmPasswordError("");
    // Optionally redirect to login page
    // window.location.href = '/login';
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
            >
              Create
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
