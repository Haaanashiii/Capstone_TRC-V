import React from "react";
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();
  return (
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
          <a href="/" className="nav-link">HOME</a>
          <a href="/about" className="nav-link">ABOUT US</a>
          <a href="/verify" className="nav-link">VERIFY TRICYCLE</a>
          <a href="/application" className="nav-link">NEW APPLICATION</a>
          <button className="nav-login" onClick={() => navigate('/signup')}>LOGIN</button>
        </nav>
      </header>
      <main className="landing-main">
        <div className="main-content">
          <h1>Tricycle Verification and<br />Hassle-Free Online<br />Franchise in Solano</h1>
          <p className="main-desc">
            TRC-V connects passengers, drivers, and the LGU in one platform —<br />making verification easy and franchise applications digital
          </p>
          <div className="main-buttons">
            <a href="/verify" className="main-btn yellow">VERIFY A TRICYCLE</a>
            <a href="/application" className="main-btn yellow">APPLY/RENEW FRANCHISE</a>
          </div>
        </div>
        <div className="main-image">
          <img src="/Logos/Tricy (2).png" alt="Tricycle" className="tricycle-img" />
        </div>

      </main>
      {/* Announcements Pageee hehe papi luke  */}
      <section className="announcements-section">
        <div className="announcements-title">ANNOUNCEMENTS</div>
        <div className="announcements-list">
          <div className="announcement-card">
            <div className="announcement-card-header">NOTICE TO ALL TRICYCLE FRANCHISE HOLDERS</div>
            <div className="announcement-card-date">SEP 3, 2025</div>
            <div className="announcement-card-body">
              This is to inform all registered tricycle operators that renewal of franchise permits for the year 2025–2026 shall commence on September 10, 2025. All submissions must be completed through the TRC-V portal before September 30, 2025.
            </div>
          </div>
          <div className="announcement-card">
            <div className="announcement-card-header">SYSTEM MAINTENANCE ADVISORY</div>
            <div className="announcement-card-date">SEP 5, 2025</div>
            <div className="announcement-card-body">
              Please be advised that the TRC-V online portal will undergo scheduled maintenance on September 8, 2025, from 12:00 AM to 6:00 AM. During this period, online services including QR code validation and document submissions will be temporarily unavailable…
            </div>
          </div>
          <div className="announcement-card">
            <div className="announcement-card-header">OFFICE CLOSURE ANNOUNCEMENT</div>
            <div className="announcement-card-date">SEP 12, 2025</div>
            <div className="announcement-card-body">
              The Municipal Tricycle Regulatory Office will be closed on September 15, 2025 (Monday) in observance of municipal administrative activities. Online services will remain accessible.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
