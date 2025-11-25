/**
 * Certificate Component - Certificate Generation System
 * 
 * This component provides comprehensive certificate generation capabilities for franchise management.
 * 
 * CERTIFICATE TYPES SUPPORTED:
 * 1. C.001 - Certificate of Approval (Fillable PDF)
 *    - Template: C.001 - CERT APPROVED - FILLABLE.pdf
 * 2. C.001 - Certificate of Cancellation (Fillable PDF)
 *    - Template: C.001 - CERT CANCELLED - FILLABLE.pdf
 * 3. F.008 - Certificate of Existing Franchise (Fillable PDF)
 *    - Template: F.008 - CERT EXISTING - FILLABLE.pdf
 * 4. F.008 - MTOF Date Report (Word Document)
 *    - Template: F.008 - MTOF - DATE.docx
 * 5. F.008 - MTOF Summary Report (Word Document)
 *    - Template: F.008 - MTOF DATE SUMMARY.docx
 * 
 * @component
 * @requires useAuth - For current administrator information
 * @requires websocketService - For real-time franchise updates
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '../../Styles/Administrator_Css/Certificate.css';
import '../../Styles/Administrator_Css/SharedTable.css';
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
  Divider,
  Menu,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Tooltip,
  Fade,
  Backdrop,
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
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ArticleIcon from '@mui/icons-material/Article';
import AssignmentIcon from '@mui/icons-material/Assignment';

const StyledModal = styled(Modal)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1300,
});

const ModalContent = styled(Box)({
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  boxShadow: '0 24px 48px rgba(0, 0, 0, 0.16)',
  maxWidth: '900px',
  width: '95%',
  maxHeight: '92vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  outline: 'none',
  position: 'relative',
  zIndex: 1301,
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';

// Certificate types configuration
const CERTIFICATE_TYPES = {
  APPROVAL: {
    id: 'C.001-APPROVAL',
    name: 'Certificate of Approval',
    code: 'C.001',
    description: 'Official approval certificate for franchise application',
    icon: CheckCircleIcon,
    fileType: 'pdf',
    fillable: true,
    template: '/src/assets/C.001 - CERT APPROVED - FILLABLE.pdf',
    color: '#2e7d32'
  },
  CANCELLATION: {
    id: 'C.001-CANCELLATION',
    name: 'Certificate of Cancellation',
    code: 'C.001',
    description: 'Official cancellation certificate for franchise',
    icon: CancelIcon,
    fileType: 'pdf',
    fillable: true,
    template: '/src/assets/C.001 - CERT CANCELLED - FILLABLE.pdf',
    color: '#d32f2f'
  },
  EXISTING: {
    id: 'F.008-EXISTING',
    name: 'Certificate of Existing Franchise',
    code: 'F.008',
    description: 'Certificate for existing franchise validation',
    icon: AssignmentIcon,
    fileType: 'pdf',
    fillable: true,
    template: '/src/assets/F.008 - CERT EXISTING - FILLABLE.pdf',
    color: '#1976d2'
  },
  MTOF_DATE: {
    id: 'F.008-MTOF-DATE',
    name: 'MTOF Date Report',
    code: 'F.008',
    description: 'Motorized Tricycle-for-Hire report grouped by date',
    icon: DescriptionIcon,
    fileType: 'docx',
    fillable: false,
    template: '/src/assets/F.008 - MTOF - DATE.docx',
    color: '#ed6c02'
  },
  MTOF_SUMMARY: {
    id: 'F.008-MTOF-SUMMARY',
    name: 'MTOF Summary Report',
    code: 'F.008',
    description: 'Summary certification with statistics',
    icon: ArticleIcon,
    fileType: 'docx',
    fillable: false,
    template: '/src/assets/F.008 - MTOF DATE SUMMARY.docx',
    color: '#9c27b0'
  }
};

function Certificate() {
  const { user } = useAuth();
  
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFranchise, setSelectedFranchise] = useState(null);
  const [openViewModal, setOpenViewModal] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [franchises, setFranchises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalFranchises, setTotalFranchises] = useState(0);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selectedCertType, setSelectedCertType] = useState('');
  const [openCertModal, setOpenCertModal] = useState(false);
  const [openPreviewModal, setOpenPreviewModal] = useState(false);
  const [certificateData, setCertificateData] = useState(null);
  const [editableData, setEditableData] = useState({});
  const [generating, setGenerating] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const getAuthToken = useCallback(() => {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
  }, []);

  const loadFranchises = useCallback(async () => {
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
      });

      if (startDate) queryParams.append('startDate', startDate.toISOString());
      if (endDate) queryParams.append('endDate', endDate.toISOString());

      const response = await fetch(`${API_BASE_URL}/api/franchise-information?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      const franchiseData = result.data || [];
      const approvedFranchises = franchiseData.filter(f => 
        f.franchiseStatus === 'Active' || f.isCurrentVersion === true
      );

      console.log('[Certificate] Loaded franchises:', approvedFranchises.length);
      setFranchises(approvedFranchises);
      setTotalFranchises(approvedFranchises.length);
    } catch (err) {
      console.error('[Certificate] Error:', err);
      setError('Failed to fetch franchises. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, startDate, endDate, getAuthToken]);

  useEffect(() => {
    loadFranchises();

    if (!websocketService.isConnected()) {
      websocketService.connect('general');
    }

    const handleFranchiseUpdates = () => loadFranchises();
    websocketService.on('approved-franchises', handleFranchiseUpdates);
    websocketService.on('franchise-approved', handleFranchiseUpdates);

    return () => {
      websocketService.off('approved-franchises', handleFranchiseUpdates);
      websocketService.off('franchise-approved', handleFranchiseUpdates);
    };
  }, [loadFranchises]);

  const filteredFranchises = useMemo(() => {
    if (!searchTerm) return franchises;
    const term = searchTerm.toLowerCase();
    return franchises.filter(f =>
      f.operatorName?.toLowerCase().includes(term) ||
      f.franchiseNumber?.toLowerCase().includes(term) ||
      f.mvPlateNo?.toLowerCase().includes(term)
    );
  }, [franchises, searchTerm]);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  const formatUserRole = useCallback((role) => {
    const roleMap = {
      'sb-admin': 'Sangguniang Bayan Administrator',
      'bplo-admin': 'BPLO Administrator',
      'super-admin': 'System Administrator'
    };
    return roleMap[role] || role;
  }, []);

  const numberToWords = useCallback((num) => {
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
                   'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    if (num < 20) return words[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? '-' + words[num % 10] : '');
    if (num < 1000) return words[Math.floor(num / 100)] + ' hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
    return num.toString();
  }, []);

  const prepareAndOpenCertModal = useCallback((certType, franchises) => {
    const certConfig = Object.values(CERTIFICATE_TYPES).find(c => c.id === certType);
    if (!certConfig) return;

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
      const grouped = {
        new: franchises.filter(f => f.applicationType === 'new'),
        renewal: franchises.filter(f => f.applicationType === 'renewal'),
        amendment: franchises.filter(f => f.applicationType === 'amendment' || f.applicationType === 'transfer')
      };
      preparedData.franchises = franchises;
      preparedData.grouped = grouped;
      preparedData.reportTitle = 'Motorized Tricycle-for-Hire Date Report';
    } else if (certType === CERTIFICATE_TYPES.MTOF_SUMMARY.id) {
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
      preparedData.franchise = selectedFranchise;
    }

    setCertificateData(preparedData);
    setEditableData(preparedData);
    setOpenPreviewModal(true);
  }, [user, selectedFranchise, formatUserRole, numberToWords]);

  const handleViewFranchise = useCallback((franchise) => {
    setSelectedFranchise(franchise);
    setOpenViewModal(true);
  }, []);

  const handleCloseViewModal = useCallback(() => {
    setOpenViewModal(false);
    setSelectedFranchise(null);
  }, []);

  const handleCertMenuClick = useCallback((event) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleCertMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleSelectCertType = useCallback((certType) => {
    setSelectedCertType(certType);
    setAnchorEl(null);
    
    if (certType === CERTIFICATE_TYPES.MTOF_DATE.id || certType === CERTIFICATE_TYPES.MTOF_SUMMARY.id) {
      prepareAndOpenCertModal(certType, filteredFranchises);
    } else {
      setOpenCertModal(true);
    }
  }, [filteredFranchises, prepareAndOpenCertModal]);

  const handleGenerateCertificate = useCallback((franchise, certType) => {
    setSelectedFranchise(franchise);
    setSelectedCertType(certType);
    setOpenCertModal(false);
    
    // Prepare preview data
    const certConfig = Object.values(CERTIFICATE_TYPES).find(c => c.id === certType);
    if (!certConfig) return;

    const preparedData = {
      certificateType: certConfig,
      franchise: franchise,
      generatedBy: user?.name || 'Administrator',
      generatedByRole: formatUserRole(user?.role || ''),
      dateGenerated: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      municipalityName: 'Municipality of Solano, Nueva Vizcaya',
    };

    setCertificateData(preparedData);
    setEditableData(preparedData);
    setOpenPreviewModal(true);
  }, [user, formatUserRole]);

  const handleDownloadCertificate = useCallback(async () => {
    setGenerating(true);

    try {
      const token = getAuthToken();
      const certConfig = certificateData.certificateType;
      
      if (!certConfig) throw new Error('Invalid certificate type');

      console.log('[Certificate] Generating certificate:', selectedCertType);
      console.log('[Certificate] API URL:', `${API_BASE_URL}/api/reports/generate-certificate`);

      // Prepare franchise data for PDF filling with all necessary fields
      const payload = {
        certificateType: selectedCertType,
        franchiseData: {
          // Core franchise information
          franchiseNumber: editableData.franchise.franchiseNumber,
          operatorName: editableData.franchise.operatorName,
          operatorAddress: editableData.franchise.operatorAddress,
          operatorBarangay: editableData.franchise.operatorBarangay,
          barangay: editableData.franchise.operatorBarangay || extractBarangay(editableData.franchise.operatorAddress),
          
          // Vehicle information
          mvPlateNo: editableData.franchise.mvPlateNo,
          unitModel: editableData.franchise.unitModel,
          makeModel: editableData.franchise.makeModel || editableData.franchise.unitModel,
          
          // Engine and chassis numbers (use actual database field names)
          motorEngineNo: editableData.franchise.motorEngineNo, // Database field name
          engineNumber: editableData.franchise.motorEngineNo, // Alternate
          chasisNo: editableData.franchise.chasisNo, // Database field name (typo in schema)
          chassisNumber: editableData.franchise.chasisNo, // Alternate
          
          // Approval information (use session number if no resolution number)
          sbResolutionNumber: editableData.franchise.sbResolutionNumber || editableData.franchise.sessionNumber,
          sessionNumber: editableData.franchise.sessionNumber,
          sbApprovedAt: editableData.franchise.sbApprovedAt || editableData.franchise.approvedAt || editableData.franchise.createdAt,
          approvedAt: editableData.franchise.approvedAt,
          dateApproved: editableData.franchise.sbApprovedAt || editableData.franchise.approvedAt || editableData.franchise.createdAt,
          
          // Official receipt
          officialReceiptNumber: editableData.franchise.officialReceiptNumber || '',
          officialReceipNumber: editableData.franchise.officialReceiptNumber || '', // Alternate spelling in PDF
          
          // Administrative information
          generatedBy: editableData.generatedBy || user?.name,
          generatedByRole: editableData.generatedByRole || formatUserRole(user?.role),
          municipalityName: editableData.municipalityName || 'Municipality of Solano, Nueva Vizcaya',
          dateGenerated: new Date().toISOString()
        },
        format: certConfig.fileType,
        generatedBy: editableData.generatedBy || user?.name,
        generatedDate: new Date().toISOString()
      };

      console.log('[Certificate] Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${API_BASE_URL}/api/reports/generate-certificate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        // Try to parse as JSON, fallback to text if it fails
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          }
        } catch (parseError) {
          console.error('[Certificate] Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      // Download the filled PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certConfig.code}_${editableData.franchise.franchiseNumber}_${Date.now()}.${certConfig.fileType}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setError('');
      setOpenPreviewModal(false);
      // Show success message
      alert('Certificate downloaded successfully!');
    } catch (err) {
      console.error('[Certificate] Error generating:', err);
      
      // Check if it's a network error
      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        setError('Cannot connect to server. Please ensure the server is running on ' + API_BASE_URL);
      } else {
        setError(err.message || 'Failed to generate certificate. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  }, [getAuthToken, selectedCertType, certificateData, editableData, user, formatUserRole]);

  // Helper function to extract barangay from address
  const extractBarangay = (address) => {
    if (!address) return '';
    const match = address.match(/(?:Brgy\.?|Barangay)\s+([^,]+)/i);
    return match ? match[1].trim() : '';
  };

  const handleFinalGenerate = async () => {
    setGenerating(true);
    try {
      const token = getAuthToken();
      const certConfig = Object.values(CERTIFICATE_TYPES).find(c => c.id === selectedCertType);
      
      if (!certConfig) throw new Error('Invalid certificate type');

      // Determine if it's a Word document (MTOF reports)
      const isWordDoc = certConfig.fileType === 'docx';

      let payload;
      if (isWordDoc) {
        // For MTOF summary reports with Word documents
        payload = {
          certificateType: selectedCertType,
          franchiseData: {
            franchiseNumber: 'MTOF-SUMMARY',
            statistics: editableData.stats || {},
            summaryText: editableData.summaryText,
            franchises: editableData.franchises || [],
            municipalityName: editableData.municipalityName,
            generatedByRole: editableData.generatedByRole
          },
          format: certConfig.fileType,
          generatedBy: editableData.generatedBy,
          generatedDate: new Date().toISOString()
        };
      } else {
        // For single franchise PDF certificates
        payload = {
          certificateType: selectedCertType,
          franchiseData: {
            franchiseNumber: editableData.franchise?.franchiseNumber,
            operatorName: editableData.franchise?.operatorName,
            operatorAddress: editableData.franchise?.operatorAddress,
            mvPlateNo: editableData.franchise?.mvPlateNo,
            unitModel: editableData.franchise?.unitModel,
            sbResolutionNumber: editableData.franchise?.sbResolutionNumber,
            dateApproved: editableData.franchise?.sbApprovedAt || editableData.franchise?.createdAt,
            municipalityName: editableData.municipalityName,
            generatedByRole: editableData.generatedByRole
          },
          format: certConfig.fileType,
          generatedBy: editableData.generatedBy,
          generatedDate: new Date().toISOString()
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/reports/generate-certificate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

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
    } catch (err) {
      console.error('[Certificate] Error generating:', err);
      setError('Failed to generate certificate. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintCertificate = useCallback(() => {
    window.print();
  }, []);

  const handleEditFieldChange = useCallback((field, value) => {
    setEditableData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  return (
    <div className="certificate-container">
      <Sidebar />
      <div className="content-container">
        {/* Header */}
        <Box className="header-container" sx={{ mb: 3 }}>
          <Typography variant="h4" className="page-title" sx={{ fontWeight: 700, color: '#0A356B' }}>
            Certificate Management
          </Typography>
        
        </Box>

        {/* Global Loading Overlay */}
        {generating && (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              flexDirection: 'column',
              gap: 2
            }}
          >
            <CircularProgress size={60} sx={{ color: '#fff' }} />
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
              Generating Certificate...
            </Typography>
            <Typography variant="body2" sx={{ color: '#fff' }}>
              Please wait while we prepare your document
            </Typography>
          </Box>
        )}

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Controls Section */}
        <Paper className="controls-section" elevation={0} sx={{ mb: 3, p: 3, border: '1px solid #e0e0e0', borderRadius: '12px' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <TextField
              placeholder="Search by Name, Franchise #, or Plate #"
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flex: 1, minWidth: '300px' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#0A356B' }} />
                  </InputAdornment>
                ),
              }}
            />

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                slotProps={{
                  textField: { size: 'small', sx: { minWidth: '170px' } }
                }}
              />
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                minDate={startDate}
                slotProps={{
                  textField: { size: 'small', sx: { minWidth: '170px' } }
                }}
              />
            </LocalizationProvider>

            <Tooltip title="Generate certificate for selected franchises">
              <span>
                <Button
                  variant="contained"
                  startIcon={<ArticleIcon />}
                  onClick={handleCertMenuClick}
                  disabled={filteredFranchises.length === 0}
                  sx={{
                    bgcolor: '#0A356B',
                    '&:hover': { bgcolor: '#082a52' },
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 3
                  }}
                >
                  Generate Certificate
                </Button>
              </span>
            </Tooltip>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleCertMenuClose}
              PaperProps={{
                elevation: 8,
                sx: { mt: 1, minWidth: '360px', borderRadius: '12px', overflow: 'hidden' }
              }}
              TransitionComponent={Fade}
            >
              <Box sx={{ px: 2, py: 1.5, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0A356B' }}>
                  Select Certificate Type
                </Typography>
              </Box>
              {Object.values(CERTIFICATE_TYPES).map((cert) => {
                const Icon = cert.icon;
                return (
                  <MenuItem
                    key={cert.id}
                    onClick={() => handleSelectCertType(cert.id)}
                    sx={{
                      py: 2,
                      px: 2,
                      '&:hover': { bgcolor: 'rgba(10, 53, 107, 0.04)' },
                      borderBottom: '1px solid #f5f5f5'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
                      <Icon sx={{ mr: 2, color: cert.color, fontSize: 28 }} />
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#333' }}>
                            {cert.name}
                          </Typography>
                          <Chip 
                            label={cert.fileType.toUpperCase()} 
                            size="small" 
                            sx={{ ml: 1, height: 20, fontSize: '0.65rem', bgcolor: cert.color, color: 'white', fontWeight: 600 }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                          {cert.description}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#999', display: 'block', mt: 0.5 }}>
                          Code: {cert.code}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                );
              })}
            </Menu>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', pt: 2, borderTop: '1px solid #e0e0e0' }}>
            <Chip
              icon={<CalendarTodayIcon sx={{ fontSize: 18 }} />}
              label={`Total Franchises: ${filteredFranchises.length}`}
              sx={{ bgcolor: '#e3f2fd', color: '#0A356B', fontWeight: 600, height: 32 }}
            />
            {(startDate || endDate) && (
              <Chip
                label={`Date Range: ${startDate ? formatDate(startDate) : 'All'} - ${endDate ? formatDate(endDate) : 'All'}`}
                onDelete={() => { setStartDate(null); setEndDate(null); }}
                sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 600, height: 32 }}
              />
            )}
          </Box>
        </Paper>

        {/* Franchises Table */}
        <Paper className="admin-table-container">
          {loading && (
            <Box display="flex" justifyContent="center" alignItems="center" py={6}>
              <CircularProgress size={40} sx={{ color: '#0A356B' }} />
            </Box>
          )}

          {!loading && (
            <TableContainer className="admin-table-wrapper">
              <Table className="admin-table" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell className="admin-table-header-cell col-id">Franchise Number</TableCell>
                    <TableCell className="admin-table-header-cell col-name">Operator Name</TableCell>
                    <TableCell className="admin-table-header-cell col-contact">Plate Number</TableCell>
                    <TableCell className="admin-table-header-cell col-date">Date Approved</TableCell>
                    <TableCell className="admin-table-header-cell col-contact">Resolution Number</TableCell>
                    <TableCell className="admin-table-header-cell col-actions">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredFranchises.length > 0 ? (
                    filteredFranchises
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((franchise) => (
                        <TableRow className="admin-table-row" hover key={franchise._id}>
                          <TableCell className="admin-table-cell col-id">
                            {franchise.franchiseNumber}
                          </TableCell>
                          <TableCell className="admin-table-cell col-name">{franchise.operatorName}</TableCell>
                          <TableCell className="admin-table-cell col-contact">{franchise.mvPlateNo}</TableCell>
                          <TableCell className="admin-table-cell col-date">{formatDate(franchise.sbApprovedAt || franchise.createdAt)}</TableCell>
                          <TableCell className="admin-table-cell col-contact">{franchise.sbResolutionNumber || 'N/A'}</TableCell>
                          <TableCell className="admin-table-cell col-actions">
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                              <Tooltip title="View Details">
                                <IconButton
                                  size="small"
                                  sx={{ color: '#0A356B', '&:hover': { bgcolor: 'rgba(10, 53, 107, 0.08)' } }}
                                  onClick={(e) => { e.stopPropagation(); handleViewFranchise(franchise); }}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Generate Certificate">
                                <IconButton
                                  size="small"
                                  sx={{ color: '#2e7d32', '&:hover': { bgcolor: 'rgba(46, 125, 50, 0.08)' } }}
                                  onClick={(e) => { e.stopPropagation(); setSelectedFranchise(franchise); setOpenCertModal(true); }}
                                >
                                  <ArticleIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow className="admin-table-row">
                      <TableCell className="admin-table-cell" colSpan={6} align="center">
                        <Box py={4}>
                          <Typography variant="body1" color="text.secondary">
                            No approved franchises found
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {!loading && filteredFranchises.length > 0 && (
            <TablePagination
              className="admin-table-pagination"
              rowsPerPageOptions={[10, 15, 25, 50]}
              component="div"
              count={filteredFranchises.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          )}
        </Paper>

        {/* View Franchise Modal */}
        <StyledModal 
          open={openViewModal} 
          onClose={handleCloseViewModal} 
          closeAfterTransition 
          BackdropComponent={Backdrop} 
          BackdropProps={{ 
            timeout: 500,
            sx: { backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1299 }
          }}
        >
          <Fade in={openViewModal}>
            <ModalContent>
              <Box sx={{ px: 3, py: 2.5, borderBottom: '2px solid #0A356B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0A356B' }}>Franchise Details</Typography>
                <IconButton onClick={handleCloseViewModal} sx={{ color: '#666' }}><CloseIcon /></IconButton>
              </Box>
              <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
                {selectedFranchise && (
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Franchise Number</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: '#0A356B', mt: 0.5 }}>{selectedFranchise.franchiseNumber}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Resolution Number</Typography>
                      <Typography variant="body1" sx={{ mt: 0.5 }}>{selectedFranchise.sbResolutionNumber || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Operator Name</Typography>
                      <Typography variant="body1" sx={{ mt: 0.5 }}>{selectedFranchise.operatorName}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Address</Typography>
                      <Typography variant="body1" sx={{ mt: 0.5 }}>{selectedFranchise.operatorAddress}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Plate Number</Typography>
                      <Typography variant="body1" sx={{ mt: 0.5 }}>{selectedFranchise.mvPlateNo}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Unit Model</Typography>
                      <Typography variant="body1" sx={{ mt: 0.5 }}>{selectedFranchise.unitModel || 'N/A'}</Typography>
                    </Grid>
                  </Grid>
                )}
              </Box>
              <Box sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" onClick={handleCloseViewModal} sx={{ bgcolor: '#0A356B', '&:hover': { bgcolor: '#082a52' }, textTransform: 'none', fontWeight: 600 }}>Close</Button>
              </Box>
            </ModalContent>
          </Fade>
        </StyledModal>

        {/* Certificate Type Selection Modal */}
        <StyledModal 
          open={openCertModal} 
          onClose={() => setOpenCertModal(false)} 
          closeAfterTransition 
          BackdropComponent={Backdrop} 
          BackdropProps={{ 
            timeout: 500,
            sx: { backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1299 }
          }}
        >
          <Fade in={openCertModal}>
            <ModalContent>
              <Box sx={{ px: 3, py: 2.5, borderBottom: '2px solid #0A356B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0A356B' }}>Select Certificate Type</Typography>
                <IconButton onClick={() => setOpenCertModal(false)} sx={{ color: '#666' }}><CloseIcon /></IconButton>
              </Box>
              <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
                {selectedFranchise && (
                  <Alert severity="info" sx={{ mb: 3, borderRadius: '12px' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Selected Franchise: {selectedFranchise.franchiseNumber}</Typography>
                    <Typography variant="caption">{selectedFranchise.operatorName} - {selectedFranchise.mvPlateNo}</Typography>
                  </Alert>
                )}
                <Grid container spacing={2}>
                  {Object.values(CERTIFICATE_TYPES).filter(cert => 
                    cert.id !== CERTIFICATE_TYPES.MTOF_DATE.id && cert.id !== CERTIFICATE_TYPES.MTOF_SUMMARY.id
                  ).map((cert) => {
                    const Icon = cert.icon;
                    return (
                      <Grid item xs={12} sm={6} md={4} key={cert.id}>
                        <Card
                          elevation={0}
                          sx={{
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            border: '2px solid #e0e0e0',
                            borderRadius: '12px',
                            height: '100%',
                            '&:hover': { 
                              borderColor: cert.color, 
                              transform: 'translateY(-4px)', 
                              boxShadow: `0 8px 20px ${cert.color}25` 
                            }
                          }}
                          onClick={() => handleGenerateCertificate(selectedFranchise, cert.id)}
                        >
                          <CardContent sx={{ p: 2.5, textAlign: 'center' }}>
                            <Box 
                              sx={{ 
                                width: 60, 
                                height: 60, 
                                borderRadius: '12px', 
                                bgcolor: `${cert.color}15`, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                mx: 'auto',
                                mb: 1.5 
                              }}
                            >
                              <Icon sx={{ fontSize: 32, color: cert.color }} />
                            </Box>
                            <Chip 
                              label={cert.code} 
                              size="small" 
                              sx={{ 
                                mb: 1, 
                                bgcolor: cert.color, 
                                color: 'white', 
                                fontWeight: 700, 
                                height: 20,
                                fontSize: '0.7rem'
                              }} 
                            />
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: '#0A356B', fontSize: '0.95rem' }}>
                              {cert.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontSize: '0.75rem', lineHeight: 1.3 }}>
                              {cert.description}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              <PictureAsPdfIcon sx={{ fontSize: 14, color: '#666' }} />
                              <Typography variant="caption" sx={{ fontWeight: 600, color: '#666', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                {cert.fileType}
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
              <Box sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="outlined" onClick={() => setOpenCertModal(false)} sx={{ textTransform: 'none', fontWeight: 600, color: '#666', borderColor: '#e0e0e0' }}>Cancel</Button>
              </Box>
            </ModalContent>
          </Fade>
        </StyledModal>

        {/* Certificate Preview Modal */}
        <StyledModal 
          open={openPreviewModal} 
          onClose={() => setOpenPreviewModal(false)} 
          closeAfterTransition 
          BackdropComponent={Backdrop} 
          BackdropProps={{ 
            timeout: 500,
            sx: { backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1299 }
          }}
        >
          <Fade in={openPreviewModal}>
            <ModalContent sx={{ maxWidth: '1000px' }}>
              <Box sx={{ px: 3, py: 2.5, borderBottom: '2px solid #0A356B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#0A356B' }}>Certificate Preview & Edit</Typography>
                  {certificateData?.certificateType && (
                    <Typography variant="caption" sx={{ color: '#666' }}>{certificateData.certificateType.name} ({certificateData.certificateType.code})</Typography>
                  )}
                </Box>
                <IconButton onClick={() => setOpenPreviewModal(false)} sx={{ color: '#666' }}><CloseIcon /></IconButton>
              </Box>
              <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
                {certificateData && certificateData.franchise && (
                  <>
                    {/* Editable Section */}
                    <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: '12px' }}>
                      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 700, color: '#0A356B', display: 'flex', alignItems: 'center' }}>
                        <EditIcon sx={{ mr: 1, fontSize: 20 }} />Edit Certificate Details
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <TextField 
                            fullWidth 
                            label="Generated By" 
                            value={editableData.generatedBy || ''} 
                            onChange={(e) => handleEditFieldChange('generatedBy', e.target.value)} 
                            size="small"
                            variant="outlined"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField 
                            fullWidth 
                            label="Position/Role" 
                            value={editableData.generatedByRole || ''} 
                            onChange={(e) => handleEditFieldChange('generatedByRole', e.target.value)} 
                            size="small"
                            variant="outlined"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField 
                            fullWidth 
                            label="Municipality Name" 
                            value={editableData.municipalityName || ''} 
                            onChange={(e) => handleEditFieldChange('municipalityName', e.target.value)} 
                            size="small"
                            variant="outlined"
                          />
                        </Grid>
                      </Grid>
                    </Paper>

                    {/* Preview Section */}
                    <Paper elevation={2} sx={{ p: 4, border: `3px solid ${certificateData.certificateType.color}`, borderRadius: '12px', mb: 3 }}>
                      <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <Box 
                          sx={{ 
                            width: 80, 
                            height: 80, 
                            borderRadius: '16px', 
                            bgcolor: `${certificateData.certificateType.color}15`, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            mx: 'auto',
                            mb: 2 
                          }}
                        >
                          {React.createElement(certificateData.certificateType.icon, { 
                            sx: { fontSize: 44, color: certificateData.certificateType.color } 
                          })}
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0A356B', mb: 1 }}>
                          {certificateData.certificateType.name}
                        </Typography>
                        <Chip 
                          label={certificateData.certificateType.code} 
                          sx={{ bgcolor: certificateData.certificateType.color, color: 'white', fontWeight: 700 }} 
                        />
                      </Box>
                      <Divider sx={{ my: 3 }} />
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Franchise Number</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600, color: '#0A356B' }}>{certificateData.franchise.franchiseNumber}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Resolution Number</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>{certificateData.franchise.sbResolutionNumber || 'N/A'}</Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Operator Name</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>{certificateData.franchise.operatorName}</Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Address</Typography>
                          <Typography variant="body1">{certificateData.franchise.operatorAddress}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Plate Number</Typography>
                          <Typography variant="body1">{certificateData.franchise.mvPlateNo}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Unit Model</Typography>
                          <Typography variant="body1">{certificateData.franchise.unitModel || 'N/A'}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Engine Number</Typography>
                          <Typography variant="body1">{certificateData.franchise.motorEngineNo || 'N/A'}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Chassis Number</Typography>
                          <Typography variant="body1">{certificateData.franchise.chasisNo || 'N/A'}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Date Approved</Typography>
                          <Typography variant="body1">{formatDate(certificateData.franchise.approvedAt || certificateData.franchise.sbApprovedAt || certificateData.franchise.createdAt)}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>Session/Resolution Number</Typography>
                          <Typography variant="body1">{certificateData.franchise.sessionNumber || certificateData.franchise.sbResolutionNumber || 'N/A'}</Typography>
                        </Grid>
                      </Grid>
                      <Divider sx={{ my: 3 }} />
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Generated By</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>{editableData.generatedBy}</Typography>
                        <Typography variant="body2" color="text.secondary">{editableData.generatedByRole}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>{editableData.dateGenerated}</Typography>
                      </Box>
                    </Paper>
                    <Alert severity="info" sx={{ borderRadius: '12px' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>📄 Ready to Generate</Typography>
                      <Typography variant="caption">
                        Click "Download {certificateData.certificateType.fileType.toUpperCase()}" to generate and download the filled certificate.
                      </Typography>
                    </Alert>
                  </>
                )}
              </Box>
              <Box sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Button variant="outlined" onClick={() => setOpenPreviewModal(false)} disabled={generating} sx={{ textTransform: 'none', fontWeight: 600, color: '#666', borderColor: '#e0e0e0' }}>Cancel</Button>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button 
                    variant="contained" 
                    startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />} 
                    onClick={handleDownloadCertificate} 
                    disabled={generating} 
                    sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' }, textTransform: 'none', fontWeight: 600 }}
                  >
                    {generating ? 'Generating...' : `Download ${certificateData?.certificateType?.fileType.toUpperCase()}`}
                  </Button>
                </Box>
              </Box>
            </ModalContent>
          </Fade>
        </StyledModal>
      </div>
    </div>
  );
}

export default Certificate;
