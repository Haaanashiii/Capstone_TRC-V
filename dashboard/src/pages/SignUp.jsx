
import React, { useState } from "react";
import { Box, Button, TextField, Typography, InputAdornment, IconButton, Divider, Paper, ThemeProvider, createTheme } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import GoogleIcon from "@mui/icons-material/Google";
import './SignUp.css';

const poppinsTheme = createTheme({
  typography: {
    fontFamily: 'Poppins, sans-serif',
  },
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;



const SignUp = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
        setError("");
    setSuccess("");
    try {
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
      } else {
        setSuccess("Account created! You can now log in.");
        setForm({ fullName: "", username: "", email: "", password: "" });
      }
    } catch (err) {
      setError("Network error. Please try again.");
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
          <TextField label="Full Name" variant="outlined" fullWidth margin="normal" className="signup-input" InputLabelProps={{ style: { fontFamily: 'Poppins, sans-serif' } }} />
          <TextField label="Username" variant="outlined" fullWidth margin="normal" className="signup-input" InputLabelProps={{ style: { fontFamily: 'Poppins, sans-serif' } }} />
          <TextField label="E-mail" variant="outlined" fullWidth margin="normal" className="signup-input" InputLabelProps={{ style: { fontFamily: 'Poppins, sans-serif' } }} />
          <TextField
            label="Password"
            variant="outlined"
            fullWidth
            margin="normal"
            className="signup-input"
            type={showPassword ? "text" : "password"}
            InputLabelProps={{ style: { fontFamily: 'Poppins, sans-serif' } }}
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
          <Button variant="outlined" startIcon={<GoogleIcon />} fullWidth className="signup-google-btn" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Continue with Google
          </Button>
        </Paper>
        <Box className="signup-right">
          <img src="/Logos/login-right.gif" alt="Sign Up Animation" className="signup-right-gif" />
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default SignUp;
