import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
   
    console.warn('useAuth was called outside of an AuthProvider. Returning fallback auth object. Make sure your app is wrapped with <AuthProvider> in src/main.jsx');
    return {
      user: null,
      login: () => {},
      logout: () => {},
      loading: false
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);


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
  const fetchUserDetails = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return null;

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // API returns { user: {...} } in other parts of the app; normalize to the inner user object
        return data?.user || data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user details:', error);
      return null;
    }
  };

  // Initialize user from token
  useEffect(() => {
    // helpful debug: indicate provider mounted
    console.info('AuthProvider initializing');
    const initializeAuth = async () => {
      try {
        // Check sessionStorage first, then localStorage for compatibility
        const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
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
            // Token expired, remove it from both storages
            sessionStorage.removeItem('accessToken');
            localStorage.removeItem('accessToken');
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        sessionStorage.removeItem('accessToken');
        localStorage.removeItem('accessToken');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = (token, userInfo) => {
    sessionStorage.setItem('accessToken', token);
    localStorage.setItem('accessToken', token); // Keep for compatibility
    setUser(userInfo);
  };

  const logout = () => {
    sessionStorage.removeItem('accessToken');
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