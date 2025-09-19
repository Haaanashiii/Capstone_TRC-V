import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import SignUp from './pages/Login/signup/SignUp';
import DriverSignUp from './pages/Driver/DriverSignUp';
import DriverID from './pages/Driver/DriverID';
import LandingPage from './pages/Landing/LandingPage';
import Login from './pages/Login/Login';
import Franchise from './pages/Driver/Franchise';
import FranchiseApplication from './pages/Driver/FranchiseApplication';
import MaintenancePage from './pages/Maintenance/MaintenancePage';
import Sidebar from './pages/Administration/Sidebar';

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
        <Route path="/driver/signup" element={<DriverSignUp />} />
        <Route path="/driver/id" element={<DriverID />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/driver/franchise" element={<Franchise />} />
        <Route path="/driver/franchise/application" element={<FranchiseApplication />} />
        <Route path="*" element={<MaintenancePage />} />
        <Route path="/admin" element={<Sidebar />} />
      </Routes>
    </Router>
  );
}

export default App;
