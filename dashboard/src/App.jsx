import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PageProtectedRoute from './components/PageProtectedRoute';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
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
import { I18nProvider } from './contexts/I18nContext';

function LandingPageWithNav() {
  const navigate = useNavigate();
  return <LandingPage onLoginClick={() => navigate('/signup')} />;
}

// Wrapper for user/driver/operator routes with i18n support
function UserRoutesWrapper({ children }) {
  return <I18nProvider>{children}</I18nProvider>;
}

function App() {
  return (
    <Router>
      <PWAUpdatePrompt />
      <Routes>
        <Route path="/" element={<UserRoutesWrapper><LandingPage /></UserRoutesWrapper>} />
        <Route path="/signup" element={<UserRoutesWrapper><SignUp /></UserRoutesWrapper>} />
        <Route path="/login" element={<UserRoutesWrapper><Login /></UserRoutesWrapper>} />
        <Route path="/oauth-callback" element={<OAuthCallback />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        
        {/* Public QR Code Route - No authentication required */}
        <Route path="/verify/franchise/:operatorId" element={<QROperatorID />} />
        
        {/* Protected Driver/Operator Routes with i18n */}
        <Route 
          path="/operator/franchisee-list" 
          element={
            <UserRoutesWrapper>
              <ProtectedRoute requiredRole={["user", "operator"]}>
                <FranchiseeListOperatorSide />
              </ProtectedRoute>
            </UserRoutesWrapper>
          } 
        />
        <Route 
          path="/operator/id" 
          element={
            <UserRoutesWrapper>
              <ProtectedRoute requiredRole={["user", "operator"]}>
                <FranchiseeListOperatorSide />
              </ProtectedRoute>
            </UserRoutesWrapper>
          } 
        />
        <Route 
          path="/operator/franchise" 
          element={
            <UserRoutesWrapper>
              <ProtectedRoute requiredRole={["user", "operator"]}>
                <OperatorHomePage />
              </ProtectedRoute>
            </UserRoutesWrapper>
          } 
        />
        <Route 
          path="/operator/franchise/application" 
          element={
            <UserRoutesWrapper>
              <ProtectedRoute requiredRole={["user", "operator"]}>
                <FranchiseApplication />
              </ProtectedRoute>
            </UserRoutesWrapper>
          } 
        />
        <Route 
          path="/operator/request-amendment"
          element={
            <UserRoutesWrapper>
              <ProtectedRoute requiredRole={["user", "operator"]}>
                <RequestAmendment />
              </ProtectedRoute>
            </UserRoutesWrapper>
          }
        />
        
        {/* Protected Admin Routes - Using database-driven page access */}
        <Route 
          path="/dashboard" 
          element={
            <PageProtectedRoute pageKey="dashboard">
              <Dashboard />
            </PageProtectedRoute>
          } 
        />
        <Route 
          path="/franchisee-list" 
          element={
            <PageProtectedRoute pageKey="franchisee-list">
              <FranchiseeList />
            </PageProtectedRoute>
          } 
        />
        <Route 
          path="/franchise-management" 
          element={
            <PageProtectedRoute pageKey="franchise-management">
              <FranchiseMgmt />
            </PageProtectedRoute>
          } 
        />
        <Route 
          path="/certificate" 
          element={
            <PageProtectedRoute pageKey="certificate">
              <Certificate />
            </PageProtectedRoute>
          } 
        />
        <Route 
          path="/fare-reports" 
          element={
            <PageProtectedRoute pageKey="fare-reports">
              <FareReports />
            </PageProtectedRoute>
          } 
        />
        <Route 
          path="/user-management" 
          element={
            <PageProtectedRoute pageKey="user-management">
              <UserManagement />
            </PageProtectedRoute>
          } 
        />
        <Route 
          path="/announcements" 
          element={
            <PageProtectedRoute pageKey="announcements">
              <Announcement />
            </PageProtectedRoute>
          } 
        />
        <Route 
          path="/analytics" 
          element={
            <PageProtectedRoute pageKey="analytics">
              <Analytics />
            </PageProtectedRoute>
          } 
        />
        <Route 
          path="/audit-trail" 
          element={
            <PageProtectedRoute pageKey="audit-trail">
              <AuditTrail />
            </PageProtectedRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <PageProtectedRoute pageKey="settings">
              <Settings />
            </PageProtectedRoute>
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
