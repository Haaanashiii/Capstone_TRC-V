import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePageAccess } from '../hooks/usePageAccess';
import { CircularProgress, Box } from '@mui/material';
import logger from '../utils/logger';

/**
 * Enhanced ProtectedRoute with page-level access control
 * Checks both role and page access from database
 */
const PageProtectedRoute = ({ children, pageKey, fallbackPath = '/dashboard' }) => {
  const location = useLocation();
  
  // Token check
  const token = sessionStorage.getItem('accessToken');
  
  if (!token) {
    logger.warn('[PageProtectedRoute] No token found, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Decode token
  const decodeToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch (error) {
      logger.error('[PageProtectedRoute] Error decoding token:', error);
      return null;
    }
  };

  const decoded = decodeToken(token);
  
  // Check if token is valid
  if (!decoded || decoded.exp * 1000 < Date.now()) {
    logger.warn('[PageProtectedRoute] Token expired or invalid');
    sessionStorage.removeItem('accessToken');
    return <Navigate to="/login" replace />;
  }

  // Check if user is admin
  const adminRoles = ['super-admin', 'sb-admin', 'bplo-admin'];
  if (!adminRoles.includes(decoded.role)) {
    logger.warn('[PageProtectedRoute] Not an admin role:', decoded.role);
    return <Navigate to="/login" replace />;
  }

  // Check page access from database
  const { hasAccess, loading } = usePageAccess(pageKey);

  logger.log(`[PageProtectedRoute] Page: ${pageKey}, Loading: ${loading}, HasAccess: ${hasAccess}, Role: ${decoded?.role}`);

  // Show loading while checking access
  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Redirect if no access
  if (!hasAccess) {
    logger.warn(`[PageProtectedRoute] Access DENIED to ${pageKey} for role: ${decoded.role}`);
    return <Navigate to={fallbackPath} replace state={{ from: location }} />;
  }

  logger.log(`[PageProtectedRoute] Access GRANTED to ${pageKey} for role: ${decoded.role}`);
  return children;
};

export default PageProtectedRoute;
