import React from "react";
import { useNavigate } from 'react-router-dom';
import '../../Styles/LandingCss/LandingPage.css';

import { useEffect, useState } from 'react';
import { CheckCircle, Building2, GraduationCap, Users, Shield } from 'lucide-react';

const Card = ({ children, className }) => (
  <div className={className}>{children}</div>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  
  useEffect(() => {
    try {
      const hash = window.location.hash || '';
      if (hash.startsWith('#')) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        if (token) {
          localStorage.setItem('accessToken', token);
          // remove token from URL if available
          if (window.history && typeof window.history.replaceState === 'function') {
            try { window.history.replaceState(null, '', window.location.pathname); } catch (err) { console.warn('replaceState failed', err); }
          }
        }
      }
  } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const benefits = [
    "Modernizes manual record management",
    "Eliminates verification delays",
    "Resolves data inconsistencies",
    "Reduces administrative workload",
    "Minimizes paperwork and filing",
    "Promotes transparency and accountability",
    "Ensures regulatory compliance",
    "Enables real-time monitoring"
  ];

  const partners = [
    { name: "Municipality of Solano", role: "Local Government Partner", icon: Building2 },
    { name: "Saint Mary's University", role: "Academic Development Partner", icon: GraduationCap },
    { name: "IT Students", role: "System Developers", icon: Users },
    { name: "Transport Authorities", role: "Regulatory Partners", icon: Shield }
  ];
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
          <button className="nav-link" onClick={() => navigate('/')}>ABOUT US</button>
          <button className="nav-link" onClick={() => navigate('/login')}>VERIFY TRICYCLE</button>
          <button className="nav-link" onClick={() => navigate('/login')}>NEW APPLICATION</button>
          <button className="nav-login" onClick={() => navigate('/login')}>LOGIN</button>
        </nav>
      </header>
      <main className="landing-main">
        
        <div className="main-content">
          <h1>Tricycle Verification and<br />Hassle-Free Online<br />Franchise in Solano</h1>
          <div className="main-buttons">
            <button className="main-btn yellow" onClick={() => navigate('/login')}>VERIFY A TRICYCLE</button>
            <button className="main-btn yellow" onClick={() => navigate('/login')}>APPLY/RENEW FRANCHISE</button>
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

      <div className="min-h-screen bg-[#F4D77E]">
      
        <section className="relative overflow-hidden pt-20 pb-32 px-6">
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              transform: `translateY(${scrollY * 0.5}px)`,
              background: `radial-gradient(circle at 30% 20%, #1B4B75 0%, transparent 50%),
                          radial-gradient(circle at 70% 60%, #1B4B75 0%, transparent 50%)`
            }}
          />
          
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="bg-[#1B4B75] inline-block px-8 py-3 mb-8">
              <h2 className="text-white font-bold text-2xl tracking-wide">ABOUT US</h2>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-[#1B4B75] mb-6 leading-tight">
              Tricycle Verification System (TRC-V)
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-800 max-w-3xl leading-relaxed font-medium mb-4">
              A digital platform designed to modernize and streamline the tricycle franchising 
              and verification process within the Municipality of Solano.
            </p>
            
            <p className="text-lg text-gray-700 max-w-3xl leading-relaxed">
              Developed through an innovative academic-government partnership with Saint Mary's University.
            </p>
          </div>
        </section>

        <section className="py-24 px-6 bg-[#1B4B75]">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <div className="bg-[#F4D77E] inline-block px-6 py-2 mb-6">
                  <h3 className="text-[#1B4B75] font-bold text-lg">OUR PURPOSE</h3>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-[#F4D77E] mb-6">
                  Transforming Tricycle Franchising Through Technology
                </h2>
                <p className="text-lg text-white/90 mb-4 leading-relaxed">
                  The TRC-V system was developed to address long-standing challenges in manual 
                  record management, verification delays, and data inconsistencies by introducing 
                  a centralized, automated, and transparent solution.
                </p>
                <p className="text-lg text-white/90 leading-relaxed">
                  Our platform enables local government offices to efficiently manage tricycle 
                  franchise applications, verify registered operators, and monitor franchise status 
                  in real time, ensuring that only authorized and compliant tricycles operate within 
                  the municipality.
                </p>
              </div>
              
              <div className="relative">
                <div className="absolute -top-8 -right-8 w-64 h-64 bg-[#F4D77E] rounded-full opacity-20 blur-3xl" />
                <div className="relative bg-white/10 backdrop-blur-sm rounded-3xl p-8 border-4 border-[#F4D77E]">
                  <div className="space-y-4">
                    {benefits.map((benefit, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <CheckCircle className="w-6 h-6 text-[#F4D77E] flex-shrink-0 mt-1" />
                        <span className="text-white font-medium">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 px-6 bg-gradient-to-b from-[#F4D77E] to-[#E8C968]">
          <div className="max-w-4xl mx-auto text-center mb-24">
            <div className="bg-[#1B4B75] inline-block px-6 py-2 mb-6">
              <h3 className="text-white font-bold text-lg">OUR COMMITMENT</h3>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-[#1B4B75] mb-8">
              Good Governance Through Digital Transformation
            </h2>
            <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-10 border-4 border-[#1B4B75]">
              <p className="text-xl text-gray-800 leading-relaxed mb-6">
                This initiative reflects the Municipality of Solano's commitment to <span className="font-bold text-[#1B4B75]">good governance</span>, 
                <span className="font-bold text-[#1B4B75]"> digital transformation</span>, and <span className="font-bold text-[#1B4B75]">sustainable urban mobility</span>.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                By leveraging technology, TRC-V promotes operational efficiency, regulatory compliance, 
                and accountability among tricycle operators and transport authorities, creating a safer 
                and more organized transportation system for the entire community.
              </p>
            </div>
          </div>

          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="bg-[#1B4B75] inline-block px-6 py-2 mb-6">
                <h3 className="text-white font-bold text-lg">COLLABORATION</h3>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#1B4B75] mb-4">
                Academic-Government Partnership
              </h2>
              <p className="text-xl text-gray-800 max-w-3xl mx-auto">
                TRC-V was developed in collaboration with Saint Mary's University Information Technology students, 
                demonstrating the potential of academic-government partnerships in building practical and 
                scalable solutions that directly benefit the community.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {partners.map((partner, index) => (
                <Card 
                  key={index}
                  className="bg-white border-2 border-[#1B4B75] hover:shadow-xl transition-all duration-300 overflow-hidden group"
                >
                  <div className="p-6 text-center">
                    <div className="w-24 h-24 mx-auto mb-4 bg-[#1B4B75] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <partner.icon className="w-12 h-12 text-white" strokeWidth={1.5} />
                    </div>
                    <h4 className="text-lg font-bold text-[#1B4B75] mb-2">
                      {partner.name}
                    </h4>
                    <p className="text-gray-600 text-sm">
                      {partner.role}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Announcements Pagee ni papa\pi lucas ni jakey */}
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
             <div style={{ background: '#174D7A', color: '#F5D76E', display: 'inline-block', padding: '10px 50px', borderRadius: '2px', fontWeight: 'bold', fontSize: '28px', boxShadow: '2px 2px 6px #b3a04a', fontFamily: 'Poppins, sans-serif' }}>
              FEATURES
            </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '60px', maxWidth: '1100px', margin: '0 auto' }}>
          
            <div style={{ textAlign: 'center', width: '300px' }}>
              <div style={{ background: '#174D7A', borderRadius: '50%', width: '170px', height: '170px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/Logos/2.png" alt="Tricycle Verification" style={{ width: '150px', height: '150px' }} />
              </div>
              <h3 style={{ fontWeight: 'bold', marginTop: '20px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>TRICYCLE VERIFICATION</h3>
              <p style={{ fontSize: '15px', marginTop: '10px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>Instantly check if a tricycle is registered and franchised by scanning its QR code.</p>
            </div>
           
            <div style={{ textAlign: 'center', width: '300px' }}>
              <div style={{ background: '#174D7A', borderRadius: '50%', width: '170px', height: '170px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/Logos/4.png" alt="Franchise Application" style={{ width: '150px', height: '150px' }} />
              </div>
              <h3 style={{ fontWeight: 'bold', marginTop: '20px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>FRANCHISE APPLICATION AND RENEWAL</h3>
              <p style={{ fontSize: '15px', marginTop: '10px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>Submit new franchise applications or renew your existing one online with ease.</p>
            </div>
           
            <div style={{ textAlign: 'center', width: '300px' }}>
              <div style={{ background: '#174D7A', borderRadius: '50%', width: '170px', height: '170px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/Logos/6.png" alt="Reporting Function" style={{ width: '150px', height: '150px' }} />
              </div>
              <h3 style={{ fontWeight: 'bold', marginTop: '20px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>REPORTING FUNCTION</h3>
              <p style={{ fontSize: '15px', marginTop: '10px', color: '#111', fontFamily: 'Poppins, sans-serif' }}>Report instances of overpricing or fare disputes, ensuring passengers are charged fairly.</p>
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
