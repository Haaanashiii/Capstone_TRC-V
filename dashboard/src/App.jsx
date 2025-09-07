import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import SignUp from './pages/SignUp';
import LandingPage from './pages/LandingPage';

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
  <Route path="/maintenance" element={<MaintenancePage />} />
      </Routes>
    </Router>
  );
}

export default App;
