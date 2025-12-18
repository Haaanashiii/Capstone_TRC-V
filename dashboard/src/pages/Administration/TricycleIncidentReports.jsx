import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import '../../Styles/Administrator_Css/TricycleIncidentReports.css';
import '../../Styles/Administrator_Css/SharedTable.css';
import Sidebar from './Sidebar';
import websocketService from '../../services/websocket';
import { incidentReportsAPI } from '../Services/api';
import PageLoader from '../../components/PageLoader';
import AnimatedPage, { AnimatedSection } from '../../components/AnimatedPage';
import { 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  TablePagination,
  Modal,
  Box,
  Alert,
  CircularProgress,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Tooltip,
  Grid,
  Fade,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import DateRangeIcon from '@mui/icons-material/DateRange';
import { logger } from '../../utils/logger';

// Constants
/** Incident category labels - synced with backend */
const INCIDENT_CATEGORIES = Object.freeze({
  'fare-related': 'Fare-Related Issues',
  'driver-conduct': 'Driver Conduct & Behavior',
  'vehicle-condition': 'Vehicle Condition & Roadworthiness',
  'franchise-violations': 'Franchise & Permit Violations',
  'safety-violations': 'Safety Violations',
  'other': 'Other Concerns'
});

/** Category color mapping for visual badges */
const CATEGORY_COLORS = Object.freeze({
  'fare-related': '#e53935',
  'driver-conduct': '#fb8c00',
  'vehicle-condition': '#7cb342',
  'franchise-violations': '#5e35b1',
  'safety-violations': '#d81b60',
  'other': '#757575'
});

/** Status color mapping */
const STATUS_COLORS = Object.freeze({
  pending: '#ff9800',
  investigating: '#2196f3',
  resolved: '#4caf50',
  dismissed: '#757575'
});

/** Status options for dropdowns */
const STATUS_OPTIONS = Object.freeze([
  { value: 'pending', label: 'Pending' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' }
]);

/** Sort options for advanced filter */
const SORT_OPTIONS = Object.freeze([
  { value: 'reportID', label: 'Report ID' },
  { value: 'dateReported', label: 'Date Reported' },
  { value: 'status', label: 'Status' },
  { value: 'category', label: 'Category' },
  { value: 'operatorName', label: 'Franchisee Name' }
]);

/** Default filter values */
const DEFAULT_FILTERS = Object.freeze({
  status: '',
  category: '',
  sortBy: 'dateReported',
  sortOrder: 'desc'
});

/** Pagination options */
const ROWS_PER_PAGE_OPTIONS = [10, 15, 25, 50];

// Utility Functions
/** Get category display label */
const getCategoryLabel = (category) => 
  INCIDENT_CATEGORIES[category] || category;

/** Get category badge color */
const getCategoryColor = (category) => 
  CATEGORY_COLORS[category] || '#757575';

/** Get status badge color */
const getStatusColor = (status) => 
  STATUS_COLORS[status] || '#757575';

/** Format date for display */
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

/** Format currency */
const formatCurrency = (amount) => 
  amount != null ? `₱${amount.toFixed(2)}` : 'N/A';

/** Create download from blob */
const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
};

// Memoized Sub-Components
/** Memoized category chip component */
const CategoryChip = memo(({ category }) => (
  <span 
    className={`status-badge ${
      category === 'fare-related' ? 'status-category-fare' :
      category === 'driver-conduct' ? 'status-category-conduct' :
      category === 'vehicle-condition' ? 'status-category-vehicle' :
      category === 'franchise-violations' ? 'status-category-franchise' :
      category === 'safety-violations' ? 'status-category-safety' :
      'status-category-other'
    }`}
  >
    {getCategoryLabel(category)}
  </span>
));
CategoryChip.displayName = 'CategoryChip';

/** Memoized status badge component */
const StatusBadge = memo(({ status }) => (
  <span 
    className={`status-badge ${
      status === 'pending' ? 'status-pending' :
      status === 'investigating' ? 'status-investigating' :
      status === 'resolved' ? 'status-resolved' :
      status === 'dismissed' ? 'status-dismissed' :
      'status-default'
    }`}
  >
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
));
StatusBadge.displayName = 'StatusBadge';

/** Memoized status select dropdown */
const StatusSelect = memo(({ value, onChange, includeAll = false, size = 'small', fullWidth = false }) => (
  <FormControl size={size} fullWidth={fullWidth} sx={!fullWidth ? { minWidth: 120 } : undefined}>
    <InputLabel>Status</InputLabel>
    <Select value={value} label="Status" onChange={onChange}>
      {includeAll && <MenuItem value="">All Status</MenuItem>}
      {STATUS_OPTIONS.map(opt => (
        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
      ))}
    </Select>
  </FormControl>
));
StatusSelect.displayName = 'StatusSelect';

/** Memoized category select dropdown */
const CategorySelect = memo(({ value, onChange, includeAll = false, label = 'Category', size = 'small', fullWidth = false }) => (
  <FormControl size={size} fullWidth={fullWidth} sx={!fullWidth ? { minWidth: 140 } : undefined}>
    <InputLabel>{label}</InputLabel>
    <Select value={value} label={label} onChange={onChange}>
      {includeAll && <MenuItem value="">All Categories</MenuItem>}
      {Object.entries(INCIDENT_CATEGORIES).map(([key, lbl]) => (
        <MenuItem key={key} value={key}>{lbl}</MenuItem>
      ))}
    </Select>
  </FormControl>
));
CategorySelect.displayName = 'CategorySelect';

// Main Component
function TricycleIncidentReports() {
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('dateReported');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Data states
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalReports, setTotalReports] = useState(0);
  
  // Modal states
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  
  // Update status states
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Export states
  const [exportFilters, setExportFilters] = useState({
    startDate: '',
    endDate: '',
    category: '',
    status: ''
  });
  const [exporting, setExporting] = useState(false);

  // Temporary filter states for dialog
  const [tempFilters, setTempFilters] = useState({ ...DEFAULT_FILTERS });

  // Snackbar Helpers
  const showSnackbar = useCallback((message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  // Data Fetching
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await incidentReportsAPI.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm,
        status: statusFilter,
        category: categoryFilter,
        sortBy,
        sortOrder
      });

      const data = response.data;
      setReports(data.reports || []);
      setTotalReports(data.pagination?.total || 0);
    } catch (err) {
      logger.error('Error fetching incident reports:', err);
      if (err.response?.status === 401) {
        setError('Authentication required. Please log in again.');
      } else {
        setError('Failed to fetch incident reports. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, statusFilter, categoryFilter, sortBy, sortOrder]);

  // Load reports and setup WebSocket
  useEffect(() => {
    fetchReports();

    // Connect to WebSocket for real-time updates
    if (!websocketService.isConnected()) {
      websocketService.connect('general');
    }

    // WebSocket event handlers
    const handleReportUpdate = () => fetchReports();

    websocketService.on('incident-reports', handleReportUpdate);
    websocketService.on('incident-report-updated', handleReportUpdate);

    return () => {
      websocketService.off('incident-reports', handleReportUpdate);
      websocketService.off('incident-report-updated', handleReportUpdate);
    };
  }, [fetchReports]);

  // Export Functions
  const exportReports = useCallback(async () => {
    const { startDate, endDate, category, status } = exportFilters;
    
    if (!startDate || !endDate) {
      showSnackbar('Please select start and end dates', 'warning');
      return;
    }

    setExporting(true);
    try {
      const response = await incidentReportsAPI.getByDateRange(startDate, endDate, {
        category: category || undefined,
        status: status || undefined,
        format: 'csv'
      });

      // Handle blob response for CSV export
      const blob = new Blob([response.data], { type: 'text/csv' });
      downloadBlob(blob, `incident_reports_${startDate}_to_${endDate}.csv`);
      
      setExportDialogOpen(false);
      showSnackbar('Reports exported successfully', 'success');
    } catch (err) {
      logger.error('Error exporting reports:', err);
      showSnackbar('Failed to export reports. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  }, [exportFilters, showSnackbar]);

  const exportMonthlyReports = useCallback(async () => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const response = await incidentReportsAPI.getMonthly(year, month, {
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        format: 'csv'
      });

      // Handle blob response for CSV export
      const blob = new Blob([response.data], { type: 'text/csv' });
      downloadBlob(blob, `incident_reports_${year}_${String(month).padStart(2, '0')}.csv`);
      
      showSnackbar('Monthly reports exported successfully', 'success');
    } catch (err) {
      logger.error('Error exporting monthly reports:', err);
      showSnackbar('Failed to export reports. Please try again.', 'error');
    }
  }, [categoryFilter, statusFilter, showSnackbar]);

  // Modal Handlers
  const handleOpenDetails = useCallback((report) => {
    setSelectedReport(report);
    setNewStatus(report.status);
    setDetailsOpen(true);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setDetailsOpen(false);
    setNewStatus('');
  }, []);

  const handleUpdateStatus = useCallback(async () => {
    if (!selectedReport || !newStatus || newStatus === selectedReport.status) return;
    
    setUpdatingStatus(true);
    try {
      await incidentReportsAPI.update(selectedReport._id, { status: newStatus });

      // Update local state optimistically
      setReports(prev => prev.map(r => 
        r._id === selectedReport._id ? { ...r, status: newStatus } : r
      ));
      
      showSnackbar('Incident report status updated successfully', 'success');
      handleCloseDetails();
    } catch (err) {
      logger.error('Error updating report status:', err);
      if (err.response?.status === 401) {
        showSnackbar('Authentication required. Please log in again.', 'error');
      } else {
        showSnackbar('Failed to update report status', 'error');
      }
    } finally {
      setUpdatingStatus(false);
    }
  }, [selectedReport, newStatus, showSnackbar, handleCloseDetails]);

  // Pagination Handlers
  const handleChangePage = useCallback((_, newPage) => setPage(newPage), []);;
  
  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  // Filter Handlers
  const handleSearch = useCallback(() => setPage(0), []);

  const handleOpenFilterDialog = useCallback(() => {
    setTempFilters({
      status: statusFilter,
      category: categoryFilter,
      sortBy,
      sortOrder
    });
    setFilterDialogOpen(true);
  }, [statusFilter, categoryFilter, sortBy, sortOrder]);

  const handleCloseFilterDialog = useCallback(() => setFilterDialogOpen(false), []);

  const handleTempFilterChange = useCallback((field, value) => {
    setTempFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleApplyFilters = useCallback(() => {
    setStatusFilter(tempFilters.status);
    setCategoryFilter(tempFilters.category);
    setSortBy(tempFilters.sortBy);
    setSortOrder(tempFilters.sortOrder);
    setPage(0);
    setFilterDialogOpen(false);
  }, [tempFilters]);

  const handleClearFilters = useCallback(() => {
    setTempFilters({ ...DEFAULT_FILTERS });
    setStatusFilter('');
    setCategoryFilter('');
    setSortBy('dateReported');
    setSortOrder('desc');
    setPage(0);
  }, []);

  const handleExportFilterChange = useCallback((field, value) => {
    setExportFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  // Computed Values
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter) count++;
    if (categoryFilter) count++;
    if (sortBy !== 'dateReported') count++;
    if (sortOrder !== 'desc') count++;
    return count;
  }, [statusFilter, categoryFilter, sortBy, sortOrder]);

  const canExport = exportFilters.startDate && exportFilters.endDate;

  // Render
  return (
    <div className="incident-reports-container">
      <Sidebar />
      <div className="content-container">
        {/* Header */}
        <div className="header-container">
          <Typography variant="h4" className="page-title">
            Tricycle Incident Reporting
          </Typography>
        </div>
        
        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        
        {/* Controls Row */}
        <div className="controls-row">
          {/* Search */}
          <div className="search-container">
            <TextField
              placeholder="Search Reports (ID, Franchisee, Description)"
              variant="outlined"
              fullWidth
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="search-field"
              size="small"
            />
            <Button className="search-button" onClick={handleSearch} variant="contained">
              <SearchIcon />
            </Button>
          </div>
          
          {/* Quick Filters */}
          <CategorySelect 
            value={categoryFilter} 
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
            includeAll
          />
          
          <StatusSelect 
            value={statusFilter} 
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            includeAll
          />
          
          {/* Advanced Filter Button */}
          <Tooltip title="Advanced Filters">
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={handleOpenFilterDialog}
              sx={{ position: 'relative' }}
            >
              Filters
              {activeFiltersCount > 0 && (
                <Chip
                  label={activeFiltersCount}
                  size="small"
                  color="primary"
                  sx={{ position: 'absolute', top: -8, right: -8, height: 20, minWidth: 20 }}
                />
              )}
            </Button>
          </Tooltip>
          
          {/* Export Buttons */}
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportMonthlyReports}>
            Export This Month
          </Button>
          
          <Tooltip title="Export with Date Range">
            <Button variant="outlined" startIcon={<DateRangeIcon />} onClick={() => setExportDialogOpen(true)}>
              Custom Export
            </Button>
          </Tooltip>
        </div>
        
        {/* Reports Table */}
        <Fade in={true} timeout={400}>
        <Paper className="admin-table-container" elevation={2}>
          {loading && (
            <PageLoader 
              loading={loading} 
              message="Loading incident reports..."
              overlay
            />
          )}
          
          <TableContainer className="admin-table-wrapper">
            <Table className="admin-table" stickyHeader aria-label="incident reports table">
              <TableHead>
                <TableRow>
                  <TableCell className="admin-table-header-cell col-id">Report ID</TableCell>
                  <TableCell className="admin-table-header-cell col-category">Category</TableCell>
                  <TableCell className="admin-table-header-cell col-name" align="left">Franchisee Name</TableCell>
                  <TableCell className="admin-table-header-cell col-date">Date Reported</TableCell>
                  <TableCell className="admin-table-header-cell col-status">Status</TableCell>
                  <TableCell className="admin-table-header-cell col-actions">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!loading && reports.length > 0 ? (
                  reports.map((report) => (
                    <TableRow 
                      key={report.reportID}
                      className="admin-table-row"
                      onClick={() => handleOpenDetails(report)}
                      hover
                    >
                      <TableCell className="admin-table-cell">{report.reportID}</TableCell>
                      <TableCell className="admin-table-cell">
                        <CategoryChip category={report.category} />
                      </TableCell>
                      <TableCell className="admin-table-cell col-name" align="left">
                        {report.operatorName || 'N/A'}
                      </TableCell>
                      <TableCell className="admin-table-cell">{formatDate(report.dateReported)}</TableCell>
                      <TableCell className="admin-table-cell">
                        <StatusBadge status={report.status} />
                      </TableCell>
                      <TableCell className="admin-table-cell">
                        <IconButton 
                          size="small"
                          className="action-icon-button view"
                          onClick={(e) => { e.stopPropagation(); handleOpenDetails(report); }}
                          aria-label="View report details"
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="admin-table-empty">
                      <Typography className="admin-table-empty-text">
                        {loading ? 'Loading...' : 'No incident reports found'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          <div className="admin-table-pagination">
            <TablePagination
              rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
              component="div"
              count={totalReports}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </div>
        </Paper>
        </Fade>
        
        {/* Advanced Filter Dialog */}
        <Dialog 
          open={filterDialogOpen} 
          onClose={handleCloseFilterDialog}
          maxWidth="sm"
          fullWidth
          className="filter-dialog"
        >
          <DialogTitle className="filter-dialog-title">
            Advanced Filters
            <IconButton onClick={handleCloseFilterDialog} sx={{ position: 'absolute', right: 8, top: 8, color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent className="filter-dialog-content">
            <Grid container spacing={3} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <CategorySelect 
                  value={tempFilters.category}
                  onChange={(e) => handleTempFilterChange('category', e.target.value)}
                  includeAll
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12}>
                <StatusSelect 
                  value={tempFilters.status}
                  onChange={(e) => handleTempFilterChange('status', e.target.value)}
                  includeAll
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Sort By</InputLabel>
                  <Select
                    value={tempFilters.sortBy}
                    label="Sort By"
                    onChange={(e) => handleTempFilterChange('sortBy', e.target.value)}
                  >
                    {SORT_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Sort Order</InputLabel>
                  <Select
                    value={tempFilters.sortOrder}
                    label="Sort Order"
                    onChange={(e) => handleTempFilterChange('sortOrder', e.target.value)}
                  >
                    <MenuItem value="asc">Ascending</MenuItem>
                    <MenuItem value="desc">Descending</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          
          <DialogActions className="filter-dialog-actions">
            <Button onClick={handleClearFilters} color="secondary">Clear All</Button>
            <Box sx={{ flex: 1 }} />
            <Button onClick={handleCloseFilterDialog} variant="outlined">Cancel</Button>
            <Button onClick={handleApplyFilters} variant="contained" color="primary">Apply Filters</Button>
          </DialogActions>
        </Dialog>
        
        {/* Export Dialog */}
        <Dialog 
          open={exportDialogOpen} 
          onClose={() => setExportDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Export Incident Reports
            <IconButton onClick={() => setExportDialogOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Start Date"
                  type="date"
                  value={exportFilters.startDate}
                  onChange={(e) => handleExportFilterChange('startDate', e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="End Date"
                  type="date"
                  value={exportFilters.endDate}
                  onChange={(e) => handleExportFilterChange('endDate', e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <CategorySelect 
                  value={exportFilters.category}
                  onChange={(e) => handleExportFilterChange('category', e.target.value)}
                  includeAll
                  label="Category (Optional)"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Status (Optional)</InputLabel>
                  <Select
                    value={exportFilters.status}
                    label="Status (Optional)"
                    onChange={(e) => handleExportFilterChange('status', e.target.value)}
                  >
                    <MenuItem value="">All Status</MenuItem>
                    {STATUS_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setExportDialogOpen(false)} variant="outlined">Cancel</Button>
            <Button 
              onClick={exportReports} 
              variant="contained" 
              color="primary"
              disabled={exporting || !canExport}
              startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Report Details Modal */}
        <Modal open={detailsOpen} onClose={handleCloseDetails} aria-labelledby="report-details-modal">
          <Box className="modal-container">
            <div className="modal-header">
              <Typography variant="h5" component="h2" id="report-details-modal">
                INCIDENT REPORT DETAILS
              </Typography>
              <IconButton onClick={handleCloseDetails} aria-label="Close modal">
                <CloseIcon />
              </IconButton>
            </div>
            
            {selectedReport && (
              <>
                <Typography variant="h6" className="section-header">
                  REPORT INFORMATION
                </Typography>
                
                <div className="info-grid">
                  <Typography variant="subtitle2" className="label">Report ID:</Typography>
                  <Typography>{selectedReport.reportID}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Category:</Typography>
                  <CategoryChip category={selectedReport.category} />
                  
                  <Typography variant="subtitle2" className="label">Franchisee:</Typography>
                  <Typography>{selectedReport.operatorName || 'N/A'}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Date:</Typography>
                  <Typography>{formatDate(selectedReport.dateReported)}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Contact:</Typography>
                  <Typography>{selectedReport.reporterContact || 'N/A'}</Typography>
                  
                  {/* Fare fields - only for fare-related incidents */}
                  {selectedReport.category === 'fare-related' && (
                    <>
                      <Typography variant="subtitle2" className="label">Charged:</Typography>
                      <Typography>{formatCurrency(selectedReport.amountCharged)}</Typography>
                      
                      <Typography variant="subtitle2" className="label">Expected:</Typography>
                      <Typography>{formatCurrency(selectedReport.expectedFare)}</Typography>
                    </>
                  )}
                  
                  <Typography variant="subtitle2" className="label">Description:</Typography>
                  <Typography sx={{ gridColumn: '2' }}>{selectedReport.description || 'No description provided'}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Status:</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                        {STATUS_OPTIONS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleUpdateStatus}
                      disabled={updatingStatus || newStatus === selectedReport.status}
                      sx={{
                        bgcolor: '#0a3161',
                        '&:hover': { bgcolor: '#082548' },
                        '&:disabled': { bgcolor: '#ccc' }
                      }}
                    >
                      {updatingStatus ? <CircularProgress size={20} color="inherit" /> : 'Update'}
                    </Button>
                  </Box>
                </div>
              </>
            )}
          </Box>
        </Modal>
        
        {/* Snackbar Notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={5000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
            {snackbar.message}
          </Alert>
        </Snackbar>
      </div>
    </div>
  );
}

export default TricycleIncidentReports;
