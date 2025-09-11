import React, { useState } from 'react';
import './DriverSignUp.css';

const DriverSignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Add signup logic here
  };

  return (
    <div className="signup-container">
      <div className="signup-header">
        <img src="/public/Logos/TRC-vLogo.png" alt="TRC-V Logo" className="logo" />
        <div className="system-title">
          <span className="trc-title">TRC-<span className="trc-highlight">V</span></span>
          <span className="subtitle">TRICYCLE VERIFICATION SYSTEM</span>
        </div>
        <img src="/public/Logos/clipboard.gif" alt="Clipboard" className="icon" />
        <img src="/public/Logos/SBLogo.png" alt="SB Logo" className="sb-logo" />
      </div>
      <form className="signup-form" onSubmit={handleSubmit}>
        <h2 className="signup-title">Sign up</h2>
        <label htmlFor="email">E-mail</label>
        <input
          type="email"
          id="email"
          placeholder="example@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          type="password"
          id="password"
          placeholder="@#*%"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="signup-options">
          <label>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={() => setRememberMe(!rememberMe)}
            />
            Remember me
          </label>
          <a href="#" className="forgot-link">Forgot Password?</a>
        </div>
        <button type="submit" className="signup-btn">Sign up</button>
      </form>
    </div>
  );
};

export default DriverSignUp;
