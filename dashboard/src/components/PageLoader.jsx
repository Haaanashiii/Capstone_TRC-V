import React from 'react';
import { Box, CircularProgress, Typography, Fade } from '@mui/material';
import logoImage from '../assets/TRC-vLogo.png';

/**
 * PageLoader Component
 * A unified loading component for consistent loading states across all pages
 * 
 * @param {boolean} loading - Whether the loader should be visible
 * @param {string} message - Optional loading message to display
 * @param {boolean} fullScreen - Whether to show as full-screen overlay (default: false)
 * @param {string} variant - Loading style: 'spinner' | 'logo' | 'skeleton' (default: 'spinner')
 * @param {string} size - Size of the loader: 'small' | 'medium' | 'large' (default: 'medium')
 * @param {boolean} overlay - Whether to show with a background overlay (default: false)
 * @param {number} minHeight - Minimum height for the container (default: 300)
 */
const PageLoader = ({
  loading = true,
  message = 'Loading...',
  fullScreen = false,
  variant = 'spinner',
  size = 'medium',
  overlay = false,
  minHeight = 300,
}) => {
  if (!loading) return null;

  // Size configurations
  const sizeConfig = {
    small: {
      spinner: 32,
      logo: 48,
      fontSize: '0.75rem',
    },
    medium: {
      spinner: 48,
      logo: 72,
      fontSize: '0.875rem',
    },
    large: {
      spinner: 64,
      logo: 96,
      fontSize: '1rem',
    },
  };

  const config = sizeConfig[size] || sizeConfig.medium;

  // Common container styles
  const containerStyles = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    ...(fullScreen
      ? {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          backgroundColor: overlay ? 'rgba(255, 255, 255, 0.9)' : '#f5f7fa',
          backdropFilter: overlay ? 'blur(4px)' : 'none',
        }
      : {
          minHeight: minHeight,
          width: '100%',
          ...(overlay && {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(2px)',
            zIndex: 10,
            borderRadius: 'inherit',
          }),
        }),
  };

  // Render based on variant
  const renderLoader = () => {
    switch (variant) {
      case 'logo':
        return (
          <Box
            sx={{
              animation: 'pulse 1.5s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': {
                  transform: 'scale(1)',
                  opacity: 1,
                },
                '50%': {
                  transform: 'scale(1.05)',
                  opacity: 0.8,
                },
              },
            }}
          >
            <img
              src={logoImage}
              alt="Loading..."
              style={{
                width: config.logo,
                height: config.logo,
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 8px rgba(10, 53, 107, 0.2))',
              }}
            />
          </Box>
        );

      case 'skeleton':
        return (
          <Box sx={{ width: '100%', maxWidth: 400, px: 3 }}>
            {/* Skeleton loading bars */}
            <Box
              sx={{
                height: 24,
                width: '60%',
                borderRadius: 1,
                mb: 2,
                background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                '@keyframes shimmer': {
                  '0%': { backgroundPosition: '-200% 0' },
                  '100%': { backgroundPosition: '200% 0' },
                },
              }}
            />
            <Box
              sx={{
                height: 16,
                width: '100%',
                borderRadius: 1,
                mb: 1,
                background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
            <Box
              sx={{
                height: 16,
                width: '80%',
                borderRadius: 1,
                background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
          </Box>
        );

      case 'spinner':
      default:
        return (
          <CircularProgress
            size={config.spinner}
            thickness={4}
            sx={{
              color: '#0A356B',
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              },
            }}
          />
        );
    }
  };

  return (
    <Fade in={loading} timeout={300}>
      <Box sx={containerStyles}>
        {renderLoader()}
        {message && variant !== 'skeleton' && (
          <Typography
            sx={{
              color: '#6B7280',
              fontSize: config.fontSize,
              fontWeight: 500,
              textAlign: 'center',
              mt: 1,
            }}
          >
            {message}
          </Typography>
        )}
      </Box>
    </Fade>
  );
};

/**
 * TableLoader Component
 * Specialized loader for table content
 */
export const TableLoader = ({ rows = 5, cols = 4 }) => {
  return (
    <Box sx={{ width: '100%', p: 2 }}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box
          key={rowIndex}
          sx={{
            display: 'flex',
            gap: 2,
            mb: 1.5,
            animation: 'fadeIn 0.3s ease-out',
            animationDelay: `${rowIndex * 0.05}s`,
            animationFillMode: 'both',
            '@keyframes fadeIn': {
              from: { opacity: 0 },
              to: { opacity: 1 },
            },
          }}
        >
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Box
              key={colIndex}
              sx={{
                flex: colIndex === 0 ? 2 : 1,
                height: 40,
                borderRadius: 1,
                background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                animationDelay: `${colIndex * 0.1}s`,
                '@keyframes shimmer': {
                  '0%': { backgroundPosition: '-200% 0' },
                  '100%': { backgroundPosition: '200% 0' },
                },
              }}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
};

/**
 * CardLoader Component
 * Skeleton loader for KPI cards
 */
export const CardLoader = ({ count = 4 }) => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: `repeat(${Math.min(count, 4)}, 1fr)`,
        },
        gap: 3,
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Box
          key={index}
          sx={{
            p: 3,
            borderRadius: 3,
            backgroundColor: '#ffffff',
            boxShadow: '0 2px 8px rgba(10, 53, 107, 0.08)',
            animation: 'fadeInUp 0.4s ease-out',
            animationDelay: `${index * 0.1}s`,
            animationFillMode: 'both',
            '@keyframes fadeInUp': {
              from: { opacity: 0, transform: 'translateY(20px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 2,
                background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                '@keyframes shimmer': {
                  '0%': { backgroundPosition: '-200% 0' },
                  '100%': { backgroundPosition: '200% 0' },
                },
              }}
            />
            <Box sx={{ flex: 1 }}>
              <Box
                sx={{
                  height: 14,
                  width: '70%',
                  borderRadius: 1,
                  mb: 1,
                  background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
              <Box
                sx={{
                  height: 32,
                  width: '50%',
                  borderRadius: 1,
                  background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default PageLoader;
