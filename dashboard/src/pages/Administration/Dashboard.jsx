import React from 'react'
import '../../Styles/Administrator_Css/Dashboard.css'
import Sidebar from './Sidebar'

function Dashboard() {
  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="content-container">
        <h1 className="title">Dashboard</h1>
        {/* Add your dashboard content here */}
      </div>
    </div>
  )
}

export default Dashboard
