import React from 'react';
import '../Styles/LogoLoader.css';
import logoImage from '../assets/TRC-vLogo.png';

const LogoLoader = () => {
  return (
    <div className="logo-loader-container">
      <div className="logo-loader-wrapper">
        <img 
          src={logoImage} 
          alt="Loading..." 
          className="logo-loader-image"
        />
      </div>
    </div>
  );
};

export default LogoLoader;
