import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

/**
 * KpiCard Component
 * Reusable KPI card with hover effects, click navigation, and consistent styling
 * 
 * @param {string} title - Card title (e.g., "Total Registered Units")
 * @param {number|string} value - KPI value to display
 * @param {React.Component} icon - MUI Icon component
 * @param {string} iconColor - Icon background color
 * @param {string} route - Navigation route on click
 */
const KpiCard = ({ title, value, icon: Icon, iconColor, route }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (route) {
      navigate(route);
    }
  };

  return (
    <Paper
      elevation={2}
      onClick={handleClick}
      sx={{
        p: 3,
        borderRadius: 3,
        cursor: route ? 'pointer' : 'default',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        backgroundColor: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': route ? {
          elevation: 6,
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 24px rgba(10, 53, 107, 0.15)',
        } : {},
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(90deg, ${iconColor} 0%, ${iconColor}dd 100%)`,
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Icon Container */}
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: iconColor,
            flexShrink: 0,
            boxShadow: `0 4px 12px ${iconColor}40`,
          }}
        >
          {Icon && <Icon sx={{ fontSize: 32, color: '#ffffff' }} />}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              color: '#6B7280',
              fontWeight: 600,
              fontSize: '0.875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              mb: 0.5,
            }}
          >
            {title}
          </Typography>
          <Typography
            variant="h3"
            sx={{
              color: '#0A356B',
              fontWeight: 700,
              fontSize: '2.25rem',
              lineHeight: 1.2,
            }}
          >
            {value}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default KpiCard;
