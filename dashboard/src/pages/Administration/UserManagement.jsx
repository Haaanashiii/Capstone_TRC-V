import React, { useState, useEffect } from 'react';
import '../../Styles/Administrator_Css/UserManagement.css';
import Sidebar from './Sidebar';

// Material UI imports
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
  tableCellClasses
} from '@mui/material';

import { styled } from "@mui/material/styles";
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

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

// Updated mock data as requested
const mockUsers = [
  { userId: '1', name: 'Luke Dominic Corpuz', username: 'lukecorpuz', email: 'hed-ldcorpuz@smu.edu.ph', role: 'Sangguniang Bayan', status: 'Active' },
];

function UserManagement() {
  const [users, setUsers] = useState(mockUsers);
  const [filteredUsers, setFilteredUsers] = useState(mockUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [viewUserOpen, setViewUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [page, setPage] = useState(0);
  const rowsPerPage = 5;
  
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: '',
    status: 'Pending'
  });

  // Filter users based on search query
  useEffect(() => {
    if (searchQuery) {
      const filtered = users.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);
  
  // Handle edit user
  const handleOpenModal = (user = null) => {
    setIsEditing(!!user);
    setSelectedUser(user);
    if (user) {
      setNewUser({
        name: user.name,
        username: user.username,
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
        role: '',
        status: 'Pending'
      });
    }
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setSelectedUser(null);
  };

  // Handle add/update user
  const handleAddUser = () => {
    // Add validation here
    if (isEditing) {
      // Update existing user
      const updatedUsers = users.map(user => 
        user.userId === selectedUser.userId ? { ...newUser, userId: user.userId } : user
      );
      setUsers(updatedUsers);
      setFilteredUsers(updatedUsers);
    } else {
      // Add new user
      const updatedUsers = [...users, { ...newUser, userId: `${users.length + 1}` }];
      setUsers(updatedUsers);
      setFilteredUsers(updatedUsers);
    }
    
    setOpenModal(false);
    setNewUser({
      name: '',
      username: '',
      email: '',
      password: '',
      role: '',
      status: 'Pending'
    });
  };

  // Handle delete user
  const handleDeleteUser = (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    const updatedUsers = users.filter(user => user.userId !== userId);
    setUsers(updatedUsers);
    setFilteredUsers(updatedUsers);
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
              fontWeight: 500
            }}
          >
            User Management
          </Typography>
          
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
                  <StyledTableCell>Status</StyledTableCell>
                  <StyledTableCell align="center">Actions</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((user) => (
                  <StyledTableRow key={user.userId}>
                    <StyledTableCell>{user.name}</StyledTableCell>
                    <StyledTableCell>{user.username}</StyledTableCell>
                    <StyledTableCell>{user.email}</StyledTableCell>
                    <StyledTableCell>{user.role}</StyledTableCell>
                    <StyledTableCell>
                      <StyledChip 
                        label={user.status} 
                        color={getStatusColor(user.status)}
                        size="small"
                        variant="outlined"
                      />
                    </StyledTableCell>
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
            
            <TextField
              fullWidth
              label="Name"
              margin="normal"
              value={newUser.name}
              onChange={(e) => setNewUser({...newUser, name: e.target.value})}
              required
            />
            <TextField
              fullWidth
              label="Username"
              margin="normal"
              value={newUser.username}
              onChange={(e) => setNewUser({...newUser, username: e.target.value})}
              required
            />
            <TextField
              fullWidth
              label="Email"
              margin="normal"
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              required
            />
            <TextField
              fullWidth
              label="Password"
              margin="normal"
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser({...newUser, password: e.target.value})}
              required={!isEditing}
              helperText={isEditing ? "Leave blank to keep current password" : ""}
            />
            <FormControl fullWidth margin="normal" required>
              <InputLabel>Role</InputLabel>
              <Select
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                input={<OutlinedInput label="Role" />}
              >
                <MenuItem value="Sangguniang Bayan">Sangguniang Bayan</MenuItem>
                <MenuItem value="BPLO">BPLO</MenuItem>
                <MenuItem value="Operator">Operator</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Status</InputLabel>
              <Select
                value={newUser.status}
                onChange={(e) => setNewUser({...newUser, status: e.target.value})}
                input={<OutlinedInput label="Status" />}
              >
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Deactivated">Deactivated</MenuItem>
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
      </div>
    </div>
  );
}

export default UserManagement;
