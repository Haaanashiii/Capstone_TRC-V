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
  Divider,
  Select,
  MenuItem,
  FormControl,
  IconButton,
  Tooltip as MuiTooltip,
  Fade,
  Skeleton,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {
  Assessment as AssessmentIcon,
  EventBusy as EventBusyIcon,
  PendingActions as PendingActionsIcon,
  Report as ReportIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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
import PageLoader, { CardLoader } from '../../components/PageLoader';
import AnimatedPage, { AnimatedSection } from '../../components/AnimatedPage';
import { dashboardAPI } from '../Services/api';
import websocketService from '../../services/websocket';

function Dashboard() {
  const navigate = useNavigate();
  
  // State management
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isAuthorized, setIsAuthorized] = useState(true);
  
  // Default to current year for more comprehensive trend data
  const getYearRange = useCallback(() => {
    const today = dayjs();
    const startOfYear = today.startOf('year');
    return { start: startOfYear, end: today };
  }, []);
  
  const yearRange = getYearRange();
  const [startDate, setStartDate] = useState(yearRange.start);
  const [endDate, setEndDate] = useState(yearRange.end);
  const [selectedQuickRange, setSelectedQuickRange] = useState('thisYear');

  // Helper function to get week range for quick select
  const getWeekRange = useCallback(() => {
    const today = dayjs();
    const startOfWeek = today.startOf('week');
    const endOfWeek = today.endOf('week');
    return { start: startOfWeek, end: endOfWeek };
  }, []);

  // Quick date range buttons
  const handleQuickRange = useCallback((range) => {
    const today = dayjs();
    setSelectedQuickRange(range);
    switch (range) {
      case 'thisWeek':
        const thisWeek = getWeekRange();
        setStartDate(thisWeek.start);
        setEndDate(thisWeek.end);
        break;
      case 'lastWeek':
        setStartDate(today.subtract(1, 'week').startOf('week'));
        setEndDate(today.subtract(1, 'week').endOf('week'));
        break;
      case 'thisMonth':
        setStartDate(today.startOf('month'));
        setEndDate(today.endOf('month'));
        break;
      case 'lastMonth':
        setStartDate(today.subtract(1, 'month').startOf('month'));
        setEndDate(today.subtract(1, 'month').endOf('month'));
        break;
      case 'thisYear':
        setStartDate(today.startOf('year'));
        setEndDate(today);
        break;
      default:
        break;
    }
  }, [getWeekRange]);

  // Memoize chart data for optimal performance
  const chartData = useMemo(() => {
    if (!dashboardData?.trendData || dashboardData.trendData.length === 0) {
      return [];
    }
    return dashboardData.trendData;
  }, [dashboardData?.trendData]);

  // Custom tooltip for better UX
  const CustomTooltip = useCallback(({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const year = dashboardData?.currentMonthInfo?.year || new Date().getFullYear();
    
    return (
      <Paper
        elevation={3}
        sx={{
          p: 2,
          backgroundColor: '#ffffff',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: '#0A356B', mb: 1 }}
        >
          {label} {year}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: '#10B981',
              }}
            />
            <Typography variant="body2" sx={{ color: '#374151' }}>
              Active: <strong>{data.active}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: '#EF4444',
              }}
            />
            <Typography variant="body2" sx={{ color: '#374151' }}>
              Expired: <strong>{data.expired}</strong>
            </Typography>
          </Box>
          <Divider sx={{ my: 0.5 }} />
          <Typography variant="body2" sx={{ color: '#6B7280', fontWeight: 600 }}>
            Total: {data.total}
          </Typography>
        </Box>
      </Paper>
    );
  }, [dashboardData?.currentMonthInfo?.year]);

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

  // Verify admin access on component mount
  useEffect(() => {
    try {
      const token = sessionStorage.getItem('accessToken');
      if (!token) {
        setIsAuthorized(false);
        navigate('/login');
        return;
      }

      // Decode token to check account type and role
      const decoded = JSON.parse(atob(token.split('.')[1]));
      
      // Only admins (with admin roles) can access dashboard
      const adminRoles = ['sb-admin', 'bplo-admin', 'super-admin'];
      if (decoded.accountType !== 'admin' && !adminRoles.includes(decoded.role)) {
        setIsAuthorized(false);
        setError('You do not have permission to access the admin dashboard. Admin access only.');
        setTimeout(() => navigate('/'), 2000);
        return;
      }

      setIsAuthorized(true);
    } catch (err) {
      console.error('[Dashboard] Authorization check failed:', err);
      setIsAuthorized(false);
      setError('Authorization verification failed. Please log in again.');
      setTimeout(() => navigate('/login'), 2000);
    }
  }, [navigate]);
  
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD')
      };
      
      const response = await dashboardAPI.getStatistics(params);
      
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
          trendData: trends?.monthly || [],
          currentMonthInfo: trends?.currentMonth || null,
          timestamp: response.data.data.timestamp,
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
  }, [navigate, startDate, endDate]);

  // Fetch data on component mount and when date range changes
  useEffect(() => {
    fetchDashboardData();

    // Connect to WebSocket for real-time updates
    if (!websocketService.isConnected()) {
      websocketService.connect('general')
    }

    // Subscribe to dashboard statistics updates
    const handleDashboardUpdates = () => {
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
  }, [fetchDashboardData, startDate, endDate]);

  // Manual retry handler
  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Authorization guard
  if (!isAuthorized) {
    return (
      <div className="dashboard-container">
        <Sidebar />
        <div className="content-container">
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '400px',
              gap: 2,
            }}
          >
            <Typography variant="h6" sx={{ color: '#EF4444', fontWeight: 700 }}>
              Access Denied
            </Typography>
            <Typography sx={{ color: '#6B7280', textAlign: 'center' }}>
              {error || 'You do not have permission to access the admin dashboard.'}
            </Typography>
          </Box>
        </div>
      </div>
    );
  }

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
            className="page-title"
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
          <Fade in={loading} timeout={300}>
            <Box>
              {/* KPI Cards Skeleton */}
              <CardLoader count={4} />
              
              {/* Chart Skeleton */}
              <AnimatedSection index={1} baseDelay={200}>
                <Paper
                  elevation={2}
                  sx={{
                    p: 3,
                    mt: 4,
                    borderRadius: 3,
                    backgroundColor: '#ffffff',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                    <Skeleton variant="text" width={200} height={32} />
                    <Skeleton variant="rectangular" width={300} height={40} sx={{ borderRadius: 1 }} />
                  </Box>
                  <Skeleton variant="rectangular" width="100%" height={400} sx={{ borderRadius: 2 }} />
                </Paper>
              </AnimatedSection>
            </Box>
          </Fade>
        ) : dashboardData ? (
          <Fade in={!loading} timeout={400}>
            <Box>
              {/* KPI Cards Section */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, 1fr)',
                    lg: 'repeat(4, 1fr)',
                  },
                  gap: { xs: 2, sm: 3 },
                  mb: 4,
                }}
              >
                <AnimatedSection index={0}>
                  <KpiCard
                    title="Total Registered Units"
                    value={dashboardData.kpiData.totalRegistered}
                    icon={AssessmentIcon}
                    iconColor="#0A356B"
                    route="/franchisee-list"
                  />
                </AnimatedSection>
                <AnimatedSection index={1}>
                  <KpiCard
                    title="Expired Franchise"
                    value={dashboardData.kpiData.expiredFranchise}
                    icon={EventBusyIcon}
                    iconColor="#DC2626"
                    route="/franchisee-list"
                  />
                </AnimatedSection>
                <AnimatedSection index={2}>
                  <KpiCard
                    title="Pending Verifications"
                    value={dashboardData.kpiData.pendingVerifications}
                    icon={PendingActionsIcon}
                    iconColor="#F59E0B"
                    route="/franchise-management"
                  />
                </AnimatedSection>
                <AnimatedSection index={3}>
                  <KpiCard
                    title="Pending Reports"
                    value={dashboardData.kpiData.pendingReports}
                    icon={ReportIcon}
                    iconColor="#EF4444"
                    route="/incident-reports"
                  />
                </AnimatedSection>
              </Box>

            {/* Trend Chart Section */}
            <AnimatedSection index={4} baseDelay={150}>
            <Paper
              elevation={2}
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 3,
                backgroundColor: '#ffffff',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography
                    variant="h6"
                    sx={{
                      color: '#0A356B',
                      fontWeight: 700,
                      fontSize: { xs: '1rem', sm: '1.25rem' },
                    }}
                  >
                    Franchise Health Over Time
                  </Typography>
                  <MuiTooltip
                    title={
                      <Box sx={{ p: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                          About This Chart
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          This chart displays the health status of franchises over the selected time period.
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          <strong style={{ color: '#10B981' }}>• Active Franchises:</strong> Franchises with valid, non-expired registrations that are currently operating.
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong style={{ color: '#EF4444' }}>• Expired Franchises:</strong> Franchises whose registration has lapsed and requires renewal.
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                          How This Helps
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          • Monitor franchise compliance trends at a glance
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          • Identify periods with high expiration rates
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          • Plan renewal reminders and outreach campaigns
                        </Typography>
                        <Typography variant="body2">
                          • Track the effectiveness of compliance initiatives
                        </Typography>
                      </Box>
                    }
                    arrow
                    placement="right"
                    componentsProps={{
                      tooltip: {
                        sx: {
                          bgcolor: '#ffffff',
                          color: '#374151',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                          borderRadius: '8px',
                          border: '1px solid #E5E7EB',
                          maxWidth: 380,
                          '& .MuiTooltip-arrow': {
                            color: '#ffffff',
                            '&::before': {
                              border: '1px solid #E5E7EB',
                            },
                          },
                        },
                      },
                    }}
                  >
                    <IconButton
                      size="small"
                      sx={{
                        color: '#0A356B',
                        '&:hover': {
                          backgroundColor: 'rgba(10, 53, 107, 0.1)',
                        },
                      }}
                    >
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                </Box>
                
                {/* Compact Filter Controls */}
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1.5,
                    backgroundColor: '#F8FAFC',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <Select
                      displayEmpty
                      value={selectedQuickRange}
                      onChange={(e) => handleQuickRange(e.target.value)}
                      sx={{
                        backgroundColor: '#ffffff',
                        fontSize: '0.8125rem',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#CBD5E1',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#0A356B',
                        },
                        '& .MuiSelect-select': {
                          py: '6px',
                        },
                      }}
                      renderValue={(selected) => {
                        const options = {
                          thisWeek: 'This Week',
                          lastWeek: 'Last Week',
                          thisMonth: 'This Month',
                          lastMonth: 'Last Month',
                          thisYear: 'This Year',
                        };
                        return options[selected] || 'Custom Range';
                      }}
                    >
                      <MenuItem value="thisWeek">This Week</MenuItem>
                      <MenuItem value="lastWeek">Last Week</MenuItem>
                      <MenuItem value="thisMonth">This Month</MenuItem>
                      <MenuItem value="lastMonth">Last Month</MenuItem>
                      <MenuItem value="thisYear">This Year</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                  
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      value={startDate}
                      onChange={(newValue) => {
                        setStartDate(newValue);
                        setSelectedQuickRange('');
                      }}
                      slotProps={{
                        textField: {
                          size: 'small',
                          placeholder: 'From',
                          sx: { 
                            width: 130,
                            '& .MuiInputBase-input': {
                              fontSize: '0.8125rem',
                              py: '6px',
                            },
                          }
                        }
                      }}
                    />
                    <Typography sx={{ color: '#94A3B8', fontSize: '0.75rem', mx: 0.5 }}>to</Typography>
                    <DatePicker
                      value={endDate}
                      onChange={(newValue) => {
                        setEndDate(newValue);
                        setSelectedQuickRange('');
                      }}
                      minDate={startDate}
                      slotProps={{
                        textField: {
                          size: 'small',
                          placeholder: 'To',
                          sx: { 
                            width: 130,
                            '& .MuiInputBase-input': {
                              fontSize: '0.8125rem',
                              py: '6px',
                            },
                          }
                        }
                      }}
                    />
                  </LocalizationProvider>
                </Box>
              </Box>
              
              {chartData.length > 0 ? (
                <Box sx={{ width: '100%', height: 400, minHeight: 400 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="colorExpired" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="date"
                        stroke="#6B7280"
                        style={{ fontSize: '0.875rem', fontFamily: 'Poppins, sans-serif' }}
                      />
                      <YAxis
                        stroke="#6B7280"
                        style={{ fontSize: '0.875rem', fontFamily: 'Poppins, sans-serif' }}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{
                          paddingTop: '20px',
                          fontFamily: 'Poppins, sans-serif',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="active"
                        stroke="#10B981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorActive)"
                        name="Active Franchises"
                      />
                      <Area
                        type="monotone"
                        dataKey="expired"
                        stroke="#EF4444"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorExpired)"
                        name="Expired Franchises"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box
                  sx={{
                    height: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: '#6B7280',
                    gap: 1,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>No franchise data available for this date range</Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.875rem', opacity: 0.7 }}>
                    Try selecting a different date range or check if franchises have been registered
                  </Typography>
                </Box>
              )}
            </Paper>
          </AnimatedSection>
            </Box>
          </Fade>
        ) : null}
      </div>
    </div>
  );
}

export default Dashboard;
