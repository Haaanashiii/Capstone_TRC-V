import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Sidebar from './Sidebar';
import {
  Box,
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
  Grid,
  Card,
  CardContent,
  CardHeader,
  Modal,
  IconButton,
  Chip,
  tableCellClasses,
  CircularProgress,
  Alert,
} from '@mui/material';
import { styled } from "@mui/material/styles";
import SearchIcon from '@mui/icons-material/Search';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import './FranchiseeList.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
  '&:hover': {
    backgroundColor: 'rgba(10, 53, 107, 0.08)',
    cursor: 'pointer',
  },
  '&:last-child td, &:last-child th': {
    border: 0,
  },
}));

// Modal styles
const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: '90%', sm: '85%', md: '900px' },
  maxHeight: '90vh',
  bgcolor: 'background.paper',
  boxShadow: 24,
  borderRadius: 2,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

// FranchiseeDetailsModal Component
const FranchiseeDetailsModal = ({ open, onClose, franchisee, isEditing, onEdit, onSave }) => {
  const [editedData, setEditedData] = useState(franchisee || {});

  // Update editedData when franchisee changes
  React.useEffect(() => {
    if (franchisee) {
      setEditedData(franchisee);
    }
  }, [franchisee]);

  const handleFieldChange = useCallback((field, value) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(() => {
    onSave(editedData);
  }, [editedData, onSave]);

  if (!franchisee) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="franchisee-details-modal"
      aria-describedby="franchisee-details-description"
    >
      <Box sx={modalStyle}>
        {/* Modal Header */}
        <Box
          sx={{
            bgcolor: '#0a3161',
            color: 'white',
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" component="h2" fontWeight="bold">
              Franchisee Details
            </Typography>
            <Chip 
              label={`Record #${franchisee.recordNumber}`} 
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 'bold' }}
            />
          </Box>
          <IconButton
            onClick={onClose}
            sx={{ color: 'white' }}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Modal Content */}
        <Box sx={{ overflowY: 'auto', flex: 1, p: 3 }}>
          {/* Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="contained"
              startIcon={isEditing ? <SaveIcon /> : <EditIcon />}
              onClick={isEditing ? handleSave : onEdit}
              sx={{
                bgcolor: '#0a3161',
                '&:hover': { bgcolor: '#082648' },
              }}
            >
              {isEditing ? 'Save Changes' : 'Edit Details'}
            </Button>
          </Box>

          {/* Franchisee Information Card */}
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardHeader
              title="FRANCHISEE INFORMATION"
              sx={{
                bgcolor: '#0a3161',
                color: 'white',
                '& .MuiCardHeader-title': { fontWeight: 'bold', fontSize: '1rem' },
              }}
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    FULL NAME
                  </Typography>
                  <TextField
                    fullWidth
                    value={isEditing ? editedData.franchiseeName : franchisee.franchiseeName}
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                    onChange={(e) => handleFieldChange('franchiseeName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    ADDRESS
                  </Typography>
                  <TextField
                    fullWidth
                    value={isEditing ? editedData.address : franchisee.address}
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    CIVIL STATUS
                  </Typography>
                  <TextField
                    fullWidth
                    defaultValue="SINGLE"
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    CO-OWNER
                  </Typography>
                  <TextField
                    fullWidth
                    defaultValue="N/A"
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Franchise Card */}
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardHeader
              title="MOTORIZED TRICYCLE OPERATORS FRANCHISE"
              sx={{
                bgcolor: '#0a3161',
                color: 'white',
                '& .MuiCardHeader-title': { fontWeight: 'bold', fontSize: '1rem' },
              }}
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    OR NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    defaultValue="7163721"
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    FRANCHISE NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    value={isEditing ? editedData.franchiseNumber : franchisee.franchiseNumber}
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                    onChange={(e) => handleFieldChange('franchiseNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    DATE APPROVED
                  </Typography>
                  <TextField
                    fullWidth
                    defaultValue="2025-09-01"
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                    type="date"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    EXPIRY DATE
                  </Typography>
                  <TextField
                    fullWidth
                    defaultValue="2029-09-01"
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                    type="date"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Motorcycle Information Card */}
          <Card elevation={2}>
            <CardHeader
              title="MOTORCYCLE INFORMATION"
              sx={{
                bgcolor: '#0a3161',
                color: 'white',
                '& .MuiCardHeader-title': { fontWeight: 'bold', fontSize: '1rem' },
              }}
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    MAKE
                  </Typography>
                  <TextField
                    fullWidth
                    value={isEditing ? editedData.make : franchisee.make}
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                    onChange={(e) => handleFieldChange('make', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    SIDECAR NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    value={franchisee.franchiseNumber}
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    PLATE NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    value={isEditing ? editedData.plateNumber : franchisee.plateNumber}
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                    onChange={(e) => handleFieldChange('plateNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    CHASSIS NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    defaultValue="LXRSF8J813NDD"
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    MOTOR NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    defaultValue="12655G8775758"
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Modal>
  );
};

function FranchiseeList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFranchisee, setSelectedFranchisee] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [franchisees, setFranchisees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get auth token
  const getAuthToken = () => {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
  };

  // Fetch franchisees from API (approved applications only)
  const fetchFranchisees = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const apiBase = API_BASE_URL || 'http://localhost:5170';
      
      // Fetch approved franchise applications
      const response = await fetch(`${apiBase}/api/franchise-applications?status=approved`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform the data to match the expected format
      const serverApps = Array.isArray(data) ? data : [];
      const transformedData = serverApps.map((app, index) => ({
        id: app._id || app.id,
        recordNumber: String(index + 1).padStart(3, '0'),
        franchiseeName: app.operatorName || app.name || app.driverName || '',
        franchiseNumber: app.franchiseNumber || app.franchise_number || '',
        make: app.unitModel || app.make || app.vehicleMake || '',
        plateNumber: app.mvPlateNo || app.mvPlate || app.plateNumber || app.plate_number || '',
        applicationType: app.actionType || app.applicationType || app.type || 'New',
        address: app.operatorAddress || app.address || app.driverAddress || app.address_of_driver || '',
        // Additional fields for details modal
        civilStatus: app.civilStatus || '',
        birthPlace: app.birthPlace || app.placeOfBirth || '',
        birthDate: app.birthDate || app.dateOfBirth || '',
        citizenship: app.citizenship || '',
        todaMembership: app.todaMembership || '',
        colorMotor: app.colorMotor || app.color || '',
        colorSidecar: app.sideCar || app.colorSidecar || app.sidecarColor || app.sidecar_color || '',
        motorEngineNumber: app.motorEngineNo || app.motorEngineNumber || app.engineNumber || '',
        chassisNumber: app.chasisNo || app.chassisNumber || app.chassis || app.chassis_number || '',
        driversID: app.driversID || app.driversId || app.driverId || '',
        driversAddress: app.driversAddress || app.driverAddress || app.address_of_driver || '',
        contactNumber: app.operatorContact || app.contactNumber || app.phone || app.contact || '',
        qrCode: app.qrCode || null,
        profilePhoto: app.profilePhoto || app.documentPicture || null
      }));

      setFranchisees(transformedData);
    } catch (err) {
      console.error('Error fetching franchisees:', err);
      setError('Failed to load franchisees. Please try again.');
      setFranchisees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load franchisees on component mount
  useEffect(() => {
    fetchFranchisees();
  }, [fetchFranchisees]);

  // Filtered franchisees based on search term
  const filteredFranchisees = useMemo(() => {
    if (!searchTerm.trim()) return franchisees;
    
    const searchLower = searchTerm.toLowerCase();
    return franchisees.filter(
      (franchisee) =>
        franchisee.franchiseeName.toLowerCase().includes(searchLower) ||
        franchisee.franchiseNumber.includes(searchLower) ||
        franchisee.plateNumber.toLowerCase().includes(searchLower) ||
        franchisee.recordNumber.includes(searchLower) ||
        franchisee.applicationType.toLowerCase().includes(searchLower)
    );
  }, [franchisees, searchTerm]);

  // Paginated data
  const paginatedFranchisees = useMemo(() => {
    return filteredFranchisees.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [filteredFranchisees, page, rowsPerPage]);

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleRowClick = useCallback((franchisee) => {
    setSelectedFranchisee(franchisee);
    setIsEditing(false);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setIsEditing(false);
  }, []);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleSave = useCallback(async (editedData) => {
    setLoading(true);
    setError('');
    
    try {
      const apiBase = API_BASE_URL || 'http://localhost:5170';

      const response = await fetch(`${apiBase}/api/franchise-applications/${editedData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operatorName: editedData.franchiseeName,
          operatorAddress: editedData.address,
          franchiseNumber: editedData.franchiseNumber,
          unitModel: editedData.make,
          mvPlateNo: editedData.plateNumber,
          civilStatus: editedData.civilStatus,
          birthPlace: editedData.birthPlace,
          birthDate: editedData.birthDate,
          citizenship: editedData.citizenship,
          todaMembership: editedData.todaMembership,
          colorMotor: editedData.colorMotor,
          sideCar: editedData.colorSidecar,
          motorEngineNo: editedData.motorEngineNumber,
          chasisNo: editedData.chassisNumber,
          driversID: editedData.driversID,
          driversAddress: editedData.driversAddress,
          operatorContact: editedData.contactNumber
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update franchisee');
      }

      setSelectedFranchisee(editedData);
      setIsEditing(false);
      
      // Refresh the list
      await fetchFranchisees();
      
      // Show success message
      setError('');
    } catch (err) {
      console.error('Error saving franchisee:', err);
      setError(err.message || 'Failed to save changes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchFranchisees]);

  const handleSearch = useCallback(() => {
    setPage(0); // Reset to first page when searching
  }, []);

  const getApplicationTypeColor = (type) => {
    switch (type) {
      case 'New':
        return '#4caf50';
      case 'Renewal':
        return '#2196f3';
      case 'Transfer':
        return '#ff9800';
      default:
        return '#757575';
    }
  };

  return (
    <div className="franchisee-list-container">
      <div className="sidebar">
        <Sidebar />
      </div>
      <div className="content-container">
        <div className="header-container">
          <div className="page-title">
            Franchisee List
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Search Bar */}
        <div className="search-container">
          <TextField
            placeholder="Search by name, franchise number, plate number, or record number..."
            variant="outlined"
            fullWidth
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            className="search-field"
          />
          <Button 
            className="search-button"
            onClick={handleSearch}
          >
            <SearchIcon />
          </Button>
        </div>

        {/* Results count */}
        {searchTerm && (
          <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
            Found {filteredFranchisees.length} result{filteredFranchisees.length !== 1 ? 's' : ''}
          </Typography>
        )}

        {/* Franchisee Records Table */}
        <TableContainer component={Paper} className="table-container" elevation={2}>
          {loading && (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          )}
          
          <Table stickyHeader aria-label="franchisee table">
            <TableHead>
              <TableRow>
                <StyledTableCell>Record Number</StyledTableCell>
                <StyledTableCell>Franchisee Name</StyledTableCell>
                <StyledTableCell>Franchise Number</StyledTableCell>
                <StyledTableCell>Plate Number</StyledTableCell>
                <StyledTableCell>Application Type</StyledTableCell>
                <StyledTableCell>Address</StyledTableCell>
                <StyledTableCell>Action</StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && paginatedFranchisees.length > 0 ? (
                paginatedFranchisees.map((row) => (
                  <StyledTableRow 
                    key={row.id}
                    onClick={() => handleRowClick(row)}
                  >
                    <StyledTableCell>{row.recordNumber}</StyledTableCell>
                    <StyledTableCell>{row.franchiseeName}</StyledTableCell>
                    <StyledTableCell>{row.franchiseNumber}</StyledTableCell>
                    <StyledTableCell>{row.plateNumber}</StyledTableCell>
                    <StyledTableCell>
                      <Chip 
                        label={row.applicationType} 
                        size="small"
                        sx={{ 
                          bgcolor: getApplicationTypeColor(row.applicationType),
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      />
                    </StyledTableCell>
                    <StyledTableCell>{row.address}</StyledTableCell>
                    <StyledTableCell>
                      <IconButton 
                        size="small" 
                        sx={{ color: '#0a3161' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(row);
                        }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </StyledTableCell>
                  </StyledTableRow>
                ))
              ) : (
                <StyledTableRow>
                  <StyledTableCell colSpan={7} align="center">
                    <Typography variant="body1" sx={{ py: 4, color: '#999' }}>
                      {loading ? 'Loading...' : 'No franchisees found'}
                    </Typography>
                  </StyledTableCell>
                </StyledTableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredFranchisees.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>

        {/* Franchisee Details Modal */}
        <FranchiseeDetailsModal
          open={modalOpen}
          onClose={handleCloseModal}
          franchisee={selectedFranchisee}
          isEditing={isEditing}
          onEdit={handleEdit}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}

export default FranchiseeList;
