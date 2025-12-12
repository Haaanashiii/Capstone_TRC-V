import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../Styles/Administrator_Css/AuditTrail.css';
import '../../Styles/Administrator_Css/SharedTable.css';
import Sidebar from './Sidebar';
import websocketService from '../../services/websocket';
import PageLoader, { TableLoader } from '../../components/PageLoader';
import AnimatedPage, { AnimatedSection } from '../../components/AnimatedPage';
import {
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Box,
  Modal,
  Divider,
  Grid,
  Fade,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import { logger } from '../../utils/logger';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';

// Action type color mapping for chips
const ACTION_COLORS = {
  LOGIN: 'success',
  USER_LOGIN: 'success',
  LOGOUT: 'default',
  USER_LOGOUT: 'default',
  SIGNUP: 'success',
  USER_SIGNUP: 'success',
  CREATE: 'info',
  UPDATE: 'warning',
  DELETE: 'error',
  APPROVE: 'success',
  REJECT: 'error',
  VIEW: 'default',
  EXPORT: 'info',
  CREATE_FRANCHISE: 'info',
  UPDATE_FRANCHISE: 'warning',
  DELETE_FRANCHISE: 'error',
  GET_FRANCHISE_INFO: 'default',
  CREATE_APPLICATION: 'info',
  UPDATE_APPLICATION: 'warning',
  EDIT_APPLICATION: 'warning',
  APPROVE_APPLICATION: 'success',
  REJECT_APPLICATION: 'error',
  BPLO_APPROVE_APPLICATION: 'success',
  BPLO_REJECT_APPLICATION: 'error',
  OPERATOR_ADD_OR: 'info',
  SB_APPROVE_FRANCHISE: 'success',
  SB_UPDATE_FRANCHISE: 'warning',
  FRANCHISE_EXPIRED: 'error',
  FRANCHISE_REVOKED: 'error',
  DOWNLOAD_APPLICATION_FILE: 'default',
  QR_CODE_SCAN: 'info',
  QR_SCAN: 'info',
  VERIFY_OTP: 'success',
  RESET_PASSWORD: 'warning',
  CREATE_ANNOUNCEMENT: 'info',
  UPDATE_ANNOUNCEMENT: 'warning',
  DELETE_ANNOUNCEMENT: 'error',
  SEARCH_FRANCHISE_NUMBER: 'default',
};

// Role color mapping - matches the design system
const ROLE_COLORS = {
  'super-admin': 'error',
  'sb-admin': 'primary',
  'bplo-admin': 'warning',
  'operator': 'default',
};

// Format role labels for display
const formatRoleLabel = (role) => {
  const roleLabels = {
    'super-admin': 'Super Administrator',
    'sb-admin': 'SB Admin',
    'bplo-admin': 'BPLO Admin',
    'operator': 'Operator',
  };
  return roleLabels[role] || role;
};

// HTTP Status Code color mapping
const getStatusColor = (statusCode) => {
  if (statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode >= 400 && statusCode < 500) return 'warning';
  if (statusCode >= 500) return 'error';
  return 'default';
};

function AuditTrail() {
  const navigate = useNavigate();
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  // Get auth token from storage
  const getAuthToken = useCallback(() => {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
  }, []);

  // Verify admin access on component mount
  useEffect(() => {
    try {
      const token = getAuthToken();
      if (!token) {
        setIsAuthorized(false);
        navigate('/login');
        return;
      }

      // Decode token to check account type and role
      const decoded = JSON.parse(atob(token.split('.')[1]));
      
      // Only admins (with admin roles) can access audit trail
      const adminRoles = ['sb-admin', 'bplo-admin', 'super-admin'];
      if (decoded.accountType !== 'admin' && !adminRoles.includes(decoded.role)) {
        setIsAuthorized(false);
        setError('You do not have permission to access the audit trail. Admin access only.');
        setTimeout(() => navigate('/'), 2000);
        return;
      }

      setIsAuthorized(true);
    } catch (err) {
      logger.error('[AuditTrail] Authorization check failed:', err);
      setIsAuthorized(false);
      setError('Authorization verification failed. Please log in again.');
      setTimeout(() => navigate('/login'), 2000);
    }
  }, [getAuthToken, navigate]);

  // Fetch audit logs from API
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = getAuthToken();
      
      if (!token) {
        setError('Authentication required. Please log in.');
        setLoading(false);
        return;
      }

      // Build query parameters
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
        sort: 'createdAt',
        order: 'desc',
      });

      // Add filters if they are set
      if (filterAction !== 'all') {
        params.append('action', filterAction);
      }
      if (filterRole !== 'all') {
        params.append('role', filterRole);
      }
      if (filterStatus !== 'all') {
        params.append('success', filterStatus === 'success' ? 'true' : 'false');
      }

      const response = await fetch(`${API_BASE_URL}/api/audit-logs?${params.toString()}`, {
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
          throw new Error('You do not have permission to view audit logs.');
        }
        throw new Error(`Failed to fetch audit logs: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && Array.isArray(result.data)) {
        setAuditLogs(result.data);
        setTotalCount(result.pagination?.total || result.data.length);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      logger.error('Error fetching audit logs:', err);
      setError(err.message || 'Failed to fetch audit logs. Please try again.');
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filterAction, filterRole, filterStatus, getAuthToken]);

  // Fetch logs on component mount, setup WebSocket, and when filters/pagination change
  useEffect(() => {
    fetchAuditLogs();

    // Connect to WebSocket for real-time updates
    if (!websocketService.isConnected()) {
      websocketService.connect('general')
    }

    // Subscribe to audit log updates
    const handleAuditLogUpdates = () => {
      fetchAuditLogs();
    };

    websocketService.on('audit-logs', handleAuditLogUpdates);
    websocketService.on('audit-log-created', handleAuditLogUpdates);

    return () => {
      websocketService.off('audit-logs', handleAuditLogUpdates);
      websocketService.off('audit-log-created', handleAuditLogUpdates);
    };
  }, [fetchAuditLogs]);

  // Apply client-side search filter (for loaded data)
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) {
      return auditLogs;
    }

    const query = searchQuery.toLowerCase();
    return auditLogs.filter(log => 
      log.username?.toLowerCase().includes(query) ||
      log.email?.toLowerCase().includes(query) ||
      log.action?.toLowerCase().includes(query) ||
      log.route?.toLowerCase().includes(query) ||
      log.ipAddress?.includes(query) ||
      log.resourceType?.toLowerCase().includes(query)
    );
  }, [auditLogs, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [filterAction, filterRole, filterStatus]);

  // Export to CSV
  const handleExport = useCallback(async () => {
    try {
      const token = getAuthToken();
      
      if (!token) {
        setError('Authentication required. Please log in.');
        return;
      }

      // For CSV export, fetch all logs without pagination
      const params = new URLSearchParams({
        limit: '10000', // Large limit to get all logs
        sort: 'createdAt',
        order: 'desc',
      });

      if (filterAction !== 'all') params.append('action', filterAction);
      if (filterRole !== 'all') params.append('role', filterRole);
      if (filterStatus !== 'all') params.append('success', filterStatus === 'success' ? 'true' : 'false');

      const response = await fetch(`${API_BASE_URL}/api/audit-logs?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch logs for export');
      }

      const result = await response.json();
      const logsToExport = result.success && Array.isArray(result.data) ? result.data : [];

      // Create CSV content
      const headers = ['Date/Time', 'Username', 'Email', 'Role', 'Action', 'Method', 'Route', 'Status Code', 'Success', 'Resource Type', 'IP Address'];
      const csvContent = [
        headers.join(','),
        ...logsToExport.map(log => [
          new Date(log.createdAt).toLocaleString(),
          `"${log.username || ''}"`,
          `"${log.email || ''}"`,
          log.role || '',
          log.action || '',
          log.method || '',
          `"${log.route || ''}"`,
          log.statusCode || '',
          log.success ? 'Yes' : 'No',
          log.resourceType || '',
          log.ipAddress || ''
        ].join(','))
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Export error:', err);
      setError('Failed to export audit logs. Please try again.');
    }
  }, [filterAction, filterRole, filterStatus, getAuthToken]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterAction('all');
    setFilterRole('all');
    setFilterStatus('all');
    setPage(0);
  }, []);

  // Modal handlers
  const handleOpenViewModal = useCallback((log) => {
    setSelectedLog(log);
    setViewModalOpen(true);
  }, []);

  const handleCloseViewModal = useCallback(() => {
    setViewModalOpen(false);
    setTimeout(() => setSelectedLog(null), 200);
  }, []);

  // Extract unique values for filters from current loaded logs
  const uniqueActions = useMemo(() => 
    [...new Set(auditLogs.map(log => log.action).filter(Boolean))].sort(),
    [auditLogs]
  );
  
  const uniqueRoles = useMemo(() => 
    [...new Set(auditLogs.map(log => log.role).filter(Boolean))].sort(),
    [auditLogs]
  );

  // Format date/time
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Authorization guard
  if (!isAuthorized) {
    return (
      <div className="audit-trail-container">
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
              {error || 'You do not have permission to access the audit trail.'}
            </Typography>
          </Box>
        </div>
      </div>
    );
  }

  return (
    <div className="audit-trail-container">
      <Sidebar />
      <div className="content-container">
        {/* Header */}
        <header className="audit-header">
          <Typography variant="h4" className="page-title">
            Audit Trail
          </Typography>
          
        </header>

        {error && (
          <Alert severity="error" className="error-alert" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Search and Filters - Separated from table */}
        <div className="filters-section">
          <div className="filters-row">
            <TextField
              placeholder="Search by username, email, action, route, or IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              variant="outlined"
              size="small"
              className="search-field"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#64748b' }} />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" className="filter-select">
              <InputLabel>Action</InputLabel>
              <Select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                label="Action"
              >
                <MenuItem value="all">All Actions</MenuItem>
                {uniqueActions.map(action => (
                  <MenuItem key={action} value={action}>{action}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" className="filter-select">
              <InputLabel>Role</InputLabel>
              <Select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                label="Role"
              >
                <MenuItem value="all">All Roles</MenuItem>
                {uniqueRoles.map(role => (
                  <MenuItem key={role} value={role}>{formatRoleLabel(role)}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" className="filter-select">
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="success">Success</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>

            <Tooltip title="Refresh">
              <IconButton onClick={fetchAuditLogs} className="refresh-btn" disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>

            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={clearFilters}
              size="small"
              className="clear-filters-btn"
              disabled={loading}
            >
              Clear
            </Button>

            <Button
              variant="contained"
              startIcon={<FileDownloadIcon />}
              onClick={handleExport}
              disabled={filteredLogs.length === 0 || loading}
              className="export-button"
            >
              Export
            </Button>
          </div>
        </div>

        <Paper elevation={2} className="admin-table-container">
          {/* Audit Logs Table */}
          {loading ? (
            <PageLoader 
              loading={loading} 
              message="Loading audit logs..." 
              minHeight={400}
            />
          ) : (
            <Fade in={!loading} timeout={400}>
              <Box>
              <TableContainer className="admin-table-wrapper">
                <Table className="admin-table" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell className="admin-table-header-cell col-date">Date/Time</TableCell>
                      <TableCell className="admin-table-header-cell col-name">User</TableCell>
                      <TableCell className="admin-table-header-cell col-status">Role</TableCell>
                      <TableCell className="admin-table-header-cell col-name">Description</TableCell>
                      <TableCell className="admin-table-header-cell col-status">Action</TableCell>
                      <TableCell className="admin-table-header-cell col-name">Browser/Device</TableCell>
                      <TableCell className="admin-table-header-cell col-status">Status</TableCell>
                      <TableCell className="admin-table-header-cell col-name">IP Address</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow className="admin-table-row">
                        <TableCell className="admin-table-cell" colSpan={8} align="center">
                          <Box sx={{ py: 4 }}>
                            <Typography variant="body2" color="text.secondary" className="no-data">
                              {searchQuery || filterAction !== 'all' || filterRole !== 'all' || filterStatus !== 'all'
                                ? 'No audit logs match your filters'
                                : 'No audit logs available'}
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => (
                        <TableRow 
                          key={log._id} 
                          className="admin-table-row" 
                          hover
                          onClick={() => handleOpenViewModal(log)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell className="admin-table-cell col-date">
                            <Typography variant="body2" className="timestamp-text">
                              {formatDateTime(log.createdAt)}
                            </Typography>
                          </TableCell>
                          <TableCell className="admin-table-cell col-name">
                            <Typography variant="body2" className="user-name">
                              {log.name || log.username || 'Unknown'}
                            </Typography>
                            <Typography variant="caption" className="email-text">
                              {log.email || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell className="admin-table-cell col-status">
                            <Chip
                              label={formatRoleLabel(log.role)}
                              color={ROLE_COLORS[log.role] || 'default'}
                              size="small"
                              className="status-badge"
                            />
                          </TableCell>
                          <TableCell className="admin-table-cell col-name">
                            <Typography variant="body2" className="description-text" sx={{ fontWeight: 500 }}>
                              {log.description || log.action || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell className="admin-table-cell col-status">
                            <Chip
                              label={log.action || 'N/A'}
                              color={ACTION_COLORS[log.action] || 'default'}
                              size="small"
                              className="status-badge"
                            />
                          </TableCell>
                          <TableCell className="admin-table-cell col-name">
                            <Typography variant="body2" className="browser-text">
                              {log.browser || 'Unknown Browser'}
                            </Typography>
                            <Typography variant="caption" className="device-text">
                              {log.device || 'Unknown Device'}
                            </Typography>
                          </TableCell>
                          <TableCell className="admin-table-cell col-status">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {log.success ? (
                                <CheckCircleIcon sx={{ fontSize: 16, color: '#10B981' }} />
                              ) : (
                                <ErrorIcon sx={{ fontSize: 16, color: '#EF4444' }} />
                              )}
                              <Chip
                                label={log.statusCode || 'N/A'}
                                color={getStatusColor(log.statusCode)}
                                size="small"
                                className="status-badge"
                              />
                            </Box>
                          </TableCell>
                          <TableCell className="admin-table-cell col-name">
                            <Typography variant="body2" className="ip-text">
                              {log.ipAddress || 'N/A'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={totalCount}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 15, 25, 50]}
                className="admin-table-pagination"
              />
              </Box>
            </Fade>
          )}
        </Paper>

        {/* View Audit Log Details Modal */}
        <Modal
          open={viewModalOpen}
          onClose={handleCloseViewModal}
          aria-labelledby="audit-log-details-modal"
        >
          <Box className="modal-container">
            <div className="modal-header">
              <Typography variant="h5" component="h2">
                AUDIT LOG DETAILS
              </Typography>
              <IconButton onClick={handleCloseViewModal}>
                <CloseIcon />
              </IconButton>
            </div>
            
            {selectedLog && (
              <>
                <Typography variant="h6" className="section-header">
                  USER INFORMATION
                </Typography>
                
                <div className="info-grid">
                  <Typography variant="subtitle2" className="label">Name:</Typography>
                  <Typography>{selectedLog.name || selectedLog.username || 'N/A'}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Email:</Typography>
                  <Typography>{selectedLog.email || 'N/A'}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Role:</Typography>
                  <Box>
                    <Chip
                      label={formatRoleLabel(selectedLog.role)}
                      color={ROLE_COLORS[selectedLog.role] || 'default'}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="subtitle2" className="label">User ID:</Typography>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                    {selectedLog.userId || 'N/A'}
                  </Typography>
                </div>

                <Divider sx={{ my: 3, borderColor: '#e0e0e0' }} />

                <Typography variant="h6" className="section-header">
                  ACTION DETAILS
                </Typography>
                
                <div className="info-grid">
                  <Typography variant="subtitle2" className="label">Description:</Typography>
                  <Typography sx={{ gridColumn: '2' }}>
                    {selectedLog.description || selectedLog.action || 'N/A'}
                  </Typography>
                  
                  <Typography variant="subtitle2" className="label">Action Type:</Typography>
                  <Box>
                    <Chip
                      label={selectedLog.action || 'N/A'}
                      color={ACTION_COLORS[selectedLog.action] || 'default'}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="subtitle2" className="label">Timestamp:</Typography>
                  <Typography>{formatDateTime(selectedLog.createdAt)}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Resource Type:</Typography>
                  <Typography>{selectedLog.resourceType || 'N/A'}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Resource ID:</Typography>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                    {selectedLog.resourceId || 'N/A'}
                  </Typography>
                </div>

                <Divider sx={{ my: 3, borderColor: '#e0e0e0' }} />

                <Typography variant="h6" className="section-header">
                  REQUEST INFORMATION
                </Typography>
                
                <div className="info-grid">
                  <Typography variant="subtitle2" className="label">HTTP Method:</Typography>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                    {selectedLog.method || 'N/A'}
                  </Typography>
                  
                  <Typography variant="subtitle2" className="label">Status Code:</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {selectedLog.success ? (
                      <CheckCircleIcon sx={{ fontSize: 18, color: '#10B981' }} />
                    ) : (
                      <ErrorIcon sx={{ fontSize: 18, color: '#EF4444' }} />
                    )}
                    <Chip
                      label={selectedLog.statusCode || 'N/A'}
                      color={getStatusColor(selectedLog.statusCode)}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="subtitle2" className="label">Route:</Typography>
                  <Typography 
                    sx={{ 
                      fontFamily: 'monospace',
                      fontSize: '0.85em',
                      bgcolor: '#f5f5f5',
                      p: 1,
                      borderRadius: 1,
                      wordBreak: 'break-all',
                      gridColumn: '2'
                    }}
                  >
                    {selectedLog.route || 'N/A'}
                  </Typography>
                </div>

                <Divider sx={{ my: 3, borderColor: '#e0e0e0' }} />

                <Typography variant="h6" className="section-header">
                  SYSTEM INFORMATION
                </Typography>
                
                <div className="info-grid">
                  <Typography variant="subtitle2" className="label">IP Address:</Typography>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                    {selectedLog.ipAddress || 'N/A'}
                  </Typography>
                  
                  <Typography variant="subtitle2" className="label">Browser:</Typography>
                  <Typography>{selectedLog.browser || 'Unknown Browser'}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Device:</Typography>
                  <Typography>{selectedLog.device || 'Unknown Device'}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Operating System:</Typography>
                  <Typography>{selectedLog.os || 'Unknown OS'}</Typography>
                </div>

                {/* Additional Details if available */}
                {selectedLog.details && (
                  <>
                    <Divider sx={{ my: 3, borderColor: '#e0e0e0' }} />
                    <Typography variant="h6" className="section-header">
                      ADDITIONAL DETAILS
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontFamily: 'monospace',
                        fontSize: '0.85em',
                        bgcolor: '#f5f5f5',
                        p: 2,
                        borderRadius: 1,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '200px',
                        overflow: 'auto',
                        mt: 2
                      }}
                    >
                      {typeof selectedLog.details === 'object' 
                        ? JSON.stringify(selectedLog.details, null, 2)
                        : selectedLog.details}
                    </Typography>
                  </>
                )}
              </>
            )}
          </Box>
        </Modal>
      </div>
    </div>
  );
}

export default AuditTrail;
