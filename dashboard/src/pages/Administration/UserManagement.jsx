import React, { useState, useEffect } from 'react';
import '../../Styles/Administrator_Css/UserManagement.css';
import Sidebar from './Sidebar';
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
  Chip,
  Modal,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  tableCellClasses,
  IconButton
} from '@mui/material';

import { styled } from "@mui/material/styles";
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import AccountVerificationModal from '../Services/AccountVerificationModal';

// Styled components for table
const StyledTableCell = styled(TableCell)(({ theme }) => ({
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

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: '#f9f9f9',
  },
  '&:last-child td, &:last-child th': {
    border: 0,
  },
}));

const StyledChip = styled(Chip)({
  borderRadius: '4px',
  fontWeight: 500,
  fontSize: '12px',
  padding: '0 2px',
});

const modalStyle = {
  position: "absolute",
  top: "50%", 
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400, 
  bgcolor: "background.paper",
  boxShadow: 24, 
  p: 4,
  borderRadius: 1
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Updated mock data as requested
const mockUsers = [
  { userId: '1', name: 'Luke Dominic Corpuz', username: 'lukecorpuz', email: 'hed-ldcorpuz@smu.edu.ph', role: 'Sangguniang Bayan', status: 'Active' },
];

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [viewUserOpen, setViewUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [page, setPage] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const rowsPerPage = 5;
  
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'operator',
    status: 'Pending'
  });

  // Fetch users from API
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setUsers(data);
        setFilteredUsers(data);
      } else {
        setError(data.error || 'Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Network error. Please try again.');
    }
  };

  // Filter users based on search query
  useEffect(() => {
    if (searchQuery) {
      const filtered = users.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const validatePassword = (password) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must include at least one capital letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must include at least one number";
    }
    return "";
  };
  
  // Handle edit user
  const handleOpenModal = (user = null) => {
    setIsEditing(!!user);
    setSelectedUser(user);
    setError('');
    setSuccess('');
    setPasswordError('');
    if (user) {
      setNewUser({
        name: user.name,
        username: user.username || '',
        email: user.email,
        password: '',
        role: user.role,
        status: user.status
      });
    } else {
      setNewUser({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'operator',
        status: 'Pending'
      });
    }
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setSelectedUser(null);
    setError('');
    setSuccess('');
    setPasswordError('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewUser({ ...newUser, [name]: value });
    
    if (name === "password") {
      setPasswordError(validatePassword(value));
    }
  };

  // Handle add/update user
  const handleAddUser = async () => {
    setError('');
    setSuccess('');
    
    // Validate password for new users
    if (!isEditing) {
      const passwordValidationError = validatePassword(newUser.password);
      if (passwordValidationError) {
        setError(passwordValidationError);
        return;
      }
    }
    
    // Check if all required fields are filled
    if (!newUser.name || !newUser.username || !newUser.email || !newUser.role) {
      setError("Please fill out all required fields");
      return;
    }

    if (!isEditing && !newUser.password) {
      setError("Password is required for new users");
      return;
    }
    
    if (isEditing) {
      // Update existing user
      try {
        const updateData = {
          name: newUser.name,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          status: newUser.status
        };
        
        // Only include password if it's provided
        if (newUser.password) {
          const passwordValidationError = validatePassword(newUser.password);
          if (passwordValidationError) {
            setError(passwordValidationError);
            return;
          }
          updateData.password = newUser.password;
        }

        const response = await fetch(`${API_BASE_URL}/users/${selectedUser.userId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(updateData)
        });

        const data = await response.json();
        if (response.ok) {
          setSuccess('User updated successfully!');
          fetchUsers();
          setTimeout(() => {
            handleCloseModal();
          }, 1500);
        } else {
          setError(data.error || 'Failed to update user');
        }
      } catch (error) {
        console.error('Error updating user:', error);
        setError('Network error. Please try again.');
      }
    } else {
      // Request OTP for new user
      try {
        console.log("Requesting OTP for:", newUser.email);
        const otpResponse = await fetch(`${API_BASE_URL}/auth/request-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: newUser.email })
        });
        const otpData = await otpResponse.json().catch(() => ({}));
        if (!otpResponse.ok) {
          setError(otpData.error || 'Failed to request verification code');
          return;
        }
        setShowVerificationModal(true);
      } catch (error) {
        console.error("OTP request network error:", error);
        setError("Network error. Please try again.");
      }
    }
  };

  const handleVerificationSuccess = async () => {
    // After OTP verification, create the actual user account
    try {
      const response = await fetch(`${API_BASE_URL}/users/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: newUser.name,
          username: newUser.username,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          status: newUser.status
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        setSuccess('User created and verified successfully!');
        fetchUsers();
        setShowVerificationModal(false);
        setTimeout(() => {
          handleCloseModal();
        }, 1500);
      } else {
        setError(data.error || 'Failed to create user');
        setShowVerificationModal(false);
      }
    } catch (error) {
      console.error('Create user network error:', error);
      setError('Network error. Please try again.');
      setShowVerificationModal(false);
    }
  };

  // Handle delete user
  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setSuccess('User deleted successfully!');
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Network error. Please try again.');
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Pending': return 'warning';
      case 'Deactivated': return 'error';
      default: return 'default';
    }
  };

  return (
    <div className="user-management-container">
      <Sidebar />
      <div className="content-area">
        <Box p={3}>
          <Typography 
            variant="h5" 
            component="h1" 
            sx={{ 
              mb: 3, 
              fontFamily: 'Poppins, sans-serif',
              color: 'black',
              fontWeight: 'bold',
              fontSize: '32px'
            }}
          >
            User Management
          </Typography>

          {error && (
            <Typography color="error" sx={{ mb: 2, fontFamily: 'Poppins, sans-serif' }}>
              {error}
            </Typography>
          )}
          {success && (
            <Typography color="success.main" sx={{ mb: 2, fontFamily: 'Poppins, sans-serif' }}>
              {success}
            </Typography>
          )}
          
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
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
              sx={{ 
                bgcolor: '#0A356B',
                '&:hover': {
                  bgcolor: '#0A356B',
                  opacity: 0.9
                }
              }}
            >
              Add User
            </Button>
          </Box>

          <TableContainer component={Paper} elevation={2}>
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
                {filteredUsers
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((user) => (
                  <StyledTableRow key={user.userId}>
                    <StyledTableCell>{user.name}</StyledTableCell>
                    <StyledTableCell>{user.username || 'N/A'}</StyledTableCell>
                    <StyledTableCell>{user.email}</StyledTableCell>
                    <StyledTableCell>{user.role}</StyledTableCell>
                    <StyledTableCell align="center">
                      <EditIcon 
                        sx={{ cursor: "pointer", mr: 2 }} 
                        onClick={() => handleOpenModal(user)}
                      />
                      <DeleteIcon 
                        sx={{ cursor: "pointer" }} 
                        onClick={() => handleDeleteUser(user.userId)}
                      />
                    </StyledTableCell>
                  </StyledTableRow>
                ))}
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
        </Box>

        {/* Add/Edit User Modal */}
        <Modal open={openModal} onClose={handleCloseModal}>
          <Box sx={modalStyle}>
            <Typography variant="h6" component="h2" sx={{ mb: 2, fontFamily: 'Poppins, sans-serif' }}>
              {isEditing ? "Edit User" : "Add New User"}
            </Typography>

            {error && (
              <Typography color="error" sx={{ mb: 2, fontFamily: 'Poppins, sans-serif', fontSize: '14px' }}>
                {error}
              </Typography>
            )}
            {success && (
              <Typography color="success.main" sx={{ mb: 2, fontFamily: 'Poppins, sans-serif', fontSize: '14px' }}>
                {success}
              </Typography>
            )}
            
            <TextField
              fullWidth
              label="Name"
              name="name"
              margin="normal"
              value={newUser.name}
              onChange={handleChange}
              required
            />
            <TextField
              fullWidth
              label="Username"
              name="username"
              margin="normal"
              value={newUser.username}
              onChange={handleChange}
              required
            />
            <TextField
              fullWidth
              label="Email"
              name="email"
              margin="normal"
              type="email"
              value={newUser.email}
              onChange={handleChange}
              required
            />
            <TextField
              fullWidth
              label="Password"
              name="password"
              margin="normal"
              type={showPassword ? "text" : "password"}
              value={newUser.password}
              onChange={handleChange}
              required={!isEditing}
              error={!!passwordError}
              helperText={passwordError || (isEditing ? "Leave blank to keep current password" : "Must be at least 8 characters and include capital letters and numbers")}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleClickShowPassword} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              FormHelperTextProps={{ style: { fontFamily: 'Poppins, sans-serif', fontSize: '12px' } }}
            />
            <FormControl fullWidth margin="normal" required>
              <InputLabel>Role</InputLabel>
              <Select
                name="role"
                value={newUser.role}
                onChange={handleChange}
                input={<OutlinedInput label="Role" />}
              >
                <MenuItem value="sb-admin">Sangguniang Bayan Admin</MenuItem>
                <MenuItem value="bplo-admin">BPLO Admin</MenuItem>
                <MenuItem value="operator">Operator</MenuItem>
              </Select>
            </FormControl>
          
            
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={handleCloseModal} sx={{ mr: 1 }}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddUser} 
                variant="contained" 
                sx={{ 
                  bgcolor: '#0A356B',
                  '&:hover': {
                    bgcolor: '#0A356B',
                    opacity: 0.9
                  }
                }}
              >
                {isEditing ? "Save Changes" : "Add User"}
              </Button>
            </Box>
          </Box>
        </Modal>

        <AccountVerificationModal
          open={showVerificationModal}
          onClose={() => setShowVerificationModal(false)}
          email={newUser.email}
          onVerificationSuccess={handleVerificationSuccess}
        />
      </div>
    </div>
  );
}

export default UserManagement;
