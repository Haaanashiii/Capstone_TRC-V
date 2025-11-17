import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  // Token is ONLY in sessionStorage (secure, cleared on tab close)
  const token = sessionStorage.getItem('accessToken');
  
  // Check if user is authenticated
  if (!token) {
    console.warn('[ProtectedRoute] No token found, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Decode token to get user info
  const decodeToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch (error) {
      console.error('[ProtectedRoute] Error decoding token:', error);
      return null;
    }
  };

  const decoded = decodeToken(token);
  
  // Check if token is valid (JWT contains: id, role, name, accountType, hasOperator)
  if (!decoded || decoded.exp * 1000 < Date.now()) {
    console.warn('[ProtectedRoute] Token expired or invalid, clearing storage');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('userFranchiseInfo');
    sessionStorage.removeItem('franchiseLinked');
    sessionStorage.removeItem('franchiseMenuReplaced');
    sessionStorage.removeItem('franchiseOwnerUserId');
    return <Navigate to="/login" replace />;
  }

  // Check role if required (supports single role or array of roles)
  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    if (!allowedRoles.includes(decoded.role)) {
      console.warn('[ProtectedRoute] Role mismatch. Required:', allowedRoles, 'Got:', decoded.role);
      return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;