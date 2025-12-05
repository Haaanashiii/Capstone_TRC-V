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
import { VerifiedUser, Email, Timer, Phone } from '@mui/icons-material';
import api from '../Services/api';
import '../../Styles/ServicesCss/AccountVerificationModal.css';

const poppinsTheme = createTheme({
  typography: {
    fontFamily: 'Poppins, sans-serif',
  },
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';

const AccountVerificationModal = ({ open, onClose, email, rememberMe = false, onVerificationSuccess, buttonText = 'Sign in to your account', userType = 'user' }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(300);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('email'); // 'email' or 'phone'

  const [isResending, setIsResending] = useState(false);
  const [canVerify, setCanVerify] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false); 
  const [resendCooldown, setResendCooldown] = useState(0);
  const [userPhoneNumber, setUserPhoneNumber] = useState(null);
  const [isLoadingPhoneNumber, setIsLoadingPhoneNumber] = useState(false);

  // Fetch user's phone number from backend (only for non-admin users)
  useEffect(() => {
    const fetchUserPhoneNumber = async () => {
      // Skip phone fetch for admin accounts
      if (userType === 'admin') {
        return;
      }

      if (open && email) {
        setIsLoadingPhoneNumber(true);
        try {
          const response = await api.get('/users/account', {
            params: { email }
          });
          if (response.data && response.data.phoneNumber) {
            setUserPhoneNumber(response.data.phoneNumber);
          }
        } catch (error) {
          console.error('Failed to fetch user phone number:', error);
          // Phone number is optional, so we don't set error
        } finally {
          setIsLoadingPhoneNumber(false);
        }
      }
    };

    fetchUserPhoneNumber();
  }, [open, email, userType]); 

 
 

  // Reset OTP and timer when modal opens
  useEffect(() => {
    if (open) {
      setOtp(['', '', '', '', '', '']);
      setTimeLeft(300);
      setError('');
      setCanVerify(false);
      setIsVerifying(false);
      setResendCooldown(60);
      // Admins MUST use email, users default to email
      setDeliveryMethod('email');
      const timer = setTimeout(() => setCanVerify(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [open, userType]);

  // Countdown for resend OTP cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendCooldown]);

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
    setIsVerifying(true);
    setError('');
    try {
      const response = await api.post('/auth/verify-otp', {
        email: email,
        otp: otpCode,
        rememberMe: rememberMe, // Pass rememberMe flag to create trusted device token
      });
      const data = response.data;
      if (data) {
        onVerificationSuccess();
        onClose();
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Invalid verification code');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setIsResending(true);
    setError('');
    try {
      const response = await api.post('/auth/request-otp', {
        email: email,
        phoneNumber: deliveryMethod === 'phone' ? userPhoneNumber : undefined,
        deliveryMethod: deliveryMethod,
      });
      if (response.data) {
        setTimeLeft(300); // Reset timer to 5 minutes
        setOtp(['', '', '', '', '', '']);
        setResendCooldown(60); // Reset cooldown to 1 minute
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  const handleTryAnotherWay = async () => {
    // Admins cannot switch away from email
    if (userType === 'admin') {
      setError('Admins must use email verification. SMS is not available.');
      return;
    }

    setIsResending(true);
    setError('');
    setSuccess('');
    
    try {
      const newMethod = deliveryMethod === 'email' ? 'phone' : 'email';
      
      // Only switch to phone if user has phone number and current method is email
      if (newMethod === 'phone' && !userPhoneNumber) {
        setError('Phone number not available. Unable to switch to SMS.');
        setIsResending(false);
        return;
      }

      const response = await api.post('/auth/request-otp', {
        email: email,
        phoneNumber: newMethod === 'phone' ? userPhoneNumber : undefined,
        deliveryMethod: newMethod,
      });
      
      if (response.data) {
        setDeliveryMethod(newMethod);
        setTimeLeft(300);
        setOtp(['', '', '', '', '', '']);
        setResendCooldown(60);
        const method = newMethod === 'phone' ? 'phone number' : 'email';
        setSuccess(`OTP sent to your ${method}`);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to switch delivery method');
    } finally {
      setIsResending(false);
    }
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

  const maskPhoneNumber = (phone) => {
    if (!phone) return '';
    // Handle both 09123456789 and +639123456789 formats
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      return `****${digits.slice(-4)}`;
    }
    return phone;
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
              
              {deliveryMethod === 'email' ? (
                <Typography variant="body1" className="verification-email">
                  to your email address: <strong>{maskEmail(email)}</strong>
                </Typography>
              ) : (
                <Typography variant="body1" className="verification-email">
                  to your phone number: <strong>{maskPhoneNumber(userPhoneNumber)}</strong>
                </Typography>
              )}
              
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
                    disabled={isResending || resendCooldown > 0}
                    className="link-button try-again-btn"
                  >
                    {isResending
                      ? 'RESENDING...'
                      : resendCooldown > 0
                        ? `RESEND CODE (${resendCooldown}s)`
                        : 'RESEND CODE'}
                  </button>
                </Typography>

                <Typography variant="caption" sx={{ display: 'block', marginTop: 1, color: '#ff9800', fontSize: '0.85rem' }}>
                  💡 Tip: Check your spam or junk folder if you can't find the verification code in your inbox.
                </Typography>

                {/* Only show alternative method for regular users, not admins */}
                {userType !== 'admin' && userPhoneNumber && (
                  <Typography variant="body2" className="verification-alternative">
                    Or{' '}
                    <button
                      onClick={handleTryAnotherWay}
                      className="link-button try-another-btn"
                      disabled={isResending}
                    >
                      {deliveryMethod === 'email' 
                        ? 'try SMS instead' 
                        : 'try email instead'}
                    </button>
                  </Typography>
                )}

                {/* Show admin-only message */}
                {userType === 'admin' && (
                  <Typography variant="caption" sx={{ display: 'block', marginTop: 1, color: 'info.main' }}>
                    Admin accounts use email verification only for security.
                  </Typography>
                )}
              </Box>

              <Button
                variant="contained"
                fullWidth
                className="verification-submit-btn"
                onClick={handleVerify}
                disabled={otp.join('').length !== 6 || !canVerify || isVerifying}
              >
                {isVerifying
                  ? 'Verifying...'
                  : canVerify
                    ? buttonText
                    : 'Please wait...'}
              </Button>
            </Box>
          </Paper>
        </Box>
      </Modal>
    </ThemeProvider>
  );
};

export default AccountVerificationModal;