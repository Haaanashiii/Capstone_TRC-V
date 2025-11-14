import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import '../../Styles/LandingCss/LandingPage.css';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, MenuItem, ListItemIcon } from '@mui/material';
import PermIdentityIcon from '@mui/icons-material/PermIdentity';
import LogoutIcon from '@mui/icons-material/Logout';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const Card = ({ children, className }) => (
  <div className={className}>{children}</div>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const { user, logout, login } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const menuOpen = Boolean(anchorEl);
  
  // Get display name from AuthContext user or fallback to token decode (consistent with UnifiedSidebar)
  const getDisplayName = () => {
    if (user?.name) {
      const parts = String(user.name).trim().split(/\s+/);
      const first = parts[0];
      const last = parts.slice(1).join(' ');
      return last ? `${first} ${String(last).charAt(0).toUpperCase()}` : first;
    }
    
    // Fallback: decode token directly from sessionStorage
    try {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        if (decoded?.name) {
          const parts = String(decoded.name).trim().split(/\s+/);
          const first = parts[0];
          const last = parts.slice(1).join(' ');
          return last ? `${first} ${String(last).charAt(0).toUpperCase()}` : first;
        }
      }
    } catch (error) {
      console.error('[LandingPage] Error decoding token:', error);
    }
    
    return null;
  };
  
  const displayName = getDisplayName();
  
  // Check if user has operator information (for disabling REQUEST FOR AMENDMENT)
  const checkHasOperator = () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        return decoded.hasOperator === true;
      }
    } catch {
      return false;
    }
    return false;
  };
  
  const userHasOperator = checkHasOperator();

  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleGoToId = () => { handleMenuClose(); navigate('/operator/id'); };
  
  const handleLogout = async () => {
    console.log('[LandingPage] Logout initiated');
    handleMenuClose();
    try {
      await logout(); // Now async - calls backend and clears tokens
      console.log('[LandingPage] Logout successful');
    } catch (error) {
      console.error('[LandingPage] Logout error:', error);
    } finally {
      navigate('/');
    }
  };
  
  // Fetch published announcements
  useEffect(() => {
    const fetchPublishedAnnouncements = async () => {
      try {
        setLoadingAnnouncements(true);
        const response = await fetch(`${API_BASE_URL}/announcements/published`);
        
        if (response.ok) {
          const data = await response.json();
          setAnnouncements(data.announcements || []);
        } else {
          console.error('Failed to fetch announcements');
          setAnnouncements([]);
        }
      } catch (error) {
        console.error('Error fetching announcements:', error);
        setAnnouncements([]);
      } finally {
        setLoadingAnnouncements(false);
      }
    };

    fetchPublishedAnnouncements();
  }, []);

  useEffect(() => {
    try {
      const hash = window.location.hash || '';
      if (hash.startsWith('#')) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        if (token) {
          // Store in sessionStorage (secure) instead of localStorage
          sessionStorage.setItem('accessToken', token);
          // Also notify AuthContext about the new login so components update immediately
          try {
            const decoded = JSON.parse(atob(token.split('.')[1]));
            const userInfo = {
              id: decoded.id,
              role: decoded.role,
              name: decoded.name,
              accountType: decoded.accountType,
              hasOperator: decoded.hasOperator
            };
            // call AuthContext login if available
            if (typeof login === 'function') {
              login(token, userInfo);
            }
          } catch (e) {
            // ignore decode errors, token is still stored
            console.warn('Failed to decode token in landing page:', e);
          }
          // remove token from URL if available
          if (window.history && typeof window.history.replaceState === 'function') {
            try { window.history.replaceState(null, '', window.location.pathname); } catch (err) { console.warn('replaceState failed', err); }
          }
        }
      }
  } catch { /* ignore */ }
  }, [login]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  };

  
  return (
    /* Adjust nyo nalang kung ayaw ko design hehe */ 


    <div className="landing-root">
      <header className="landing-header">
        <div className="logo-title">
          <img src="/Logos/TRC-vLogo.png" alt="TRC-V Logo" className="logo-img" />
          <div className="title-group">
            <span className="trc-title">TRC-V</span>
            <span className="trc-subtitle">TRICYCLE VERIFICATION SYSTEM</span>
          </div>
        </div>
        <nav className="landing-nav">
          <button className="nav-link" onClick={() => navigate('/')}>HOME</button>
          {/* Show different label & route when user is logged in */}
          {displayName ? (
            <button 
              className="nav-link" 
              onClick={() => userHasOperator ? navigate('/request-amendment') : navigate('/operator/franchise')}
              style={{ 
                opacity: userHasOperator ? 1 : 0.5, 
                cursor: userHasOperator ? 'pointer' : 'not-allowed',
                pointerEvents: userHasOperator ? 'auto' : 'none'
              }}
              title={!userHasOperator ? 'Complete your franchise application first' : ''}
            >
              REQUEST FOR AMENDMENT
            </button>
          ) : (
            <button className="nav-link" onClick={() => navigate('/login')}>VERIFY TRICYCLE</button>
          )}
          <button className="nav-link" onClick={() => navigate('/operator/franchise/application')}>NEW APPLICATION</button>
          {/* If user is logged in show name and menu, otherwise show Login button */}
          {displayName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              
              <div style={{ background: 'rgba(255,255,255,0.12)', padding: '6px 10px', borderRadius: 28, display: 'flex', alignItems: 'center' }}>
               
                <div onClick={handleMenuOpen} style={{ background: '#143c6e', color: '#fff', padding: '6px 16px', borderRadius: 20, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>{displayName}</div>
              </div>
              <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} PaperProps={{ sx: { borderRadius: 2, minWidth: 200 } }}>
                <MenuItem onClick={handleGoToId}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <PermIdentityIcon fontSize="small" />
                  </ListItemIcon>
                  Operator ID
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  Logout
                </MenuItem>
              </Menu>
            </div>
          ) : (
            <button className="nav-login" onClick={() => navigate('/login')}>LOGIN</button>
          )}
        </nav>
      </header>
      <main className="landing-main">
        
        <div className="main-content">
          <h1>Tricycle Verification and<br />Hassle-Free Online<br />Franchise in Solano</h1>
           {/* For button  */}
          <div className="main-buttons">
            <button className="main-btn yellow" onClick={() => navigate('/login')}>RENEW A FRANCHISE</button>
          </div>
        </div>
        <div className="main-image" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <img
            src="/Logos/right-sideLanding.gif"
            alt="Landing Animation"
            style={{ width: '90%', maxWidth: '640px', height: 'auto', marginRight: '40px' }}
          />
        </div>
      </main>

            {/* Announcements Section - Dynamic */}
      <section className="announcements-section">
        <div className="announcements-title">ANNOUNCEMENTS</div>
        <div className="announcements-list">
          {loadingAnnouncements ? (
            <div className="announcement-card">
              <div className="announcement-card-body" style={{ textAlign: 'center', padding: '40px' }}>
                Loading announcements...
              </div>
            </div>
          ) : announcements.length > 0 ? (
            announcements.map((announcement) => (
              <div className="announcement-card" key={announcement._id}>
                <div className="announcement-card-header">{announcement.title}</div>
                <div className="announcement-card-date">{formatDate(announcement.date)}</div>
                <div className="announcement-card-body">
                  {announcement.description}
                </div>
              </div>
            ))
          ) : (
            <div className="announcement-card">
              <div className="announcement-card-body" style={{ textAlign: 'center', padding: '40px' }}>
                No announcements at this time.
              </div>
            </div>
          )}
        </div>
      </section>






      <div className="min-h-screen bg-[#F4D77E]">
      

        {/* FEATURES Hatdog */}
        <div style={{ background: '#F4D77E', padding: '40px 0' }}>
             <div style={{ background: '#1B4B75', color: '#F4D77E', display: 'inline-block', padding: '10px 50px', borderRadius: '2px', fontWeight: 'bold', fontSize: '28px', boxShadow: '2px 2px 6px #b3a04a', fontFamily: 'Poppins, sans-serif' }}>
              FEATURES
            </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '60px', maxWidth: '1100px', margin: '0 auto' }}>
          
            <div style={{ textAlign: 'center', width: '300px' }}>
              <div style={{ background: '#1B4B75', borderRadius: '50%', width: '170px', height: '170px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/Logos/2.png" alt="Tricycle Verification" style={{ width: '150px', height: '150px' }} />
              </div>
              <h3 style={{ fontWeight: 'bold', marginTop: '20px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>TRICYCLE VERIFICATION</h3>
              <p style={{ fontSize: '15px', marginTop: '10px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>Instantly check if a tricycle is registered and franchised by scanning its QR code.</p>
            </div>
           
            <div style={{ textAlign: 'center', width: '300px' }}>
              <div style={{ background: '#1B4B75', borderRadius: '50%', width: '170px', height: '170px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/Logos/4.png" alt="Franchise Application" style={{ width: '150px', height: '150px' }} />
              </div>
              <h3 style={{ fontWeight: 'bold', marginTop: '20px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>FRANCHISE APPLICATION AND RENEWAL</h3>
              <p style={{ fontSize: '15px', marginTop: '10px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>Submit new franchise applications or renew your existing one online with ease.</p>
            </div>
           
            <div style={{ textAlign: 'center', width: '300px' }}>
              <div style={{ background: '#1B4B75', borderRadius: '50%', width: '170px', height: '170px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/Logos/6.png" alt="Reporting Function" style={{ width: '150px', height: '150px' }} />
              </div>
              <h3 style={{ fontWeight: 'bold', marginTop: '20px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>REPORTING FUNCTION</h3>
              <p style={{ fontSize: '15px', marginTop: '10px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>Report instances of overpricing or fare disputes, ensuring passengers are charged fairly.</p>
            </div>
          </div>
          <div style={{ textAlign: 'right', maxWidth: '1100px', margin: '20px auto 0' }}>
          
          </div>
        </div>
      
      </div> 

    {/* Footer Sectionsz */}
    <footer
  style={{
    background: "linear-gradient(90deg, #f7f7f7 0%, #f7f7f7 100%)",
    padding: "32px 0 24px 0",
    marginTop: "40px",
    width: "100%",
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      maxWidth: "1400px",
      margin: "0 auto",
      flexWrap: "wrap",
      gap: "40px",
    }}
  >

    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "18px",
        minWidth: "300px",
      }}
    >
      <img
        src="/Logos/SBLogo.png"
        
        alt="SB Logo"
        style={{ width: "100px", height: "100px", objectFit: "contain" }}
      />
      <img
        src="/Logos/TRC-vLogo.png"
        alt="Vice Mayor Logo"
        style={{ width: "100px", height: "100px", objectFit: "contain" }}
      />
      <img
        src="/Logos/vm.png"
        alt="Municipality Logo"
        style={{ width: "100px", height: "100px", objectFit: "contain" }}
      />
    </div>


    <div style={{ flex: 1, minWidth: "300px" }}>
      <div
        style={{
          fontWeight: "bold",
          fontSize: "24px",
          color: "#111",
          marginBottom: "10px",
        }}
      >
        SANGGUNIANG BAYAN OF SOLANO
      </div>
      <div
        style={{
          color: "#222",
          fontSize: "16px",
          marginBottom: "24px",
        }}
      >
        All content is in the public domain unless otherwise stated.
      </div>
      <div
        style={{
          fontWeight: "bold",
          fontSize: "20px",
          color: "#111",
          marginBottom: "10px",
        }}
      >
        ABOUT SB-SOLANO
      </div>
      <div style={{ color: "#222", fontSize: "16px" }}>
        Learn more about the Sangguniang Bayan of Solano, its structure, how
        legislative works and the people behind it.
      </div>
    </div>


    <div style={{ minWidth: "300px", textAlign: "left" }}>
      <div
        style={{
          fontWeight: "bold",
          fontSize: "20px",
          color: "#111",
          marginBottom: "12px",
        }}
      >
        GOVERNMENT HOTLINE NUMBERS
      </div>
      <div style={{ color: "#222", fontSize: "16px", lineHeight: "2" }}>
        Police Department - 0927 400 8033 <br />
        MSWDO - 0916 284 0885 <br />
        Fire Department - 0936 062 0305 <br />
        DILG Solano - 0906 188 086 <br />
        MDRRMO - 0926 383 3744 <br />
        R2TMC - 0906 819 5569
      </div>
    </div>
  </div>
</footer>

  </div> 
);
};

export default LandingPage;
