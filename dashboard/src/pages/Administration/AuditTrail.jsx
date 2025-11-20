import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '../../Styles/Administrator_Css/AuditTrail.css';
import Sidebar from './Sidebar';
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
  tableCellClasses,
  IconButton,
  Tooltip,
  Box,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

// Styled components for table
const StyledTableCell = styled(TableCell)(() => ({
  [`&.${tableCellClasses.head}`]: {
    backgroundColor: '#0A356B',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '14px',
    padding: '16px 12px',
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 13,
    color: '#333',
    padding: '12px',
  },
}));

const StyledTableRow = styled(TableRow)(() => ({
  '&:nth-of-type(odd)': {
    backgroundColor: '#f9f9f9',
  },
  '&:hover': {
    backgroundColor: 'rgba(10, 53, 107, 0.08)',
  },
  '&:last-child td, &:last-child th': {
    border: 0,
  },
}));

// Action type color mapping for chips
const ACTION_COLORS = {
  LOGIN: 'success',
  LOGOUT: 'default',
  CREATE: 'info',
  UPDATE: 'warning',
  DELETE: 'error',
  APPROVE: 'success',
  REJECT: 'error',
  VIEW: 'default',
  EXPORT: 'info',
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
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/audit-logs');
      // const data = await response.json();
      // setAuditLogs(data);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch audit logs');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Apply filters and search with useMemo for optimization
  const filteredLogs = useMemo(() => {
    let filtered = [...auditLogs];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => 
        log.username.toLowerCase().includes(query) ||
        log.email.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.route.toLowerCase().includes(query) ||
        log.ipAddress.includes(query)
      );
    }

    // Action filter
    if (filterAction !== 'all') {
      filtered = filtered.filter(log => log.action === filterAction);
    }

    // Role filter
    if (filterRole !== 'all') {
      filtered = filtered.filter(log => log.role === filterRole);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(log => 
        filterStatus === 'success' ? log.success : !log.success
      );
    }

    return filtered;
  }, [auditLogs, searchQuery, filterAction, filterRole, filterStatus]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, filterAction, filterRole, filterStatus]);

  // Export to CSV
  const handleExport = useCallback(() => {
    const headers = ['Date/Time', 'Username', 'Email', 'Role', 'Action', 'Method', 'Route', 'Status Code', 'Success', 'Resource Type', 'IP Address'];
    const csvContent = [
      headers.join(','),
      ...filteredLogs.map(log => [
        new Date(log.createdAt).toLocaleString(),
        log.username,
        log.email,
        log.role,
        log.action,
        log.method,
        `"${log.route}"`,
        log.statusCode,
        log.success,
        log.resourceType,
        log.ipAddress
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredLogs]);

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
  }, []);

  // Extract unique values for filters using useMemo
  const uniqueActions = useMemo(() => 
    [...new Set(auditLogs.map(log => log.action))].sort(),
    [auditLogs]
  );
  
  const uniqueRoles = useMemo(() => 
    [...new Set(auditLogs.map(log => log.role))].sort(),
    [auditLogs]
  );

  // Format date/time
  const formatDateTime = (dateString) => {
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

  // Get status color based on HTTP status code
  const getStatusColor = (statusCode) => {
    if (statusCode >= 200 && statusCode < 300) return 'success';
    if (statusCode >= 400 && statusCode < 500) return 'warning';
    if (statusCode >= 500) return 'error';
    return 'default';
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

        <Paper elevation={0} className="audit-paper">
          {/* Search and Filters */}
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
                <IconButton onClick={fetchAuditLogs} className="refresh-btn">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>

              <Button
                variant="outlined"
                startIcon={<FilterListIcon />}
                onClick={clearFilters}
                size="small"
                className="clear-filters-btn"
              >
                Clear
              </Button>

              <Button
                variant="contained"
                startIcon={<FileDownloadIcon />}
                onClick={handleExport}
                disabled={filteredLogs.length === 0}
                className="export-button"
              >
                Export
              </Button>
            </div>
          </div>

          {/* Audit Logs Table */}
          {loading ? (
            <div className="loading-container">
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 2, color: '#64748b' }}>
                Loading audit logs...
              </Typography>
            </div>
          ) : (
            <>
              <TableContainer className="table-container">
                <Table>
                  <TableHead>
                    <TableRow>
                      <StyledTableCell>Date/Time</StyledTableCell>
                      <StyledTableCell>User</StyledTableCell>
                      <StyledTableCell>Role</StyledTableCell>
                      <StyledTableCell>Action</StyledTableCell>
                      <StyledTableCell>Method</StyledTableCell>
                      <StyledTableCell>Route</StyledTableCell>
                      <StyledTableCell>Status</StyledTableCell>
                      <StyledTableCell>IP Address</StyledTableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <StyledTableCell colSpan={8} align="center">
                          <Box sx={{ py: 4 }}>
                            <Typography variant="body2" color="text.secondary" className="no-data">
                              {searchQuery || filterAction !== 'all' || filterRole !== 'all' || filterStatus !== 'all'
                                ? 'No audit logs match your filters'
                                : 'No audit logs available'}
                            </Typography>
                          </Box>
                        </StyledTableCell>
                      </TableRow>
                    ) : (
                      filteredLogs
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((log) => (
                          <StyledTableRow key={log._id}>
                            <StyledTableCell>
                              <Typography variant="body2" className="timestamp-text">
                                {formatDateTime(log.createdAt)}
                              </Typography>
                            </StyledTableCell>
                            <StyledTableCell>
                              <Typography variant="body2" className="user-name">
                                {log.username}
                              </Typography>
                              <Typography variant="caption" className="email-text">
                                {log.email}
                              </Typography>
                            </StyledTableCell>
                            <StyledTableCell>
                              <Chip
                                label={formatRoleLabel(log.role)}
                                color={ROLE_COLORS[log.role] || 'default'}
                                size="small"
                                className="role-chip"
                              />
                            </StyledTableCell>
                            <StyledTableCell>
                              <Chip
                                label={log.action}
                                color={ACTION_COLORS[log.action] || 'default'}
                                size="small"
                                className="action-chip"
                              />
                            </StyledTableCell>
                            <StyledTableCell>
                              <Chip
                                label={log.method}
                                size="small"
                                variant="outlined"
                                className="method-chip"
                                sx={{
                                  borderColor: log.method === 'GET' ? '#10B981' :
                                             log.method === 'POST' ? '#3B82F6' :
                                             log.method === 'PUT' ? '#F59E0B' :
                                             log.method === 'DELETE' ? '#EF4444' : '#64748b',
                                  color: log.method === 'GET' ? '#10B981' :
                                        log.method === 'POST' ? '#3B82F6' :
                                        log.method === 'PUT' ? '#F59E0B' :
                                        log.method === 'DELETE' ? '#EF4444' : '#64748b',
                                  fontWeight: 600,
                                }}
                              />
                            </StyledTableCell>
                            <StyledTableCell>
                              <Typography variant="body2" className="route-text">
                                {log.route}
                              </Typography>
                              <Typography variant="caption" className="resource-text">
                                {log.resourceType}
                              </Typography>
                            </StyledTableCell>
                            <StyledTableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {log.success ? (
                                  <CheckCircleIcon sx={{ fontSize: 16, color: '#10B981' }} />
                                ) : (
                                  <ErrorIcon sx={{ fontSize: 16, color: '#EF4444' }} />
                                )}
                                <Chip
                                  label={log.statusCode}
                                  color={getStatusColor(log.statusCode)}
                                  size="small"
                                  className="status-chip"
                                />
                              </Box>
                            </StyledTableCell>
                            <StyledTableCell>
                              <Typography variant="body2" className="ip-text">
                                {log.ipAddress}
                              </Typography>
                            </StyledTableCell>
                          </StyledTableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={filteredLogs.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25, 50]}
                className="table-pagination"
              />
            </>
          )}
        </Paper>
      </div>
    </div>
  )
}

export default AuditTrail
