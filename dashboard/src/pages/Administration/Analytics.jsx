import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './Sidebar';
import KpiCard from '../../components/KpiCard';
import PageLoader, { CardLoader } from '../../components/PageLoader';
import AnimatedPage, { AnimatedSection } from '../../components/AnimatedPage';
import { useDebounce } from '../../hooks/useDebounce';
import '../../Styles/Administrator_Css/Analytics.css';
import '../../Styles/Administrator_Css/SharedTable.css';
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
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Button,
  Chip,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Fade,
  Skeleton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import SortIcon from '@mui/icons-material/Sort';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import {
  Assessment,
  CheckCircle,
  Cancel,
  HourglassEmpty,
  Autorenew,
  InfoOutlined,
} from '@mui/icons-material';
import websocketService from '../../services/websocket';
import { dashboardAPI, franchiseInformationAPI } from '../Services/api';
import { logger } from '../../utils/logger';
import { exportBarangayAnalyticsCSV } from '../../utils/csvExport';

// Constants
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const TABLE_SORT_OPTIONS = {
  HIGHEST_TOTAL: 'highest_total',
  HIGHEST_ACTIVE: 'highest_active',
  HIGHEST_EXPIRED: 'highest_expired',
};

const BARANGAY_FILTER_OPTIONS = {
  HIGHEST_ACTIVE: 'highest_active',
  HIGHEST_EXPIRED: 'highest_expired',
};

const getCurrentMonthIndex = () => new Date().getMonth();
const getCurrentYear = () => new Date().getFullYear();

function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  
  // Modal state for expired franchises
  const [expiredModalOpen, setExpiredModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthIndex());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [expiringFranchisees, setExpiringFranchisees] = useState([]);
  const [loadingExpiring, setLoadingExpiring] = useState(false);
  
  // Modal state for recyclable franchise numbers
  const [recycleModalOpen, setRecycleModalOpen] = useState(false);
  const [recyclableNumbers, setRecyclableNumbers] = useState([]);
  const [recyclableStats, setRecyclableStats] = useState(null);
  const [loadingRecyclable, setLoadingRecyclable] = useState(false);
  
  // Filter states
  const [barangayFilter, setBarangayFilter] = useState(BARANGAY_FILTER_OPTIONS.HIGHEST_ACTIVE);
  const [tableSortFilter, setTableSortFilter] = useState(TABLE_SORT_OPTIONS.HIGHEST_TOTAL);
  
  // Analytics data from API
  const [analyticsData, setAnalyticsData] = useState({
    totalFranchises: 0,
    activeFranchises: 0,
    expiredFranchises: 0,
    pendingApplications: 0,
    barangayData: [],
  });

  // Fetch analytics data from API using centralized dashboardAPI
  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await dashboardAPI.getAnalytics();
      
      if (response.data?.success && response.data?.data) {
        setAnalyticsData(response.data.data);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      logger.error('Error fetching analytics:', err);
      
      // Handle specific error cases
      if (err.response?.status === 401) {
        setError('Session expired. Please log in again.');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view analytics.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to fetch analytics. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch recyclable franchise numbers using centralized franchiseInformationAPI
  const fetchRecyclableNumbers = useCallback(async () => {
    setLoadingRecyclable(true);
    
    try {
      const response = await franchiseInformationAPI.getAvailableNumbers();
      
      if (response.data?.success && response.data?.data) {
        setRecyclableNumbers(response.data.data.availableNumbers || []);
        setRecyclableStats(response.data.data.statistics || null);
      } else {
        setRecyclableNumbers([]);
        setRecyclableStats(null);
      }
    } catch (err) {
      logger.error('Error fetching recyclable numbers:', err);
      setRecyclableNumbers([]);
      setRecyclableStats(null);
    } finally {
      setLoadingRecyclable(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
    fetchRecyclableNumbers(); // Fetch recyclable stats for KPI card

    // Connect to WebSocket for real-time updates
    if (!websocketService.isConnected()) {
      websocketService.connect('general')
    }

    // Subscribe to analytics updates
    const handleAnalyticsUpdates = () => {
      fetchAnalyticsData();
      fetchRecyclableNumbers();
    };

    websocketService.on('analytics-data', handleAnalyticsUpdates);
    websocketService.on('franchise-updated', handleAnalyticsUpdates);
    websocketService.on('franchisee-updated', handleAnalyticsUpdates);

    return () => {
      websocketService.off('analytics-data', handleAnalyticsUpdates);
      websocketService.off('franchise-updated', handleAnalyticsUpdates);
      websocketService.off('franchisee-updated', handleAnalyticsUpdates);
    };
  }, [fetchAnalyticsData, fetchRecyclableNumbers]);

  // Fetch expiring franchisees for selected month using centralized dashboardAPI
  const fetchExpiringFranchisees = useCallback(async (month, year) => {
    setLoadingExpiring(true);
    
    try {
      const response = await dashboardAPI.getExpiringFranchises(month + 1, year);
      
      if (response.data?.success && response.data?.data) {
        setExpiringFranchisees(response.data.data);
      } else {
        setExpiringFranchisees([]);
      }
    } catch (err) {
      logger.error('Error fetching expiring franchises:', err);
      setExpiringFranchisees([]);
    } finally {
      setLoadingExpiring(false);
    }
  }, []);

  // Handle recycle card click
  const handleRecycleCardClick = useCallback(() => {
    setRecycleModalOpen(true);
    fetchRecyclableNumbers();
  }, [fetchRecyclableNumbers]);

  // Handle recycle modal close
  const handleCloseRecycleModal = useCallback(() => {
    setRecycleModalOpen(false);
  }, []);

  // Handle expired card click
  const handleExpiredCardClick = useCallback(() => {
    setExpiredModalOpen(true);
    fetchExpiringFranchisees(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear, fetchExpiringFranchisees]);

  // Handle month filter change
  const handleMonthChange = useCallback((month) => {
    setSelectedMonth(month);
    fetchExpiringFranchisees(month, selectedYear);
  }, [selectedYear, fetchExpiringFranchisees]);

  // Handle year change
  const handleYearChange = useCallback((year) => {
    setSelectedYear(year);
    fetchExpiringFranchisees(selectedMonth, year);
  }, [selectedMonth, fetchExpiringFranchisees]);

  // Handle modal close
  const handleCloseExpiredModal = useCallback(() => {
    setExpiredModalOpen(false);
  }, []);

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

  // Handle barangay filter change
  const handleBarangayFilterChange = (event) => {
    setBarangayFilter(event.target.value);
  };

  // Handle table sort filter change
  const handleTableSortChange = (event) => {
    setTableSortFilter(event.target.value);
    setPage(0);
  };

  // Top 5 Barangays - separate from table search/filter
  const topBarangaysData = useMemo(() => {
    const sortedData = [...analyticsData.barangayData];
    
    if (barangayFilter === BARANGAY_FILTER_OPTIONS.HIGHEST_ACTIVE) {
      sortedData.sort((a, b) => b.active - a.active);
    } else if (barangayFilter === BARANGAY_FILTER_OPTIONS.HIGHEST_EXPIRED) {
      sortedData.sort((a, b) => b.expired - a.expired);
    }
    
    return sortedData.slice(0, 5);
  }, [analyticsData.barangayData, barangayFilter]);

  // Filter data for table only (search applies only here)
  const filteredTableData = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return analyticsData.barangayData;
    
    const query = debouncedSearchQuery.toLowerCase();
    return analyticsData.barangayData.filter(item => 
      item.barangay.toLowerCase().includes(query)
    );
  }, [analyticsData.barangayData, debouncedSearchQuery]);
  
  // Sort table data based on selected filter
  const sortedTableData = useMemo(() => {
    const data = [...filteredTableData];
    
    switch (tableSortFilter) {
      case TABLE_SORT_OPTIONS.HIGHEST_ACTIVE:
        return data.sort((a, b) => b.active - a.active);
      case TABLE_SORT_OPTIONS.HIGHEST_EXPIRED:
        return data.sort((a, b) => b.expired - a.expired);
      case TABLE_SORT_OPTIONS.HIGHEST_TOTAL:
      default:
        return data.sort((a, b) => b.total - a.total);
    }
  }, [filteredTableData, tableSortFilter]);
  
  const paginatedData = useMemo(() => 
    sortedTableData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sortedTableData, page, rowsPerPage]
  );

  // Generate available years for filter
  const availableYears = useMemo(() => {
    const currentYear = getCurrentYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  }, []);

  // Export table data to CSV using secure utility
  const handleExportCSV = useCallback(() => {
    if (!sortedTableData || sortedTableData.length === 0) {
      logger.warn('No data to export');
      return;
    }
    exportBarangayAnalyticsCSV(sortedTableData, 'barangay_franchise_analytics');
  }, [sortedTableData]);

  return (
    <div className="analytics-container" style={{ overflowX: 'hidden' }}>
      <Sidebar />
      
      <main className="analytics-content" role="main" style={{ overflowX: 'hidden' }}>
        {/* Page Header */}
        <header className="analytics-header">
          <Typography variant="h4" className="page-title">
            Franchise Analytics
          </Typography>
        </header>

        {error && (
          <Alert severity="error" className="error-alert" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Fade in={loading} timeout={300}>
            <Box>
              <CardLoader count={5} />
              <AnimatedSection index={1} baseDelay={200}>
                <Box sx={{ mt: 4 }}>
                  <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} variant="rectangular" height={180} sx={{ borderRadius: 2 }} />
                    ))}
                  </Box>
                </Box>
              </AnimatedSection>
            </Box>
          </Fade>
        ) : (
          <Fade in={!loading} timeout={400}>
            <Box>
            {/* Summary KPI Cards */}
            <section className="analytics-overview" aria-labelledby="overview-heading">
              <div className="kpi-grid">
                <AnimatedSection index={0}>
                <KpiCard
                  title="Total Franchises"
                  value={analyticsData.totalFranchises}
                  icon={Assessment}
                  iconColor="#0A356B"
                  aria-label={`Total franchises: ${analyticsData.totalFranchises}`}
                />
                </AnimatedSection>
                <AnimatedSection index={1}>
                <KpiCard
                  title="Active Franchises"
                  value={analyticsData.activeFranchises}
                  icon={CheckCircle}
                  iconColor="#10B981"
                  aria-label={`Active franchises: ${analyticsData.activeFranchises}`}
                />
                </AnimatedSection>
                <AnimatedSection index={2}>
                <Box 
                  onClick={handleRecycleCardClick} 
                  sx={{ cursor: 'pointer' }}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => e.key === 'Enter' && handleRecycleCardClick()}
                >
                  <KpiCard
                    title="Available Franchise"
                    value={recyclableStats ? (recyclableStats.gaps || 0) + (recyclableStats.revokedAvailable || 0) : '—'}
                    icon={Autorenew}
                    iconColor="#06B6D4"
                    aria-label="Franchise numbers available for assignment. Click to view details."
                  />
                </Box>
                </AnimatedSection>
                <AnimatedSection index={3}>
                <Box 
                  onClick={handleExpiredCardClick} 
                  sx={{ cursor: 'pointer' }}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => e.key === 'Enter' && handleExpiredCardClick()}
                >
                  <KpiCard
                    title="Expired Franchises"
                    value={analyticsData.expiredFranchises}
                    icon={Cancel}
                    iconColor="#EF4444"
                    aria-label={`Expired franchises: ${analyticsData.expiredFranchises}. Click to view details.`}
                  />
                </Box>
                </AnimatedSection>
                <AnimatedSection index={4}>
                <KpiCard
                  title="Pending Applications"
                  value={analyticsData.pendingApplications}
                  icon={HourglassEmpty}
                  iconColor="#F59E0B"
                  aria-label={`Pending applications: ${analyticsData.pendingApplications}`}
                />
                </AnimatedSection>
              </div>
            </section>

            {/* Top Barangays */}
            <section className="top-barangays-section" aria-labelledby="top-barangays-heading">
              <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <h2 id="top-barangays-heading" className="section-title">
                  Top 5 Barangays
                </h2>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="barangay-filter-label">Sort By</InputLabel>
                  <Select
                    labelId="barangay-filter-label"
                    id="barangay-filter"
                    value={barangayFilter}
                    label="Sort By"
                    onChange={handleBarangayFilterChange}
                    sx={{
                      backgroundColor: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#e5e7eb',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#0A356B',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#0A356B',
                      },
                    }}
                  >
                    <MenuItem value={BARANGAY_FILTER_OPTIONS.HIGHEST_ACTIVE}>
                      Highest Active Franchises
                    </MenuItem>
                    <MenuItem value={BARANGAY_FILTER_OPTIONS.HIGHEST_EXPIRED}>
                      Highest Expired Franchises
                    </MenuItem>
                  </Select>
                </FormControl>
              </div>

              {topBarangaysData.length === 0 ? (
                <div className="no-data-message">
                  <Typography variant="body1" color="text.secondary">
                    No barangay data available yet.
                  </Typography>
                </div>
              ) : (
                <div className="top-barangays-grid">
                  {topBarangaysData.map((item, index) => (
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
                      <span 
                        className="active-count" 
                        aria-label={`${barangayFilter === BARANGAY_FILTER_OPTIONS.HIGHEST_ACTIVE ? item.active : item.expired} ${barangayFilter === BARANGAY_FILTER_OPTIONS.HIGHEST_ACTIVE ? 'active' : 'expired'} franchises`}
                        style={{ color: barangayFilter === BARANGAY_FILTER_OPTIONS.HIGHEST_ACTIVE ? '#10B981' : '#EF4444' }}
                      >
                        {barangayFilter === BARANGAY_FILTER_OPTIONS.HIGHEST_ACTIVE ? item.active : item.expired}
                      </span>
                      <span className="active-label">
                        {barangayFilter === BARANGAY_FILTER_OPTIONS.HIGHEST_ACTIVE ? 'Active Franchises' : 'Expired Franchises'}
                      </span>
                    </div>
                    <div className="barangay-stats">
                      <div className="stat-item">
                        <span 
                          className="stat-value" 
                          style={{ color: barangayFilter === BARANGAY_FILTER_OPTIONS.HIGHEST_ACTIVE ? '#EF4444' : '#10B981' }}
                          aria-label={`${barangayFilter === BARANGAY_FILTER_OPTIONS.HIGHEST_ACTIVE ? item.expired : item.active} ${barangayFilter === BARANGAY_FILTER_OPTIONS.HIGHEST_ACTIVE ? 'expired' : 'active'}`}
                        >
                          {barangayFilter === BARANGAY_FILTER_OPTIONS.HIGHEST_ACTIVE ? item.expired : item.active}
                        </span>
                        <span className="stat-label">
                          {barangayFilter === BARANGAY_FILTER_OPTIONS.HIGHEST_ACTIVE ? 'Expired' : 'Active'}
                        </span>
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
              <Paper elevation={2} className="admin-table-container">
                <div className="table-header-section" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <Typography variant="h6" className="table-title">
                      All Barangays
                    </Typography>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                      <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel id="table-sort-label">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <SortIcon sx={{ fontSize: 18 }} />
                            Sort By
                          </Box>
                        </InputLabel>
                        <Select
                          labelId="table-sort-label"
                          id="table-sort"
                          value={tableSortFilter}
                          label="Sort By"
                          onChange={handleTableSortChange}
                          sx={{
                            backgroundColor: '#fff',
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#e5e7eb',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#0A356B',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#0A356B',
                            },
                          }}
                        >
                          <MenuItem value={TABLE_SORT_OPTIONS.HIGHEST_TOTAL}>Highest Total</MenuItem>
                          <MenuItem value={TABLE_SORT_OPTIONS.HIGHEST_ACTIVE}>Highest Active</MenuItem>
                          <MenuItem value={TABLE_SORT_OPTIONS.HIGHEST_EXPIRED}>Highest Expired</MenuItem>
                        </Select>
                      </FormControl>
                      <Tooltip title="Export to CSV">
                        <Button
                          variant="outlined"
                          startIcon={<DownloadIcon />}
                          onClick={handleExportCSV}
                          disabled={sortedTableData.length === 0}
                          sx={{
                            borderColor: '#0A356B',
                            color: '#0A356B',
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': {
                              borderColor: '#082548',
                              backgroundColor: 'rgba(10, 53, 107, 0.04)',
                            },
                          }}
                        >
                          Export CSV
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
                <TableContainer className="admin-table-wrapper">
                  <Table className="admin-table" stickyHeader aria-label="Barangay franchise details table">
                    <TableHead>
                      <TableRow>
                        <TableCell className="admin-table-header-cell col-barangay" align="left">
                          Barangay
                        </TableCell>
                        <TableCell className="admin-table-header-cell col-status">
                          Active
                        </TableCell>
                        <TableCell className="admin-table-header-cell col-status">
                          Expired
                        </TableCell>
                        <TableCell className="admin-table-header-cell col-status">
                          Total
                        </TableCell>
                        <TableCell className="admin-table-header-cell col-status">
                          Active %
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="admin-table-empty">
                            <Typography className="admin-table-empty-text">
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
                            className="admin-table-row"
                            hover
                          >
                            <TableCell className="admin-table-cell col-barangay" align="left">
                              {row.barangay}
                            </TableCell>
                            <TableCell className="admin-table-cell">
                              <span className="status-badge status-active">
                                {row.active}
                              </span>
                            </TableCell>
                            <TableCell className="admin-table-cell">
                              <span className="status-badge status-expired">
                                {row.expired}
                              </span>
                            </TableCell>
                            <TableCell className="admin-table-cell">
                              <strong>{row.total}</strong>
                            </TableCell>
                            <TableCell className="admin-table-cell">
                              <div className="percentage-cell">
                                <div className="progress-bar" role="progressbar" aria-valuenow={activePercentage} aria-valuemin="0" aria-valuemax="100">
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
                <div className="admin-table-pagination">
                  <TablePagination
                    rowsPerPageOptions={[10, 15, 25, 50]}
                    component="div"
                    count={sortedTableData.length}
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
            </Box>
          </Fade>
        )}

        {/* Expired Franchises Modal */}
        <Dialog
          open={expiredModalOpen}
          onClose={handleCloseExpiredModal}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              maxHeight: '90vh',
            },
          }}
        >
          <DialogTitle
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#0A356B',
              color: '#fff',
              py: 2,
              px: 3,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Franchises Expiring in {MONTHS[selectedMonth]} {selectedYear}
            </Typography>
            <IconButton
              onClick={handleCloseExpiredModal}
              sx={{ color: '#fff' }}
              aria-label="Close modal"
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            {/* Date Filter Section */}
            <Box 
              sx={{ 
                p: 3, 
                borderBottom: '1px solid #e5e7eb', 
                backgroundColor: '#f8fafc',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CalendarMonthIcon sx={{ color: '#0A356B', fontSize: 24 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#0A356B' }}>
                    Filter by Date:
                  </Typography>
                </Box>
                
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel id="year-select-label">Year</InputLabel>
                  <Select
                    labelId="year-select-label"
                    id="year-select"
                    value={selectedYear}
                    label="Year"
                    onChange={(e) => handleYearChange(e.target.value)}
                    sx={{
                      backgroundColor: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#e5e7eb',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#0A356B',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#0A356B',
                      },
                    }}
                  >
                    {availableYears.map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="month-select-label">Month</InputLabel>
                  <Select
                    labelId="month-select-label"
                    id="month-select"
                    value={selectedMonth}
                    label="Month"
                    onChange={(e) => handleMonthChange(e.target.value)}
                    sx={{
                      backgroundColor: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#e5e7eb',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#0A356B',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#0A356B',
                      },
                    }}
                  >
                    {MONTHS.map((month, index) => (
                      <MenuItem key={month} value={index}>
                        {month}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Chip
                  label={`${MONTHS[selectedMonth]} ${selectedYear}`}
                  sx={{
                    backgroundColor: '#0A356B',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    height: 32,
                  }}
                />
              </Box>
            </Box>

            {/* Expiring Franchisees Table */}
            <Box sx={{ p: 3 }}>
              {loadingExpiring ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress size={48} sx={{ color: '#0A356B' }} />
                </Box>
              ) : expiringFranchisees.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography variant="body1" sx={{ color: '#64748b' }}>
                    No franchises expiring in {MONTHS[selectedMonth]} {selectedYear}.
                  </Typography>
                </Box>
              ) : (
                <>
                  <Typography variant="body2" sx={{ mb: 2, color: '#64748b' }}>
                    Found {expiringFranchisees.length} franchise(s) expiring in {MONTHS[selectedMonth]} {selectedYear}
                  </Typography>
                  <TableContainer sx={{ maxHeight: 400, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ backgroundColor: '#0A356B', color: '#fff', fontWeight: 600 }}>
                            Franchise #
                          </TableCell>
                          <TableCell sx={{ backgroundColor: '#0A356B', color: '#fff', fontWeight: 600 }}>
                            Operator Name
                          </TableCell>
                          <TableCell sx={{ backgroundColor: '#0A356B', color: '#fff', fontWeight: 600 }}>
                            Contact
                          </TableCell>
                          <TableCell sx={{ backgroundColor: '#0A356B', color: '#fff', fontWeight: 600 }}>
                            Barangay
                          </TableCell>
                          <TableCell sx={{ backgroundColor: '#0A356B', color: '#fff', fontWeight: 600 }}>
                            Expiry Date
                          </TableCell>
                          <TableCell sx={{ backgroundColor: '#0A356B', color: '#fff', fontWeight: 600 }}>
                            Days Until Expiry
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {expiringFranchisees.map((franchise) => {
                          const expiryDate = new Date(franchise.expiryDate);
                          const today = new Date();
                          const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                          
                          return (
                            <TableRow key={franchise._id || franchise.franchiseNumber} hover>
                              <TableCell sx={{ fontWeight: 600, color: '#0A356B' }}>
                                {franchise.franchiseNumber}
                              </TableCell>
                              <TableCell>{franchise.operatorName}</TableCell>
                              <TableCell>{franchise.operatorContactNumber || 'N/A'}</TableCell>
                              <TableCell>{franchise.operatorBarangay}</TableCell>
                              <TableCell>
                                {expiryDate.toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={
                                    daysUntilExpiry < 0
                                      ? `Expired ${Math.abs(daysUntilExpiry)} days ago`
                                      : daysUntilExpiry === 0
                                      ? 'Expires today'
                                      : `${daysUntilExpiry} days`
                                  }
                                  sx={{
                                    fontWeight: 600,
                                    backgroundColor:
                                      daysUntilExpiry < 0
                                        ? '#fee2e2'
                                        : daysUntilExpiry <= 7
                                        ? '#fef3c7'
                                        : '#d1fae5',
                                    color:
                                      daysUntilExpiry < 0
                                        ? '#991b1b'
                                        : daysUntilExpiry <= 7
                                        ? '#92400e'
                                        : '#065f46',
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Box>
          </DialogContent>
        </Dialog>

        {/* Recyclable Franchise Numbers Modal */}
        <Dialog
          open={recycleModalOpen}
          onClose={handleCloseRecycleModal}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              maxHeight: '90vh',
            },
          }}
        >
          <DialogTitle
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#06B6D4',
              color: '#fff',
              py: 2,
              px: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Autorenew sx={{ fontSize: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Available Franchise Numbers
              </Typography>
            </Box>
            <IconButton
              onClick={handleCloseRecycleModal}
              sx={{ color: '#fff' }}
              aria-label="Close modal"
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            {/* Contextual Information Banner */}
            <Box
              sx={{
                p: 3,
                backgroundColor: '#ecfeff',
                borderBottom: '1px solid #a5f3fc',
              }}
            >
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <InfoOutlined sx={{ color: '#0891b2', fontSize: 24, mt: 0.25 }} />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0e7490', mb: 1 }}>
                    What are available franchise numbers?
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#6b7280', lineHeight: 1.7 }}>
                    These are franchise numbers from revoked franchises that have been expired for more than 6 years and can be reassigned to new applicants.
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Statistics Summary */}
            {recyclableStats && (
              <Box
                sx={{
                  p: 3,
                  backgroundColor: '#fff',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Box sx={{ textAlign: 'center', minWidth: 140, p: 2, backgroundColor: '#f0fdf4', borderRadius: 2 }}>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: '#10B981' }}>
                      {recyclableStats.revokedAvailable || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#065f46', fontWeight: 600, mt: 0.5 }}>
                      Reusable Numbers
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center', minWidth: 140, p: 2, backgroundColor: '#eff6ff', borderRadius: 2 }}>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: '#0A356B' }}>
                      {String(recyclableStats.nextNumber || 1).padStart(4, '0')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#1e40af', fontWeight: 600, mt: 0.5 }}>
                      Next New Number
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}

            {/* Recyclable Numbers List */}
            <Box sx={{ p: 3 }}>
              {loadingRecyclable ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress size={48} sx={{ color: '#06B6D4' }} />
                </Box>
              ) : recyclableNumbers.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Autorenew sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                  <Typography variant="body1" sx={{ color: '#64748b', mb: 1 }}>
                    No franchise numbers available for recycling.
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                    All numbers are currently in use or not yet eligible for reuse.
                  </Typography>
                </Box>
              ) : (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: '#64748b', fontWeight: 600 }}>
                      AVAILABLE NUMBERS ({recyclableNumbers.length})
                    </Typography>
                    <Chip
                      size="small"
                      label="Ready for assignment"
                      sx={{
                        backgroundColor: '#d1fae5',
                        color: '#065f46',
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 1.5,
                      maxHeight: 300,
                      overflowY: 'auto',
                      p: 2,
                      backgroundColor: '#f8fafc',
                      borderRadius: 2,
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    {recyclableNumbers.map((number) => (
                      <Chip
                        key={number}
                        label={number}
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.9375rem',
                          fontFamily: 'monospace',
                          backgroundColor: '#fff',
                          border: '2px solid #06B6D4',
                          color: '#0e7490',
                          height: 36,
                          '&:hover': {
                            backgroundColor: '#ecfeff',
                          },
                        }}
                      />
                    ))}
                  </Box>
                  {recyclableStats?.hasMore && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 2, color: '#9ca3af', textAlign: 'center' }}>
                      Showing first 100 numbers. Total available: {recyclableStats.totalAvailable || recyclableNumbers.length}
                    </Typography>
                  )}
                </>
              )}
            </Box>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default Analytics;
