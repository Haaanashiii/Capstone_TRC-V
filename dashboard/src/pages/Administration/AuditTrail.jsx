import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../Styles/Administrator_Css/AuditTrail.css';
import '../../Styles/Administrator_Css/SharedTable.css';
import Sidebar from './Sidebar';
import websocketService from '../../services/websocket';
import { useIsMounted } from '../../hooks/useIsMounted';
import { useDebounce } from '../../hooks/useDebounce';
import PageLoader from '../../components/PageLoader';
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
  Alert,
  IconButton,
  Tooltip,
  Box,
  Modal,
  Divider,
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
import { auditLogsAPI } from '../Services/api';
import { exportAuditLogsCSV } from '../../utils/csvExport';

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

// Map MUI color to CSS class for consistent styling
const getActionStatusClass = (action) => {
  const color = ACTION_COLORS[action] || 'default';
  switch (color) {
    case 'success': return 'status-active';
    case 'error': return 'status-rejected';
    case 'warning': return 'status-pending';
    case 'info': return 'status-investigating';
    default: return 'status-dismissed';
  }
};

// Map role to CSS class for consistent tonal pill styling
const getRoleStatusClass = (role) => {
  switch (role) {
    case 'super-admin': return 'status-role-super-admin';
    case 'sb-admin': return 'status-role-sb-admin';
    case 'bplo-admin': return 'status-role-bplo-admin';
    case 'operator': return 'status-role-operator';
    default: return 'status-dismissed';
  }
};

// Map HTTP status to CSS class for consistent styling
const getHttpStatusClass = (statusCode) => {
  if (statusCode >= 200 && statusCode < 300) return 'status-active';
  if (statusCode >= 400 && statusCode < 500) return 'status-pending';
  if (statusCode >= 500) return 'status-rejected';
  return 'status-dismissed';
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
  const isMountedRef = useIsMounted();
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [filterAction, setFilterAction] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  // Fetch audit logs from API using centralized auditLogsAPI
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      // Build query parameters
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        sort: 'createdAt',
        order: 'desc',
      };

      // Add filters if they are set
      if (filterAction !== 'all') {
        params.action = filterAction;
      }
      if (filterRole !== 'all') {
        params.role = filterRole;
      }
      if (filterStatus !== 'all') {
        params.success = filterStatus === 'success';
      }

      const response = await auditLogsAPI.getAll(params);
      
      if (response.data?.success && Array.isArray(response.data.data)) {
        setAuditLogs(response.data.data);
        setTotalCount(response.data.pagination?.total || response.data.data.length);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      logger.error('[AuditTrail] Error fetching logs:', err?.message || 'Unknown error');
      
      if (err.response?.status === 401) {
        setError('Session expired. Please log in again.');
        setTimeout(() => navigate('/login'), 2000);
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view audit logs.');
      } else {
        setError('Failed to fetch audit logs. Please try again.');
      }
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filterAction, filterRole, filterStatus, navigate]);

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

  // Export to CSV using secure sanitized export
  const handleExport = useCallback(async () => {
    try {
      // Build export parameters
      const params = {
        limit: 10000,
        sort: 'createdAt',
        order: 'desc',
      };

      if (filterAction !== 'all') params.action = filterAction;
      if (filterRole !== 'all') params.role = filterRole;
      if (filterStatus !== 'all') params.success = filterStatus === 'success';

      const response = await auditLogsAPI.getAll(params);
      
      if (response.data?.success && Array.isArray(response.data.data)) {
        // Use secure CSV export utility with sanitization
        exportAuditLogsCSV(response.data.data, 'audit_trail');
      } else {
        throw new Error('Failed to fetch logs for export');
      }
    } catch (err) {
      logger.error('[AuditTrail] Export error:', err?.message || 'Unknown error');
      setError('Failed to export audit logs. Please try again.');
    }
  }, [filterAction, filterRole, filterStatus]);

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

        <Fade in={!loading} timeout={400}>
        <Paper elevation={2} className="admin-table-container">
          {/* Audit Logs Table */}
          {loading ? (
            <PageLoader 
              loading={loading} 
              message="Loading audit logs..." 
              minHeight={400}
            />
          ) : (
            <>
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
                            <Tooltip title={`${log.name || log.username || 'Unknown'} - ${log.email || 'N/A'}`} arrow placement="top" enterDelay={500}>
                              <Box>
                                <Typography variant="body2" className="user-name truncate-text">
                                  {log.name || log.username || 'Unknown'}
                                </Typography>
                                <Typography variant="caption" className="email-text truncate-text">
                                  {log.email || 'N/A'}
                                </Typography>
                              </Box>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="admin-table-cell col-status">
                            <Tooltip title={formatRoleLabel(log.role)} arrow placement="top" enterDelay={300}>
                              <span className={`status-badge ${getRoleStatusClass(log.role)}`}>
                                {formatRoleLabel(log.role)}
                              </span>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="admin-table-cell col-name">
                            <Tooltip title={log.description || log.action || 'N/A'} arrow placement="top" enterDelay={500}>
                              <Typography variant="body2" className="description-text truncate-text" sx={{ fontWeight: 500 }}>
                                {log.description || log.action || 'N/A'}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="admin-table-cell col-status">
                            <Tooltip title={log.action || 'N/A'} arrow placement="top" enterDelay={300}>
                              <span className={`status-badge ${getActionStatusClass(log.action)}`}>
                                {log.action || 'N/A'}
                              </span>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="admin-table-cell col-name">
                            <Tooltip title={`${log.browser || 'Unknown Browser'} - ${log.device || 'Unknown Device'}`} arrow placement="top" enterDelay={500}>
                              <Box>
                                <Typography variant="body2" className="browser-text truncate-text">
                                  {log.browser || 'Unknown Browser'}
                                </Typography>
                                <Typography variant="caption" className="device-text truncate-text">
                                  {log.device || 'Unknown Device'}
                                </Typography>
                              </Box>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="admin-table-cell col-status">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              {log.success ? (
                                <CheckCircleIcon sx={{ fontSize: 16, color: '#10B981' }} />
                              ) : (
                                <ErrorIcon sx={{ fontSize: 16, color: '#EF4444' }} />
                              )}
                              <span className={`status-badge ${getHttpStatusClass(log.statusCode)}`}>
                                {log.statusCode || 'N/A'}
                              </span>
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

              <div className="admin-table-pagination">
                <TablePagination
                  component="div"
                  count={totalCount}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[10, 15, 25, 50]}
                />
              </div>
            </>
          )}
        </Paper>
        </Fade>

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
                    <span className={`status-badge ${getRoleStatusClass(selectedLog.role)}`}>
                      {formatRoleLabel(selectedLog.role)}
                    </span>
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
                    <span className={`status-badge ${getActionStatusClass(selectedLog.action)}`}>
                      {selectedLog.action || 'N/A'}
                    </span>
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
                    <span className={`status-badge ${getHttpStatusClass(selectedLog.statusCode)}`}>
                      {selectedLog.statusCode || 'N/A'}
                    </span>
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
