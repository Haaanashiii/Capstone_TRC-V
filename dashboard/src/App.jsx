import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import SignUp from './pages/Login/signup/SignUp';
import OAuthCallback from './pages/Login/OAuthCallback';

import DriverID from './pages/Driver/DriverID';
import LandingPage from './pages/Landing/LandingPage';
import Login from './pages/Login/Login';
import Franchise from './pages/Driver/Franchise';
import FranchiseApplication from './pages/Driver/FranchiseApplication';
import MaintenancePage from './pages/Maintenance/MaintenancePage';
import Sidebar from './pages/Administration/Sidebar';
import UserManagement from './pages/Administration/UserManagement';
import FranchiseeList from './pages/Administration/FranchiseeList';
import FranchiseMgmt from './pages/Administration/FranchiseMgmt';
import Dashboard from './pages/Administration/Dashboard';
import Reports from './pages/Administration/Reports';

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
        <Route path="/driver/id" element={<DriverID />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/oauth-callback" element={<OAuthCallback />} />
        <Route path="/driver/franchise" element={<Franchise />} />
        <Route path="/driver/franchise/application" element={<FranchiseApplication />} />
        <Route path="*" element={<MaintenancePage />} />
        <Route path="/admin" element={<Sidebar />} />
        <Route path="/admin/user-management" element={<UserManagement />} />
        <Route path="/admin/franchisee-list" element={<FranchiseeList />} />
        <Route path="/admin/franchise-management" element={<FranchiseMgmt />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/reports" element={<Reports />} />

      </Routes>
    </Router>
  );
}

export default App;
