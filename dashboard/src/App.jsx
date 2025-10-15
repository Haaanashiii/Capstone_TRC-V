import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import SignUp from './pages/signup/SignUp';
import OAuthCallback from './pages/Services/OAuthCallback';

import DriverID from './pages/Driver/DriverID';
import LandingPage from './pages/Landing/LandingPage';
import Login from './pages/Login/Login';
import Franchise from './pages/Driver/Franchise';
import FranchiseApplication from './pages/Driver/FranchiseApplication';
import MaintenancePage from './pages/Maintenance/MaintenancePage';
import AdminDashboard from './pages/Administration/AdminDashboard';
import UserManagement from './pages/Administration/UserManagement';
import ReportDriver from './pages/Reporting/reportDriver';

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
        <Route path="/login" element={<Login />} />
        <Route path="/oauth-callback" element={<OAuthCallback />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        
        {/* Protected Driver Routes */}
        <Route 
          path="/driver/id" 
          element={
            <ProtectedRoute requiredRole="driver">
              <DriverID />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/driver/franchise" 
          element={
            <ProtectedRoute requiredRole="driver">
              <Franchise />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/driver/franchise/application" 
          element={
            <ProtectedRoute requiredRole="driver">
              <FranchiseApplication />
            </ProtectedRoute>
          } 
        />
        
        {/* Protected Admin Routes */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/user-management" 
          element={
            <ProtectedRoute requiredRole="admin">
              <UserManagement />
            </ProtectedRoute>
          } 
        />
        
        {/* Public Report Route */}
        <Route path="/report-driver" element={<ReportDriver />} />
        
        {/* Catch-all route */}
        <Route path="*" element={<MaintenancePage />} />
      </Routes>
    </Router>
  );
}

export default App;
