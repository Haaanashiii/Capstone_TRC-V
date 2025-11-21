import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import SignUp from './pages/auth/SignUp';
import OAuthCallback from './pages/auth/OAuthCallback';
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
import Reports from './pages/Administration/Reports';
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
        
        {/* Protected Driver Routes */}
        <Route 
          path="/operator/franchisee-list" 
          element={<FranchiseeListOperatorSide />} 
        />
        <Route 
          path="/operator/id" 
          element={
            <ProtectedRoute requiredRole="operator">
              <FranchiseeListOperatorSide />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/operator/franchise" 
          element={
            <ProtectedRoute requiredRole="operator">
              <OperatorHomePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/operator/franchise/application" 
          element={
            <ProtectedRoute requiredRole="operator">
              <FranchiseApplication />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/operator/request-amendment"
          element={<RequestAmendment />}
        />
        {/* Temporarily removed ProtectedRoute for UI testing */}
        {/* 
        <Route 
          path="/operator/request-amendment"
          element={
            <ProtectedRoute requiredRole="operator">
              <RequestAmendment />
            </ProtectedRoute>
          }
        />
        */}
        
        {/* Protected Admin Routes */}
        <Route 
          path="/sb-admin" 
          element={
            <ProtectedRoute requiredRole={["sb-admin", "super-admin"]}>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/bplo-admin" 
          element={
            <ProtectedRoute requiredRole={["bplo-admin", "super-admin"]}>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute requiredRole={["sb-admin", "super-admin"]}>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/user-management" 
          element={
            <ProtectedRoute requiredRole={["sb-admin", "super-admin"]}>
              <UserManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sb-admin/user-management" 
          element={
            <ProtectedRoute requiredRole={["sb-admin", "super-admin"]}>
              <UserManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sb-admin/franchisee-list" 
          element={
            <ProtectedRoute requiredRole={["sb-admin", "super-admin"]}>
              <FranchiseeList />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sb-admin/franchise-management" 
          element={
            <ProtectedRoute requiredRole={["sb-admin", "super-admin"]}>
              <FranchiseMgmt />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sb-admin/dashboard" 
          element={
            <ProtectedRoute requiredRole={["sb-admin", "super-admin"]}>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sb-admin/reports" 
          element={
            <ProtectedRoute requiredRole={["sb-admin", "super-admin"]}>
              <Reports />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sb-admin/announcements" 
          element={
            <ProtectedRoute requiredRole={["super-admin"]}>
              <Announcement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sb-admin/analytics" 
          element={
            <ProtectedRoute requiredRole={["sb-admin", "super-admin"]}>
              <Analytics />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sb-admin/audit-trail" 
          element={
            <ProtectedRoute requiredRole={["super-admin"]}>
              <AuditTrail />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sb-admin/settings" 
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
