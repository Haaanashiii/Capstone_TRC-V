import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Function to decode JWT token and extract user info
  const decodeToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // Function to fetch user details from the server
  const fetchUserDetails = async (userId) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return null;

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Error fetching user details:', error);
      return null;
    }
  };

  // Initialize user from token
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          const decoded = decodeToken(token);
          if (decoded && decoded.exp * 1000 > Date.now()) {
            // Token is valid, fetch full user details
            const userDetails = await fetchUserDetails(decoded.id);
            if (userDetails) {
              setUser({
                id: decoded.id,
                role: decoded.role,
                ...userDetails
              });
            } else {
              // Fallback to basic info from token
              setUser({
                id: decoded.id,
                role: decoded.role,
                name: 'User' // Default name
              });
            }
          } else {
            // Token expired, remove it
            localStorage.removeItem('accessToken');
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        localStorage.removeItem('accessToken');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = (token, userInfo) => {
    localStorage.setItem('accessToken', token);
    setUser(userInfo);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;