import React, { useState } from 'react';
import './Reports.css';
import Sidebar from './Sidebar';
import { 
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
  Modal,
  Box,
  Divider,
  Grid
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

function Reports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Mock data for demonstration
const reports = [
  { 
    id: 'RPT-001', 
    franchiseeName: 'Manila Trike Services',
    dateReported: '2025-10-12 14:30',
    amountCharged: 50.00,
    expectedFare: 35.00,
    description: 'Driver charged more than the standard fare rate',
    reporterContact: 'maria.santos@gmail.com | 0917-234-5678'
  },
  { 
    id: 'RPT-002', 
    franchiseeName: 'Solano Express Tricycle',
    dateReported: '2025-10-11 09:45',
    amountCharged: 80.00,
    expectedFare: 80.00,
    description: 'Reported for rude behavior towards passenger',
    reporterContact: 'juan.delacruz@yahoo.com | 0928-456-7890'
  },
  { 
    id: 'RPT-003', 
    franchiseeName: 'Nueva Vizcaya Transport Cooperative',
    dateReported: '2025-10-10 16:20',
    amountCharged: 30.00,
    expectedFare: 30.00,
    description: 'Tricycle was in poor condition and emitted smoke',
    reporterContact: 'angelica.cruz@example.com | 0995-123-6547'
  },
  { 
    id: 'RPT-004', 
    franchiseeName: 'Vizcaya Ride Corporation',
    dateReported: '2025-10-09 11:05',
    amountCharged: 60.00,
    expectedFare: 45.00,
    description: 'Driver took a longer route without reason',
    reporterContact: 'mark.reyes@gmail.com | 0908-321-8765'
  },
  { 
    id: 'RPT-005', 
    franchiseeName: 'Bambang City Trikes',
    dateReported: '2025-10-08 16:45',
    amountCharged: 40.00,
    expectedFare: 40.00,
    description: 'Driver was impolite to senior citizen passenger',
    reporterContact: 'josefina.mendoza@gmail.com | 0916-789-2345'
  },
  { 
    id: 'RPT-006', 
    franchiseeName: 'Solano Central Tricycle Association',
    dateReported: '2025-10-07 09:15',
    amountCharged: 35.00,
    expectedFare: 35.00,
    description: 'Tricycle was dirty and had unpleasant odor',
    reporterContact: 'carlo.garcia@yahoo.com | 0947-562-3412'
  }
];


  const handleOpen = (report) => {
    setSelectedReport(report);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter reports based on search term
  const filteredReports = reports.filter(report => 
    report.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.franchiseeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 600,
    maxWidth: '90%',
    bgcolor: 'background.paper',
    boxShadow: 24,
    p: 4,
    borderRadius: 2,
  };

  return (
    <div className="reports-container">
      <Sidebar />
      <div className="content-container">
        <div className="header-container">
          <div className="page-title">
            Reports
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="search-container">
          <TextField
            placeholder="Search Reports"
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
        
        {/* Reports Table */}
        <TableContainer component={Paper} className="table-container">
          <Table stickyHeader aria-label="reports table">
            <TableHead>
              <TableRow>
                <TableCell>Report ID</TableCell>
                <TableCell>Franchisee Name</TableCell>
                <TableCell>Date and Time Reported</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredReports
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((report) => (
                <TableRow 
                  key={report.id}
                  onClick={() => handleOpen(report)}
                  sx={{ 
                    '&:hover': { 
                      backgroundColor: '#f5f5f5',
                      cursor: 'pointer'
                    }
                  }}
                >
                  <TableCell>{report.id}</TableCell>
                  <TableCell>{report.franchiseeName}</TableCell>
                  <TableCell>{report.dateReported}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredReports.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
        
        {/* Modal for displaying report details */}
        <Modal
          open={open}
          onClose={handleClose}
          aria-labelledby="report-details-modal"
        >
          <Box sx={modalStyle}>
            <Typography id="modal-title" variant="h5" component="h2" sx={{ mb: 2, fontWeight: 'bold' }}>
              Report Details
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            {selectedReport && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Report ID
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedReport.id}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Franchisee Name
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedReport.franchiseeName}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Amount Charged
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    ${selectedReport.amountCharged.toFixed(2)}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Expected Fare
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    ${selectedReport.expectedFare.toFixed(2)}
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Description
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedReport.description}
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Reporter's Contact
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedReport.reporterContact}
                  </Typography>
                </Grid>
              </Grid>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button 
                variant="contained" 
                onClick={handleClose}
                className="action-button"
              >
                Close
              </Button>
            </Box>
          </Box>
        </Modal>
      </div>
    </div>
  );
}

export default Reports;
