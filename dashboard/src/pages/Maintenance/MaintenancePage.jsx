import React from 'react';
import './MaintenancePage.css';

const MaintenancePage = () => {
  return (
    <div className="maintenance-container">
      <div style={{ paddingTop: '40px' }}>
        <div className="maintenance-header">
          <img src="/Logos/SBLogo.png" alt="Solano Logo" className="maintenance-logo" />
          <div className="maintenance-title">UNDER MAINTENANCE</div>
          <img src="/Logos/TRC-vLogo.png" alt="QR Logo" className="maintenance-logo" />
        </div>
  <img src="/Logos/Tricy (2).png" alt="Tricycle" className="maintenance-tricycle tricycle-animate" />
        <h2 className="maintenance-message">We will be back shortly.</h2>
     
      </div>
    </div>
  );
};

export default MaintenancePage;
