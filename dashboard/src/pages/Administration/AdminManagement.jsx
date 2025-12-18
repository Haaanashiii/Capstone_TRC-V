import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../../Styles/Administrator_Css/AdminManagement.css';
import '../../Styles/Administrator_Css/SharedTable.css';
import Sidebar from './Sidebar';
import AccountVerificationModal from '../Services/AccountVerificationModal';
import { authAPI, adminAPI } from '../Services/api';
import websocketService from '../../services/websocket';
import PageLoader, { TableLoader } from '../../components/PageLoader';
import AnimatedPage, { AnimatedSection } from '../../components/AnimatedPage';
import {
  Box, 
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
  Modal,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Switch,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Divider,
  Fade,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from "@mui/icons-material/Edit";
import FilterListIcon from "@mui/icons-material/FilterList";
import ClearIcon from "@mui/icons-material/Clear";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import SortIcon from "@mui/icons-material/Sort";
import ConfirmDialog from '../../components/ConfirmDialog';
import { logger } from '../../utils/logger';

const INITIAL_USER_STATE = {
  name: '',
  username: '',
  email: '',
  password: '',
  role: ''
};

const ROLES = [
  { value: 'sb-admin', label: 'Sangguniang Bayan' },
  { value: 'bplo-admin', label: 'BPLO' },
  { value: 'super-admin', label: 'Super Admin' }
];

// Filter options for status
const STATUS_FILTERS = {
  ALL: 'all',
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

// Sort options
const SORT_OPTIONS = {
  NAME_ASC: 'name_asc',
  NAME_DESC: 'name_desc',
  ROLE: 'role',
  STATUS: 'status',
  NEWEST: 'newest',
  OLDEST: 'oldest'
};

function AdminManagement() {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [page, setPage] = useState(0);
  const [newUser, setNewUser] = useState(INITIAL_USER_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [pendingUserData, setPendingUserData] = useState(null);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // New filter states - default to showing only active users
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.ACTIVE);
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy] = useState(SORT_OPTIONS.NAME_ASC);
  const [showFilters, setShowFilters] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState(null);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    severity: 'warning',
    user: null
  });

  /**
   * Fetch admin accounts from backend
   * Uses secure adminAPI.getAll() with automatic token refresh
   */
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      // Include inactive admins to see all users in database
      const response = await adminAPI.getAll({ includeInactive: true });
      
      // Filter to show only Sangguniang Bayan and BPLO admins (include all, even inactive)
      const adminUsers = Array.isArray(response.data) 
        ? response.data.filter(user => user.role === 'sb-admin' || user.role === 'bplo-admin' || user.role === 'super-admin')
        : [];
      setUsers(adminUsers);
      setError('');
    } catch (err) {
      logger.error('[AdminManagement] Error fetching admins:', err);
      setError(err.response?.data?.error || 'Failed to load admin accounts. Please try again.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load users on component mount and setup WebSocket
  useEffect(() => {
    fetchUsers();

    // Connect to WebSocket for real-time updates
    if (!websocketService.isConnected()) {
      websocketService.connect('super-admin-room');
    } else {
      websocketService.joinRoom('super-admin-room');
    }

    // Subscribe to admin account updates and permission changes
    const handleUserUpdates = () => {
      fetchUsers();
    };

    websocketService.on('admin-accounts', handleUserUpdates);
    websocketService.on('admin-updated', handleUserUpdates);
    websocketService.on('admin-status-changed', handleUserUpdates);

    return () => {
      websocketService.off('admin-accounts', handleUserUpdates);
      websocketService.off('admin-updated', handleUserUpdates);
      websocketService.off('admin-status-changed', handleUserUpdates);
    };
  }, [fetchUsers]);

  // Memoized filtered and sorted users
  const filteredUsers = useMemo(() => {
    let result = [...users];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(user => 
        user.name?.toLowerCase().includes(query) ||
        user.username?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (statusFilter !== STATUS_FILTERS.ALL) {
      const isActive = statusFilter === STATUS_FILTERS.ACTIVE;
      result = result.filter(user => user.isActive === isActive);
    }
    
    // Apply role filter
    if (roleFilter !== 'all') {
      result = result.filter(user => user.role === roleFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case SORT_OPTIONS.NAME_ASC:
          return (a.name || '').localeCompare(b.name || '');
        case SORT_OPTIONS.NAME_DESC:
          return (b.name || '').localeCompare(a.name || '');
        case SORT_OPTIONS.ROLE:
          return (a.role || '').localeCompare(b.role || '');
        case SORT_OPTIONS.STATUS:
          // Active first, then inactive
          return (b.isActive === a.isActive) ? 0 : b.isActive ? 1 : -1;
        case SORT_OPTIONS.NEWEST:
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case SORT_OPTIONS.OLDEST:
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        default:
          return 0;
      }
    });
    
    return result;
  }, [searchQuery, users, statusFilter, roleFilter, sortBy]);

  // Reset page when search changes
  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  // Memoized paginated users
  const paginatedUsers = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredUsers.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredUsers, page, rowsPerPage]);

  // Handle modal open
  const handleOpenModal = useCallback((user = null) => {
    setIsEditing(!!user);
    setSelectedUser(user);
    setNewUser(user ? {
      name: user.name,
      username: user.username,
      email: user.email,
      password: '',
      role: user.role
    } : INITIAL_USER_STATE);
    setOpenModal(true);
    setError('');
    setSuccess('');
  }, []);

  const handleCloseModal = useCallback(() => {
    setOpenModal(false);
    setSelectedUser(null);
    setNewUser(INITIAL_USER_STATE);
    setError('');
    setSuccess('');
  }, []);

  /**
   * Request OTP for email verification
   * Uses secure authAPI.requestOTP()
   */
  const requestOTP = async (email) => {
    try {
      await authAPI.requestOTP(email);
      return true;
    } catch (err) {
      logger.error('[AdminManagement] OTP request error:', err);
      throw new Error(err.response?.data?.error || 'Failed to send verification code');
    }
  };

  /**
   * Handle add/update user
   */
  const handleAddUser = useCallback(async () => {
    // Validation
    if (!newUser.name || !newUser.username || !newUser.email || !newUser.role) {
      setError('Please fill in all required fields');
      return;
    }

    if (!isEditing && !newUser.password) {
      setError('Password is required for new users');
      return;
    }

    if (newUser.password && newUser.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (isEditing) {
      // Update existing user
      try {
        setLoading(true);
        setError('');
        
        const updateData = {
          name: newUser.name,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role
        };
        
        // Only include password if it's being changed
        if (newUser.password) {
          updateData.password = newUser.password;
        }
        
        // Get the correct admin ID (try adminId first, then _id, then id)
        const adminId = selectedUser.adminId || selectedUser._id || selectedUser.id;
        
        if (!adminId) {
          throw new Error('Admin ID not found');
        }
        
        const response = await adminAPI.update(adminId, updateData);
        
        setSuccess('Admin account updated successfully');
        await fetchUsers();
        setTimeout(() => {
          handleCloseModal();
        }, 1500);
      } catch (err) {
        logger.error('[AdminManagement] Error updating admin:', err);
        setError(err.response?.data?.error || 'Failed to update admin account');
      } finally {
        setLoading(false);
      }
    } else {
      // Add new user - require OTP verification
      try {
        setLoading(true);
        setError('');
        
        // Store user data for after verification
        setPendingUserData({
          name: newUser.name,
          username: newUser.username,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role
        });
        
        // Request OTP
        await requestOTP(newUser.email);
        
        // Open verification modal
        setShowVerificationModal(true);
        setOpenModal(false);
      } catch (err) {
        logger.error('Error requesting OTP:', err);
        setError(err.message || 'Failed to send verification code');
      } finally {
        setLoading(false);
      }
    }
  }, [isEditing, newUser, selectedUser, handleCloseModal, fetchUsers]);

  /**
   * Handle verification success - create admin account
   * Uses secure adminAPI.create()
   */
  const handleVerificationSuccess = useCallback(async () => {
    if (!pendingUserData) return;
    
    try {
      setLoading(true);
      
      const response = await adminAPI.create(pendingUserData);
      
      setSuccess('Admin account created and verified successfully!');
      setPendingUserData(null);
      await fetchUsers();
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      logger.error('[AdminManagement] Error creating admin:', err);
      setError(err.response?.data?.error || 'Failed to create admin account');
    } finally {
      setLoading(false);
    }
  }, [pendingUserData, fetchUsers]);

  /**
   * Open confirmation dialog for toggling admin status
   */
  const handleToggleStatusRequest = useCallback((user) => {
    const newStatus = !user.isActive;
    const action = newStatus ? 'activate' : 'deactivate';
    
    setConfirmDialog({
      open: true,
      title: `${newStatus ? 'Activate' : 'Deactivate'} Admin Account`,
      message: `Are you sure you want to ${action} ${user.name}'s account?${!newStatus ? ' They will no longer be able to access the system.' : ''}`,
      severity: newStatus ? 'info' : 'warning',
      user: user
    });
  }, []);

  /**
   * Handle confirmed toggle admin account status (active/inactive)
   * Uses secure adminAPI.toggleStatus()
   */
  const handleToggleStatusConfirmed = useCallback(async () => {
    const user = confirmDialog.user;
    if (!user) return;
    
    const adminId = user.adminId || user._id || user.id;
    const newStatus = !user.isActive;
    const action = newStatus ? 'activate' : 'deactivate';
    
    setConfirmDialog(prev => ({ ...prev, open: false }));
    
    try {
      setTogglingUserId(adminId);
      setError('');
      
      if (!adminId) {
        throw new Error('Admin ID not found');
      }
      
      const response = await adminAPI.toggleStatus(adminId);
      
      setSuccess(`Admin account ${newStatus ? 'activated' : 'deactivated'} successfully`);
      await fetchUsers();
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      logger.error('[AdminManagement] Error toggling admin status:', err);
      setError(err.response?.data?.error || `Failed to ${action} admin account`);
    } finally {
      setTogglingUserId(null);
    }
  }, [confirmDialog.user, fetchUsers]);

  /**
   * Clear all filters (reset to defaults)
   */
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter(STATUS_FILTERS.ACTIVE);
    setRoleFilter('all');
    setSortBy(SORT_OPTIONS.NAME_ASC);
  }, []);

  /**
   * Check if any filters are active (excluding default ACTIVE status)
   */
  const hasActiveFilters = useMemo(() => {
    return searchQuery.trim() !== '' || 
           statusFilter !== STATUS_FILTERS.ACTIVE || 
           roleFilter !== 'all' ||
           sortBy !== SORT_OPTIONS.NAME_ASC;
  }, [searchQuery, statusFilter, roleFilter, sortBy]);

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  // Get role label
  const getRoleLabel = useCallback((roleValue) => {
    const role = ROLES.find(r => r.value === roleValue);
    return role ? role.label : roleValue;
  }, []);

  // Handle form field changes
  const handleFieldChange = useCallback((field, value) => {
    setNewUser(prev => ({ ...prev, [field]: value }));
  }, []);

  return (
    <div className="user-management-container">
      <Sidebar />
      <div className="content-area">
        <div className="header-container">
          <Typography variant="h4" className="page-title">
            Admin Management
          </Typography>
        </div>

          {/* Success/Error Messages */}
          {error && (
            <Alert severity="error" className="alert-message" onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" className="alert-message" onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}
          
          <div className="user-management-toolbar">
            <Box className="toolbar-filter-box">
              <TextField
                placeholder="Search users..."
                variant="outlined"
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-field-admin"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery('')}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              
              <Button
                variant={showFilters ? "contained" : "outlined"}
                startIcon={<FilterListIcon />}
                onClick={() => setShowFilters(!showFilters)}
                size="small"
                className={showFilters ? 'filter-btn-active' : 'filter-btn'}
              >
                Filters {hasActiveFilters && `(${[statusFilter !== STATUS_FILTERS.ACTIVE, roleFilter !== 'all', sortBy !== SORT_OPTIONS.NAME_ASC].filter(Boolean).length})`}
              </Button>
              
              {hasActiveFilters && (
                <Button
                  variant="text"
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                  size="small"
                  color="error"
                >
                  Clear All
                </Button>
              )}
            </Box>
            
            <Button 
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => handleOpenModal()}
              disabled={loading}
              className="add-user-btn"
            >
              Add User
            </Button>
          </div>
          
          {/* Filter Panel */}
          {showFilters && (
            <Paper className="admin-filter-panel" elevation={1}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start" flexWrap="wrap">
                {/* Status Filter */}
                <Box>
                  <Typography variant="caption" color="textSecondary" className="filter-label">
                    Status
                  </Typography>
                  <ToggleButtonGroup
                    value={statusFilter}
                    exclusive
                    onChange={(e, value) => value && setStatusFilter(value)}
                    size="small"
                  >
                    <ToggleButton value={STATUS_FILTERS.ALL}>
                      All
                    </ToggleButton>
                    <ToggleButton value={STATUS_FILTERS.ACTIVE} className={statusFilter === STATUS_FILTERS.ACTIVE ? 'toggle-active' : ''}>
                      <CheckCircleIcon fontSize="small" className="toggle-icon" />
                      Active
                    </ToggleButton>
                    <ToggleButton value={STATUS_FILTERS.INACTIVE} className={statusFilter === STATUS_FILTERS.INACTIVE ? 'toggle-inactive' : ''}>
                      <CancelIcon fontSize="small" className="toggle-icon" />
                      Inactive
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                
                <Divider orientation="vertical" flexItem className="filter-divider" />
                
                {/* Role Filter */}
                <Box>
                  <Typography variant="caption" color="textSecondary" className="filter-label">
                    Role
                  </Typography>
                  <FormControl size="small" className="filter-select">
                    <Select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      displayEmpty
                    >
                      <MenuItem value="all">All Roles</MenuItem>
                      {ROLES.map(role => (
                        <MenuItem key={role.value} value={role.value}>
                          {role.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                
                <Divider orientation="vertical" flexItem className="filter-divider" />
                
                {/* Sort By */}
                <Box>
                  <Typography variant="caption" color="textSecondary" className="filter-label">
                    Sort By
                  </Typography>
                  <FormControl size="small" className="sort-select">
                    <Select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      startAdornment={<SortIcon fontSize="small" className="sort-icon" />}
                    >
                      <MenuItem value={SORT_OPTIONS.NAME_ASC}>Name (A-Z)</MenuItem>
                      <MenuItem value={SORT_OPTIONS.NAME_DESC}>Name (Z-A)</MenuItem>
                      <MenuItem value={SORT_OPTIONS.ROLE}>Role</MenuItem>
                      <MenuItem value={SORT_OPTIONS.STATUS}>Status</MenuItem>
                      <MenuItem value={SORT_OPTIONS.NEWEST}>Newest First</MenuItem>
                      <MenuItem value={SORT_OPTIONS.OLDEST}>Oldest First</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Stack>
              
              {/* Active Filter Chips */}
              {hasActiveFilters && (
                <Box className="active-filters-box">
                  {statusFilter !== STATUS_FILTERS.ACTIVE && (
                    <Chip
                      label={`Status: ${statusFilter === STATUS_FILTERS.ALL ? 'All' : 'Inactive'}`}
                      onDelete={() => setStatusFilter(STATUS_FILTERS.ACTIVE)}
                      size="small"
                      color={statusFilter === STATUS_FILTERS.INACTIVE ? 'error' : 'default'}
                      variant="outlined"
                    />
                  )}
                  {roleFilter !== 'all' && (
                    <Chip
                      label={`Role: ${getRoleLabel(roleFilter)}`}
                      onDelete={() => setRoleFilter('all')}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  {sortBy !== SORT_OPTIONS.NAME_ASC && (
                    <Chip
                      label={`Sort: ${
                        sortBy === SORT_OPTIONS.NAME_DESC ? 'Name (Z-A)' :
                        sortBy === SORT_OPTIONS.ROLE ? 'Role' :
                        sortBy === SORT_OPTIONS.STATUS ? 'Status' :
                        sortBy === SORT_OPTIONS.NEWEST ? 'Newest' : 'Oldest'
                      }`}
                      onDelete={() => setSortBy(SORT_OPTIONS.NAME_ASC)}
                      size="small"
                      color="default"
                      variant="outlined"
                    />
                  )}
                </Box>
              )}
            </Paper>
          )}
          
          {/* Results Count */}
          <Box className="results-count">
            <Typography variant="body2" color="textSecondary">
              Showing {filteredUsers.length} of {users.length} admin{users.length !== 1 ? 's' : ''}
              {hasActiveFilters && ' (filtered)'}
            </Typography>
          </Box>

          {loading && !openModal ? (
            <PageLoader 
              loading={loading} 
              message="Loading admin accounts..." 
              minHeight={400}
            />
          ) : (
            <Fade in={!loading} timeout={400}>
              <Box>
          <Paper className="admin-table-container" elevation={2}>
            <TableContainer className="admin-table-wrapper">
              <Table className="admin-table" stickyHeader aria-label="user management table">
                <TableHead>
                <TableRow>
                  <TableCell className="admin-table-header-cell col-name">Name</TableCell>
                  <TableCell className="admin-table-header-cell col-name">Username</TableCell>
                  <TableCell className="admin-table-header-cell col-email">Email</TableCell>
                  <TableCell className="admin-table-header-cell col-status">Role</TableCell>
                  <TableCell className="admin-table-header-cell col-status" align="center">Status</TableCell>
                  <TableCell className="admin-table-header-cell col-actions" align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedUsers.length > 0 ? (
                  paginatedUsers.map((user) => {
                    const adminId = user.adminId || user._id || user.id;
                    const isToggling = togglingUserId === adminId;
                    
                    return (
                      <TableRow 
                        key={adminId} 
                        className={`admin-table-row ${!user.isActive ? 'inactive-row' : ''}`} 
                        hover
                        sx={{ 
                          opacity: user.isActive ? 1 : 0.7,
                          backgroundColor: user.isActive ? 'inherit' : 'rgba(0, 0, 0, 0.04)'
                        }}
                      >
                        <TableCell className="admin-table-cell col-name">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {user.name}
                            {!user.isActive && (
                              <span className="status-badge status-expired">
                                Inactive
                              </span>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell className="admin-table-cell col-name">{user.username}</TableCell>
                        <TableCell className="admin-table-cell col-email">{user.email}</TableCell>
                        <TableCell className="admin-table-cell col-status">
                          <span className={`status-badge ${
                            user.role === 'super-admin' ? 'status-rejected' :
                            user.role === 'sb-admin' ? 'status-investigating' : 'status-pending'
                          }`}>
                            {getRoleLabel(user.role)}
                          </span>
                        </TableCell>
                        <TableCell className="admin-table-cell col-status" align="center">
                          <Tooltip 
                            title={user.isActive ? 'Click to deactivate' : 'Click to activate'}
                            arrow
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {isToggling ? (
                                <CircularProgress size={20} />
                              ) : (
                                <Switch
                                  checked={user.isActive !== false}
                                  onChange={() => handleToggleStatusRequest(user)}
                                  disabled={loading || isToggling}
                                  color="success"
                                  size="small"
                                  inputProps={{ 
                                    'aria-label': `Toggle ${user.name}'s account status` 
                                  }}
                                />
                              )}
                            </Box>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="admin-table-cell col-actions" align="center">
                          <Tooltip title="Edit user" arrow>
                            <IconButton 
                              className="action-icon-button edit"
                              size="small"
                              onClick={() => handleOpenModal(user)}
                              disabled={loading}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="admin-table-empty">
                      <Typography className="admin-table-empty-text">
                        {loading ? 'Loading...' : hasActiveFilters ? 'No users match the current filters' : 'No users found'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              </Table>
            </TableContainer>
            
            <TablePagination
              component="div"
              count={filteredUsers.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 15, 25, 50]}
              className="admin-table-pagination"
            />
          </Paper>
              </Box>
            </Fade>
          )}

        {/* Add/Edit User Modal */}
        <Modal open={openModal} onClose={handleCloseModal}>
          <Box className="user-modal-box">
            <Typography variant="h6" component="h2" className="user-modal-title">
              {isEditing ? "Edit User" : "Add New User"}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            <TextField
              fullWidth
              label="Name"
              name="name"
              margin="normal"
              value={newUser.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              required
              disabled={loading}
            />
            <TextField
              fullWidth
              label="Username"
              name="username"
              margin="normal"
              value={newUser.username}
              onChange={(e) => handleFieldChange('username', e.target.value)}
              required
              disabled={loading}
            />
            <TextField
              fullWidth
              label="Email"
              name="email"
              margin="normal"
              type="email"
              value={newUser.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              required
              disabled={loading}
            />
            <TextField
              fullWidth
              label="Password"
              name="password"
              margin="normal"
              type="password"
              value={newUser.password}
              onChange={(e) => handleFieldChange('password', e.target.value)}
              required={!isEditing}
              helperText={isEditing ? "Leave blank to keep current password" : "Minimum 8 characters"}
              disabled={loading}
            />
            <FormControl fullWidth margin="normal" required>
              <InputLabel>Role</InputLabel>
              <Select
                name="role"
                value={newUser.role}
                onChange={(e) => handleFieldChange('role', e.target.value)}
                input={<OutlinedInput label="Role" />}
                disabled={loading}
              >
                {ROLES.map(role => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Box className="user-modal-actions">
              <Button onClick={handleCloseModal} disabled={loading}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddUser} 
                variant="contained" 
                disabled={loading}
                className="user-modal-submit-btn"
              >
                {loading ? <CircularProgress size={24} /> : (isEditing ? "Save Changes" : "Add User")}
              </Button>
            </Box>
          </Box>
        </Modal>

        {/* OTP Verification Modal */}
        <AccountVerificationModal
          open={showVerificationModal}
          onClose={() => {
            setShowVerificationModal(false);
            setPendingUserData(null);
          }}
          email={pendingUserData?.email || ''}
          onVerificationSuccess={handleVerificationSuccess}
          buttonText="Add User"
        />

        {/* Confirmation Dialog for Status Toggle */}
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          severity={confirmDialog.severity}
          onConfirm={handleToggleStatusConfirmed}
          onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
          confirmText="Confirm"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}

export default AdminManagement;
