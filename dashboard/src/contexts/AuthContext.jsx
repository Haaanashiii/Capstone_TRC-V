import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, decodeToken, getToken, setTokens, clearTokens } from '../pages/Services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    console.warn('useAuth was called outside of an AuthProvider. Returning fallback auth object. Make sure your app is wrapped with <AuthProvider> in src/main.jsx');
    return {
      user: null,
      login: async () => {},
      logout: async () => {},
      loading: false
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch user details from backend
   * Uses secure authAPI.getMe() endpoint
   */
  const fetchUserDetails = async () => {
    try {
      const token = getToken();
      if (!token) {
        console.info('[AuthContext] No token found, skipping user fetch');
        return null;
      }

      const response = await authAPI.getMe();
      return response.data?.user || response.data;
    } catch (error) {
      console.error('[AuthContext] Error fetching user details:', error);
      
      // If token is invalid, clear it
      if (error.response?.status === 401) {
        clearTokens();
      }
      
      return null;
    }
  };

  /**
   * Initialize authentication state on mount
   * Checks for existing valid token and fetches user data
   */
  useEffect(() => {
    console.info('[AuthContext] Initializing authentication');
    
    const initializeAuth = async () => {
      try {
        const token = getToken();
        
        if (!token) {
          console.info('[AuthContext] No token found');
          setLoading(false);
          return;
        }

        // Decode token for basic info (UX only - server validates)
        const decoded = decodeToken(token);
        
        if (!decoded) {
          console.warn('[AuthContext] Invalid token, clearing...');
          clearTokens();
          setLoading(false);
          return;
        }

        // Check expiration (with buffer)
        const isExpired = decoded.exp * 1000 <= Date.now();
        
        if (isExpired) {
          console.warn('[AuthContext] Token expired, clearing...');
          clearTokens();
          setLoading(false);
          return;
        }

        // Token valid, fetch full user details from backend
        const userDetails = await fetchUserDetails();
        
        if (userDetails) {
          // Merge decoded token data with backend user data
          setUser({
            id: decoded.id,
            role: decoded.role,
            ...userDetails
          });
          console.info('[AuthContext] User authenticated:', { 
            id: decoded.id, 
            role: decoded.role,
            name: userDetails.name 
          });
        } else {
          // Backend fetch failed, use token data as fallback
          console.warn('[AuthContext] Using token data as fallback');
          setUser({
            id: decoded.id,
            role: decoded.role,
            name: decoded.name || 'User'
          });
        }
      } catch (error) {
        console.error('[AuthContext] Initialization error:', error);
        clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Login user
   * @param {string} accessToken - JWT access token from backend
   * @param {object} userInfo - User information from backend
   */
  const login = async (accessToken, userInfo) => {
    try {
      // Use secure setTokens function (stores in sessionStorage only)
      const success = setTokens(accessToken);
      
      if (!success) {
        throw new Error('Failed to store authentication token');
      }

      // Set user state
      setUser(userInfo);
      
      console.info('[AuthContext] User logged in:', { 
        id: userInfo.id, 
        role: userInfo.role,
        name: userInfo.name 
      });
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      throw error;
    }
  };

  /**
   * Logout user
   * Clears tokens from frontend and notifies backend
   */
  const logout = async () => {
    try {
      console.info('[AuthContext] Logging out user');
      
      // Call backend logout endpoint (clears HTTP-only cookie)
      await authAPI.logout();
      
      // Clear frontend state
      setUser(null);
      
      console.info('[AuthContext] Logout successful');
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
      
      // Even if backend call fails, clear frontend state
      clearTokens();
      setUser(null);
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