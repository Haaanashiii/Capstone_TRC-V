import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  ThemeProvider,
  createTheme
} from '@mui/material';
import { VerifiedUser, Email, Timer } from '@mui/icons-material';
import '../../Styles/ServicesCss/AccountVerificationModal.css';

const poppinsTheme = createTheme({
  typography: {
    fontFamily: 'Poppins, sans-serif',
  },
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const AccountVerificationModal = ({ open, onClose, email, onVerificationSuccess }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [error, setError] = useState('');
  const [isResending, setIsResending] = useState(false);

 
 

  // Reset OTP and timer when modal opens
  useEffect(() => {
    if (open) {
      setOtp(['', '', '', '', '', '']);
      setTimeLeft(300);
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (open && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0) {
      // Auto-close modal when timer expires
      onClose();
    }
  }, [open, timeLeft, onClose]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleOtpChange = (index, value) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Auto-focus next input
      if (value !== '' && index < 5) {
        const nextInput = inputRefs.current[index + 1];
        if (nextInput) nextInput.focus();
      }
    }
  };

  const handleKeyDown = (index, e) => {
    
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      const prevInput = inputRefs.current[index - 1];
      if (prevInput) prevInput.focus();
    }
  };

  // Refs for inputs to avoid DOM queries
  const inputRefs = useRef([]);

  const handlePaste = (e, startIndex = 0) => {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData('text');
    const digits = paste.replace(/\D/g, '').split('');
    if (digits.length === 0) return;

    const newOtp = [...otp];
    let writeIndex = startIndex;
    for (let i = 0; i < digits.length && writeIndex < 6; i++, writeIndex++) {
      newOtp[writeIndex] = digits[i];
    }

    setOtp(newOtp);

    // focus first empty after startIndex, or last filled
    const firstEmpty = newOtp.findIndex((d, idx) => idx >= startIndex && d === '');
    const focusIndex = firstEmpty === -1 ? Math.min(writeIndex - 1, 5) : firstEmpty;
    const ref = inputRefs.current[focusIndex];
    if (ref) ref.focus();
  };

  const handleInputFocus = (e) => {
    // select the content for easy replacement when focusing
    e.target.select();
  };

  const handleArrowNavigation = (index, e) => {
    if (e.key === 'ArrowLeft' && index > 0) {
      const prev = inputRefs.current[index - 1];
      if (prev) prev.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      const next = inputRefs.current[index + 1];
      if (next) next.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          otp: otpCode,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onVerificationSuccess();
        onClose();
      } else {
        setError(data.error || 'Invalid verification code');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTimeLeft(300); // Reset timer to 5 minutes
        setOtp(['', '', '', '', '', '']); 
      } else {
        setError(data.error || 'Failed to resend code');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleTryAnotherWay = () => {
    // Close modal and return to login page
    onClose();
  };

  const maskEmail = (email) => {
    if (!email) return '';
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
      return `${localPart}****@${domain}`;
    }
    const maskedLocal = localPart.substring(0, 2) + '****' + localPart.slice(-1);
    return `${maskedLocal}@${domain}`;
  };

  return (
    <ThemeProvider theme={poppinsTheme}>
      <Modal
        open={open}
        onClose={onClose}
        aria-labelledby="verification-modal"
        aria-describedby="verification-modal-description"
        style={{ zIndex: 1300 }}
      >
        <Box className="verification-modal-container">
          <Paper className="verification-modal-paper">
            <Box className="verification-content">
              <Box className="verification-icon-container">
                <VerifiedUser className="verification-icon" />
              </Box>
              
              <Typography variant="h4" className="verification-title">
                Account Verification
              </Typography>
              
              <Typography variant="body1" className="verification-subtitle">
                <Email className="inline-icon" />
                To verify your identity, we have sent a verification code
              </Typography>
              
              <Typography variant="body1" className="verification-email">
                to your email address: <strong>{maskEmail(email)}</strong>
              </Typography>
              
              <Typography variant="body2" className="verification-timer">
                <Timer className="inline-icon" />
                This code will expire in <strong>{formatTime(timeLeft)}</strong>.
              </Typography>

              <Box className="otp-inputs-container">
                {otp.map((digit, index) => (
                  <TextField
                    key={index}
                    id={`otp-${index}`}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => { handleKeyDown(index, e); handleArrowNavigation(index, e); }}
                    onPaste={(e) => handlePaste(e, index)}
                    onFocus={handleInputFocus}
                    variant="outlined"
                    className="otp-input"
                    inputProps={{
                      maxLength: 1,
                      style: { textAlign: 'center', fontSize: '1.5rem', padding: '12px' }
                    }}
                    inputRef={(el) => (inputRefs.current[index] = el)}
                  />
                ))}
              </Box>

              {error && (
                <Typography color="error" className="verification-error">
                  {error}
                </Typography>
              )}

              <Box className="verification-actions">
                <Typography variant="body2" className="verification-resend">
                  Did not receive the code?{' '}
                  <button
                    onClick={handleResendCode}
                    disabled={isResending || timeLeft > 0}
                    className="link-button try-again-btn"
                  >
                    {isResending ? 'RESENDING...' : 'RESEND CODE'}
                  </button>
                </Typography>
                
                <Typography variant="body2" className="verification-alternative">
                  Or{' '}
                  <button
                    onClick={handleTryAnotherWay}
                    className="link-button try-another-btn"
                  >
                    try a different login method
                  </button>
                </Typography>
              </Box>

              <Button
                variant="contained"
                fullWidth
                className="verification-submit-btn"
                onClick={handleVerify}
                disabled={otp.join('').length !== 6}
              >
                Sign in to your account
              </Button>
            </Box>
          </Paper>
        </Box>
      </Modal>
    </ThemeProvider>
  );
};

export default AccountVerificationModal;