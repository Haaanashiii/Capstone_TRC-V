
import React from 'react';
import '../../Styles/MaintenanceCss/MaintenancePage.css';
import { useNavigate } from 'react-router-dom';

{/* Updated ver sya yah */}
const MaintenancePage = () => {
  const navigate = useNavigate();
  return (
    <div className="maintenance-404-container">
      <div className="maintenance-header-logo">
        <img src="/Logos/TRC-vLogo.png" alt="TRC-V Logo" className="maintenance-header-logo-img" />
        <div className="maintenance-header-logo-text">
          <span className="maintenance-header-logo-title">TR<span className="highlight-c">C</span>-V</span>
          <div className="maintenance-header-logo-sub">TRICYCLE VERIFICATION SYSTEM</div>
        </div>
      </div>
      <div className="maintenance-404-content">
        <div className="maintenance-404-left">
          <h1 className="maintenance-404-title">404</h1>
          <h2 className="maintenance-404-subtitle">Page not found!</h2>
          <p className="maintenance-404-message">
            Looks like your tricycle took a wrong turn — the page you're looking for cannot be found.
          </p>
          <button className="maintenance-404-btn" onClick={() => navigate('/')}>BACK TO HOME</button>
        </div>
        <div className="maintenance-404-right">
          <img src="/Logos/Tricy (2).png" alt="Tricycle" className="maintenance-404-tricycle" />
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
