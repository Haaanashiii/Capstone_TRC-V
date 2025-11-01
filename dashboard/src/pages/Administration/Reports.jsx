import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './Reports.css';
import Sidebar from './Sidebar';
import api from '../Services/api';
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
  Grid,
  Alert,
  CircularProgress,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  tableCellClasses,
  IconButton
} from '@mui/material';
import { styled } from "@mui/material/styles";
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';

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

function Reports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalReports, setTotalReports] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('dateReported');
  const [sortOrder, setSortOrder] = useState('desc');

  // Load reports on component mount and when filters change
  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      setError('');
      
      try {
        const queryParams = new URLSearchParams({
          page: page + 1,
          limit: rowsPerPage,
          search: searchTerm,
          status: statusFilter,
          sortBy,
          sortOrder
        });

        const { data } = await api.get(`/reports?${queryParams}`);
        setReports(data.reports || []);
        setTotalReports(data.pagination?.total || 0);
      } catch (err) {
        console.error('Error fetching reports:', err);
        setError(err.response?.data?.error || 'Failed to fetch reports. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [page, rowsPerPage, searchTerm, statusFilter, sortBy, sortOrder]);

  // Export monthly reports as CSV
  const exportMonthlyReports = async () => {
    try {
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const response = await api.get(`/reports/monthly?month=${month}&year=${year}&format=csv`, {
        responseType: 'blob'
      });

      // Create download
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reports_${year}_${month.toString().padStart(2, '0')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting reports:', err);
      setError(err.response?.data?.error || 'Failed to export reports. Please try again.');
    }
  };

  // Status color mapping
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#ff9800';
      case 'investigating': return '#2196f3';
      case 'resolved': return '#4caf50';
      case 'dismissed': return '#757575';
      default: return '#757575';
    }
  };

  const handleOpen = useCallback((report) => {
    setSelectedReport(report);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleSearch = () => {
    setPage(0);
    // The useEffect will automatically trigger when searchTerm changes
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

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
        
        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {/* Controls Row */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
          {/* Search Bar */}
          <div className="search-container" style={{ flex: 1 }}>
            <TextField
              placeholder="Search Reports"
              variant="outlined"
              fullWidth
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-field"
            />
            <Button 
              className="search-button"
              onClick={handleSearch}
            >
              <SearchIcon />
            </Button>
          </div>
          
          {/* Status Filter */}
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="investigating">Investigating</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="dismissed">Dismissed</MenuItem>
            </Select>
          </FormControl>
          
          {/* Sort By Filter */}
          <FormControl sx={{ minWidth: 140 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              label="Sort By"
              onChange={(e) => setSortBy(e.target.value)}
            >
              <MenuItem value="reportID">Report ID</MenuItem>
              <MenuItem value="dateReported">Date Reported</MenuItem>
              <MenuItem value="status">Status</MenuItem>
              <MenuItem value="franchiseeName">Franchisee</MenuItem>
            </Select>
          </FormControl>
          
          {/* Sort Order Filter */}
          <FormControl sx={{ minWidth: 100 }}>
            <InputLabel>Order</InputLabel>
            <Select
              value={sortOrder}
              label="Order"
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <MenuItem value="asc">Ascending</MenuItem>
              <MenuItem value="desc">Descending</MenuItem>
            </Select>
          </FormControl>
          
          {/* Export Button */}
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportMonthlyReports}
          >
            Export CSV
          </Button>
        </div>
        
        {/* Reports Table */}
        <TableContainer component={Paper} className="table-container" elevation={2}>
          {loading && (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress />
            </Box>
          )}
          
          <Table stickyHeader aria-label="reports table">
            <TableHead>
              <TableRow>
                <StyledTableCell>Report ID</StyledTableCell>
                <StyledTableCell>Franchisee Name</StyledTableCell>
                <StyledTableCell>Date and Time Reported</StyledTableCell>
                <StyledTableCell>Status</StyledTableCell>
                <StyledTableCell>Action</StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && reports.length > 0 ? (
                reports.map((report) => (
                  <StyledTableRow 
                    key={report.reportID}
                    onClick={() => handleOpen(report)}
                  >
                    <StyledTableCell>{report.reportID}</StyledTableCell>
                    <StyledTableCell>{report.franchiseeName}</StyledTableCell>
                    <StyledTableCell>{formatDate(report.dateReported)}</StyledTableCell>
                    <StyledTableCell>
                      <Chip 
                        label={report.status} 
                        size="small"
                        sx={{ 
                          bgcolor: getStatusColor(report.status),
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      />
                    </StyledTableCell>
                    <StyledTableCell>
                      <IconButton 
                        size="small"
                        sx={{ color: '#0a3161' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpen(report);
                        }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </StyledTableCell>
                  </StyledTableRow>
                ))
              ) : (
                <StyledTableRow>
                  <StyledTableCell colSpan={5} align="center">
                    {loading ? 'Loading...' : 'No reports found'}
                  </StyledTableCell>
                </StyledTableRow>
              )}
            </TableBody>
          </Table>
          
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalReports}
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
                    {selectedReport.reportID}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Status
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Chip 
                      label={selectedReport.status} 
                      color={getStatusColor(selectedReport.status)}
                      size="small"
                    />
                  </Box>
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
                    Date Reported
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {formatDate(selectedReport.dateReported)}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Amount Charged
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    ₱{selectedReport.amountCharged?.toFixed(2)}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Expected Fare
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    ₱{selectedReport.expectedFare?.toFixed(2)}
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
