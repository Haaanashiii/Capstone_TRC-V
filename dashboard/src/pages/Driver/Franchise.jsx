import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import UnifiedSidebar from "../../components/UnifiedSidebar";
import "../../Styles/Operator's_CSS/Franchise.css";
import { Sparkles, Link2, CheckCircle, PlusCircle } from 'lucide-react';

const Franchise = () => {
  // User state for displaying user information
  const [userDetails, setUserDetails] = useState(null);
  
  // Get user info from token (same as UnifiedSidebar)
  const getUserInfo = () => {
    // Check sessionStorage first (where Login stores it), fallback to localStorage
    const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch {
      return null;
    }
  };

  // Get user from token
  const user = getUserInfo();
  
  
  // Fetch user details from the server (same logic as UnifiedSidebar)
  const fetchUserDetails = async () => {
    try {
      // Check sessionStorage first (where Login stores it), fallback to localStorage
      const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
      console.log('[Franchise] Token found:', !!token);
      if (!token) return;

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
      console.log('[Franchise] Fetching from:', `${API_BASE_URL}/auth/me`);
      
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[Franchise] Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[Franchise] User data received:', data);
        setUserDetails(data.user);
      } else {
        console.error('[Franchise] Failed to fetch user details:', response.status);
      }
    } catch (error) {
      console.error('[Franchise] Error fetching user details:', error);
    }
  };

  // Fetch user details on component mount
  useEffect(() => {
    fetchUserDetails();
    
    // session storage for identifying linked franchise if ever meron 
    const savedFranchiseInfo = localStorage.getItem('userFranchiseInfo');
    const savedFranchiseLinked = localStorage.getItem('franchiseLinked');
    const savedOwnerEmail = localStorage.getItem('franchiseOwnerEmail');

    // Only restore saved franchise info if it belongs to the currently logged-in user
    try {
      const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
      let tokenEmail = null;
      if (token) {
        try { tokenEmail = JSON.parse(atob(token.split('.')[1])).email?.toLowerCase() } catch { tokenEmail = null }
      }

      if (savedFranchiseInfo && savedFranchiseLinked === 'true' && savedOwnerEmail && tokenEmail && savedOwnerEmail === tokenEmail) {
        try {
          const parsedInfo = JSON.parse(savedFranchiseInfo);
          setUserFranchiseInfo(parsedInfo);
          setFranchiseLinked(true);
        } catch (error) {
          console.error('Error parsing saved franchise info:', error);
        }
      }
    } catch {
      console.warn('Error while restoring franchise info from storage')
    }
  }, []);

  // Fetch approved franchises and auto-link if the logged-in operator has one
  useEffect(() => {
    const tryFetchApproved = async () => {
      try {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170'
  const resp = await fetch(`${API_BASE_URL}/api/franchise-applications?status=approved`)
        if (!resp.ok) return
        const apps = await resp.json()
        if (!Array.isArray(apps) || !apps.length) return

        // Try to match by operator name or contact
        const token = sessionStorage.getItem('accessToken')
        let userName = null
        let userEmail = null
        if (token) {
          try { userName = JSON.parse(atob(token.split('.')[1])).name } catch { /* ignore */ }
          try { userEmail = JSON.parse(atob(token.split('.')[1])).email } catch { userEmail = null }
        }

        const matched = apps.find(a => {
          if (!a) return false
          const nm = (a.name || '').toLowerCase()
          if (userName && nm.includes(String(userName).toLowerCase())) return true
          // fallback: if driverName or contact matches local storage user info
          return false
        })

        if (matched) {
          const franchiseInfo = {
            orNumber: matched.franchiseNumber,
            status: 'ACTIVE',
            linkedDate: matched.approvedAt || new Date().toLocaleDateString()
          }
          setUserFranchiseInfo(franchiseInfo)
          setFranchiseLinked(true)
          localStorage.setItem('userFranchiseInfo', JSON.stringify(franchiseInfo))
          localStorage.setItem('franchiseLinked', 'true')
          // persist owner email so only that user is recognized as linked
          try {
            if (userEmail) localStorage.setItem('franchiseOwnerEmail', String(userEmail).toLowerCase())
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.warn('Error fetching approved franchises', err)
      }
    }

    tryFetchApproved()
  }, [])
  
  // Language state
  const [language, setLanguage] = useState('en'); // 'en' for English, 'tl' for Tagalog
  

  const translations = {
    en: {
      user: "USER",
      franchiseLinked: "FRANCHISE LINKED",
      noFranchise: "NO FRANCHISE",
      franchiseDetails: "FRANCHISE DETAILS",
      orNumber: "O.R. Number",
      status: "Status",
      linkedOn: "Linked on",
      franchiseApplication: "FRANCHISE APPLICATION",
      questionText: "Do you already have a franchise with us?",
      yesLink: "Yes, Link my franchise",
      noApply: "No, apply for a new franchise",
      franchiseLinkTitle: "Franchise Link",
      franchiseLinkDesc: "Link your existing franchise to TRC-V for easy management of tricycle franchise",
      orNumberLabel: "O.R. Number",
      orNumberPlaceholder: "Enter O.R. Number",
      uploadMtop: "Upload MTOP Document",
      browseFiles: "Browse Files to upload",
      noFileSelected: "No selected File -",
      numbersOnlyWarning: "Numbers only are accepted",
      pleaseProvideWarning: "Please provide both O.R. Number and MTOP document",
      cancel: "Cancel",
      submit: "Submit",
      toggleLanguage: "Tagalog"
    },
    tl: {
      user: "USER",
      franchiseLinked: "NAKAUGNAY NA ANG PRANGKISA",
      noFranchise: "WALANG PRANGKISA",
      franchiseDetails: "MGA DETALYE NG PRANGKISA",
      orNumber: "Numero ng O.R.",
      status: "Katayuan",
      linkedOn: "Naikaugnay noong",
      franchiseApplication: "APLIKASYON PARA SA PRANGKISA",
      questionText: "Mayroon ka na bang prangkisa sa amin?",
      yesLink: "Oo, Iugnay ang aking prangkisa",
      noApply: "Hindi, mag-apply para sa bagong prangkisa",
      franchiseLinkTitle: "Pag-uugnay ng Prangkisa",
      franchiseLinkDesc: "Iugnay ang inyong kasalukuyang prangkisa sa TRC-V para sa madaling pamamahala ng tricycle franchise",
      orNumberLabel: "Numero ng O.R.",
      orNumberPlaceholder: "Ilagay ang Numero ng O.R.",
      uploadMtop: "Mag-upload ng MTOP Document",
      browseFiles: "Mag-browse ng mga file para i-upload",
      noFileSelected: "Walang napiling File -",
      numbersOnlyWarning: "Mga numero lamang ang tatanggapin",
      pleaseProvideWarning: "Mangyaring magbigay ng O.R. Number at MTOP document",
      cancel: "Kanselahin",
      submit: "Ipasa",
      toggleLanguage: "English"
    }
  };
  
  const t = translations[language];

  const [showModal, setShowModal] = useState(false);
  const [orNumber, setOrNumber] = useState("");
  const [mtopFile, setMtopFile] = useState(null);
  const [orWarning, setOrWarning] = useState("");
  const [franchiseLinked, setFranchiseLinked] = useState(false);
  const [userFranchiseInfo, setUserFranchiseInfo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const replaced = localStorage.getItem('franchiseMenuReplaced') === 'true'
      const linked = localStorage.getItem('franchiseLinked') === 'true'
      const ownerEmail = localStorage.getItem('franchiseOwnerEmail')

      const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken')
      let tokenEmail = null
      if (token) {
        try { tokenEmail = JSON.parse(atob(token.split('.')[1])).email?.toLowerCase() } catch { tokenEmail = null }
      }

      // Only redirect if the saved franchise state belongs to the currently logged-in user
      if (replaced || (linked && ownerEmail && tokenEmail && ownerEmail === tokenEmail)) {
        // user already applied/linked -> redirect to Operator ID
        navigate('/operator/id')
      }
    } catch {
      // If localStorage fails, don't block the page by default.
    }
  }, [navigate])

  const handleSubmitFranchiseLink = () => {
    if (!orNumber || !mtopFile) {
      alert(t.pleaseProvideWarning);
      return;
    }

    // API call
    const franchiseInfo = {
      orNumber: orNumber,
      status: "ACTIVE",
      linkedDate: new Date().toLocaleDateString()
    };

    setUserFranchiseInfo(franchiseInfo);
    setFranchiseLinked(true);
    
    // para sa Storing ng  franchise info in localStorage so DriverID can access it
    try { localStorage.setItem('userFranchiseInfo', JSON.stringify(franchiseInfo)) } catch { /* ignore */ }
    try { localStorage.setItem('franchiseLinked', 'true') } catch { /* ignore */ }
    // persist owner email so other users won't pick up this data
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      if (token) {
        try { const payload = JSON.parse(atob(token.split('.')[1])); if (payload?.email) localStorage.setItem('franchiseOwnerEmail', String(payload.email).toLowerCase()) } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    
    setShowModal(false);
    
    // For reset 
    setOrNumber("");
    setMtopFile(null);
    setOrWarning("");
  };


  const handleLinkFranchise = () => setShowModal(true);
  const handleApplyNew = () => navigate('/operator/franchise/application');


  const badgeClass = (franchiseLinked && userFranchiseInfo?.status === 'ACTIVE') ? 'badge-pill active' : 'badge-pill inactive';



  return (
    <div className="franchise-bg">
      <UnifiedSidebar 
        userType="operator"
        language={language}
        onLanguageToggle={() => setLanguage(language === 'en' ? 'tl' : 'en')}
        translations={t}
      />

      <div className="franchise-page-content">
          <div className="profile-header-card">
            <div className="profile-header-inner">
              <div className="avatar-wrap">
                <div className="avatar-square">
                  {userDetails?.avatar_url || user?.avatar_url ? (
                    <img
                      src={userDetails?.avatar_url || user?.avatar_url}
                      alt={(userDetails?.full_name || userDetails?.name || user?.name) || ''}
                      className="avatar-img"
                    />
                  ) : (
                    <div className="avatar-placeholder" />
                  )}
                </div>
                <div className="avatar-alert">!</div>
              </div>

              <div className="profile-info">
                <h3 className="profile-name">{(userDetails?.full_name || userDetails?.name || user?.name || t.user).toUpperCase()}</h3>
                <span className={badgeClass}>{franchiseLinked ? t.franchiseLinked : t.noFranchise}</span>
                <p className="profile-desc">Welcome! You don't have an active franchise yet. Choose an option below to get started on your franchise journey.</p>
              </div>
            </div>
          </div>

          {franchiseLinked && userFranchiseInfo ? (
            <div className="franchise-card-content-centered">
              <div className="franchise-card-title-centered">{t.franchiseDetails}</div>
              <div className="franchise-card-subtitle-centered">{t.orNumber}: {userFranchiseInfo.orNumber}</div>
              <div className="franchise-card-subtitle-centered">{t.status}: {userFranchiseInfo.status}</div>
              <div className="franchise-card-subtitle-centered">{t.linkedOn}: {userFranchiseInfo.linkedDate}</div>
            </div>
          ) : (
            <div className="application-section">
              <div className="application-inner">
                <div className="mb-12 text-center">
                  <h2 className="application-title">Franchise Application</h2>
                  <p className="application-sub">Do you already have a franchise with us?</p>
                </div>

                <div className="options-grid">
      
                <div className="app-card group">
                    <div className="app-card-icon">
                      <Link2 style={{ width: 28, height: 28, color: '#174D7A' }} />
                    </div>

                  <h3 className="app-card-title">Yes, Link my franchise</h3>
                  <p className="app-card-desc">Connect your existing franchise</p>

                  <button onClick={handleLinkFranchise} className="app-card-cta">Get Started</button>
                </div>

         
                <div className="app-card group">
                  <div className="app-card-icon">
                    <PlusCircle style={{ width: 28, height: 28, color: '#174D7A' }} />
                  </div>

                  <h3 className="app-card-title">No, apply for a new franchise</h3>
                  <p className="app-card-desc">Apply your franchise now</p>

                  <button onClick={handleApplyNew} className="app-card-cta">Get Started</button>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

      {/* For modal, paki adjust nalang if wants nyo   */}
      {showModal && (
        <div className="franchise-modal-bg">
          <div className="franchise-modal">
            <div className="franchise-modal-title">{t.franchiseLinkTitle}</div>
            <div className="franchise-modal-desc">{t.franchiseLinkDesc}</div>
            <div style={{ marginBottom: 18 }}>
              <label className="franchise-modal-label">{t.orNumberLabel}</label>
              <input
                type="text"
                value={orNumber}
                onChange={e => {
                  const val = e.target.value;
                  if (/[^0-9]/.test(val)) {
                    setOrWarning(t.numbersOnlyWarning);
                  } else {
                    setOrWarning("");
                  }
                  setOrNumber(val.replace(/[^0-9]/g, ""));
                }}
                className="franchise-modal-input"
                placeholder={t.orNumberPlaceholder}
              />
              {orWarning && (
                <div style={{ color: '#b71c1c', fontWeight: 'bold', marginTop: '4px', fontSize: '14px', fontFamily: 'Poppins, sans-serif' }}>
                  <span style={{ marginRight: '6px' }}>⚠️</span>{orWarning}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 18 }}>
              <label className="franchise-modal-label">{t.uploadMtop}</label>
              <div className="franchise-upload-box">
                <label htmlFor="mtop-upload" className="franchise-upload-label">
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div className="franchise-upload-icon">
                      <svg width="32" height="32" fill="#F5D76E" viewBox="0 0 24 24"><path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="#F5D76E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" stroke="#174D7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <span className="franchise-upload-text">{t.browseFiles}</span>
                  </div>
                  <input
                    id="mtop-upload"
                    type="file"
                    style={{ display: "none" }}
                    onChange={e => setMtopFile(e.target.files[0])}
                  />
                </label>
                <div className="franchise-upload-filename">
                  {mtopFile ? mtopFile.name : t.noFileSelected}
                </div>
              </div>
            </div>
            <div className="franchise-modal-actions">
              <button
                className="franchise-cancel-btn"
                onClick={() => setShowModal(false)}>
                {t.cancel}
              </button>
              <button
                className="franchise-submit-btn"
                onClick={handleSubmitFranchiseLink}>
                {t.submit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Franchise;
