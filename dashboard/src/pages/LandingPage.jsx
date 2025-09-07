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
              <div className="tricycle-image-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '40px 0' }}>
                {/* <img
                  src="/Logos/Tricy (2).png"
                  alt="Tricycle"
                  style={{ width: '350px', height: 'auto', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}
                /> */}
              </div>
          </p>
          <div className="main-buttons">
            <a href="/verify" className="main-btn yellow">VERIFY A TRICYCLE</a>
            <a href="/application" className="main-btn yellow">APPLY/RENEW FRANCHISE</a>
          </div>
        </div>
        <div className="main-image">
            <div className="main-image-animated" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '40px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: '32px', position: 'relative', width: '500px', height: '220px' }}>
                <div style={{ position: 'absolute', left: '10%', top: '-150px', transform: 'translateX(-50%)' }}>
                    <img
                      src="/Logos/Qr.gif"
                      alt="QR Code"
                      style={{ width: '110px', height: '110px' }}
                    />
                </div>
                <img
                  src="/Logos/Tricy (2).png"
                  alt="Tricycle"
                  className="tricycle-animate"
                    style={{ width: '350px', height: 'auto', position: 'absolute', left: 30, bottom: 0, background: 'none', padding: 0 }}
                />
                <img
                  src="/Logos/clipboard.gif"
                  alt="Clipboard"
                  style={{ width: '110px', height: '110px', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', position: 'absolute', right: 0, bottom: '20px', background: 'none', padding: 0 }}
                />
              </div>
            </div>
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
        {/* FEATURES Hatdog */}
        <div style={{ background: '#F5D76E', padding: '40px 0' }}>
             <div style={{ background: '#174D7A', color: '#F5D76E', display: 'inline-block', padding: '10px 50px', borderRadius: '2px', fontWeight: 'bold', fontSize: '28px', boxShadow: '2px 2px 6px #b3a04a' }}>
              FEATURES
            </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '60px', maxWidth: '1100px', margin: '0 auto' }}>
          
            <div style={{ textAlign: 'center', width: '300px' }}>
              <div style={{ background: '#174D7A', borderRadius: '50%', width: '170px', height: '170px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* <img src="/Logos/Qr.gif" alt="Tricycle Verification" style={{ width: '90px', height: '90px' }} /> */}
              </div>
              <h3 style={{ fontWeight: 'bold', marginTop: '20px', color: '#111' }}>TRICYCLE VERIFICATION</h3>
              <p style={{ fontSize: '15px', marginTop: '10px', color: '#111' }}>Instantly check if a tricycle is registered and franchised by scanning its QR code.</p>
            </div>
           
            <div style={{ textAlign: 'center', width: '300px' }}>
              <div style={{ background: '#174D7A', borderRadius: '50%', width: '170px', height: '170px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* <img src="/Logos/clipboard.gif" alt="Franchise Application" style={{ width: '90px', height: '90px' }} /> */}
              </div>
              <h3 style={{ fontWeight: 'bold', marginTop: '20px', color: '#111' }}>FRANCHISE APPLICATION AND RENEWAL</h3>
              <p style={{ fontSize: '15px', marginTop: '10px', color: '#111' }}>Submit new franchise applications or renew your existing one online with ease.</p>
            </div>
           
            <div style={{ textAlign: 'center', width: '300px' }}>
              <div style={{ background: '#174D7A', borderRadius: '50%', width: '170px', height: '170px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* <img src="/Logos/Arrows.png" alt="Reporting Function" style={{ width: '90px', height: '90px' }} /> */}
              </div>
              <h3 style={{ fontWeight: 'bold', marginTop: '20px', color: '#111' }}>REPORTING FUNCTION</h3>
              <p style={{ fontSize: '15px', marginTop: '10px', color: '#111' }}>Report instances of overpricing or fare disputes, ensuring passengers are charged fairly.</p>
            </div>
          </div>
          <div style={{ textAlign: 'right', maxWidth: '1100px', margin: '20px auto 0' }}>
          
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
