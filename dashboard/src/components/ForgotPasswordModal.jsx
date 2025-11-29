import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  IconButton,
  Alert,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import { Close, Visibility, VisibilityOff } from '@mui/icons-material';
import api from '../pages/Services/api';

const ForgotPasswordModal = ({ open, onClose }) => {
  const [step, setStep] = useState(1); // 1: Email/Phone, 2: OTP & New Password
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleClose = () => {
    // Reset all states
    setStep(1);
    setEmail('');
    setPhoneNumber('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError('');
    setSuccess('');
    onClose();
  };

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate that at least one field is filled
    if (!email && !phoneNumber) {
      setError('Please enter either an email address or phone number.');
      return;
    }

    setLoading(true);

    try {
      const payload = {};
      if (email) payload.email = email;
      if (phoneNumber) payload.phoneNumber = phoneNumber;

      const response = await api.post('/auth/forgot-password', payload);
      setSuccess(response.data.message || 'OTP sent successfully!');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

    // Validate password strength
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long!');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        otp,
        newPassword
      };
      if (email) payload.email = email;
      if (phoneNumber) payload.phoneNumber = phoneNumber;

      const response = await api.post('/auth/reset-password', payload);
      setSuccess(response.data.message || 'Password reset successfully!');
      
      // Close modal after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          fontFamily: 'Poppins, sans-serif'
        }
      }}
    >
      <DialogTitle sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" component="span" sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>
            Forgot Password
          </Typography>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {step === 1 ? (
          // Step 1: Request OTP
          <Box component="form" onSubmit={handleRequestOTP}>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', fontFamily: 'Poppins, sans-serif' }}>
              Enter your email address or phone number and we'll send you an OTP to reset your password.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2, fontFamily: 'Poppins, sans-serif' }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 2, fontFamily: 'Poppins, sans-serif' }}>
                {success}
              </Alert>
            )}

            <TextField
              label="Email Address *"
              placeholder="example@gmail.com"
              type="email"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              sx={{ mb: 2, fontFamily: 'Poppins, sans-serif' }}
              InputProps={{
                sx: { fontFamily: 'Poppins, sans-serif' }
              }}
              InputLabelProps={{
                sx: { fontFamily: 'Poppins, sans-serif' }
              }}
            />

            <Typography variant="body2" sx={{ mb: 1, textAlign: 'center', color: 'text.secondary', fontFamily: 'Poppins, sans-serif', fontStyle: 'italic' }}>
              OR
            </Typography>

            <TextField
              label="Phone Number *"
              placeholder="09XX XXX XXXX"
              type="tel"
              fullWidth
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={loading}
              sx={{ mb: 1, fontFamily: 'Poppins, sans-serif' }}
              InputProps={{
                sx: { fontFamily: 'Poppins, sans-serif' }
              }}
              InputLabelProps={{
                sx: { fontFamily: 'Poppins, sans-serif' }
              }}
            />

            <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary', fontFamily: 'Poppins, sans-serif', fontStyle: 'italic' }}>
              * At least one field is required
            </Typography>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                mt: 1,
                py: 1.2,
                textTransform: 'none',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 500,
                fontSize: '1rem'
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Send OTP'}
            </Button>
          </Box>
        ) : (
          // Step 2: Verify OTP and Reset Password
          <Box component="form" onSubmit={handleResetPassword}>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', fontFamily: 'Poppins, sans-serif' }}>
              Enter the OTP sent to {email ? 'your email' : 'your phone'} and your new password.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2, fontFamily: 'Poppins, sans-serif' }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 2, fontFamily: 'Poppins, sans-serif' }}>
                {success}
              </Alert>
            )}

            <TextField
              label="OTP Code"
              fullWidth
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              disabled={loading}
              sx={{ mb: 2, fontFamily: 'Poppins, sans-serif' }}
              InputProps={{
                sx: { fontFamily: 'Poppins, sans-serif' }
              }}
              InputLabelProps={{
                sx: { fontFamily: 'Poppins, sans-serif' }
              }}
            />

            <TextField
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
              sx={{ mb: 2, fontFamily: 'Poppins, sans-serif' }}
              InputProps={{
                sx: { fontFamily: 'Poppins, sans-serif' },
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              InputLabelProps={{
                sx: { fontFamily: 'Poppins, sans-serif' }
              }}
            />

            <TextField
              label="Confirm New Password"
              type={showConfirmPassword ? 'text' : 'password'}
              fullWidth
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              sx={{ mb: 2, fontFamily: 'Poppins, sans-serif' }}
              InputProps={{
                sx: { fontFamily: 'Poppins, sans-serif' },
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                      size="small"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              InputLabelProps={{
                sx: { fontFamily: 'Poppins, sans-serif' }
              }}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => setStep(1)}
                disabled={loading}
                sx={{
                  py: 1.2,
                  textTransform: 'none',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500
                }}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
                sx={{
                  py: 1.2,
                  textTransform: 'none',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Reset Password'}
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ForgotPasswordModal;
