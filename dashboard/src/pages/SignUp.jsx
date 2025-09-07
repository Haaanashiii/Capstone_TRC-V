
import React from "react";
import { Box, Button, TextField, Typography, InputAdornment, IconButton, Divider, Paper, ThemeProvider, createTheme } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import GoogleIcon from "@mui/icons-material/Google";
import './SignUp.css';

const poppinsTheme = createTheme({
  typography: {
    fontFamily: 'Poppins, sans-serif',
  },
});

// Images are referenced from public folder using URLs

const SignUp = () => {
  const [showPassword, setShowPassword] = React.useState(false);

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  return (
    <ThemeProvider theme={poppinsTheme}>
      <Box className="signup-root">
        <Paper elevation={0} className="signup-left">
          <Box className="signup-header">
            <img src="/Logos/SBLogo.png" alt="SBLogo" className="signup-logo" />
            <img src="/Logos/TRC-vLogo.png" alt="QR" className="signup-qr" />
          </Box>
          <Typography variant="h4" className="signup-title">Create your Account</Typography>
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
          <Button variant="contained" color="primary" fullWidth className="signup-create-btn" style={{ fontFamily: 'Poppins, sans-serif' }}>Create</Button>
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
          <div className="signup-right-accent"></div>
          <Box className="signup-right-content">
            {/* <img src="/Logos/Arrows.png" alt="Arrows" className="signup-right-arrows" /> */}
            <Box className="signup-right-icons">
              {/* <img src="/Logos/Qr.gif" alt="QR" className="signup-right-qr" /> */}
              <img src="/Logos/Tricy (2).png" alt="Tricycle" className="signup-right-tricy" />
              {/* <img src="/Logos/clipboard.gif" alt="Clipboard" className="signup-right-clipboard" /> */}
            </Box>
            <Typography variant="h3" className="signup-right-title">TRC-V</Typography>
            <Typography variant="body1" className="signup-right-desc">
              TRC-V (Tricycle Verification System) is a digital solution designed to streamline tricycle franchising in the Municipality of Solano. It ensures faster processing, reliable verification, and better service for both drivers and administrators.
            </Typography>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default SignUp;
