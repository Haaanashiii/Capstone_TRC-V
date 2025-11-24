/**
 * Reports Component - Certificate Generation System
 * 
 * This component provides comprehensive certificate generation capabilities for franchise management:
 * 
 * CERTIFICATE TYPES SUPPORTED:
 * 1. C.001 - Certificate of Approval (Fillable PDF)
 *    - Issued when a franchise is approved by SB
 *    - Pre-filled with franchise and operator details
 * 
 * 2. C.001 - Certificate of Cancellation (Fillable PDF)
 *    - Issued when a franchise is cancelled
 *    - Includes cancellation reason and date
 * 
 * 3. F.008 - Application for Provisional Authority (Fillable PDF)
 *    - For temporary operating permits
 *    - Includes provisional terms and conditions
 * 
 * 4. F.008 - MTOF Date Report (Word Document)
 *    - Motorized Tricycle-for-Hire report grouped by date
 *    - Tables organized by application type (new, renewal, amendment)
 *    - Includes: Name, Franchise Number, Address
 * 
 * 5. F.008 - MTOF Summary Report (Word Document)
 *    - Summary certification statement
 *    - Statistics: new applicants, renewals, provisional authorities
 *    - Editable template text
 * 
 * FEATURES:
 * - Real-time data from franchise information database
 * - Preview and edit capability before generating
 * - Print preview functionality
 * - Current user information automatically included
 * - Professional formatting matching municipal standards
 * - Date range filtering for bulk reports
 * - Search and filter capabilities
 * 
 * WORKFLOW:
 * 1. Select franchise(s) from the table
 * 2. Click "Generate Certificate" button
 * 3. Choose certificate type from menu
 * 4. Review and edit pre-filled data in preview modal
 * 5. Print or download as PDF/Word document
 * 
 * @component
 * @requires useAuth - For current administrator information
 * @requires websocketService - For real-time franchise updates
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '../../Styles/Administrator_Css/Reports.css';
import Sidebar from './Sidebar';
import websocketService from '../../services/websocket';
import { useAuth } from '../../contexts/AuthContext';
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
  Divider,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
  Checkbox,
  FormControlLabel
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
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ArticleIcon from '@mui/icons-material/Article';

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

// Certificate types configuration
const CERTIFICATE_TYPES = {
  APPROVAL: {
    id: 'C.001-APPROVAL',
    name: 'Certificate of Approval',
    code: 'C.001',
    description: 'Certificate of Approval for Franchise',
    icon: CheckCircleIcon,
    fileType: 'pdf',
    fillable: true
  },
  CANCELLATION: {
    id: 'C.001-CANCELLATION',
    name: 'Certificate of Cancellation',
    code: 'C.001',
    description: 'Certificate of Cancellation for Franchise',
    icon: CancelIcon,
    fileType: 'pdf',
    fillable: true
  },
  PROVISIONAL: {
    id: 'F.008-PROVISIONAL',
    name: 'Provisional Authority',
    code: 'F.008',
    description: 'Application for Provisional Authority',
    icon: ArticleIcon,
    fileType: 'pdf',
    fillable: true
  },
  MTOF_DATE: {
    id: 'F.008-MTOF-DATE',
    name: 'MTOF Date Report',
    code: 'F.008',
    description: 'Motorized Tricycle-for-Hire Date Report (Word)',
    icon: DescriptionIcon,
    fileType: 'docx',
    fillable: false
  },
  MTOF_SUMMARY: {
    id: 'F.008-MTOF-SUMMARY',
    name: 'MTOF Summary Report',
    code: 'F.008',
    description: 'Motorized Tricycle-for-Hire Summary (Word)',
    icon: DescriptionIcon,
    fileType: 'docx',
    fillable: false
  }
};

function Reports() {
  const { user } = useAuth(); // Get current user for certificate generation
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
  
  // Certificate generation states
  const [selectedCertType, setSelectedCertType] = useState('');
  const [openCertModal, setOpenCertModal] = useState(false);
  const [openPreviewModal, setOpenPreviewModal] = useState(false);
  const [certificateData, setCertificateData] = useState(null);
  const [editableData, setEditableData] = useState({});
  const [generating, setGenerating] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedFranchisesForCert, setSelectedFranchisesForCert] = useState([]);

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

  // Format user role for display
  const formatUserRole = (role) => {
    const roleMap = {
      'sb-admin': 'Sangguniang Bayan Administrator',
      'bplo-admin': 'BPLO Administrator',
      'super-admin': 'System Administrator'
    };
    return roleMap[role] || role;
  };

  // Handle certificate type selection menu
  const handleCertMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCertMenuClose = () => {
    setAnchorEl(null);
  };

  // Handle certificate type selection
  const handleSelectCertType = (certType) => {
    setSelectedCertType(certType);
    setAnchorEl(null);
    
    if (certType === CERTIFICATE_TYPES.MTOF_DATE.id || certType === CERTIFICATE_TYPES.MTOF_SUMMARY.id) {
      // For MTOF reports, use all filtered franchises
      setSelectedFranchisesForCert(filteredFranchises);
      prepareAndOpenCertModal(certType, filteredFranchises);
    } else {
      // For individual certificates, open selection modal
      setOpenCertModal(true);
    }
  };

  // Prepare certificate data and open modal
  const prepareAndOpenCertModal = (certType, franchises) => {
    const certConfig = Object.values(CERTIFICATE_TYPES).find(c => c.id === certType);
    
    if (!certConfig) return;

    // Prepare data based on certificate type
    let preparedData = {
      certificateType: certConfig,
      generatedBy: user?.name || 'Administrator',
      generatedByRole: formatUserRole(user?.role || ''),
      generatedById: user?.id || '',
      dateGenerated: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      timeGenerated: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      municipalityName: 'Municipality of Solano, Nueva Vizcaya',
    };

    if (certType === CERTIFICATE_TYPES.MTOF_DATE.id) {
      // Group franchises by application type
      const grouped = {
        new: franchises.filter(f => f.applicationType === 'new'),
        renewal: franchises.filter(f => f.applicationType === 'renewal'),
        amendment: franchises.filter(f => f.applicationType === 'amendment' || f.applicationType === 'transfer')
      };
      
      preparedData.franchises = franchises;
      preparedData.grouped = grouped;
      preparedData.reportTitle = 'Motorized Tricycle-for-Hire Date Report';
    } else if (certType === CERTIFICATE_TYPES.MTOF_SUMMARY.id) {
      // Summary statistics
      const stats = {
        newCount: franchises.filter(f => f.applicationType === 'new').length,
        renewalCount: franchises.filter(f => f.applicationType === 'renewal').length,
        provisionalCount: franchises.filter(f => f.status === 'provisional').length,
        totalCount: franchises.length
      };
      
      preparedData.stats = stats;
      preparedData.reportTitle = 'Motorized Tricycle-for-Hire Summary Report';
      preparedData.summaryText = `THIS IS TO CERTIFY that there are ${stats.newCount} (${numberToWords(stats.newCount)}) new applicants, ${stats.renewalCount} (${numberToWords(stats.renewalCount)}) applications for renewal and ${stats.provisionalCount} (${numberToWords(stats.provisionalCount)}) units for provisional authority to operate motorized-tricycle-for-hire within Solano, Nueva Vizcaya.`;
    } else {
      // Individual certificate (Approval, Cancellation, Provisional)
      preparedData.franchise = selectedFranchise;
    }

    setCertificateData(preparedData);
    setEditableData(preparedData);
    setOpenPreviewModal(true);
  };

  // Convert number to words helper
  const numberToWords = (num) => {
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
                   'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    if (num < 20) return words[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? '-' + words[num % 10] : '');
    if (num < 1000) return words[Math.floor(num / 100)] + ' hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
    return num.toString();
  };

  // Handle certificate generation for individual franchise
  const handleGenerateCertificate = (franchise, certType) => {
    setSelectedFranchise(franchise);
    setSelectedCertType(certType);
    setOpenCertModal(false);
    prepareAndOpenCertModal(certType, [franchise]);
  };

  // Handle final certificate generation and download
  const handleFinalGenerate = async () => {
    setGenerating(true);
    try {
      const token = getAuthToken();
      const certConfig = Object.values(CERTIFICATE_TYPES).find(c => c.id === selectedCertType);
      
      if (!certConfig) {
        throw new Error('Invalid certificate type');
      }

      // Prepare request payload
      const payload = {
        certificateType: selectedCertType,
        data: editableData,
        format: certConfig.fileType
      };

      const response = await fetch(`${API_BASE_URL}/api/reports/generate-certificate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certConfig.code}_${editableData.franchise?.franchiseNumber || 'Report'}_${Date.now()}.${certConfig.fileType}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setOpenPreviewModal(false);
      setError('');
      alert('Certificate generated successfully!');
    } catch (err) {
      console.error('Error generating certificate:', err);
      setError('Failed to generate certificate. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Handle print certificate
  const handlePrintCertificate = () => {
    window.print();
  };

  // Handle edit field change
  const handleEditFieldChange = (field, value) => {
    setEditableData(prev => ({
      ...prev,
      [field]: value
    }));
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

            {/* Generate Certificate Button */}
            <Button
              variant="contained"
              startIcon={<ArticleIcon />}
              onClick={handleCertMenuClick}
              disabled={filteredFranchises.length === 0}
              sx={{
                bgcolor: '#2e7d32',
                '&:hover': { bgcolor: '#1b5e20' },
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
              }}
            >
              Generate Certificate
            </Button>

            {/* Certificate Type Menu */}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleCertMenuClose}
              PaperProps={{
                sx: {
                  mt: 1,
                  minWidth: '320px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                }
              }}
            >
              <MenuItem disabled sx={{ opacity: 1, fontWeight: 600, color: '#0A356B' }}>
                Select Certificate Type
              </MenuItem>
              <Divider sx={{ my: 1 }} />
              {Object.values(CERTIFICATE_TYPES).map((cert) => {
                const Icon = cert.icon;
                return (
                  <MenuItem
                    key={cert.id}
                    onClick={() => handleSelectCertType(cert.id)}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      py: 1.5,
                      '&:hover': { bgcolor: 'rgba(10, 53, 107, 0.08)' }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 0.5 }}>
                      <Icon sx={{ mr: 1, color: '#0A356B', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {cert.name}
                      </Typography>
                      <Chip 
                        label={cert.fileType.toUpperCase()} 
                        size="small" 
                        sx={{ ml: 'auto', height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', ml: 3.5 }}>
                      {cert.description}
                    </Typography>
                  </MenuItem>
                );
              })}
            </Menu>
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
                            sx={{ color: '#2e7d32', mr: 1 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFranchise(franchise);
                              setOpenCertModal(true);
                            }}
                            title="Generate Certificate"
                          >
                            <ArticleIcon />
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

        {/* Certificate Type Selection Modal */}
        <Modal open={openCertModal} onClose={() => setOpenCertModal(false)}>
          <Box className="modal-container">
            <div className="modal-header">
              <Typography variant="h5" component="h2" sx={{ fontWeight: 700, color: '#0A356B' }}>
                Select Certificate Type
              </Typography>
              <IconButton onClick={() => setOpenCertModal(false)}>
                <CloseIcon />
              </IconButton>
            </div>

            <Divider sx={{ my: 2 }} />

            {selectedFranchise && (
              <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Selected Franchise:
                </Typography>
                <Typography variant="body2">
                  <strong>Franchise #:</strong> {selectedFranchise.franchiseNumber}
                </Typography>
                <Typography variant="body2">
                  <strong>Operator:</strong> {selectedFranchise.operatorName}
                </Typography>
                <Typography variant="body2">
                  <strong>Plate #:</strong> {selectedFranchise.mvPlateNo}
                </Typography>
              </Box>
            )}

            <Grid container spacing={2}>
              {Object.values(CERTIFICATE_TYPES).filter(cert => 
                cert.id !== CERTIFICATE_TYPES.MTOF_DATE.id && 
                cert.id !== CERTIFICATE_TYPES.MTOF_SUMMARY.id
              ).map((cert) => {
                const Icon = cert.icon;
                return (
                  <Grid item xs={12} key={cert.id}>
                    <Paper
                      elevation={2}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: '2px solid transparent',
                        '&:hover': {
                          borderColor: '#0A356B',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(10, 53, 107, 0.2)'
                        }
                      }}
                      onClick={() => handleGenerateCertificate(selectedFranchise, cert.id)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Icon sx={{ mr: 2, color: '#0A356B', fontSize: 32 }} />
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {cert.name}
                            </Typography>
                            <Chip 
                              label={cert.code} 
                              size="small" 
                              sx={{ ml: 1, bgcolor: '#0A356B', color: 'white' }}
                            />
                            <Chip 
                              label={cert.fillable ? 'Fillable' : 'Template'} 
                              size="small" 
                              sx={{ ml: 1 }}
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {cert.description}
                          </Typography>
                        </Box>
                        <Chip 
                          label={cert.fileType.toUpperCase()} 
                          color="primary" 
                          size="small"
                        />
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => setOpenCertModal(false)}
                sx={{ textTransform: 'none' }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        </Modal>

        {/* Certificate Preview and Edit Modal */}
        <Modal 
          open={openPreviewModal} 
          onClose={() => setOpenPreviewModal(false)}
          sx={{ overflow: 'auto' }}
        >
          <Box 
            className="modal-container" 
            sx={{ 
              maxWidth: '900px', 
              maxHeight: '90vh', 
              overflow: 'auto',
              my: 2 
            }}
          >
            <div className="modal-header">
              <Typography variant="h5" component="h2" sx={{ fontWeight: 700, color: '#0A356B' }}>
                Certificate Preview & Edit
              </Typography>
              <IconButton onClick={() => setOpenPreviewModal(false)}>
                <CloseIcon />
              </IconButton>
            </div>

            <Divider sx={{ my: 2 }} />

            {certificateData && (
              <>
                {/* Certificate Type Info */}
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {certificateData.certificateType?.name} ({certificateData.certificateType?.code})
                  </Typography>
                  <Typography variant="caption">
                    {certificateData.certificateType?.description}
                  </Typography>
                </Alert>

                {/* Editable Fields Section */}
                <Paper elevation={0} sx={{ p: 3, bgcolor: '#f9f9f9', mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#0A356B' }}>
                    <EditIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Editable Certificate Data
                  </Typography>

                  <Grid container spacing={2}>
                    {/* Generator Information */}
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Generated By"
                        value={editableData.generatedBy || ''}
                        onChange={(e) => handleEditFieldChange('generatedBy', e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Position/Role"
                        value={editableData.generatedByRole || ''}
                        onChange={(e) => handleEditFieldChange('generatedByRole', e.target.value)}
                        size="small"
                      />
                    </Grid>

                    {/* Date and Time */}
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Date Generated"
                        value={editableData.dateGenerated || ''}
                        onChange={(e) => handleEditFieldChange('dateGenerated', e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Time Generated"
                        value={editableData.timeGenerated || ''}
                        onChange={(e) => handleEditFieldChange('timeGenerated', e.target.value)}
                        size="small"
                      />
                    </Grid>

                    {/* Municipality Name */}
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Municipality"
                        value={editableData.municipalityName || ''}
                        onChange={(e) => handleEditFieldChange('municipalityName', e.target.value)}
                        size="small"
                      />
                    </Grid>

                    {/* Franchise-specific fields for individual certificates */}
                    {editableData.franchise && (
                      <>
                        <Grid item xs={12}>
                          <Divider sx={{ my: 1 }}>
                            <Chip label="Franchise Details" size="small" />
                          </Divider>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Franchise Number"
                            value={editableData.franchise?.franchiseNumber || ''}
                            size="small"
                            disabled
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Resolution Number"
                            value={editableData.franchise?.sbResolutionNumber || ''}
                            size="small"
                            disabled
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Operator Name"
                            value={editableData.franchise?.operatorName || ''}
                            size="small"
                            disabled
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Address"
                            value={editableData.franchise?.operatorAddress || ''}
                            size="small"
                            disabled
                          />
                        </Grid>
                      </>
                    )}

                    {/* MTOF Summary Text */}
                    {selectedCertType === CERTIFICATE_TYPES.MTOF_SUMMARY.id && (
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          rows={4}
                          label="Summary Statement"
                          value={editableData.summaryText || ''}
                          onChange={(e) => handleEditFieldChange('summaryText', e.target.value)}
                          helperText="Edit the certification text as needed"
                        />
                      </Grid>
                    )}
                  </Grid>
                </Paper>

                {/* Preview Section */}
                <Paper elevation={2} sx={{ p: 3, mb: 3, border: '2px solid #0A356B' }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#0A356B', textAlign: 'center' }}>
                    Preview
                  </Typography>

                  {/* MTOF Date Report Preview */}
                  {selectedCertType === CERTIFICATE_TYPES.MTOF_DATE.id && editableData.grouped && (
                    <Box>
                      <Typography variant="h5" sx={{ textAlign: 'center', mb: 3, fontWeight: 700 }}>
                        {editableData.municipalityName}
                      </Typography>
                      <Typography variant="h6" sx={{ textAlign: 'center', mb: 3 }}>
                        Motorized Tricycle-for-Hire Report
                      </Typography>
                      <Typography variant="body2" sx={{ textAlign: 'right', mb: 3 }}>
                        Date: {editableData.dateGenerated}
                      </Typography>

                      {['new', 'renewal', 'amendment'].map((type) => (
                        editableData.grouped[type]?.length > 0 && (
                          <Box key={type} sx={{ mb: 4 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, textTransform: 'uppercase' }}>
                              {type === 'amendment' ? 'Transfer/Amendment' : type} Applications ({editableData.grouped[type].length})
                            </Typography>
                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <StyledTableCell>Name</StyledTableCell>
                                    <StyledTableCell>Franchise Number</StyledTableCell>
                                    <StyledTableCell>Address</StyledTableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {editableData.grouped[type].map((franchise, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>{franchise.operatorName}</TableCell>
                                      <TableCell>{franchise.franchiseNumber}</TableCell>
                                      <TableCell>{franchise.operatorAddress}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </Box>
                        )
                      ))}

                      <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Typography variant="body2">
                          Prepared by: {editableData.generatedBy}
                        </Typography>
                        <Typography variant="body2">
                          {editableData.generatedByRole}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* MTOF Summary Preview */}
                  {selectedCertType === CERTIFICATE_TYPES.MTOF_SUMMARY.id && (
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
                        {editableData.municipalityName}
                      </Typography>
                      <Typography variant="h6" sx={{ mb: 3 }}>
                        Certificate of Summary
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 4, textAlign: 'justify', px: 4 }}>
                        {editableData.summaryText}
                      </Typography>
                      <Box sx={{ mt: 6 }}>
                        <Typography variant="body2">
                          Prepared by: {editableData.generatedBy}
                        </Typography>
                        <Typography variant="body2">
                          {editableData.generatedByRole}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 2 }}>
                          Date: {editableData.dateGenerated}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Individual Certificate Preview */}
                  {editableData.franchise && (
                    <Box>
                      <Typography variant="h5" sx={{ textAlign: 'center', mb: 3, fontWeight: 700 }}>
                        {editableData.municipalityName}
                      </Typography>
                      <Typography variant="h6" sx={{ textAlign: 'center', mb: 3 }}>
                        {certificateData.certificateType?.name}
                      </Typography>
                      
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                          <strong>Franchise Number:</strong> {editableData.franchise.franchiseNumber}
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                          <strong>Resolution Number:</strong> {editableData.franchise.sbResolutionNumber}
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                          <strong>Operator Name:</strong> {editableData.franchise.operatorName}
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                          <strong>Address:</strong> {editableData.franchise.operatorAddress}
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                          <strong>Plate Number:</strong> {editableData.franchise.mvPlateNo}
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                          <strong>Unit Model:</strong> {editableData.franchise.unitModel}
                        </Typography>
                      </Box>

                      <Box sx={{ mt: 6, textAlign: 'center' }}>
                        <Typography variant="body2">
                          Issued by: {editableData.generatedBy}
                        </Typography>
                        <Typography variant="body2">
                          {editableData.generatedByRole}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 2 }}>
                          Date Issued: {editableData.dateGenerated}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Paper>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 3 }}>
                  <Button
                    variant="outlined"
                    onClick={() => setOpenPreviewModal(false)}
                    sx={{ textTransform: 'none' }}
                  >
                    Cancel
                  </Button>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<PrintIcon />}
                      onClick={handlePrintCertificate}
                      sx={{ textTransform: 'none' }}
                    >
                      Print
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={generating ? <CircularProgress size={20} /> : <DownloadIcon />}
                      onClick={handleFinalGenerate}
                      disabled={generating}
                      sx={{
                        bgcolor: '#2e7d32',
                        '&:hover': { bgcolor: '#1b5e20' },
                        textTransform: 'none',
                      }}
                    >
                      {generating ? 'Generating...' : `Generate ${certificateData.certificateType?.fileType.toUpperCase()}`}
                    </Button>
                  </Box>
                </Box>
              </>
            )}
          </Box>
        </Modal>
      </div>
    </div>
  );
}

export default Reports;
