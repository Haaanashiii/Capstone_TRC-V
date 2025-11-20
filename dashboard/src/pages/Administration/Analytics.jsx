import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './Sidebar';
import KpiCard from '../../components/KpiCard';
import '../../Styles/Administrator_Css/Analytics.css';
import {
  Paper,
  Typography,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import {
  Assessment,
  CheckCircle,
  Cancel,
  HourglassEmpty,
} from '@mui/icons-material';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';

function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Analytics data from API
  const [analyticsData, setAnalyticsData] = useState({
    totalFranchises: 0,
    activeFranchises: 0,
    expiredFranchises: 0,
    pendingApplications: 0,
    barangayData: [],
  });

  // Get auth token from storage
  const getAuthToken = useCallback(() => {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
  }, []);

  // Fetch analytics data from API
  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = getAuthToken();
      
      if (!token) {
        setError('Authentication required. Please log in.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/dashboard/analytics`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please log in again.');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to view analytics.');
        }
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setAnalyticsData(result.data);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err.message || 'Failed to fetch analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  // Filter and sort data with search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return analyticsData.barangayData;
    
    const query = searchQuery.toLowerCase();
    return analyticsData.barangayData.filter(item => 
      item.barangay.toLowerCase().includes(query)
    );
  }, [analyticsData.barangayData, searchQuery]);
  
  const sortedData = useMemo(() => 
    [...filteredData].sort((a, b) => b.active - a.active),
    [filteredData]
  );
  
  const paginatedData = useMemo(() => 
    sortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sortedData, page, rowsPerPage]
  );

  return (
    <div className="analytics-container">
      <Sidebar />
      
      <main className="analytics-content" role="main">
        {/* Page Header */}
        <header className="analytics-header">
          <Typography variant="h4" className="page-title">
            Franchise Analytics
          </Typography>
          <Typography variant="body2" className="page-subtitle">
            Comprehensive franchise distribution and statistics
          </Typography>
        </header>

        {error && (
          <Alert severity="error" className="error-alert" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="analytics-loading" role="status" aria-live="polite">
            <CircularProgress size={60} className="loading-spinner" />
            <span className="sr-only">Loading analytics data...</span>
          </div>
        ) : (
          <>
            {/* Summary KPI Cards */}
            <section className="analytics-overview" aria-labelledby="overview-heading">
              <div className="kpi-grid">
                <KpiCard
                  title="Total Franchises"
                  value={analyticsData.totalFranchises}
                  icon={Assessment}
                  iconColor="#0A356B"
                  aria-label={`Total franchises: ${analyticsData.totalFranchises}`}
                />
                <KpiCard
                  title="Active Franchises"
                  value={analyticsData.activeFranchises}
                  icon={CheckCircle}
                  iconColor="#10B981"
                  aria-label={`Active franchises: ${analyticsData.activeFranchises}`}
                />
                <KpiCard
                  title="Expired Franchises"
                  value={analyticsData.expiredFranchises}
                  icon={Cancel}
                  iconColor="#EF4444"
                  aria-label={`Expired franchises: ${analyticsData.expiredFranchises}`}
                />
                <KpiCard
                  title="Pending Applications"
                  value={analyticsData.pendingApplications}
                  icon={HourglassEmpty}
                  iconColor="#F59E0B"
                  aria-label={`Pending applications: ${analyticsData.pendingApplications}`}
                />
              </div>
            </section>

            {/* Top Barangays */}
            <section className="top-barangays-section" aria-labelledby="top-barangays-heading">
              <div className="section-header">
                <h2 id="top-barangays-heading" className="section-title">Top 5 Barangays</h2>
              </div>

              {sortedData.length === 0 ? (
                <div className="no-data-message">
                  <Typography variant="body1" color="text.secondary">
                    No barangay data available yet.
                  </Typography>
                </div>
              ) : (
                <div className="top-barangays-grid">
                  {sortedData.slice(0, 5).map((item, index) => (
                  <article 
                    key={item.barangay} 
                    className="barangay-card"
                    aria-labelledby={`barangay-${index}-name`}
                  >
                    <span className="barangay-rank" aria-label={`Rank ${index + 1}`}>
                      RANK #{index + 1}
                    </span>
                    <h3 id={`barangay-${index}-name`} className="barangay-name">
                      {item.barangay}
                    </h3>
                    <div className="barangay-active">
                      <span className="active-count" aria-label={`${item.active} active franchises`}>
                        {item.active}
                      </span>
                      <span className="active-label">Active Franchises</span>
                    </div>
                    <div className="barangay-stats">
                      <div className="stat-item">
                        <span className="stat-value expired" aria-label={`${item.expired} expired`}>
                          {item.expired}
                        </span>
                        <span className="stat-label">Expired</span>
                      </div>
                      <div className="stat-divider" aria-hidden="true"></div>
                      <div className="stat-item">
                        <span className="stat-value total" aria-label={`${item.total} total`}>
                          {item.total}
                        </span>
                        <span className="stat-label">Total</span>
                      </div>
                    </div>
                  </article>
                  ))}
                </div>
              )}
            </section>

            {/* Data Table */}
            <section className="barangay-table-section" aria-labelledby="all-barangays-heading">
              <Paper elevation={0} className="table-container">
                <div className="table-header-section">
                  <Typography variant="h6" className="table-title">
                    All Barangays
                  </Typography>
                  <TextField
                    size="small"
                    placeholder="Search barangay..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="search-field"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#64748b' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </div>
                <TableContainer>
                  <Table aria-label="Barangay franchise details table">
                    <TableHead>
                      <TableRow className="table-header-row">
                        <TableCell className="table-header-cell">
                          Barangay
                        </TableCell>
                        <TableCell align="center" className="table-header-cell">
                          Active
                        </TableCell>
                        <TableCell align="center" className="table-header-cell">
                          Expired
                        </TableCell>
                        <TableCell align="center" className="table-header-cell">
                          Total
                        </TableCell>
                        <TableCell align="center" className="table-header-cell">
                          Active %
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                              {searchQuery ? 'No barangays match your search' : 'No barangay data available'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedData.map((row) => {
                          const activePercentage = row.total > 0 ? ((row.active / row.total) * 100).toFixed(1) : '0.0';
                          return (
                          <TableRow 
                            key={row.barangay}
                            className="table-row"
                            hover
                          >
                            <TableCell className="table-cell barangay-name-cell">
                              {row.barangay}
                            </TableCell>
                            <TableCell align="center" className="table-cell">
                              <span className="badge badge-active" aria-label={`${row.active} active franchises`}>
                                {row.active}
                              </span>
                            </TableCell>
                            <TableCell align="center" className="table-cell">
                              <span className="badge badge-expired" aria-label={`${row.expired} expired franchises`}>
                                {row.expired}
                              </span>
                            </TableCell>
                            <TableCell align="center" className="table-cell total-cell">
                              {row.total}
                            </TableCell>
                            <TableCell align="center" className="table-cell">
                              <div className="percentage-cell">
                                <div className="progress-bar" role="progressbar" aria-valuenow={activePercentage} aria-valuemin="0" aria-valuemax="100" aria-label={`${activePercentage}% active`}>
                                  <div className="progress-fill" style={{ width: `${activePercentage}%` }}></div>
                                </div>
                                <span className="percentage-text">{activePercentage}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <div className="table-pagination">
                  <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={filteredData.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    labelRowsPerPage="Rows per page:"
                    labelDisplayedRows={({ from, to, count }) => 
                      `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`
                    }
                  />
                </div>
              </Paper>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default Analytics;
