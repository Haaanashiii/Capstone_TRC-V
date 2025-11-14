import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../../Styles/Administrator_Css/UserManagement.css';
import Sidebar from './Sidebar';
import AccountVerificationModal from '../Services/AccountVerificationModal';
import { authAPI, userAPI } from '../Services/api';
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
  tableCellClasses,
  IconButton,
  CircularProgress,
  Alert
} from '@mui/material';

import { styled } from "@mui/material/styles";
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

// Styled components for table
const StyledTableCell = styled(TableCell)(() => ({
  [`&.${tableCellClasses.head}`]: {
    backgroundColor: '#0A356B',
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
    textAlign: 'center',
    color: '#333',
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

const INITIAL_USER_STATE = {
  name: '',
  username: '',
  email: '',
  password: '',
  role: ''
};

const ROLES = [
  { value: 'sb-admin', label: 'Sangguniang Bayan' },
  { value: 'bplo-admin', label: 'BPLO' }
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
  
  const rowsPerPage = 5;

  /**
   * Fetch users from backend (only admin users)
   * Uses secure userAPI.getAll() with automatic token refresh
   */
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await userAPI.getAll();
      
      console.log('[UserManagement] Fetched users:', response.data?.length || 0);
      
      // Filter to show only Sangguniang Bayan and BPLO admins
      const adminUsers = Array.isArray(response.data) 
        ? response.data.filter(user => user.role === 'sb-admin' || user.role === 'bplo-admin')
        : [];
      setUsers(adminUsers);
      setError('');
    } catch (err) {
      console.error('[UserManagement] Error fetching users:', err);
      setError(err.response?.data?.error || 'Failed to load users. Please try again.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load users on component mount
  useEffect(() => {
    fetchUsers();
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
    
    // Debug log to check user structure
    if (user) {
      console.log('[UserManagement] Opening modal for user:', {
        userId: user.userId,
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
        
        // Get the correct user ID (try userId first, then _id, then id)
        const userId = selectedUser.userId || selectedUser._id || selectedUser.id;
        
        console.log('[UserManagement] Updating user with ID:', userId);
        
        if (!userId) {
          throw new Error('User ID not found');
        }
        
        const response = await userAPI.update(userId, updateData);
        
        console.log('[UserManagement] User updated:', response.data);
        
        setSuccess('User updated successfully');
        await fetchUsers();
        setTimeout(() => {
          handleCloseModal();
        }, 1500);
      } catch (err) {
        console.error('[UserManagement] Error updating user:', err);
        setError(err.response?.data?.error || 'Failed to update user');
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
   * Handle verification success - create user
   * Uses secure userAPI.create()
   */
  const handleVerificationSuccess = useCallback(async () => {
    if (!pendingUserData) return;
    
    try {
      setLoading(true);
      
      const response = await userAPI.create(pendingUserData);
      
      console.log('[UserManagement] User created:', response.data);
      
      setSuccess('User created and verified successfully!');
      setPendingUserData(null);
      await fetchUsers();
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error('[UserManagement] Error creating user:', err);
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }, [pendingUserData, fetchUsers]);

  /**
   * Handle delete user
   * Uses secure userAPI.delete()
   */
  const handleDeleteUser = useCallback(async (user) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    
    try {
      setLoading(true);
      setError('');
      
      // Get the correct user ID (try userId first, then _id, then id)
      const userId = user.userId || user._id || user.id;
      
      console.log('[UserManagement] Deleting user with ID:', userId);
      
      if (!userId) {
        throw new Error('User ID not found');
      }
      
      await userAPI.delete(userId);
      
      console.log('[UserManagement] User deleted:', userId);
      
      setSuccess('User deleted successfully');
      await fetchUsers();
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error('[UserManagement] Error deleting user:', err);
      setError(err.response?.data?.error || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
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
            <Box display="flex" justifyContent="center" my={4}>
              <CircularProgress />
            </Box>
          )}

          <TableContainer component={Paper} className="table-container" elevation={2}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <StyledTableCell>Name</StyledTableCell>
                  <StyledTableCell>Username</StyledTableCell>
                  <StyledTableCell>Email</StyledTableCell>
                  <StyledTableCell>Role</StyledTableCell>
                  <StyledTableCell align="center">Actions</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedUsers.length > 0 ? (
                  paginatedUsers.map((user) => (
                    <StyledTableRow key={user.userId || user._id}>
                      <StyledTableCell>{user.name}</StyledTableCell>
                      <StyledTableCell>{user.username}</StyledTableCell>
                      <StyledTableCell>{user.email}</StyledTableCell>
                      <StyledTableCell>{getRoleLabel(user.role)}</StyledTableCell>
                      <StyledTableCell align="center">
                        <IconButton 
                          size="small"
                          onClick={() => handleOpenModal(user)}
                          sx={{ mr: 1 }}
                          disabled={loading}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small"
                          onClick={() => handleDeleteUser(user)}
                          color="error"
                          disabled={loading}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </StyledTableCell>
                    </StyledTableRow>
                  ))
                ) : (
                  <StyledTableRow>
                    <StyledTableCell colSpan={5} align="center">
                      {loading ? 'Loading...' : 'No users found'}
                    </StyledTableCell>
                  </StyledTableRow>
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
            rowsPerPageOptions={[]}
          />

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
