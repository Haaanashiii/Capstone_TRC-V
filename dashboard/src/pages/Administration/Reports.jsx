import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '../../Styles/Administrator_Css/Reports.css';
import Sidebar from './Sidebar';
import websocketService from '../../services/websocket';
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
  CircularProgress,
  IconButton,
  InputAdornment,
  Chip,
  Alert,
  tableCellClasses,
  Divider
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import GroupsIcon from '@mui/icons-material/Groups';

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
  const [selectedFranchise, setSelectedFranchise] = useState(null);
  const [openViewModal, setOpenViewModal] = useState(false);
  const [openBulkModal, setOpenBulkModal] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [franchises, setFranchises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalFranchises, setTotalFranchises] = useState(0);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);

  // Get auth token
  const getAuthToken = () => {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
  };

  // Load approved franchises
  const loadFranchises = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = getAuthToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Build query params
      const queryParams = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm,
      });

      if (startDate) {
        queryParams.append('startDate', startDate.toISOString());
      }
      if (endDate) {
        queryParams.append('endDate', endDate.toISOString());
      }

      const response = await fetch(`${API_BASE_URL}/api/franchise-information?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const franchiseData = result.data || [];
      
      // Filter only SB approved franchises
      const approvedFranchises = franchiseData.filter(f => 
        f.status === 'active' || f.sbApprovedAt
      );

      setFranchises(approvedFranchises);
      setTotalFranchises(approvedFranchises.length);
    } catch (err) {
      console.error('Error fetching franchises:', err);
      setError('Failed to fetch franchises. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, startDate, endDate]);

  // Setup WebSocket real-time updates
  useEffect(() => {
    loadFranchises();

    // Connect to WebSocket for real-time updates
    if (!websocketService.isConnected()) {
      console.log('[Reports] Connecting to WebSocket');
      websocketService.connect('general')
    }

    // Subscribe to franchise updates
    const handleFranchiseUpdates = () => {
      console.log('[Reports] WebSocket update - approved-franchises');
      loadFranchises();
    };

    websocketService.on('approved-franchises', handleFranchiseUpdates);
    websocketService.on('franchise-approved', handleFranchiseUpdates);

    return () => {
      websocketService.off('approved-franchises', handleFranchiseUpdates);
      websocketService.off('franchise-approved', handleFranchiseUpdates);
    };
  }, [loadFranchises]);

  // Filtered franchises based on search and date range
  const filteredFranchises = useMemo(() => {
    let filtered = [...franchises];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        f =>
          f.operatorName?.toLowerCase().includes(term) ||
          f.franchiseNumber?.toLowerCase().includes(term) ||
          f.mvPlateNo?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [franchises, searchTerm]);

  // Handle view franchise details
  const handleViewFranchise = useCallback((franchise) => {
    setSelectedFranchise(franchise);
    setOpenViewModal(true);
  }, []);

  const handleCloseViewModal = useCallback(() => {
    setOpenViewModal(false);
    setSelectedFranchise(null);
  }, []);

  // Handle download individual certificate
  const handleDownloadCertificate = async (franchise) => {
    setDownloadingPdf(true);
    try {
      const token = getAuthToken();
      // TODO: Connect to PDF generation endpoint
      // const response = await fetch(`${API_BASE_URL}/api/certificates/${franchise._id}`, {
      //   headers: { 'Authorization': `Bearer ${token}` }
      // });
      
      console.log('Download certificate for:', franchise.franchiseNumber);
      alert('PDF generation will be connected later');
    } catch (err) {
      console.error('Error downloading certificate:', err);
      setError('Failed to download certificate');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Handle bulk preview
  const handleBulkPreview = useCallback(() => {
    setOpenBulkModal(true);
  }, []);

  const handleCloseBulkModal = useCallback(() => {
    setOpenBulkModal(false);
  }, []);

  // Handle bulk download
  const handleBulkDownload = async () => {
    setBulkDownloading(true);
    try {
      const token = getAuthToken();
      const franchiseIds = filteredFranchises.map(f => f._id);
      
      // TODO: Connect to bulk PDF generation endpoint
      // const response = await fetch(`${API_BASE_URL}/api/certificates/bulk`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${token}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({ franchiseIds, startDate, endDate })
      // });
      
      console.log('Bulk download for', filteredFranchises.length, 'franchises');
      alert('Bulk PDF generation will be connected later');
    } catch (err) {
      console.error('Error downloading bulk certificates:', err);
      setError('Failed to download bulk certificates');
    } finally {
      setBulkDownloading(false);
    }
  };

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="reports-container">
      <Sidebar />
      <div className="content-container">
        <div className="header-container">
          <div className="page-title">
            Certificate of Approval Reports
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Controls Section */}
        <Paper className="controls-section" elevation={2}>
          <div className="controls-row">
            {/* Search Bar */}
            <TextField
              placeholder="Search by Name, Franchise #, or Plate #"
              variant="outlined"
              size="medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-field"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#0A356B' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 1, minWidth: '300px' }}
            />

            {/* Date Range Picker */}
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="medium"
                    sx={{ minWidth: '180px' }}
                  />
                )}
                slotProps={{
                  textField: {
                    size: 'medium',
                    sx: { minWidth: '180px' }
                  }
                }}
              />
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                minDate={startDate}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="medium"
                    sx={{ minWidth: '180px' }}
                  />
                )}
                slotProps={{
                  textField: {
                    size: 'medium',
                    sx: { minWidth: '180px' }
                  }
                }}
              />
            </LocalizationProvider>

            {/* Bulk Actions Button */}
            <Button
              variant="contained"
              startIcon={<GroupsIcon />}
              onClick={handleBulkPreview}
              disabled={filteredFranchises.length === 0}
              sx={{
                bgcolor: '#0A356B',
                '&:hover': { bgcolor: '#083057' },
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
              }}
            >
              Bulk Report ({filteredFranchises.length})
            </Button>
          </div>

          {/* Summary Info */}
          <div className="summary-info">
            <Chip
              icon={<CalendarTodayIcon />}
              label={`Total Franchises: ${filteredFranchises.length}`}
              sx={{
                bgcolor: '#e3f2fd',
                color: '#0A356B',
                fontWeight: 600,
              }}
            />
            {(startDate || endDate) && (
              <Chip
                label={`Date Range: ${startDate ? formatDate(startDate) : 'All'} - ${endDate ? formatDate(endDate) : 'All'}`}
                onDelete={() => {
                  setStartDate(null);
                  setEndDate(null);
                }}
                sx={{
                  bgcolor: '#fff3e0',
                  color: '#e65100',
                  fontWeight: 600,
                }}
              />
            )}
          </div>
        </Paper>

        {/* Franchises Table */}
        <Paper className="table-container" elevation={2}>
          {loading && (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          )}

          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader aria-label="approved franchises table">
              <TableHead>
                <TableRow>
                  <StyledTableCell>Franchise Number</StyledTableCell>
                  <StyledTableCell>Operator Name</StyledTableCell>
                  <StyledTableCell>Plate Number</StyledTableCell>
                  <StyledTableCell>Date Approved</StyledTableCell>
                  <StyledTableCell>Resolution Number</StyledTableCell>
                  <StyledTableCell>Actions</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!loading && filteredFranchises.length > 0 ? (
                  filteredFranchises
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((franchise) => (
                      <StyledTableRow
                        key={franchise._id}
                        onClick={() => handleViewFranchise(franchise)}
                      >
                        <StyledTableCell sx={{ fontWeight: 600, color: '#0A356B' }}>
                          {franchise.franchiseNumber}
                        </StyledTableCell>
                        <StyledTableCell>{franchise.operatorName}</StyledTableCell>
                        <StyledTableCell>{franchise.mvPlateNo}</StyledTableCell>
                        <StyledTableCell>{formatDate(franchise.sbApprovedAt || franchise.createdAt)}</StyledTableCell>
                        <StyledTableCell>
                          {franchise.sbResolutionNumber || 'N/A'}
                        </StyledTableCell>
                        <StyledTableCell>
                          <IconButton
                            size="small"
                            sx={{ color: '#0A356B', mr: 1 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewFranchise(franchise);
                            }}
                            title="View Details"
                          >
                            <VisibilityIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            sx={{ color: '#d32f2f' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadCertificate(franchise);
                            }}
                            disabled={downloadingPdf}
                            title="Download Certificate"
                          >
                            <PictureAsPdfIcon />
                          </IconButton>
                        </StyledTableCell>
                      </StyledTableRow>
                    ))
                ) : (
                  <StyledTableRow>
                    <StyledTableCell colSpan={6} align="center">
                      {loading ? 'Loading...' : 'No approved franchises found'}
                    </StyledTableCell>
                  </StyledTableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={filteredFranchises.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>

        {/* View Franchise Details Modal */}
        <Modal open={openViewModal} onClose={handleCloseViewModal}>
          <Box className="modal-container">
            <div className="modal-header">
              <Typography variant="h5" component="h2" sx={{ fontWeight: 700, color: '#0A356B' }}>
                Certificate of Approval Details
              </Typography>
              <IconButton onClick={handleCloseViewModal}>
                <CloseIcon />
              </IconButton>
            </div>

            {selectedFranchise && (
              <>
                <Divider sx={{ my: 2 }} />
                
                <div className="modal-content">
                  {/* Franchise Information */}
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#0A356B', mb: 2 }}>
                    Franchise Information
                  </Typography>
                  
                  <div className="info-grid">
                    <div className="info-item">
                      <Typography variant="subtitle2" className="label">Franchise Number:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {selectedFranchise.franchiseNumber}
                      </Typography>
                    </div>

                    <div className="info-item">
                      <Typography variant="subtitle2" className="label">Resolution Number:</Typography>
                      <Typography variant="body1">
                        {selectedFranchise.sbResolutionNumber || 'N/A'}
                      </Typography>
                    </div>

                    <div className="info-item">
                      <Typography variant="subtitle2" className="label">Operator Name:</Typography>
                      <Typography variant="body1">{selectedFranchise.operatorName}</Typography>
                    </div>

                    <div className="info-item">
                      <Typography variant="subtitle2" className="label">Address:</Typography>
                      <Typography variant="body1">{selectedFranchise.operatorAddress}</Typography>
                    </div>

                    <div className="info-item">
                      <Typography variant="subtitle2" className="label">Contact Number:</Typography>
                      <Typography variant="body1">{selectedFranchise.operatorContactNumber}</Typography>
                    </div>

                    <div className="info-item">
                      <Typography variant="subtitle2" className="label">Date Approved:</Typography>
                      <Typography variant="body1">
                        {formatDate(selectedFranchise.sbApprovedAt || selectedFranchise.createdAt)}
                      </Typography>
                    </div>
                  </div>

                  <Divider sx={{ my: 3 }} />

                  {/* Vehicle Information */}
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#0A356B', mb: 2 }}>
                    Vehicle Information
                  </Typography>

                  <div className="info-grid">
                    <div className="info-item">
                      <Typography variant="subtitle2" className="label">Plate Number:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {selectedFranchise.mvPlateNo}
                      </Typography>
                    </div>

                    <div className="info-item">
                      <Typography variant="subtitle2" className="label">Unit Model:</Typography>
                      <Typography variant="body1">{selectedFranchise.unitModel}</Typography>
                    </div>

                    <div className="info-item">
                      <Typography variant="subtitle2" className="label">Engine Number:</Typography>
                      <Typography variant="body1">{selectedFranchise.motorEngineNo}</Typography>
                    </div>

                    <div className="info-item">
                      <Typography variant="subtitle2" className="label">Chassis Number:</Typography>
                      <Typography variant="body1">{selectedFranchise.chasisNo}</Typography>
                    </div>

                    <div className="info-item">
                      <Typography variant="subtitle2" className="label">Motor Color:</Typography>
                      <Typography variant="body1">{selectedFranchise.colorMotor}</Typography>
                    </div>

                    <div className="info-item">
                      <Typography variant="subtitle2" className="label">Sidecar Color:</Typography>
                      <Typography variant="body1">{selectedFranchise.sideCarColor}</Typography>
                    </div>
                  </div>
                </div>

                <Divider sx={{ my: 2 }} />

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
                  <Button
                    variant="outlined"
                    onClick={handleCloseViewModal}
                    sx={{ textTransform: 'none' }}
                  >
                    Close
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={downloadingPdf ? <CircularProgress size={20} /> : <PictureAsPdfIcon />}
                    onClick={() => handleDownloadCertificate(selectedFranchise)}
                    disabled={downloadingPdf}
                    sx={{
                      bgcolor: '#d32f2f',
                      '&:hover': { bgcolor: '#b71c1c' },
                      textTransform: 'none',
                    }}
                  >
                    Download Certificate
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </Modal>

        {/* Bulk Report Modal */}
        <Modal open={openBulkModal} onClose={handleCloseBulkModal}>
          <Box className="modal-container">
            <div className="modal-header">
              <Typography variant="h5" component="h2" sx={{ fontWeight: 700, color: '#0A356B' }}>
                Bulk Certificate Report - Plenary Session
              </Typography>
              <IconButton onClick={handleCloseBulkModal}>
                <CloseIcon />
              </IconButton>
            </div>

            <Divider sx={{ my: 2 }} />

            <div className="modal-content">
              <Alert severity="info" sx={{ mb: 3 }}>
                This will generate a consolidated PDF report of all {filteredFranchises.length} approved franchises
                {(startDate || endDate) && ' within the selected date range'} for the plenary session.
              </Alert>

              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Report Summary
              </Typography>

              <div className="info-grid">
                <div className="info-item">
                  <Typography variant="subtitle2" className="label">Total Franchises:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {filteredFranchises.length}
                  </Typography>
                </div>

                {startDate && (
                  <div className="info-item">
                    <Typography variant="subtitle2" className="label">Start Date:</Typography>
                    <Typography variant="body1">{formatDate(startDate)}</Typography>
                  </div>
                )}

                {endDate && (
                  <div className="info-item">
                    <Typography variant="subtitle2" className="label">End Date:</Typography>
                    <Typography variant="body1">{formatDate(endDate)}</Typography>
                  </div>
                )}

                <div className="info-item">
                  <Typography variant="subtitle2" className="label">Report Type:</Typography>
                  <Typography variant="body1">Certificate of Approval - Bulk</Typography>
                </div>
              </div>

              <Divider sx={{ my: 3 }} />

              {/* Preview List */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Franchises to be included:
              </Typography>
              <Box sx={{ maxHeight: '200px', overflowY: 'auto', bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                {filteredFranchises.slice(0, 10).map((franchise, index) => (
                  <Typography key={franchise._id} variant="body2" sx={{ mb: 0.5 }}>
                    {index + 1}. {franchise.franchiseNumber} - {franchise.operatorName}
                  </Typography>
                ))}
                {filteredFranchises.length > 10 && (
                  <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 1 }}>
                    ... and {filteredFranchises.length - 10} more
                  </Typography>
                )}
              </Box>
            </div>

            <Divider sx={{ my: 2 }} />

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
              <Button
                variant="outlined"
                onClick={handleCloseBulkModal}
                sx={{ textTransform: 'none' }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={bulkDownloading ? <CircularProgress size={20} /> : <DownloadIcon />}
                onClick={handleBulkDownload}
                disabled={bulkDownloading}
                sx={{
                  bgcolor: '#0A356B',
                  '&:hover': { bgcolor: '#083057' },
                  textTransform: 'none',
                }}
              >
                Generate & Download PDF
              </Button>
            </Box>
          </Box>
        </Modal>
      </div>
    </div>
  );
}

export default Reports;
