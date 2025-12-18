/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the entire app.
 * 
 * Security: Error details are only shown in development mode or to admin users.
 * 
 * @component
 * @example
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */

import React, { Component } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import HomeIcon from '@mui/icons-material/Home';
import { logger } from '../utils/logger';

// Check if user has admin role from localStorage (safe fallback approach)
const isAdminUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return false;
    const user = JSON.parse(userStr);
    return user?.role === 'admin' || user?.role === 'super-admin' || user?.role === 'bplo-admin' || user?.role === 'sb-admin';
  } catch {
    return false;
  }
};

// Check if error details should be shown (dev mode OR admin user)
const shouldShowErrorDetails = () => {
  return import.meta.env.DEV || isAdminUser();
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console (in production, this would go to a logging service)
    logger.error('[ErrorBoundary] Caught error:', {
      message: error?.message || 'Unknown error',
      stack: error?.stack?.substring(0, 500) || 'No stack trace',
      componentStack: errorInfo?.componentStack?.substring(0, 500) || 'No component stack'
    });

    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: '#f5f7fa',
            padding: 3,
          }}
        >
          <Paper
            elevation={3}
            sx={{
              padding: 4,
              borderRadius: 3,
              maxWidth: 500,
              width: '100%',
              textAlign: 'center',
            }}
          >
            <ErrorOutlineIcon 
              sx={{ 
                fontSize: 80, 
                color: '#EF4444',
                mb: 2 
              }} 
            />
            
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 700, 
                color: '#0A356B',
                mb: 1 
              }}
            >
              Something went wrong
            </Typography>
            
            <Typography 
              variant="body1" 
              sx={{ 
                color: '#6B7280',
                mb: 3 
              }}
            >
              We're sorry, but an unexpected error occurred. 
              Please try refreshing the page or return to the home page.
            </Typography>

            {/* Only show error details in development OR for admin users */}
            {shouldShowErrorDetails() && this.state.error && (
              <Box
                sx={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 2,
                  padding: 2,
                  mb: 3,
                  textAlign: 'left',
                  maxHeight: 150,
                  overflow: 'auto',
                }}
              >
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontFamily: 'monospace',
                    color: '#991B1B',
                    wordBreak: 'break-word'
                  }}
                >
                  {this.state.error.toString()}
                </Typography>
                {import.meta.env.DEV && (
                  <Typography 
                    variant="caption" 
                    component="div"
                    sx={{ 
                      mt: 1,
                      fontStyle: 'italic',
                      color: '#6B7280',
                      fontSize: '0.65rem'
                    }}
                  >
                    (Detailed error info visible in dev mode or to admin users only)
                  </Typography>
                )}
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleRefresh}
                sx={{
                  backgroundColor: '#0A356B',
                  '&:hover': { backgroundColor: '#072a56' },
                }}
              >
                Refresh Page
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<HomeIcon />}
                onClick={this.handleGoHome}
                sx={{
                  borderColor: '#0A356B',
                  color: '#0A356B',
                  '&:hover': { borderColor: '#072a56', backgroundColor: '#f0f4f8' },
                }}
              >
                Go to Home
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
