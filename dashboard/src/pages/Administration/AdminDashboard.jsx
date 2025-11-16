import React from 'react';
import UnifiedSidebar from '../../components/UnifiedSidebar';
import '../../Styles/Administrator_Css/Dashboard.css';

function AdminDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <UnifiedSidebar userType="admin" />
      <div style={{ flex: 1, padding: '20px', background: '#f5f7fa' }}>
        <h1>Admin Dashboard</h1>
        <p>Welcome to the TRC-V Administration Panel</p>
      </div>
    </div>
  );
}

export default AdminDashboard;