
import React from "react";
import { Box, Button, TextField, Typography, InputAdornment, IconButton, Divider, Paper, ThemeProvider, createTheme, Checkbox, FormControlLabel } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import GoogleIcon from "@mui/icons-material/Google";
import './Login.css';


const poppinsTheme = createTheme({
  typography: {
    fontFamily: 'Poppins, sans-serif',
  },
});


const Login = () => {
  const [showPassword, setShowPassword] = React.useState(false);
  const handleClickShowPassword = () => setShowPassword((show) => !show);

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
            <Typography variant="body2" className="login-label">E-mail</Typography>
            <TextField 
              placeholder="example@gmail.com" 
              variant="outlined" 
              fullWidth 
              className="login-input"
              InputProps={{
                classes: { root: "login-input-root" }
              }}
            />
            
            <Typography variant="body2" className="login-label">Password</Typography>
            <TextField
              placeholder="@#*%"
              variant="outlined"
              fullWidth
              className="login-input"
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
            
            <Button variant="contained" fullWidth className="login-signin-btn">Sign in</Button>
          </Box>
          <Box className="login-divider-box">
            <hr className="login-divider-line" />
            <span className="login-divider-text">OR</span>
            <hr className="login-divider-line" />
          </Box>
          <Button variant="outlined" startIcon={<GoogleIcon />} fullWidth className="login-google-btn">
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
      </Box>
    </ThemeProvider>
  );
};

export default Login;
