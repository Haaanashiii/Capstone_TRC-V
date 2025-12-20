import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PageProtectedRoute from './components/PageProtectedRoute';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import ErrorBoundary from './components/ErrorBoundary';
import PageLoader from './components/PageLoader';
import SignUp from './pages/auth/SignUp';
import OAuthCallback from './pages/auth/OAuthCallback';
import './utils/envCheck';
import Sidebar from './pages/Administration/Sidebar';
import FranchiseeListOperatorSide from './pages/Driver/FranchiseeListOperatorSide';
import LandingPage from './pages/Landing/LandingPage';
import Login from './pages/auth/Login';
import OperatorHomePage from './pages/Driver/OperatorHomePage';
import FranchiseApplication from './pages/Driver/FranchiseApplication';
import RequestAmendment from './pages/Driver/RequestAmendment';
import MaintenancePage from './pages/Maintenance/MaintenancePage';
import ReportDriver from './pages/Reporting/reportDriver';
import QROperatorID from './pages/Driver/QROperatorID';
import { I18nProvider } from './contexts/I18nContext';

// Lazy load heavy admin components
const AdminManagement = lazy(() => import('./pages/Administration/AdminManagement'));
const FranchiseeList = lazy(() => import('./pages/Administration/FranchiseeList'));
const FranchiseMgmt = lazy(() => import('./pages/Administration/FranchiseMgmt'));
const Dashboard = lazy(() => import('./pages/Administration/Dashboard'));
const Certificate = lazy(() => import('./pages/Administration/Certificate'));
const TricycleIncidentReports = lazy(() => import('./pages/Administration/TricycleIncidentReports'));
const FranchiseLinking = lazy(() => import('./pages/Administration/FranchiseLinking'));
const Announcement = lazy(() => import('./pages/Administration/Announcement'));
const Analytics = lazy(() => import('./pages/Administration/Analytics'));
const AuditTrail = lazy(() => import('./pages/Administration/AuditTrail'));
const Settings = lazy(() => import('./pages/Administration/Settings'));

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
    <ErrorBoundary>
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
            <Suspense fallback={<PageLoader />}>
              <PageProtectedRoute pageKey="dashboard">
                <Dashboard />
              </PageProtectedRoute>
            </Suspense>
          } 
        />
        <Route 
          path="/franchisee-list" 
          element={
            <Suspense fallback={<PageLoader />}>
              <PageProtectedRoute pageKey="franchisee-list">
                <FranchiseeList />
              </PageProtectedRoute>
            </Suspense>
          } 
        />
        <Route 
          path="/franchise-management" 
          element={
            <Suspense fallback={<PageLoader />}>
              <PageProtectedRoute pageKey="franchise-management">
                <FranchiseMgmt />
              </PageProtectedRoute>
            </Suspense>
          } 
        />
        <Route 
          path="/certificate" 
          element={
            <Suspense fallback={<PageLoader />}>
              <PageProtectedRoute pageKey="certificate">
                <Certificate />
              </PageProtectedRoute>
            </Suspense>
          } 
        />
        <Route 
          path="/incident-reports" 
          element={
            <Suspense fallback={<PageLoader />}>
              <PageProtectedRoute pageKey="incident-reports">
                <TricycleIncidentReports />
              </PageProtectedRoute>
            </Suspense>
          } 
        />
        <Route 
          path="/franchise-linking" 
          element={
            <Suspense fallback={<PageLoader />}>
              <PageProtectedRoute pageKey="franchise-linking">
                <FranchiseLinking />
              </PageProtectedRoute>
            </Suspense>
          } 
        />
        <Route 
          path="/admin-management" 
          element={
            <Suspense fallback={<PageLoader />}>
              <PageProtectedRoute pageKey="admin-management">
                <AdminManagement />
              </PageProtectedRoute>
            </Suspense>
          } 
        />
        <Route 
          path="/announcements" 
          element={
            <Suspense fallback={<PageLoader />}>
              <PageProtectedRoute pageKey="announcements">
                <Announcement />
              </PageProtectedRoute>
            </Suspense>
          } 
        />
        <Route 
          path="/analytics" 
          element={
            <Suspense fallback={<PageLoader />}>
              <PageProtectedRoute pageKey="analytics">
                <Analytics />
              </PageProtectedRoute>
            </Suspense>
          } 
        />
        <Route 
          path="/audit-trail" 
          element={
            <Suspense fallback={<PageLoader />}>
              <PageProtectedRoute pageKey="audit-trail">
                <AuditTrail />
              </PageProtectedRoute>
            </Suspense>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <Suspense fallback={<PageLoader />}>
              <PageProtectedRoute pageKey="settings">
                <Settings />
              </PageProtectedRoute>
            </Suspense>
          } 
        />
        
        {/* Public Report Route */}
        <Route path="/report-driver" element={<ReportDriver />} />
        
        {/* Catch-all route */}
        <Route path="*" element={<MaintenancePage />} />
      </Routes>
    </Router>
    </ErrorBoundary>
  );
}

export default App;
