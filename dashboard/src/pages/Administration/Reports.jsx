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
  Grid,
  Alert,
  CircularProgress,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Badge
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
      case 'pending': return 'warning';
      case 'investigating': return 'info';
      case 'resolved': return 'success';
      case 'dismissed': return 'default';
      default: return 'default';
    }
  };


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
    maxHeight: '90vh',
    overflow: 'auto'
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
          <Box sx={modalStyle}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography id="modal-title" variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
                Report Details
              </Typography>
              <IconButton onClick={handleClose} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
            <Divider sx={{ mb: 3 }} />
            
            {selectedReport && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                    Report ID
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedReport.id}
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
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
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
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                    Amount Charged
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    ${selectedReport.amountCharged.toFixed(2)}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                    Expected Fare
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    ${selectedReport.expectedFare.toFixed(2)}
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedReport.description}
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                    Reporter's Contact
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedReport.reporterContact}
                  </Typography>
                </Grid>
              </Grid>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button 
                variant="contained" 
                onClick={handleClose}
                sx={{
                  bgcolor: '#0a3161',
                  '&:hover': {
                    bgcolor: '#082548'
                  }
                }}
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
