import React, { useState } from 'react';
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
  Divider,
  Card,
  CardContent,
  CardHeader,
  Stack,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import './FranchiseeList.css';

function FranchiseeList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFranchisee, setSelectedFranchisee] = useState(null);
  

  const franchisees = [
  { id: 1, recordNumber: '001', franchiseeName: 'Charles Agustin', franchiseNumber: '81737', make: 'Skygo', plateNumber: 'NV-1001', applicationType: 'New', address: 'Brgy. Poblacion, Solano, Nueva Vizcaya' },
  { id: 2, recordNumber: '002', franchiseeName: 'Kevin Klein Ananayo', franchiseNumber: '81738', make: 'Honda', plateNumber: 'NV-1002', applicationType: 'Renewal', address: 'Brgy. Quezon, Solano, Nueva Vizcaya' },
  { id: 3, recordNumber: '003', franchiseeName: 'Andreev Abellera', franchiseNumber: '81739', make: 'Yamaha', plateNumber: 'NV-1003', applicationType: 'New', address: 'Brgy. Roxas, Bayombong, Nueva Vizcaya' },
  { id: 4, recordNumber: '004', franchiseeName: 'Jose “Wendell Jon” III Apolonio', franchiseNumber: '81740', make: 'Suzuki', plateNumber: 'NV-1004', applicationType: 'Transfer', address: 'Brgy. Bangaan, Solano, Nueva Vizcaya' },
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
];

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const handleRowClick = (franchisee) => {
    setSelectedFranchisee(franchisee);
    setIsEditing(false); // Reset to view mode when selecting a new franchisee
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
            placeholder="Search Franchisee"
            variant="outlined"
            fullWidth
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-field"
          />
          <Button className="search-button">
            <SearchIcon />
          </Button>
        </div>

        {/* Franchisee Records Table */}
        <TableContainer component={Paper} className="table-container">
          <Table stickyHeader aria-label="franchisee table">
            <TableHead>
              <TableRow>
                <TableCell>Record Number</TableCell>
                <TableCell>Franchisee Name</TableCell>
                <TableCell>Franchise Number</TableCell>
                <TableCell>Plate Number</TableCell>
                <TableCell>Application Type</TableCell>
                <TableCell>Address</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {franchisees
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => (
                  <TableRow 
                    key={row.id}
                    onClick={() => handleRowClick(row)}
                    className="clickable-row"
                    sx={{ 
                      cursor: 'pointer',
                      backgroundColor: selectedFranchisee && selectedFranchisee.id === row.id ? 'rgba(10, 53, 107, 0.1)' : 'inherit'
                    }}
                  >
                    <TableCell>{row.recordNumber}</TableCell>
                    <TableCell>{row.franchiseeName}</TableCell>
                    <TableCell>{row.franchiseNumber}</TableCell>
                    <TableCell>{row.plateNumber}</TableCell>
                    <TableCell>{row.applicationType}</TableCell>
                    <TableCell>{row.address}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={franchisees.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>

        {/* Franchisee Details Section */}
        <Box sx={{ mt: 4, mb: 6 }} className="details-container">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
            <Typography variant="h5" component="h2" fontWeight="bold">
              Franchisee Details
            </Typography>
            <Button 
              variant="contained" 
              startIcon={isEditing ? <SaveIcon /> : <EditIcon />}
              className="action-button"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Save Changes' : 'Edit Details'}
            </Button>
          </Box>
          
          {/* Franchisee Information Card */}
          <Card className="detail-card" elevation={2} sx={{ mb: 3 }}>
            <CardHeader 
              title="FRANCHISEE INFORMATION" 
              className="card-header"
              titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">FULL NAME</Typography>
                  <TextField 
                    fullWidth 
                    value={selectedFranchisee ? selectedFranchisee.franchiseeName : "LUKE DOMINIC CORPUZ"} 
                    variant="outlined" 
                    size="small"
                    className="form-field"
                    disabled={!isEditing}
                    onChange={(e) => {
                      if (selectedFranchisee && isEditing) {
                        setSelectedFranchisee({
                          ...selectedFranchisee,
                          franchiseeName: e.target.value
                        });
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">ADDRESS</Typography>
                  <TextField 
                    fullWidth 
                    value={selectedFranchisee ? selectedFranchisee.address : "BRGY. QUEZON, SOLANO, NUEVA VIZCAYA"} 
                    variant="outlined" 
                    size="small"
                    className="form-field"
                    disabled={!isEditing}
                    onChange={(e) => {
                      if (selectedFranchisee && isEditing) {
                        setSelectedFranchisee({
                          ...selectedFranchisee,
                          address: e.target.value
                        });
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">CIVIL STATUS</Typography>
                  <TextField 
                    fullWidth 
                    defaultValue="SINGLE" 
                    variant="outlined" 
                    size="small"
                    className="form-field"
                    disabled={!isEditing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">CO-OWNER</Typography>
                  <TextField 
                    fullWidth 
                    defaultValue="N/A" 
                    variant="outlined" 
                    size="small"
                    className="form-field"
                    disabled={!isEditing}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Franchise Card */}
          <Card className="detail-card" elevation={2} sx={{ mb: 3 }}>
            <CardHeader 
              title="MOTORIZED TRICYCLE OPERATORS FRANCHISE" 
              className="card-header"
              titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">OR NUMBER</Typography>
                  <TextField 
                    fullWidth 
                    defaultValue="7163721" 
                    variant="outlined" 
                    size="small"
                    className="form-field"
                    disabled={!isEditing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">FRANCHISE NUMBER</Typography>
                  <TextField 
                    fullWidth 
                    value={selectedFranchisee ? selectedFranchisee.franchiseNumber : "81737"} 
                    variant="outlined" 
                    size="small"
                    className="form-field"
                    disabled={!isEditing}
                    onChange={(e) => {
                      if (selectedFranchisee && isEditing) {
                        setSelectedFranchisee({
                          ...selectedFranchisee,
                          franchiseNumber: e.target.value
                        });
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">DATE APPROVED</Typography>
                  <TextField 
                    fullWidth 
                    defaultValue="09/01/2025" 
                    variant="outlined" 
                    size="small"
                    className="form-field"
                    disabled={!isEditing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">EXPIRY DATE</Typography>
                  <TextField 
                    fullWidth 
                    defaultValue="09/01/2029" 
                    variant="outlined" 
                    size="small"
                    className="form-field"
                    disabled={!isEditing}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Motorcycle Information Card */}
          <Card className="detail-card" elevation={2}>
            <CardHeader 
              title="MOTORCYCLE INFORMATION" 
              className="card-header"
              titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" fontWeight="bold">MAKE</Typography>
                  <TextField 
                    fullWidth 
                    value={selectedFranchisee ? selectedFranchisee.make : "Skygo"} 
                    variant="outlined" 
                    size="small"
                    className="form-field"
                    disabled={!isEditing}
                    onChange={(e) => {
                      if (selectedFranchisee && isEditing) {
                        setSelectedFranchisee({
                          ...selectedFranchisee,
                          make: e.target.value
                        });
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" fontWeight="bold">SIDECAR NUMBER</Typography>
                  <TextField 
                    fullWidth 
                    defaultValue="81737" 
                    variant="outlined" 
                    size="small"
                    className="form-field"
                    disabled={!isEditing}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" fontWeight="bold">PLATE NUMBER</Typography>
                  <TextField 
                    fullWidth 
                    value={selectedFranchisee ? selectedFranchisee.plateNumber : "090703"} 
                    variant="outlined" 
                    size="small"
                    className="form-field"
                    disabled={!isEditing}
                    onChange={(e) => {
                      if (selectedFranchisee && isEditing) {
                        setSelectedFranchisee({
                          ...selectedFranchisee,
                          plateNumber: e.target.value
                        });
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">CHASSIS NUMBER</Typography>
                  <TextField 
                    fullWidth 
                    defaultValue="LXRSF8J813NDD" 
                    variant="outlined" 
                    size="small"
                    className="form-field"
                    disabled={!isEditing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">MOTOR NUMBER</Typography>
                  <TextField 
                    fullWidth 
                    defaultValue="12655G8775758" 
                    variant="outlined" 
                    size="small"
                    className="form-field"
                    disabled={!isEditing}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      </div>
    </div>
  );
}

export default FranchiseeList;
