import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import SignUp from './pages/SignUp';
import DriverSignUp from './pages/DriverSignUp';
import DriverID from './pages/DriverID';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import MaintenancePage from './pages/MaintenancePage';

function LandingPageWithNav() {
  const navigate = useNavigate();
  return <LandingPage onLoginClick={() => navigate('/signup')} />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/driver-signup" element={<DriverSignUp />} />
    
  <Route path="/maintenance" element={<MaintenancePage />} />
  <Route path="/login" element={<Login />} />
  <Route path="/driver-id" element={<DriverID />} />
  <Route path="*" element={<MaintenancePage />} />
      </Routes>
    </Router>
  );
}

export default App;
