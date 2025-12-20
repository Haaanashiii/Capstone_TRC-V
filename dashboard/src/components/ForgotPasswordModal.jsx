import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  Typography,
  Box,
  IconButton,
  Alert,
  CircularProgress,
  InputAdornment,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { Close, Visibility, VisibilityOff, CheckCircle } from '@mui/icons-material';
import api from '../pages/Services/api';
import logger from '../utils/logger';

const ForgotPasswordModal = ({ open, onClose }) => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP Verification, 3: New Password
  const [email, setEmail] = useState('');
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
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError('');
    setSuccess('');
    onClose();
  };

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate email
    if (!email || email.trim() === '') {
      setError('Please enter your email address.');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { email, deliveryMethod: 'email' });
      setSuccess('OTP sent successfully to your email!');
      setTimeout(() => {
        setSuccess('');
        setStep(2);
      }, 1500);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to send OTP. Please try again.';
      setError(errorMsg);
      logger.error('[Forgot Password] Step 1 error:', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate OTP
    if (!otp || otp.trim() === '') {
      setError('Please enter the OTP code.');
      return;
    }

    if (otp.length !== 6) {
      setError('OTP must be exactly 6 digits.');
      return;
    }

    setLoading(true);

    try {
      // Just verify the OTP, don't reset password yet
      const response = await api.post('/auth/verify-otp', { email, otp, purpose: 'password-reset' });
      setSuccess('OTP verified successfully!');
      setTimeout(() => {
        setSuccess('');
        setStep(3);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate new password is provided
    if (!newPassword || newPassword.trim() === '') {
      setError('Please enter a new password.');
      return;
    }

    if (!confirmPassword || confirmPassword.trim() === '') {
      setError('Please confirm your password.');
      return;
    }

    // Validate password strength
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/reset-password', {
        email,
        otp,
        newPassword
      });
      setSuccess(response.data.message || 'Password reset successfully!');
      
      // Close modal after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to reset password. Please try again.';
      setError(errorMsg);
      logger.error('[Forgot Password] Step 3 error:', errorMsg);
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
            Reset Password
          </Typography>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Stepper */}
        <Stepper activeStep={step - 1} sx={{ mb: 3 }}>
          <Step>
            <StepLabel>Email</StepLabel>
          </Step>
          <Step>
            <StepLabel>Verify OTP</StepLabel>
          </Step>
          <Step>
            <StepLabel>New Password</StepLabel>
          </Step>
        </Stepper>

        {/* Step 1: Email Input */}
        {step === 1 && (
          <Box component="form" onSubmit={handleStep1Submit}>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', fontFamily: 'Poppins, sans-serif' }}>
              Enter your email address to receive an OTP code.
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
              label="Email Address"
              placeholder="example@gmail.com"
              type="email"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              autoFocus
              sx={{ mb: 3, fontFamily: 'Poppins, sans-serif' }}
              InputProps={{
                sx: { fontFamily: 'Poppins, sans-serif' }
              }}
              InputLabelProps={{
                sx: { fontFamily: 'Poppins, sans-serif' }
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
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
        )}

        {/* Step 2: OTP Verification */}
        {step === 2 && (
          <Box component="form" onSubmit={handleStep2Submit}>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', fontFamily: 'Poppins, sans-serif' }}>
              Enter the 6-digit OTP sent to <strong>{email}</strong>
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
              placeholder="000000"
              fullWidth
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              required
              disabled={loading}
              autoFocus
              inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' } }}
              sx={{ mb: 3, fontFamily: 'Poppins, sans-serif' }}
              InputLabelProps={{
                sx: { fontFamily: 'Poppins, sans-serif' }
              }}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  setStep(1);
                  setError('');
                  setSuccess('');
                  setOtp('');
                }}
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
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify OTP'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 3: New Password */}
        {step === 3 && (
          <Box component="form" onSubmit={handleStep3Submit}>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', fontFamily: 'Poppins, sans-serif' }}>
              Create a new password for your account.
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
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
              autoFocus
              sx={{ mb: 2, fontFamily: 'Poppins, sans-serif' }}
              InputProps={{
                sx: { fontFamily: 'Poppins, sans-serif' },
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                      tabIndex={-1}
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
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              fullWidth
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              sx={{ mb: 3, fontFamily: 'Poppins, sans-serif' }}
              InputProps={{
                sx: { fontFamily: 'Poppins, sans-serif' },
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                      size="small"
                      tabIndex={-1}
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

            <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary', fontFamily: 'Poppins, sans-serif' }}>
              ✓ Password must be at least 8 characters
              <br />
              ✓ Cannot be the same as your old password
            </Typography>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  setStep(2);
                  setError('');
                  setSuccess('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
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
