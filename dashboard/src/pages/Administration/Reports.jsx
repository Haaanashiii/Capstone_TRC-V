import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../../Styles/Administrator_Css/Reports.css';
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
  Grid,
  Alert,
  CircularProgress,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  tableCellClasses,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from '@mui/material';
import { styled } from "@mui/material/styles";
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';

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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';

function Reports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalReports, setTotalReports] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('dateReported');
  const [sortOrder, setSortOrder] = useState('desc');
  const [tempFilters, setTempFilters] = useState({
    status: '',
    sortBy: 'dateReported',
    sortOrder: 'desc'
  });
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Get auth token
  const getAuthToken = () => {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
  };

  // Load reports on component mount and when filters change
  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      setError('');
      
      try {
        const token = getAuthToken();
        if (!token) {
          setError('Authentication required');
          return;
        }

        const queryParams = new URLSearchParams({
          page: page + 1,
          limit: rowsPerPage,
          search: searchTerm,
          status: statusFilter,
          sortBy,
          sortOrder
        });

        const response = await fetch(`${API_BASE_URL}/reports?${queryParams}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setReports(data.reports || []);
        setTotalReports(data.pagination?.total || 0);
      } catch (err) {
        console.error('Error fetching reports:', err);
        setError('Failed to fetch reports. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [page, rowsPerPage, searchTerm, statusFilter, sortBy, sortOrder]);

  // Export monthly reports as CSV
  const exportMonthlyReports = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const response = await fetch(`${API_BASE_URL}/reports/monthly?month=${month}&year=${year}&format=csv`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export reports');
      }

      // Create download
      const blob = await response.blob();
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
      setError('Failed to export reports. Please try again.');
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
    setNewStatus(report.status);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setNewStatus('');
  }, []);

  const handleUpdateStatus = async () => {
    if (!selectedReport || !newStatus) return;
    
    setUpdatingStatus(true);
    try {
      const token = getAuthToken();
      if (!token) {
        setSnackbar({ open: true, message: 'Authentication required', severity: 'error' });
        return;
      }

      const response = await fetch(`${API_BASE_URL}/reports/${selectedReport._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update report status');
      }

      // Update local state
      setReports(prev => prev.map(r => 
        r._id === selectedReport._id ? { ...r, status: newStatus } : r
      ));
      
      setSnackbar({ open: true, message: 'Report status updated successfully', severity: 'success' });
      handleClose();
    } catch (err) {
      console.error('Error updating report status:', err);
      setSnackbar({ open: true, message: 'Failed to update report status', severity: 'error' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleSearch = useCallback(() => {
    setPage(0);
    // The useEffect will automatically trigger when searchTerm changes
  }, []);

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Filter dialog handlers
  const handleCloseFilter = useCallback(() => {
    setFilterOpen(false);
    // Reset temp filters to current filters
    setTempFilters({
      status: statusFilter,
      sortBy: sortBy,
      sortOrder: sortOrder
    });
  }, [statusFilter, sortBy, sortOrder]);

  const handleTempFilterChange = useCallback((field, value) => {
    setTempFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleApplyFilters = useCallback(() => {
    setStatusFilter(tempFilters.status);
    setSortBy(tempFilters.sortBy);
    setSortOrder(tempFilters.sortOrder);
    setPage(0);
    setFilterOpen(false);
  }, [tempFilters]);

  const handleClearFilters = useCallback(() => {
    const defaultFilters = {
      status: '',
      sortBy: 'dateReported',
      sortOrder: 'desc'
    };
    setTempFilters(defaultFilters);
    setStatusFilter('');
    setSortBy('dateReported');
    setSortOrder('desc');
    setPage(0);
  }, []);

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
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
        <Paper className="table-container" elevation={2}>
          {loading && (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress />
            </Box>
          )}
          
          <TableContainer sx={{ maxHeight: 500 }}>
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
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalReports}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
        
        {/* Filter Dialog */}
        <Dialog 
          open={filterOpen} 
          onClose={handleCloseFilter}
          maxWidth="sm"
          fullWidth
          className="filter-dialog"
          PaperProps={{
            className: "filter-dialog-paper"
          }}
        >
          <DialogTitle className="filter-dialog-title">
            Filter Reports
            <IconButton
              onClick={handleCloseFilter}
              className="filter-close-button"
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent className="filter-dialog-content">
            <Grid container spacing={3}>
              {/* Status Filter */}
              <Grid item xs={12}>
                <FormControl fullWidth className="filter-form-control">
                  <InputLabel id="status-filter-label">Status</InputLabel>
                  <Select
                    labelId="status-filter-label"
                    value={tempFilters.status}
                    label="Status"
                    onChange={(e) => handleTempFilterChange('status', e.target.value)}
                    className="filter-select"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="investigating">Investigating</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                    <MenuItem value="dismissed">Dismissed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Sort By Filter */}
              <Grid item xs={12}>
                <FormControl fullWidth className="filter-form-control">
                  <InputLabel id="sort-by-filter-label">Sort By</InputLabel>
                  <Select
                    labelId="sort-by-filter-label"
                    value={tempFilters.sortBy}
                    label="Sort By"
                    onChange={(e) => handleTempFilterChange('sortBy', e.target.value)}
                    className="filter-select"
                  >
                    <MenuItem value="reportID">Report ID</MenuItem>
                    <MenuItem value="dateReported">Date Reported</MenuItem>
                    <MenuItem value="status">Status</MenuItem>
                    <MenuItem value="franchiseeName">Franchisee Name</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Sort Order Filter */}
              <Grid item xs={12}>
                <FormControl fullWidth className="filter-form-control">
                  <InputLabel id="sort-order-filter-label">Sort Order</InputLabel>
                  <Select
                    labelId="sort-order-filter-label"
                    value={tempFilters.sortOrder}
                    label="Sort Order"
                    onChange={(e) => handleTempFilterChange('sortOrder', e.target.value)}
                    className="filter-select"
                  >
                    <MenuItem value="asc">Ascending</MenuItem>
                    <MenuItem value="desc">Descending</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          
          <DialogActions className="filter-dialog-actions">
            <Button 
              onClick={handleClearFilters}
              className="filter-clear-button"
            >
              Clear All
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button 
              onClick={handleCloseFilter}
              variant="outlined"
              className="filter-cancel-button"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleApplyFilters}
              variant="contained"
              className="filter-apply-button"
            >
              Apply Filters
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Modal for displaying report details */}
        <Modal
          open={open}
          onClose={handleClose}
          aria-labelledby="report-details-modal"
        >
          <Box className="modal-container">
            <div className="modal-header">
              <Typography variant="h5" component="h2">
                REPORT DETAILS
              </Typography>
              <IconButton onClick={handleClose}>
                <CloseIcon />
              </IconButton>
            </div>
            
            {selectedReport && (
              <>
                <Typography variant="h6" className="section-header">
                  REPORT INFORMATION
                </Typography>
                
                <div className="info-grid">
                  <Typography variant="subtitle2" className="label">Report ID:</Typography>
                  <Typography>{selectedReport.reportID}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Franchisee:</Typography>
                  <Typography>{selectedReport.franchiseeName}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Date:</Typography>
                  <Typography>{formatDate(selectedReport.dateReported)}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Contact:</Typography>
                  <Typography>{selectedReport.reporterContact}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Charged:</Typography>
                  <Typography>₱{selectedReport.amountCharged?.toFixed(2)}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Expected:</Typography>
                  <Typography>₱{selectedReport.expectedFare?.toFixed(2)}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Description:</Typography>
                  <Typography sx={{ gridColumn: '2' }}>{selectedReport.description}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Status:</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <Select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                      >
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="investigating">Investigating</MenuItem>
                        <MenuItem value="resolved">Resolved</MenuItem>
                        <MenuItem value="dismissed">Dismissed</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleUpdateStatus}
                      disabled={updatingStatus || newStatus === selectedReport.status}
                      sx={{
                        bgcolor: '#0a3161',
                        '&:hover': { bgcolor: '#082548' },
                        '&:disabled': { bgcolor: '#ccc' }
                      }}
                    >
                      {updatingStatus ? <CircularProgress size={20} /> : 'Update'}
                    </Button>
                  </Box>
                </div>
              </>
            )}
          </Box>
        </Modal>
        
        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </div>
    </div>
  );
}

export default Reports;
