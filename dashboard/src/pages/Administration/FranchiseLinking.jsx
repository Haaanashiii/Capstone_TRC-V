import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import '../../Styles/Administrator_Css/FranchiseLinking.css';
import '../../Styles/Administrator_Css/SharedTable.css';
import Sidebar from './Sidebar';
import websocketService from '../../services/websocket';
import { franchiseLinkRequestAPI, API_BASE_URL } from '../Services/api';
import PageLoader from '../../components/PageLoader';
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
  Card,
  CardContent,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/Pending';
import LinkIcon from '@mui/icons-material/Link';
import DescriptionIcon from '@mui/icons-material/Description';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { logger } from '../../utils/logger';
import { getToken } from '../Services/api';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Status configuration */
const STATUS_CONFIG = Object.freeze({
  pending: { label: 'Pending', color: '#ff9800', icon: PendingIcon },
  approved: { label: 'Approved', color: '#4caf50', icon: CheckCircleIcon },
  rejected: { label: 'Rejected', color: '#f44336', icon: CancelIcon }
});

/** Status options for filter dropdown */
const STATUS_OPTIONS = Object.freeze([
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }
]);

/** Sort options */
const SORT_OPTIONS = Object.freeze([
  { value: 'createdAt', label: 'Date Submitted' },
  { value: 'franchiseNumber', label: 'Franchise Number' },
  { value: 'userName', label: 'Operator Name' },
  { value: 'status', label: 'Status' }
]);

/** Pagination options */
const ROWS_PER_PAGE_OPTIONS = [10, 15, 25, 50];

/** Default filters */
const DEFAULT_FILTERS = Object.freeze({
  status: '',
  sortBy: 'createdAt',
  sortOrder: 'desc'
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Format date for display */
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/** Format relative time */
const formatRelativeTime = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
};

// ============================================================================
// MEMOIZED SUB-COMPONENTS
// ============================================================================

/** Status badge component */
const StatusBadge = memo(({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span 
      className={`status-badge status-${status}`}
      style={{ backgroundColor: config.color }}
    >
      {config.label}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

/** Statistics card component */
const StatCard = memo(({ title, value, icon: Icon, color, onClick }) => (
  <Card 
    className={`stat-card ${onClick ? 'clickable' : ''}`}
    onClick={onClick}
    sx={{ 
      borderLeft: `4px solid ${color}`,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s ease',
      '&:hover': onClick ? { 
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      } : {}
    }}
  >
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
      <Box sx={{ 
        backgroundColor: `${color}20`, 
        borderRadius: '12px', 
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon sx={{ color, fontSize: 28 }} />
      </Box>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
          {title}
        </Typography>
      </Box>
    </CardContent>
  </Card>
));
StatCard.displayName = 'StatCard';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function FranchiseLinking() {
  // State management
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalRequests, setTotalRequests] = useState(0);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Statistics
  const [statistics, setStatistics] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  
  // Modal states
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  
  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  
  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Temp filters for dialog
  const [tempFilters, setTempFilters] = useState({ ...DEFAULT_FILTERS });
  
  // File preview states
  const [openFilePreview, setOpenFilePreview] = useState(false);
  const [previewFile, setPreviewFile] = useState({ name: '', type: '', path: '' });
  const currentBlobUrlRef = React.useRef(null);

  // ============================================================================
  // SNACKBAR HELPERS
  // ============================================================================
  
  const showSnackbar = useCallback((message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================
  
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await franchiseLinkRequestAPI.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm,
        status: statusFilter,
        sortBy,
        sortOrder
      });
      
      const data = response.data;
      setRequests(data.requests || []);
      setTotalRequests(data.total || 0);
    } catch (err) {
      logger.error('[FranchiseLinking] Error fetching requests:', err);
      if (err.response?.status === 401) {
        setError('Authentication required. Please log in again.');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to access this page.');
      } else {
        setError('Failed to fetch link requests. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, statusFilter, sortBy, sortOrder]);

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await franchiseLinkRequestAPI.getStatistics();
      setStatistics(response.data?.data || { pending: 0, approved: 0, rejected: 0, total: 0 });
    } catch (err) {
      logger.error('[FranchiseLinking] Error fetching statistics:', err);
    }
  }, []);

  // Initial load and WebSocket setup
  useEffect(() => {
    fetchRequests();
    fetchStatistics();

    // Connect to WebSocket
    if (!websocketService.isConnected()) {
      websocketService.connect('general');
    }

    // WebSocket event handlers
    const handleNewRequest = () => {
      fetchRequests();
      fetchStatistics();
    };

    const handleRequestUpdate = () => {
      fetchRequests();
      fetchStatistics();
    };

    websocketService.on('franchise-link-request-new', handleNewRequest);
    websocketService.on('franchise-link-request-updated', handleRequestUpdate);

    return () => {
      websocketService.off('franchise-link-request-new', handleNewRequest);
      websocketService.off('franchise-link-request-updated', handleRequestUpdate);
    };
  }, [fetchRequests, fetchStatistics]);

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================
  
  const handleOpenDetails = useCallback(async (request) => {
    try {
      // Fetch full details including franchise info
      const response = await franchiseLinkRequestAPI.getById(request._id);
      setSelectedRequest(response.data?.data || request);
      setDetailsModalOpen(true);
    } catch (err) {
      logger.error('[FranchiseLinking] Error fetching request details:', err);
      setSelectedRequest(request);
      setDetailsModalOpen(true);
    }
  }, []);

  const handleCloseDetails = useCallback(() => {
    setDetailsModalOpen(false);
    setSelectedRequest(null);
    setAdminNotes('');
  }, []);

  const handleApprove = useCallback(async () => {
    if (!selectedRequest) return;
    
    setActionLoading(true);
    try {
      await franchiseLinkRequestAPI.approve(selectedRequest._id, { adminNotes });
      showSnackbar('Request approved successfully. Franchise has been linked.', 'success');
      handleCloseDetails();
      fetchRequests();
      fetchStatistics();
    } catch (err) {
      logger.error('[FranchiseLinking] Error approving request:', err);
      const errorMsg = err.response?.data?.message || 'Failed to approve request. Please try again.';
      showSnackbar(errorMsg, 'error');
    } finally {
      setActionLoading(false);
    }
  }, [selectedRequest, adminNotes, showSnackbar, handleCloseDetails, fetchRequests, fetchStatistics]);

  const handleOpenRejectDialog = useCallback(() => {
    setRejectDialogOpen(true);
  }, []);

  const handleCloseRejectDialog = useCallback(() => {
    setRejectDialogOpen(false);
    setRejectionReason('');
  }, []);

  const handleReject = useCallback(async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      showSnackbar('Please provide a reason for rejection.', 'warning');
      return;
    }
    
    setActionLoading(true);
    try {
      await franchiseLinkRequestAPI.reject(selectedRequest._id, { 
        rejectionReason: rejectionReason.trim(),
        adminNotes 
      });
      showSnackbar('Request rejected. The operator will be notified via email.', 'success');
      handleCloseRejectDialog();
      handleCloseDetails();
      fetchRequests();
      fetchStatistics();
    } catch (err) {
      logger.error('[FranchiseLinking] Error rejecting request:', err);
      const errorMsg = err.response?.data?.message || 'Failed to reject request. Please try again.';
      showSnackbar(errorMsg, 'error');
    } finally {
      setActionLoading(false);
    }
  }, [selectedRequest, rejectionReason, adminNotes, showSnackbar, handleCloseRejectDialog, handleCloseDetails, fetchRequests, fetchStatistics]);

  // ============================================================================
  // PAGINATION & FILTER HANDLERS
  // ============================================================================
  
  const handleChangePage = useCallback((_, newPage) => setPage(newPage), []);
  
  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleSearch = useCallback(() => setPage(0), []);

  const handleOpenFilterDialog = useCallback(() => {
    setTempFilters({
      status: statusFilter,
      sortBy,
      sortOrder
    });
    setFilterDialogOpen(true);
  }, [statusFilter, sortBy, sortOrder]);

  const handleCloseFilterDialog = useCallback(() => setFilterDialogOpen(false), []);

  const handleTempFilterChange = useCallback((field, value) => {
    setTempFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleApplyFilters = useCallback(() => {
    setStatusFilter(tempFilters.status);
    setSortBy(tempFilters.sortBy);
    setSortOrder(tempFilters.sortOrder);
    setPage(0);
    setFilterDialogOpen(false);
  }, [tempFilters]);

  const handleClearFilters = useCallback(() => {
    setTempFilters({ ...DEFAULT_FILTERS });
    setStatusFilter('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(0);
  }, []);

  const handleFilterByStatus = useCallback((status) => {
    setStatusFilter(status);
    setPage(0);
  }, []);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter) count++;
    if (sortBy !== 'createdAt') count++;
    if (sortOrder !== 'desc') count++;
    return count;
  }, [statusFilter, sortBy, sortOrder]);

  // ============================================================================
  // DOCUMENT VIEWER
  // ============================================================================
  
  const handleViewDocument = useCallback(async (documentUrl) => {
    if (!documentUrl) {
      showSnackbar('No document available', 'warning');
      return;
    }
    
    // Normalize file path
    let filePath = documentUrl;
    let fileName = 'document';
    
    // Extract filename from path
    if (typeof documentUrl === 'string') {
      fileName = documentUrl.split('/').pop() || documentUrl;
      
      // Handle gridfs:// URLs
      if (documentUrl.startsWith('gridfs://')) {
        const fileId = documentUrl.substring(9);
        filePath = `${API_BASE_URL.replace(/\/$/, '')}/api/files/${fileId}`;
      } else if (!/^https?:\/\//i.test(documentUrl)) {
        const pathPart = documentUrl.startsWith('/') ? documentUrl : '/' + documentUrl;
        filePath = API_BASE_URL.replace(/\/$/, '') + pathPart;
      }
    }
    
    // Fetch and preview file
    try {
      const token = getToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const resp = await fetch(filePath, { 
        mode: 'cors',
        headers
      });
      
      if (!resp.ok) {
        throw new Error(`Failed to fetch file: ${resp.status}`);
      }
      
      const blob = await resp.blob();
      const contentType = blob.type || resp.headers.get('Content-Type') || '';
      
      // Create blob URL
      const blobWithType = !blob.type ? new Blob([blob], { type: contentType }) : blob;
      const objectUrl = URL.createObjectURL(blobWithType);
      
      // Revoke previous blob URL if any
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }
      currentBlobUrlRef.current = objectUrl;
      
      setPreviewFile({ 
        name: fileName,
        type: contentType,
        path: objectUrl
      });
      setOpenFilePreview(true);
    } catch (err) {
      logger.error('[FilePreview] Failed to load file:', err);
      showSnackbar('Failed to load file preview', 'error');
    }
  }, [showSnackbar]);
  
  const handleCloseFilePreview = useCallback(() => {
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
    setOpenFilePreview(false);
    setPreviewFile({ name: '', type: '', path: '' });
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="franchise-linking-container">
      <Sidebar />
      <div className="content-container">
        {/* Header */}
        <div className="header-container">
          <Typography variant="h4" className="page-title">
            Franchise Linking Requests
          </Typography>
          <Tooltip title="Refresh">
            <IconButton onClick={() => { fetchRequests(); fetchStatistics(); }} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </div>
        
        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        
        {/* Statistics Cards */}
        <div className="stats-grid">
          <StatCard 
            title="Pending Requests" 
            value={statistics.pending} 
            icon={PendingIcon} 
            color="#ff9800"
            onClick={() => handleFilterByStatus('pending')}
          />
          <StatCard 
            title="Approved" 
            value={statistics.approved} 
            icon={CheckCircleIcon} 
            color="#4caf50"
            onClick={() => handleFilterByStatus('approved')}
          />
          <StatCard 
            title="Rejected" 
            value={statistics.rejected} 
            icon={CancelIcon} 
            color="#f44336"
            onClick={() => handleFilterByStatus('rejected')}
          />
          <StatCard 
            title="Total Requests" 
            value={statistics.total} 
            icon={LinkIcon} 
            color="#0A356B"
            onClick={() => handleFilterByStatus('')}
          />
        </div>
        
        {/* Controls Row */}
        <div className="controls-row">
          {/* Search */}
          <div className="search-container">
            <TextField
              placeholder="Search by franchise number, name, or email..."
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
          
          {/* Quick Status Filter */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select 
              value={statusFilter} 
              label="Status" 
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            >
              {STATUS_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
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
        </div>
        
        {/* Requests Table */}
        <Fade in={true} timeout={400}>
          <Paper className="admin-table-container" elevation={2}>
            {loading && (
              <PageLoader 
                loading={loading} 
                message="Loading link requests..."
                overlay
              />
            )}
            
            <TableContainer className="admin-table-wrapper">
              <Table className="admin-table" stickyHeader aria-label="franchise link requests table">
                <TableHead>
                  <TableRow>
                    <TableCell className="admin-table-header-cell">Franchise #</TableCell>
                    <TableCell className="admin-table-header-cell">Operator Name</TableCell>
                    <TableCell className="admin-table-header-cell">Email</TableCell>
                    <TableCell className="admin-table-header-cell">Date Submitted</TableCell>
                    <TableCell className="admin-table-header-cell">Status</TableCell>
                    <TableCell className="admin-table-header-cell">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!loading && requests.length > 0 ? (
                    requests.map((request) => (
                      <TableRow 
                        key={request._id}
                        className="admin-table-row"
                        onClick={() => handleOpenDetails(request)}
                        hover
                      >
                        <TableCell className="admin-table-cell">
                          <strong>{request.franchiseNumber}</strong>
                        </TableCell>
                        <TableCell className="admin-table-cell">
                          {request.userName || 'N/A'}
                        </TableCell>
                        <TableCell className="admin-table-cell">
                          {request.userEmail || 'N/A'}
                        </TableCell>
                        <TableCell className="admin-table-cell">
                          <Tooltip title={formatDate(request.createdAt)}>
                            <span>{formatRelativeTime(request.createdAt)}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="admin-table-cell">
                          <StatusBadge status={request.status} />
                        </TableCell>
                        <TableCell className="admin-table-cell">
                          <IconButton 
                            size="small"
                            className="action-icon-button view"
                            onClick={(e) => { e.stopPropagation(); handleOpenDetails(request); }}
                            aria-label="View request details"
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
                          {loading ? 'Loading...' : 'No link requests found'}
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
                count={totalRequests}
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
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select 
                    value={tempFilters.status} 
                    label="Status"
                    onChange={(e) => handleTempFilterChange('status', e.target.value)}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
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
        
        {/* Request Details Modal */}
        <Modal open={detailsModalOpen} onClose={handleCloseDetails} aria-labelledby="request-details-modal">
          <Box className="modal-container">
            <div className="modal-header">
              <Typography variant="h5" component="h2" id="request-details-modal">
                LINK REQUEST DETAILS
              </Typography>
              <IconButton onClick={handleCloseDetails} aria-label="Close modal">
                <CloseIcon />
              </IconButton>
            </div>
            
            {selectedRequest && (
              <>
                {/* Request Info */}
                <Typography variant="h6" className="section-header">
                  REQUEST INFORMATION
                </Typography>
                
                <div className="info-grid">
                  <Typography variant="subtitle2" className="label">Franchise Number:</Typography>
                  <Typography><strong>{selectedRequest.franchiseNumber}</strong></Typography>
                  
                  <Typography variant="subtitle2" className="label">Operator Name:</Typography>
                  <Typography>{selectedRequest.userName || 'N/A'}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Email:</Typography>
                  <Typography>{selectedRequest.userEmail || 'N/A'}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Contact:</Typography>
                  <Typography>{selectedRequest.userContact || 'N/A'}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Date Submitted:</Typography>
                  <Typography>{formatDate(selectedRequest.createdAt)}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Status:</Typography>
                  <StatusBadge status={selectedRequest.status} />
                  
                  {selectedRequest.supportingDocument && (
                    <>
                      <Typography variant="subtitle2" className="label">Document:</Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DescriptionIcon />}
                        onClick={() => handleViewDocument(selectedRequest.supportingDocument)}
                      >
                        {selectedRequest.documentFilename || 'View Document'}
                      </Button>
                    </>
                  )}
                </div>
                
                {/* Franchise Details (if available) */}
                {selectedRequest.franchiseDetails && (
                  <>
                    <Typography variant="h6" className="section-header" sx={{ mt: 3 }}>
                      FRANCHISE INFORMATION
                    </Typography>
                    
                    <div className="info-grid">
                      <Typography variant="subtitle2" className="label">Registered Name:</Typography>
                      <Typography>{selectedRequest.franchiseDetails.operatorName || 'N/A'}</Typography>
                      
                      <Typography variant="subtitle2" className="label">Franchise Status:</Typography>
                      <Typography>{selectedRequest.franchiseDetails.franchiseStatus || 'N/A'}</Typography>
                      
                      <Typography variant="subtitle2" className="label">Barangay:</Typography>
                      <Typography>{selectedRequest.franchiseDetails.operatorBarangay || 'N/A'}</Typography>
                      
                      {selectedRequest.franchiseDetails.expiryDate && (
                        <>
                          <Typography variant="subtitle2" className="label">Expiry Date:</Typography>
                          <Typography>{formatDate(selectedRequest.franchiseDetails.expiryDate)}</Typography>
                        </>
                      )}
                    </div>
                  </>
                )}
                
                {/* Review Info (if already reviewed) */}
                {selectedRequest.status !== 'pending' && (
                  <>
                    <Typography variant="h6" className="section-header" sx={{ mt: 3 }}>
                      REVIEW INFORMATION
                    </Typography>
                    
                    <div className="info-grid">
                      <Typography variant="subtitle2" className="label">Reviewed By:</Typography>
                      <Typography>{selectedRequest.reviewedByName || 'N/A'}</Typography>
                      
                      <Typography variant="subtitle2" className="label">Reviewed At:</Typography>
                      <Typography>{formatDate(selectedRequest.reviewedAt)}</Typography>
                      
                      {selectedRequest.rejectionReason && (
                        <>
                          <Typography variant="subtitle2" className="label">Rejection Reason:</Typography>
                          <Typography sx={{ color: '#dc2626' }}>{selectedRequest.rejectionReason}</Typography>
                        </>
                      )}
                      
                      {selectedRequest.adminNotes && (
                        <>
                          <Typography variant="subtitle2" className="label">Admin Notes:</Typography>
                          <Typography>{selectedRequest.adminNotes}</Typography>
                        </>
                      )}
                    </div>
                  </>
                )}
                
                {/* Action Buttons (only for pending requests) */}
                {selectedRequest.status === 'pending' && (
                  <>
                    <Typography variant="h6" className="section-header" sx={{ mt: 3 }}>
                      ADMIN NOTES (Optional)
                    </Typography>
                    
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      placeholder="Add internal notes about this request..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      sx={{ mb: 3 }}
                    />
                    
                    <div className="action-buttons">
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
                        onClick={handleApprove}
                        disabled={actionLoading}
                        sx={{ mr: 2 }}
                      >
                        Approve & Link
                      </Button>
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={<CancelIcon />}
                        onClick={handleOpenRejectDialog}
                        disabled={actionLoading}
                      >
                        Reject
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </Box>
        </Modal>
        
        {/* Reject Confirmation Dialog */}
        <Dialog
          open={rejectDialogOpen}
          onClose={handleCloseRejectDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ backgroundColor: '#dc2626', color: 'white' }}>
            Reject Link Request
            <IconButton onClick={handleCloseRejectDialog} sx={{ position: 'absolute', right: 8, top: 8, color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ mt: 2 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              The operator will receive an email notification with the rejection reason.
            </Alert>
            
            <TextField
              fullWidth
              label="Rejection Reason"
              placeholder="Please provide a clear reason for rejection..."
              multiline
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
              error={!rejectionReason.trim()}
              helperText={!rejectionReason.trim() ? 'Rejection reason is required' : ''}
            />
          </DialogContent>
          
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleCloseRejectDialog} variant="outlined">
              Cancel
            </Button>
            <Button 
              onClick={handleReject} 
              variant="contained" 
              color="error"
              disabled={actionLoading || !rejectionReason.trim()}
              startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
            >
              {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* File Preview Modal */}
        <Modal
          open={openFilePreview}
          onClose={handleCloseFilePreview}
          aria-labelledby="file-preview-modal"
          sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
          slotProps={{
            backdrop: {
              sx: {
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(4px)',
              },
            },
          }}
        >
          <Box 
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%',
              maxWidth: '900px',
              height: '85vh',
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <Box 
              sx={{ 
                p: 2.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: '#f8f9fa',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                {previewFile.type?.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(previewFile.name) ? (
                  <ImageIcon sx={{ color: '#2196f3', fontSize: 28 }} />
                ) : previewFile.type?.includes('pdf') || previewFile.name?.toLowerCase().endsWith('.pdf') ? (
                  <PictureAsPdfIcon sx={{ color: '#d32f2f', fontSize: 28 }} />
                ) : (
                  <InsertDriveFileIcon sx={{ color: '#757575', fontSize: 28 }} />
                )}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 600,
                      fontSize: '1.125rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#1a1a1a',
                    }}
                  >
                    {previewFile.name}
                  </Typography>
                  {previewFile.type && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                      {previewFile.type}
                    </Typography>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = previewFile.path;
                    link.download = previewFile.name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  sx={{ 
                    borderColor: '#0A356B',
                    color: '#0A356B',
                    textTransform: 'none',
                    fontWeight: 500,
                    '&:hover': { 
                      borderColor: '#082548',
                      bgcolor: 'rgba(10, 53, 107, 0.04)'
                    }
                  }}
                >
                  Download
                </Button>
                <IconButton
                  onClick={handleCloseFilePreview}
                  sx={{ 
                    color: '#666',
                    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.08)' }
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>
            
            {/* Preview Content */}
            <Box 
              sx={{ 
                flex: 1,
                overflow: 'hidden',
                bgcolor: '#2b2b2b',
              }}
            >
              {previewFile.type?.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(previewFile.name) ? (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 3,
                  }}
                >
                  <img 
                    src={previewFile.path} 
                    alt={previewFile.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    }}
                    onError={(e) => {
                      logger.error('Image preview failed:', e);
                      e.target.style.display = 'none';
                    }}
                  />
                </Box>
              ) : previewFile.type?.includes('pdf') || previewFile.name?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewFile.path}
                  title={previewFile.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    backgroundColor: '#525252',
                  }}
                />
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2.5,
                    p: 4,
                    textAlign: 'center',
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    m: 4,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <InsertDriveFileIcon sx={{ fontSize: 80, color: '#bdbdbd' }} />
                  <Typography variant="h6" sx={{ color: '#424242', fontWeight: 500 }}>
                    Preview Not Available
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
                    This file type cannot be previewed directly in the browser. Please download the file to view its contents.
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<DownloadIcon />}
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = previewFile.path;
                      link.download = previewFile.name;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    sx={{
                      mt: 1,
                      bgcolor: '#0A356B',
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 4,
                      py: 1.5,
                      '&:hover': { bgcolor: '#082548' }
                    }}
                  >
                    Download File
                  </Button>
                </Box>
              )}
            </Box>
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

export default FranchiseLinking;
