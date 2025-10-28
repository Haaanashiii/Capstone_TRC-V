import React, { useState, useMemo, useCallback } from 'react';
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
} from '@mui/material';
import { styled } from "@mui/material/styles";
import SearchIcon from '@mui/icons-material/Search';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import './FranchiseeList.css';

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

  // Mock data - In production, this would come from an API
  const franchisees = useMemo(() => [
    { id: 1, recordNumber: '001', franchiseeName: 'Charles Agustin', franchiseNumber: '81737', make: 'Skygo', plateNumber: 'NV-1001', applicationType: 'New', address: 'Brgy. Poblacion, Solano, Nueva Vizcaya' },
    { id: 2, recordNumber: '002', franchiseeName: 'Kevin Klein Ananayo', franchiseNumber: '81738', make: 'Honda', plateNumber: 'NV-1002', applicationType: 'Renewal', address: 'Brgy. Quezon, Solano, Nueva Vizcaya' },
    { id: 3, recordNumber: '003', franchiseeName: 'Andreev Abellera', franchiseNumber: '81739', make: 'Yamaha', plateNumber: 'NV-1003', applicationType: 'New', address: 'Brgy. Roxas, Bayombong, Nueva Vizcaya' },
    { id: 4, recordNumber: '004', franchiseeName: 'Jose "Wendell Jon" III Apolonio', franchiseNumber: '81740', make: 'Suzuki', plateNumber: 'NV-1004', applicationType: 'Transfer', address: 'Brgy. Bangaan, Solano, Nueva Vizcaya' },
    { id: 5, recordNumber: '005', franchiseeName: 'Marc Aedrian Andres', franchiseNumber: '81741', make: 'Kawasaki', plateNumber: 'NV-1005', applicationType: 'Renewal', address: 'Brgy. Osmeña, Bagabag, Nueva Vizcaya' },
    { id: 6, recordNumber: '006', franchiseeName: 'Lance Krystian Andres', franchiseNumber: '81742', make: 'Skygo', plateNumber: 'NV-1006', applicationType: 'New', address: 'Brgy. Bagahabag, Solano, Nueva Vizcaya' },
    { id: 7, recordNumber: '007', franchiseeName: 'Erein Miko Bambalan', franchiseNumber: '81743', make: 'Honda', plateNumber: 'NV-1007', applicationType: 'Renewal', address: 'Brgy. Quirino, Solano, Nueva Vizcaya' },
    { id: 8, recordNumber: '008', franchiseeName: 'Johann Dwyane Bandolin', franchiseNumber: '81744', make: 'Yamaha', plateNumber: 'NV-1008', applicationType: 'New', address: 'Brgy. Mabini, Bayombong, Nueva Vizcaya' },
    { id: 9, recordNumber: '009', franchiseeName: 'Joshua Roel Basto', franchiseNumber: '81745', make: 'Suzuki', plateNumber: 'NV-1009', applicationType: 'Transfer', address: 'Brgy. Bonfal, Bayombong, Nueva Vizcaya' },
    { id: 10, recordNumber: '010', franchiseeName: 'Andrei Barroga', franchiseNumber: '81746', make: 'Skygo', plateNumber: 'NV-1010', applicationType: 'Renewal', address: 'Brgy. Aggub, Solano, Nueva Vizcaya' },
    { id: 11, recordNumber: '011', franchiseeName: 'Jenzon Emerald Baquiran', franchiseNumber: '81747', make: 'Honda', plateNumber: 'NV-1011', applicationType: 'New', address: 'Brgy. Sta. Cruz, Bambang, Nueva Vizcaya' },
    { id: 12, recordNumber: '012', franchiseeName: 'Hanamitchie Beltran', franchiseNumber: '81748', make: 'Yamaha', plateNumber: 'NV-1012', applicationType: 'Renewal', address: 'Brgy. Almaguer, Quezon, Nueva Vizcaya' },
    { id: 13, recordNumber: '013', franchiseeName: 'Luke Dominic Corpuz', franchiseNumber: '81749', make: 'Suzuki', plateNumber: 'NV-1013', applicationType: 'Transfer', address: 'Brgy. Communal, Solano, Nueva Vizcaya' },
    { id: 14, recordNumber: '014', franchiseeName: 'Karrel Emman Dayag', franchiseNumber: '81750', make: 'Kawasaki', plateNumber: 'NV-1014', applicationType: 'New', address: 'Brgy. Ibung, Solano, Nueva Vizcaya' },
    { id: 15, recordNumber: '015', franchiseeName: 'Nicolai Dela Peña', franchiseNumber: '81751', make: 'Skygo', plateNumber: 'NV-1015', applicationType: 'Renewal', address: 'Brgy. Maddiangat, Quezon, Nueva Vizcaya' },
    { id: 16, recordNumber: '016', franchiseeName: 'Marc Christian Delos Santos', franchiseNumber: '81752', make: 'Yamaha', plateNumber: 'NV-1016', applicationType: 'New', address: 'Brgy. Don Tomas, Solano, Nueva Vizcaya' },
    { id: 17, recordNumber: '017', franchiseeName: 'Ray Richard Gabatino', franchiseNumber: '81753', make: 'Suzuki', plateNumber: 'NV-1017', applicationType: 'Renewal', address: 'Brgy. Aggub, Solano, Nueva Vizcaya' },
    { id: 18, recordNumber: '018', franchiseeName: 'Arnoell Kelhzcy Galano', franchiseNumber: '81754', make: 'Honda', plateNumber: 'NV-1018', applicationType: 'New', address: 'Brgy. Roxas, Bayombong, Nueva Vizcaya' },
    { id: 19, recordNumber: '019', franchiseeName: 'Marla Rihana Jose', franchiseNumber: '81755', make: 'Kawasaki', plateNumber: 'NV-1019', applicationType: 'Transfer', address: 'Brgy. Quirino, Solano, Nueva Vizcaya' },
    { id: 20, recordNumber: '020', franchiseeName: 'Marlowe Ian Jumagbas', franchiseNumber: '81756', make: 'Yamaha', plateNumber: 'NV-1020', applicationType: 'Renewal', address: 'Brgy. Sta. Lucia, Bayombong, Nueva Vizcaya' },
  ], []);

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

  const handleSave = useCallback((editedData) => {
    // In production, this would make an API call to save the data
    console.log('Saving data:', editedData);
    setSelectedFranchisee(editedData);
    setIsEditing(false);
    // TODO: Show success notification
    // TODO: Update the franchisees list with the new data
  }, []);

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
              {paginatedFranchisees.length > 0 ? (
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
                      No franchisees found
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
