import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  EventBusy as EventBusyIcon,
  PendingActions as PendingActionsIcon,
  Report as ReportIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import '../../Styles/Administrator_Css/Dashboard.css';
import Sidebar from './Sidebar';
import KpiCard from '../../components/KpiCard';
import { dashboardAPI } from '../Services/api';
import websocketService from '../../services/websocket';

function Dashboard() {
  const navigate = useNavigate();
  
  // State management
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Memoized user info and greeting
  const { userName, greeting } = useMemo(() => {
    const token = sessionStorage.getItem('accessToken');
    let name = 'Admin';
    
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        name = decoded.name || 'Admin';
      } catch (error) {
        console.error('[Dashboard] Error decoding token:', error);
      }
    }

    // Set greeting based on time of day
    const hour = new Date().getHours();
    let greetingText = 'Good Evening';
    if (hour < 12) {
      greetingText = 'Good Morning';
    } else if (hour < 18) {
      greetingText = 'Good Afternoon';
    }

    return { userName: name, greeting: greetingText };
  }, []); // Only calculate once on mount

  // Optimized data fetching with single API call
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[Dashboard] Fetching statistics from API...');
      
      // Single optimized API call that returns all dashboard data
      const response = await dashboardAPI.getStatistics();
      
      if (response?.data?.success && response.data.data) {
        const { kpis, trends } = response.data.data;
        
        setDashboardData({
          kpiData: {
            totalRegistered: kpis.totalRegistered || 0,
            expiredFranchise: kpis.expiredFranchise || 0,
            pendingVerifications: kpis.pendingVerifications || 0,
            pendingReports: kpis.pendingReports || 0,
            totalApplications: kpis.totalApplications || 0,
            approvalRate: kpis.approvalRate || 0,
          },
          trendData: trends.monthly || [],
          currentMonthInfo: trends.currentMonth || null,
          timestamp: response.data.data.timestamp,
        });

        console.log('[Dashboard] Statistics loaded successfully:', {
          totalRegistered: kpis.totalRegistered,
          pendingVerifications: kpis.pendingVerifications,
          expiredFranchise: kpis.expiredFranchise,
        });
        
        setRetryCount(0); // Reset retry count on success
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      console.error('[Dashboard] Error fetching data:', err);
      
      const errorMessage = err.response?.status === 401 
        ? 'Session expired. Please log in again.'
        : err.response?.status === 403
        ? 'You do not have permission to view this dashboard.'
        : err.response?.data?.error || err.message || 'Failed to load dashboard data';
      
      setError(errorMessage);
      
      // Set empty fallback data on error
      setDashboardData({
        kpiData: {
          totalRegistered: 0,
          expiredFranchise: 0,
          pendingVerifications: 0,
          pendingReports: 0,
          totalApplications: 0,
          approvalRate: 0,
        },
        trendData: [],
        currentMonthInfo: null,
        timestamp: new Date().toISOString(),
      });

      // Redirect to login if unauthorized
      if (err.response?.status === 401) {
        setTimeout(() => navigate('/login'), 2000);
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Fetch data on component mount and setup WebSocket
  useEffect(() => {
    fetchDashboardData();

    // Connect to WebSocket for real-time updates
    if (!websocketService.isConnected()) {
      console.log('[Dashboard] Connecting to WebSocket');
      websocketService.connect('general')
    }

    // Subscribe to dashboard statistics updates
    const handleDashboardUpdates = () => {
      console.log('[Dashboard] WebSocket update - dashboard-statistics');
      fetchDashboardData();
    };

    websocketService.on('dashboard-statistics', handleDashboardUpdates);
    websocketService.on('franchise-updated', handleDashboardUpdates);
    websocketService.on('application-updated', handleDashboardUpdates);

    return () => {
      websocketService.off('dashboard-statistics', handleDashboardUpdates);
      websocketService.off('franchise-updated', handleDashboardUpdates);
      websocketService.off('application-updated', handleDashboardUpdates);
    };
  }, [fetchDashboardData]);

  // Manual retry handler
  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="content-container">
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 4,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Typography
            variant="h4"
            className="title"
            sx={{
              fontSize: '36px',
              fontWeight: 700,
              color: '#0A356B',
              letterSpacing: '-0.5px',
              mb: 0,
            }}
          >
            Dashboard
          </Typography>
          
          {userName && (
            <Paper
              elevation={3}
              sx={{
                backgroundColor: '#0A356B',
                color: '#ffffff',
                padding: '16px 24px',
                borderRadius: '12px',
                minWidth: '280px',
                textAlign: 'right',
              }}
            >
              <Typography
                sx={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  mb: 0.5,
                }}
              >
                {greeting}, {userName}!
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.875rem',
                  fontWeight: 400,
                  opacity: 0.9,
                }}
              >
                Here is your overview for today's operations.
              </Typography>
            </Paper>
          )}
        </Box>

        {/* Error Alert with Retry */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            action={
              <Typography
                onClick={handleRetry}
                sx={{
                  cursor: 'pointer',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  '&:hover': { opacity: 0.8 },
                }}
              >
                Retry
              </Typography>
            }
          >
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '300px',
              gap: 2,
            }}
          >
            <CircularProgress size={48} sx={{ color: '#0A356B' }} />
            <Typography sx={{ color: '#6B7280', fontSize: '0.875rem' }}>
              Loading dashboard data...
            </Typography>
          </Box>
        ) : dashboardData ? (
          <>
            {/* KPI Cards Section */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(4, 1fr)',
                },
                gap: 3,
                mb: 4,
              }}
            >
              <KpiCard
                title="Total Registered Units"
                value={dashboardData.kpiData.totalRegistered}
                icon={AssessmentIcon}
                iconColor="#0A356B"
                route="/franchisee-list"
              />
              <KpiCard
                title="Expired Franchise"
                value={dashboardData.kpiData.expiredFranchise}
                icon={EventBusyIcon}
                iconColor="#DC2626"
                route="/franchisee-list"
              />
              <KpiCard
                title="Pending Verifications"
                value={dashboardData.kpiData.pendingVerifications}
                icon={PendingActionsIcon}
                iconColor="#F59E0B"
                route="/franchise-management"
              />
              <KpiCard
                title="Pending Reports"
                value={dashboardData.kpiData.pendingReports}
                icon={ReportIcon}
                iconColor="#EF4444"
                route="/reports"
              />
            </Box>

            {/* Trend Chart Section */}
            <Paper
              elevation={2}
              sx={{
                p: 3,
                borderRadius: 3,
                backgroundColor: '#ffffff',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography
                  variant="h6"
                  sx={{
                    color: '#0A356B',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                  }}
                >
                  Verification Processing Trend
                </Typography>
                {dashboardData.currentMonthInfo && (
                  <Chip
                    label={`${dashboardData.currentMonthInfo.month}: ${dashboardData.currentMonthInfo.applications} applications`}
                    sx={{
                      backgroundColor: '#0A356B',
                      color: '#ffffff',
                      fontWeight: 600,
                    }}
                  />
                )}
              </Box>
              
              {dashboardData.trendData && dashboardData.trendData.length > 0 ? (
                <Box sx={{ width: '100%', height: 400 }}>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                      data={dashboardData.trendData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="month"
                        stroke="#6B7280"
                        style={{ fontSize: '0.875rem', fontFamily: 'Poppins, sans-serif' }}
                      />
                      <YAxis
                        stroke="#6B7280"
                        style={{ fontSize: '0.875rem', fontFamily: 'Poppins, sans-serif' }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          padding: '12px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        }}
                        labelStyle={{
                          color: '#0A356B',
                          fontWeight: 600,
                          fontFamily: 'Poppins, sans-serif',
                        }}
                        itemStyle={{
                          color: '#0A356B',
                          fontFamily: 'Poppins, sans-serif',
                        }}
                      />
                      <Legend
                        wrapperStyle={{
                          paddingTop: '20px',
                          fontFamily: 'Poppins, sans-serif',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="verifications"
                        stroke="#0A356B"
                        strokeWidth={3}
                        dot={{
                          fill: '#0A356B',
                          strokeWidth: 2,
                          r: 5,
                        }}
                        activeDot={{
                          r: 7,
                          fill: '#0A356B',
                        }}
                        name="Verifications Processed"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box
                  sx={{
                    height: 400,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: '#6B7280',
                  }}
                >
                  <Typography>No trend data available for this year</Typography>
                </Box>
              )}
            </Paper>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default Dashboard;
