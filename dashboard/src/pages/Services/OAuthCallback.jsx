import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setTokens, decodeToken, clearTokens } from './api';

/**
 * OAuthCallback Component
 * Handles OAuth redirect from backend after Google authentication
 * - Extracts access_token from URL fragment
 * - Stores token securely using setTokens() (sessionStorage only)
 * - Decodes token to determine user role
 * - Redirects to appropriate dashboard
 */
const OAuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Extract token from URL fragment (#access_token=...)
        const hash = window.location.hash.substring(1); // Remove '#'
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');

        if (!accessToken) {
          console.error('OAuthCallback: No access token in URL fragment');
          setError('Authentication failed. No token received from server.');
          
          // Redirect to login after 3 seconds
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        console.log('OAuthCallback: Token received (length:', accessToken.length, ')');

        // Store token securely using TokenManager (sessionStorage only)
        setTokens(accessToken);

        // Clear token from URL for security
        window.history.replaceState(null, '', window.location.pathname);

        // Decode token to get user role (client-side decode for UX only)
        const decoded = decodeToken(accessToken);

        if (!decoded || !decoded.role) {
          console.error('OAuthCallback: Invalid token structure');
          setError('Authentication failed. Invalid token received.');
          clearTokens();
          
          // Redirect to login after 3 seconds
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        console.log('OAuthCallback: User authenticated as', decoded.role);

        // Navigate based on user role
        switch (decoded.role) {
          case 'operator':
            navigate('/operator/franchise', { replace: true });
            break;
          case 'sb-admin':
            navigate('/sb-admin', { replace: true });
            break;
          case 'bplo-admin':
            navigate('/bplo-admin', { replace: true });
            break;
          default:
            console.warn('OAuthCallback: Unknown role:', decoded.role);
            navigate('/', { replace: true });
        }
      } catch (err) {
        console.error('OAuthCallback error:', err);
        setError(`Authentication failed: ${err.message}`);
        clearTokens();
        
        // Redirect to login after 3 seconds
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleOAuthCallback();
  }, [navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      padding: '20px',
      textAlign: 'center'
    }}>
      {error ? (
        <>
          <h2 style={{ color: '#f44336' }}>❌ Authentication Failed</h2>
          <p>{error}</p>
          <p style={{ marginTop: '20px', color: '#666' }}>
            Redirecting to login page...
          </p>
        </>
      ) : (
        <>
          <h2>🔐 Authenticating...</h2>
          <p>Processing your Google sign-in. Please wait...</p>
          <div style={{ 
            marginTop: '20px', 
            width: '40px', 
            height: '40px', 
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </>
      )}
    </div>
  );
};

export default OAuthCallback;
