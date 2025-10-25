import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import UnifiedSidebar from "../../components/UnifiedSidebar";
import "../../Styles/Operator's_CSS/Franchise.css";

const Franchise = () => {
  // User state for displaying user information
  const [userDetails, setUserDetails] = useState(null);
  
  // Get user info from token (same as UnifiedSidebar)
  const getUserInfo = () => {
    const token = localStorage.getItem('accessToken');
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
      const token = localStorage.getItem('accessToken');
      console.log('Token found:', !!token);
      if (!token) return;

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';
      console.log('Fetching from:', `${API_BASE_URL}/auth/me`);
      
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('User data received:', data);
        setUserDetails(data.user);
      } else {
        console.error('Failed to fetch user details:', response.status);
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  // Fetch user details on component mount
  useEffect(() => {
    fetchUserDetails();
    
    // Check if franchise was previously linked
    const savedFranchiseInfo = localStorage.getItem('userFranchiseInfo');
    const savedFranchiseLinked = localStorage.getItem('franchiseLinked');
    
    if (savedFranchiseInfo && savedFranchiseLinked === 'true') {
      try {
        const parsedInfo = JSON.parse(savedFranchiseInfo);
        setUserFranchiseInfo(parsedInfo);
        setFranchiseLinked(true);
      } catch (error) {
        console.error('Error parsing saved franchise info:', error);
      }
    }
  }, []);
  
  // Language state
  const [language, setLanguage] = useState('en'); // 'en' for English, 'tl' for Tagalog
  
  // Translation object
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

  const handleSubmitFranchiseLink = () => {
    if (!orNumber || !mtopFile) {
      alert(t.pleaseProvideWarning);
      return;
    }

    // Simulate franchise linking - replace with actual API call
    const franchiseInfo = {
      orNumber: orNumber,
      status: "ACTIVE",
      linkedDate: new Date().toLocaleDateString()
    };

    setUserFranchiseInfo(franchiseInfo);
    setFranchiseLinked(true);
    
    // Store franchise info in localStorage so DriverID can access it
    localStorage.setItem('userFranchiseInfo', JSON.stringify(franchiseInfo));
    localStorage.setItem('franchiseLinked', 'true');
    
    setShowModal(false);
    
    // Reset form
    setOrNumber("");
    setMtopFile(null);
    setOrWarning("");
  };

  return (
    <div className="franchise-bg">
      <UnifiedSidebar 
        userType="operator"
        language={language}
        onLanguageToggle={() => setLanguage(language === 'en' ? 'tl' : 'en')}
        translations={t}
      />

      {/* Card section yah */}
      <div className="franchise-card-wrapper">
        <div className="franchise-card-centered">
          <div className="franchise-profile-img-outer-centered">
            <img src="/Logos/Tricy (2).png" alt="Profile" className="franchise-profile-img" />
          </div>
          <div className="franchise-card-content-centered">
            <div className="franchise-card-name-centered">
              {(() => {
                const displayName = userDetails?.name || userDetails?.username || user?.name || t.user;
                console.log('UserDetails in render:', userDetails);
                console.log('User from token:', user);
                console.log('Display name:', displayName);
                return displayName;
              })()}
            </div>
            <div className="franchise-card-status-centered">
              {franchiseLinked ? t.franchiseLinked : t.noFranchise}
            </div>
            
            {franchiseLinked && userFranchiseInfo ? (
              <>
                <div className="franchise-card-title-centered">{t.franchiseDetails}</div>
                <div className="franchise-card-subtitle-centered">
                  {t.orNumber}: {userFranchiseInfo.orNumber}
                </div>
                <div className="franchise-card-subtitle-centered">
                  {t.status}: {userFranchiseInfo.status}
                </div>
                <div className="franchise-card-subtitle-centered">
                  {t.linkedOn}: {userFranchiseInfo.linkedDate}
                </div>
              </>
            ) : (
              <>
                <div className="franchise-card-title-centered">{t.franchiseApplication}</div>
                <div className="franchise-card-subtitle-centered">{t.questionText}</div>
                <div className="franchise-btn-group-centered">
                  <button
                    className="franchise-btn-centered"
                    onClick={() => setShowModal(true)}
                  >
                    {t.yesLink}
                  </button>
                  <button
                    className="franchise-btn-centered"
                    onClick={() => navigate("/operator/franchise/application")}
                  >
                    {t.noApply}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
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
