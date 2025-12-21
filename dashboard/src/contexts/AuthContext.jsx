import React, { createContext, useContext, useState, useEffect } from 'react';
import logger from '../utils/logger';

// Provide default value to prevent null context errors during initialization
const AuthContext = createContext({
  user: null,
  login: () => {},
  logout: () => {},
  loading: true
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    logger.warn('useAuth was called outside of an AuthProvider. Returning fallback auth object.');
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
      logger.error('Error decoding token:', error);
      return null;
    }
  };

  // Function to fetch user details from the server (for detailed info not in JWT)
  const fetchUserDetails = async () => {
    try {
      // Token is only in sessionStorage (secure storage)
      const token = sessionStorage.getItem('accessToken');
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
      logger.error('Error fetching user details:', error);
      return null;
    }
  };

  // Initialize user from token (JWT is the single source of truth)
  useEffect(() => {
    logger.info('AuthProvider initializing');
    const initializeAuth = async () => {
      try {
        // Token is only in sessionStorage (secure, cleared on tab close)
        const token = sessionStorage.getItem('accessToken');
        if (token) {
          const decoded = decodeToken(token);
          if (decoded && decoded.exp * 1000 > Date.now()) {
            // Token is valid - JWT contains minimal user data
            // Set user from JWT (contains: id, role, name, accountType, hasOperator)
            setUser({
              id: decoded.id,
              role: decoded.role,
              name: decoded.name,
              accountType: decoded.accountType,
              hasOperator: decoded.hasOperator
            });
            
            // If there's saved franchise info for a different user, clear it to avoid leaking data
            try {
              const savedOwnerUserId = sessionStorage.getItem('franchiseOwnerUserId');
              if (savedOwnerUserId && savedOwnerUserId !== decoded.id) {
                sessionStorage.removeItem('userFranchiseInfo');
                sessionStorage.removeItem('franchiseLinked');
                sessionStorage.removeItem('franchiseMenuReplaced');
                sessionStorage.removeItem('franchiseOwnerUserId');
              }
            } catch { /* ignore */ }
          } else {
            // Token expired, remove it
            sessionStorage.removeItem('accessToken');
          }
        }
      } catch (error) {
        logger.error('Error initializing auth:', error);
        sessionStorage.removeItem('accessToken');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = (token, userInfo) => {
    // Store ONLY in sessionStorage (secure, cleared on tab close)
    sessionStorage.setItem('accessToken', token);
    setUser(userInfo);
  };

  const logout = async () => {
    try {
      logger.log('[AuthContext] Logging out...');
      
      // Call backend to invalidate refresh token (HTTP-only cookie)
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
      const token = sessionStorage.getItem('accessToken');
      
      if (token) {
        try {
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include' // Important: Send HTTP-only cookie
          });
          logger.log('[AuthContext] Backend logout successful');
        } catch (error) {
          logger.error('[AuthContext] Backend logout failed:', error);
          // Continue with frontend cleanup even if backend fails
        }
      }
    } catch (error) {
      logger.error('[AuthContext] Logout error:', error);
    } finally {
      // Always clear frontend storage regardless of backend response
      logger.log('[AuthContext] Clearing frontend storage');
      sessionStorage.removeItem('accessToken');
      
      // Clear any franchise-related persisted state to avoid leaking to another user
      sessionStorage.removeItem('userFranchiseInfo');
      sessionStorage.removeItem('franchiseLinked');
      sessionStorage.removeItem('franchiseMenuReplaced');
      sessionStorage.removeItem('franchiseOwnerUserId');
      
      setUser(null);
      logger.log('[AuthContext] Logout complete');
    }
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