/**
 * ConfirmDialog Component
 * A reusable MUI-based confirmation dialog to replace window.confirm()
 * Provides better UX, accessibility, and security for critical actions.
 * 
 * @component
 * @example
 * <ConfirmDialog
 *   open={dialogOpen}
 *   title="Confirm Action"
 *   message="Are you sure you want to proceed?"
 *   confirmText="Yes, proceed"
 *   cancelText="Cancel"
 *   severity="warning"
 *   onConfirm={handleConfirm}
 *   onCancel={() => setDialogOpen(false)}
 * />
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  CircularProgress,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const SEVERITY_CONFIG = {
  warning: {
    icon: WarningAmberIcon,
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    confirmColor: '#D97706',
  },
  error: {
    icon: ErrorOutlineIcon,
    color: '#EF4444',
    bgColor: '#FEE2E2',
    confirmColor: '#DC2626',
  },
  info: {
    icon: InfoOutlinedIcon,
    color: '#3B82F6',
    bgColor: '#DBEAFE',
    confirmColor: '#2563EB',
  },
  success: {
    icon: CheckCircleOutlineIcon,
    color: '#10B981',
    bgColor: '#D1FAE5',
    confirmColor: '#059669',
  },
};

function ConfirmDialog({
  open,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  severity = 'warning',
  loading = false,
  onConfirm,
  onCancel,
  children,
}) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.warning;
  const IconComponent = config.icon;

  const handleConfirm = () => {
    if (onConfirm && !loading) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    if (onCancel && !loading) {
      onCancel();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        },
      }}
    >
      <DialogTitle 
        id="confirm-dialog-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          pb: 1,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: '50%',
            backgroundColor: config.bgColor,
          }}
        >
          <IconComponent sx={{ fontSize: 28, color: config.color }} />
        </Box>
        <Box sx={{ fontWeight: 600, color: '#1F2937' }}>
          {title}
        </Box>
      </DialogTitle>

      <DialogContent>
        <DialogContentText 
          id="confirm-dialog-description"
          sx={{ color: '#4B5563', fontSize: '0.95rem' }}
        >
          {message}
        </DialogContentText>
        {children}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button
          onClick={handleCancel}
          disabled={loading}
          variant="outlined"
          sx={{
            borderColor: '#D1D5DB',
            color: '#4B5563',
            '&:hover': {
              borderColor: '#9CA3AF',
              backgroundColor: '#F9FAFB',
            },
          }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={loading}
          variant="contained"
          sx={{
            backgroundColor: config.confirmColor,
            '&:hover': {
              backgroundColor: config.color,
            },
            minWidth: 100,
          }}
        >
          {loading ? (
            <CircularProgress size={20} sx={{ color: 'white' }} />
          ) : (
            confirmText
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmDialog;
