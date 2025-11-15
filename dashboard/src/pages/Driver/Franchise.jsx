import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import UnifiedSidebar from "../../components/UnifiedSidebar";
import { useAuth } from "../../contexts/AuthContext";
import "../../Styles/Operator's_CSS/Franchise.css";
import { Sparkles, Link2, CheckCircle, PlusCircle } from 'lucide-react';

const Franchise = () => {
  // Use AuthContext for user data (consistent with UnifiedSidebar)
  const { user: authUser } = useAuth();
  
  // Get user data from AuthContext or fallback to direct token decode
  const getUser = () => {
    if (authUser) return authUser;
    
    // Fallback: decode token directly (same approach as Admin Sidebar)
    try {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        return decoded;
      }
    } catch (error) {
      console.error('[Franchise] Error decoding token:', error);
    }
    
    return null;
  };
  
  const currentUser = getUser();
  
  // Use authUser from context instead of fetching separately
  useEffect(() => {
    if (currentUser) {
      console.log('[Franchise] User data:', currentUser);
    }
    
    // Use sessionStorage for franchise info (cleared on tab close - more secure)
    const savedFranchiseInfo = sessionStorage.getItem('userFranchiseInfo');
    const savedFranchiseLinked = sessionStorage.getItem('franchiseLinked');
    const savedOwnerUserId = sessionStorage.getItem('franchiseOwnerUserId');

    // Only restore saved franchise info if it belongs to the currently logged-in user
    try {
      const token = sessionStorage.getItem('accessToken');
      let tokenUserId = null;
      if (token) {
        try { tokenUserId = JSON.parse(atob(token.split('.')[1])).id } catch { tokenUserId = null }
      }

      if (savedFranchiseInfo && savedFranchiseLinked === 'true' && savedOwnerUserId && tokenUserId && savedOwnerUserId === tokenUserId) {
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
  }, [authUser]);

  // Fetch approved franchises and auto-link if the logged-in operator has one
  useEffect(() => {
    const tryFetchApproved = async () => {
      try {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170'
  const resp = await fetch(`${API_BASE_URL}/api/franchise-applications?status=approved`)
        if (!resp.ok) return
        const apps = await resp.json()
        if (!Array.isArray(apps) || !apps.length) return

        // Try to match by user ID from JWT
        const token = sessionStorage.getItem('accessToken')
        let userId = null
        if (token) {
          try { userId = JSON.parse(atob(token.split('.')[1])).id } catch { /* ignore */ }
        }

        const matched = apps.find(a => {
          if (!a || !a.userId) return false
          // Match franchise to logged-in user by userId
          return a.userId === userId
        })

        if (matched) {
          const franchiseInfo = {
            orNumber: matched.franchiseNumber,
            status: 'ACTIVE',
            linkedDate: matched.approvedAt || new Date().toLocaleDateString()
          }
          setUserFranchiseInfo(franchiseInfo)
          setFranchiseLinked(true)
          sessionStorage.setItem('userFranchiseInfo', JSON.stringify(franchiseInfo))
          sessionStorage.setItem('franchiseLinked', 'true')
          // persist owner userId so only that user is recognized as linked
          try {
            if (userId) sessionStorage.setItem('franchiseOwnerUserId', userId)
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

  // Removed auto-redirect - users stay on Franchise page until they complete application
  // and backend approves it (hasOperator becomes true in JWT)
  useEffect(() => {
    console.log('[Franchise] User can now choose to link or apply for franchise');
    // Check if user already has operator info in JWT
    try {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        if (decoded.hasOperator === true) {
          console.log('[Franchise] User has operator info, they can navigate to Operator ID');
          // Don't auto-redirect, let user navigate via menu
        } else {
          console.log('[Franchise] User needs to complete franchise application');
        }
      }
    } catch (e) {
      console.error('[Franchise] Error checking operator status:', e);
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
    
    // Store franchise info in sessionStorage so DriverID can access it
    try { sessionStorage.setItem('userFranchiseInfo', JSON.stringify(franchiseInfo)) } catch { /* ignore */ }
    try { sessionStorage.setItem('franchiseLinked', 'true') } catch { /* ignore */ }
    // persist owner userId so other users won't pick up this data
    try {
      const token = sessionStorage.getItem('accessToken')
      if (token) {
        try { const payload = JSON.parse(atob(token.split('.')[1])); if (payload?.id) sessionStorage.setItem('franchiseOwnerUserId', payload.id) } catch { /* ignore */ }
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
                  {currentUser?.avatar_url ? (
                    <img
                      src={currentUser.avatar_url}
                      alt={(currentUser?.full_name || currentUser?.name) || ''}
                      className="avatar-img"
                    />
                  ) : (
                    <div className="avatar-placeholder" />
                  )}
                </div>
                <div className="avatar-alert">!</div>
              </div>

              <div className="profile-info">
                <h3 className="profile-name">{(currentUser?.full_name || currentUser?.name || t.user).toUpperCase()}</h3>
                <span className={badgeClass}>{franchiseLinked ? t.franchiseLinked : t.noFranchise}</span>
                {!currentUser?.hasOperator && (
                  <p className="profile-desc" style={{ color: '#e74c3c', fontWeight: 600, marginTop: '8px', background: '#fee', padding: '8px 12px', borderRadius: '8px' }}>
                    ⚠️ Complete your franchise application to access all features
                  </p>
                )}
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
