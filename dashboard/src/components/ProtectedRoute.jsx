import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const token = localStorage.getItem('accessToken');
  
  // Check if user is authenticated
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Decode token to get user info
  const decodeToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  const decoded = decodeToken(token);
  
  // Check if token is valid
  if (!decoded || decoded.exp * 1000 < Date.now()) {
    localStorage.removeItem('accessToken');
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  if (requiredRole && decoded.role !== requiredRole) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;