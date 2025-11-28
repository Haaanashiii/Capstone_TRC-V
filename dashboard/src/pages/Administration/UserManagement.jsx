import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../../Styles/Administrator_Css/UserManagement.css';
import '../../Styles/Administrator_Css/SharedTable.css';
import Sidebar from './Sidebar';
import AccountVerificationModal from '../Services/AccountVerificationModal';
import { authAPI, adminAPI } from '../Services/api';
import websocketService from '../../services/websocket';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Chip
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LockIcon from "@mui/icons-material/Lock";
import SecurityIcon from "@mui/icons-material/Security";

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

function UserManagement() {
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

  /**
   * Fetch admin accounts from backend
   * Uses secure adminAPI.getAll() with automatic token refresh
   */
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      // Include inactive admins to see all users in database
      const response = await adminAPI.getAll({ includeInactive: true });
      
      console.log('[UserManagement] Fetched admins:', response.data?.length || 0);
      
      // Filter to show only Sangguniang Bayan and BPLO admins (include all, even inactive)
      const adminUsers = Array.isArray(response.data) 
        ? response.data.filter(user => user.role === 'sb-admin' || user.role === 'bplo-admin' || user.role === 'super-admin')
        : [];
      setUsers(adminUsers);
      setError('');
    } catch (err) {
      console.error('[UserManagement] Error fetching admins:', err);
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
      console.log('[UserManagement] Connecting to WebSocket');
      websocketService.connect('super-admin-room');
    } else {
      websocketService.joinRoom('super-admin-room');
    }

    // Subscribe to admin account updates and permission changes
    const handleUserUpdates = () => {
      console.log('[UserManagement] WebSocket update - admin-accounts');
      fetchUsers();
    };

    websocketService.on('admin-accounts', handleUserUpdates);
    websocketService.on('admin-updated', handleUserUpdates);

    return () => {
      websocketService.off('admin-accounts', handleUserUpdates);
      websocketService.off('admin-updated', handleUserUpdates);
    };
  }, [fetchUsers]);

  // Memoized filtered users
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    
    const query = searchQuery.toLowerCase();
    return users.filter(user => 
      user.name?.toLowerCase().includes(query) ||
      user.username?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  }, [searchQuery, users]);

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
    
    // Debug log to check admin structure
    if (user) {
      console.log('[UserManagement] Opening modal for admin:', {
        adminId: user.adminId,
        _id: user._id,
        id: user.id,
        fullUser: user
      });
    }
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
      console.log('[UserManagement] OTP sent to:', email);
      return true;
    } catch (err) {
      console.error('[UserManagement] OTP request error:', err);
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
        
        console.log('[UserManagement] Updating admin with ID:', adminId);
        
        if (!adminId) {
          throw new Error('Admin ID not found');
        }
        
        const response = await adminAPI.update(adminId, updateData);
        
        console.log('[UserManagement] Admin updated:', response.data);
        
        setSuccess('Admin account updated successfully');
        await fetchUsers();
        setTimeout(() => {
          handleCloseModal();
        }, 1500);
      } catch (err) {
        console.error('[UserManagement] Error updating admin:', err);
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
        console.error('Error requesting OTP:', err);
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
      
      console.log('[UserManagement] Admin created:', response.data);
      
      setSuccess('Admin account created and verified successfully!');
      setPendingUserData(null);
      await fetchUsers();
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error('[UserManagement] Error creating admin:', err);
      setError(err.response?.data?.error || 'Failed to create admin account');
    } finally {
      setLoading(false);
    }
  }, [pendingUserData, fetchUsers]);

  /**
   * Handle delete admin account
   * Uses secure adminAPI.delete()
   */
  const handleDeleteUser = useCallback(async (user) => {
    if (!window.confirm("Are you sure you want to delete this admin account?")) return;
    
    try {
      setLoading(true);
      setError('');
      
      // Get the correct admin ID (try adminId first, then _id, then id)
      const adminId = user.adminId || user._id || user.id;
      
      console.log('[UserManagement] Deleting admin with ID:', adminId);
      
      if (!adminId) {
        throw new Error('Admin ID not found');
      }
      
      await adminAPI.delete(adminId);
      
      console.log('[UserManagement] Admin deleted:', adminId);
      
      setSuccess('Admin account deleted successfully');
      await fetchUsers();
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error('[UserManagement] Error deleting admin:', err);
      setError(err.response?.data?.error || 'Failed to delete admin account');
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

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
          <div className="page-title">
            User Management
          </div>
        </div>

          {/* Success/Error Messages */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}
          
          <div className="user-management-toolbar">
            <TextField
              placeholder="Search users..."
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
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

          {loading && !openModal && (
            <Box className="admin-table-loading">
              <CircularProgress />
            </Box>
          )}

          <Paper className="admin-table-container" elevation={2}>
            <TableContainer className="admin-table-wrapper">
              <Table className="admin-table" stickyHeader aria-label="user management table">
                <TableHead>
                <TableRow>
                  <TableCell className="admin-table-header-cell col-name">Name</TableCell>
                  <TableCell className="admin-table-header-cell col-name">Username</TableCell>
                  <TableCell className="admin-table-header-cell col-email">Email</TableCell>
                  <TableCell className="admin-table-header-cell col-status">Role</TableCell>
                  <TableCell className="admin-table-header-cell col-actions" align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedUsers.length > 0 ? (
                  paginatedUsers.map((user) => (
                    <TableRow key={user.adminId || user._id} className="admin-table-row" hover>
                      <TableCell className="admin-table-cell col-name">{user.name}</TableCell>
                      <TableCell className="admin-table-cell col-name">{user.username}</TableCell>
                      <TableCell className="admin-table-cell col-email">{user.email}</TableCell>
                      <TableCell className="admin-table-cell col-status">{getRoleLabel(user.role)}</TableCell>
                      <TableCell className="admin-table-cell col-actions" align="center">
                        {/* <IconButton 
                          className="action-icon-button"
                          size="small"
                          onClick={() => {
                            setSelectedUserForPermissions(user);
                            setPermissionsModalOpen(true);
                          }}
                          title="Manage Permissions"
                          disabled={true}
                        >
                          <SecurityIcon fontSize="small" />
                        </IconButton> */}
                        <IconButton 
                          className="action-icon-button edit"
                          size="small"
                          onClick={() => handleOpenModal(user)}
                          disabled={loading}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          className="action-icon-button delete"
                          size="small"
                          onClick={() => handleDeleteUser(user)}
                          disabled={loading}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="admin-table-empty">
                      <Typography className="admin-table-empty-text">
                        {loading ? 'Loading...' : 'No users found'}
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
      </div>
    </div>
  );
}

export default UserManagement;
