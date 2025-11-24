import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import SignUp from './pages/auth/SignUp';
import OAuthCallback from './pages/auth/OAuthCallback';
import './utils/envCheck'; // Check environment variables on app load
import Sidebar from './pages/Administration/Sidebar';
import FranchiseeListOperatorSide from './pages/Driver/FranchiseeListOperatorSide';
import LandingPage from './pages/Landing/LandingPage';
import Login from './pages/auth/Login';
import OperatorHomePage from './pages/Driver/OperatorHomePage';
import FranchiseApplication from './pages/Driver/FranchiseApplication';
import RequestAmendment from './pages/Driver/RequestAmendment';
import MaintenancePage from './pages/Maintenance/MaintenancePage';
import UserManagement from './pages/Administration/UserManagement';
import ReportDriver from './pages/Reporting/reportDriver';
import FranchiseeList from './pages/Administration/FranchiseeList';
import FranchiseMgmt from './pages/Administration/FranchiseMgmt';
import Dashboard from './pages/Administration/Dashboard';
import Certificate from './pages/Administration/Certificate';
import FareReports from './pages/Administration/FareReports';
import Announcement from './pages/Administration/Announcement';
import Analytics from './pages/Administration/Analytics';
import AuditTrail from './pages/Administration/AuditTrail';
import Settings from './pages/Administration/Settings';
import QROperatorID from './pages/Driver/QROperatorID';

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
        
        {/* Public QR Code Route - No authentication required */}
        <Route path="/operator/id/:operatorId" element={<QROperatorID />} />
        
        {/* Protected Driver/Operator Routes */}
        <Route 
          path="/operator/franchisee-list" 
          element={
            <ProtectedRoute requiredRole={["user", "operator"]}>
              <FranchiseeListOperatorSide />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/operator/id" 
          element={
            <ProtectedRoute requiredRole={["user", "operator"]}>
              <FranchiseeListOperatorSide />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/operator/franchise" 
          element={
            <ProtectedRoute requiredRole={["user", "operator"]}>
              <OperatorHomePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/operator/franchise/application" 
          element={
            <ProtectedRoute requiredRole={["user", "operator"]}>
              <FranchiseApplication />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/operator/request-amendment"
          element={
            <ProtectedRoute requiredRole={["user", "operator"]}>
              <RequestAmendment />
            </ProtectedRoute>
          }
        />
        
        {/* Protected Admin Routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute requiredRole={["bplo-admin", "sb-admin", "super-admin"]}>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/franchisee-list" 
          element={
            <ProtectedRoute requiredRole={["bplo-admin", "sb-admin", "super-admin"]}>
              <FranchiseeList />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/franchise-management" 
          element={
            <ProtectedRoute requiredRole={["bplo-admin", "sb-admin", "super-admin"]}>
              <FranchiseMgmt />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/certificate" 
          element={
            <ProtectedRoute requiredRole={["bplo-admin", "sb-admin", "super-admin"]}>
              <Certificate />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/fare-reports" 
          element={
            <ProtectedRoute requiredRole={["bplo-admin", "sb-admin", "super-admin"]}>
              <FareReports />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/user-management" 
          element={
            <ProtectedRoute requiredRole={["super-admin"]}>
              <UserManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/announcements" 
          element={
            <ProtectedRoute requiredRole={["super-admin"]}>
              <Announcement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/analytics" 
          element={
            <ProtectedRoute requiredRole={["super-admin"]}>
              <Analytics />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/audit-trail" 
          element={
            <ProtectedRoute requiredRole={["super-admin"]}>
              <AuditTrail />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute requiredRole={["super-admin"]}>
              <Settings />
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
