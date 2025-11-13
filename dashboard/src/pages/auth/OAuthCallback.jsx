import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// a component that reads the access_token from the URL fragment, stores it in localStorage (pwede rin secure cookie), and redirects the user to the app's main page.

const OAuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const rawHash = window.location.hash || '';
      const rawSearch = window.location.search || '';
      console.log('OAuthCallback rawHash:', rawHash);
      console.log('OAuthCallback rawSearch:', rawSearch);

      // Try fragment first (access_token in hash)
      const hash = rawHash.startsWith('#') ? rawHash.substring(1) : rawHash;
      const hashParams = new URLSearchParams(hash);
      let accessToken = hashParams.get('access_token');

      // If not in hash, try query string
      if (!accessToken) {
        const searchParams = new URLSearchParams(rawSearch.startsWith('?') ? rawSearch.substring(1) : rawSearch);
        accessToken = searchParams.get('access_token');
      }

      if (accessToken) {
        console.log('OAuthCallback: got access token', accessToken && accessToken.slice(0, 8) + '...');
        // Store token in sessionStorage for better security (session-based storage)
        sessionStorage.setItem('accessToken', accessToken);
        // Also keep localStorage for compatibility with existing code
        localStorage.setItem('accessToken', accessToken);
        // Optionally clear the hash/search to remove token from URL
  try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ }
        
        // Decode token to get user role and redirect appropriately
        try {
          const decoded = JSON.parse(atob(accessToken.split('.')[1]));
          console.log('OAuthCallback decoded token:', decoded); // Debug log
          console.log('User role from token:', decoded.role); // Debug log
          
          if (decoded.role === 'operator') {
            console.log('Redirecting to operator dashboard'); // Debug log
            navigate('/operator/franchise');
          } else if (decoded.role === 'sb-admin') {
            console.log('Redirecting to sb-admin dashboard'); // Debug log
            navigate('/sb-admin');
          } else if (decoded.role === 'bplo-admin') {
            console.log('Redirecting to bplo-admin dashboard'); // Debug log
            navigate('/bplo-admin');
          } else {
            console.log('Unknown role, redirecting to home:', decoded.role); // Debug log
            navigate('/');
          }
        } catch (error) {
          console.error('Token decode error:', error); // Debug log
          // Fallback to operator dashboard for Google login users
          console.log('Fallback: redirecting to operator dashboard'); // Debug log
          navigate('/operator/franchise');
        }
      } else {
        console.warn('OAuthCallback: no access token found in hash or query');
        // Keep user on this page and show debug info instead of auto-redirecting
      }
    } catch (err) {
      console.error('OAuthCallback error parsing token', err);
    }
  }, [navigate]);

  return (
    <div style={{ padding: 20 }}>
      <h3>Processing sign-in...</h3>
      <p>Open the browser console to see debug logs. If sign-in fails, the token may be missing from the redirect.</p>
      <p><strong>Note:</strong> If you see no token, check server logs and confirm the redirect contains <code>#access_token=...</code>.</p>
    </div>
  );
};

export default OAuthCallback;
