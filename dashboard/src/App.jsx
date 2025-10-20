import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import SignUp from './pages/signup/SignUp';
import OAuthCallback from './pages/Services/OAuthCallback';
import Sidebar from './pages/Administration/Sidebar';
import DriverID from './pages/Driver/DriverID';
import LandingPage from './pages/Landing/LandingPage';
import Login from './pages/Login/Login';
import Franchise from './pages/Driver/Franchise';
import FranchiseApplication from './pages/Driver/FranchiseApplication';
import MaintenancePage from './pages/Maintenance/MaintenancePage';
import AdminDashboard from './pages/Administration/AdminDashboard';
import UserManagement from './pages/Administration/UserManagement';
import ReportDriver from './pages/Reporting/reportDriver';
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
        <Route path="/login" element={<Login />} />
        <Route path="/oauth-callback" element={<OAuthCallback />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        
        {/* Protected Driver Routes */}
        <Route 
          path="/operator/id" 
          element={
            <ProtectedRoute requiredRole="operator">
              <DriverID />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/operator/franchise" 
          element={
            <ProtectedRoute requiredRole="operator">
              <Franchise />
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
        
        {/* Protected Admin Routes */}
        <Route 
          path="/sb-admin" 
          element={
            <ProtectedRoute requiredRole="sb-admin">
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/bplo-admin" 
          element={
            <ProtectedRoute requiredRole="bplo-admin">
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/user-management" 
          element={
            <ProtectedRoute requiredRole="sb-admin">
              <UserManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sb-admin/user-management" 
          element={
            <ProtectedRoute requiredRole="sb-admin">
              <UserManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sb-admin/franchisee-list" 
          element={
            <ProtectedRoute requiredRole="sb-admin">
              <FranchiseeList />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sb-admin/franchise-management" 
          element={
            <ProtectedRoute requiredRole="sb-admin">
              <FranchiseMgmt />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sb-admin/dashboard" 
          element={
            <ProtectedRoute requiredRole="sb-admin">
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sb-admin/reports" 
          element={
            <ProtectedRoute requiredRole="sb-admin">
              <Reports />
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
