import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '../../Styles/Administrator_Css/Certificate.css';
import '../../Styles/Administrator_Css/SharedTable.css';
import Sidebar from './Sidebar';
import websocketService from '../../services/websocket';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMounted } from '../../hooks/useIsMounted';
import { useDebounce } from '../../hooks/useDebounce';
import { toast } from 'react-toastify';
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
import PageLoader from '../../components/PageLoader';
import AnimatedPage, { AnimatedSection } from '../../components/AnimatedPage';
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
import { logger } from '../../utils/logger';
import { getToken, franchiseAPI, franchiseInformationAPI, certificateAPI } from '../Services/api';

// API Base URL for error messages only
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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
    template: '/C.001 - CERT APPROVED - FILLABLE.pdf',
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
    template: '/C.001 - CERT CANCELLED - FILLABLE.pdf',
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
    template: '/F.008 - CERT EXISTING - FILLABLE.pdf',
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
    template: '/F.008 - MTOF - DATE.docx',
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
    template: '/F.008 - MTOF DATE SUMMARY.docx',
    color: '#9c27b0'
  }
};

function Certificate() {
  const { user } = useAuth();
  const isMountedRef = useIsMounted();
  
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
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
  const [generating, setGenerating] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Get auth token from centralized secure token manager
  const getAuthToken = useCallback(() => {
    return getToken();
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

      // Determine if MTOF mode (date range selected for reports)
      const isMTOFMode = startDate && endDate;
      
      const queryParams = {
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearchTerm,
      };
      
      if (startDate) queryParams.startDate = startDate.toISOString();
      if (endDate) queryParams.endDate = endDate.toISOString();

      // MTOF Reports: Use franchise-applications (has applicationType for grouping)
      // Individual Certificates: Use franchise-information (approved franchises)
      const response = isMTOFMode 
        ? await franchiseAPI.getAll(queryParams)
        : await franchiseInformationAPI.getAll(queryParams);

      const result = response.data;
      const franchiseData = result?.data || [];
      
      // For MTOF: show all applications (for grouping by type)
      // For Individual: filter by active franchises only
      const filteredFranchises = isMTOFMode
        ? franchiseData
        : franchiseData.filter(f => f.franchiseStatus === 'Active' || f.isCurrentVersion === true);

      setFranchises(filteredFranchises);
      setTotalFranchises(filteredFranchises.length);
    } catch (err) {
      logger.error('[Certificate] Error:', err);
      setError('Failed to fetch franchises. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedSearchTerm, startDate, endDate, getAuthToken]);

  useEffect(() => {
    loadFranchises();

    if (!websocketService.isConnected()) {
      websocketService.connect('general');
    }

    const handleFranchiseUpdates = () => {
      if (isMountedRef.current) {
        loadFranchises();
      }
    };
    websocketService.on('approved-franchises', handleFranchiseUpdates);
    websocketService.on('franchise-approved', handleFranchiseUpdates);

    return () => {
      websocketService.off('approved-franchises', handleFranchiseUpdates);
      websocketService.off('franchise-approved', handleFranchiseUpdates);
    };
  }, [loadFranchises, isMountedRef]);

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
      preparedData.dateRange = {
        start: startDate ? startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A',
        end: endDate ? endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'
      };
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
      preparedData.dateRange = {
        start: startDate ? startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A',
        end: endDate ? endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'
      };
    } else {
      preparedData.franchise = selectedFranchise;
    }

    setCertificateData(preparedData);
    setOpenPreviewModal(true);
  }, [user, selectedFranchise, formatUserRole, numberToWords, startDate, endDate]);

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
      // Validate that date range is selected for MTOF reports
      if (!startDate || !endDate) {
        toast.error('Please select both Start Date and End Date to generate MTOF Summary Reports.');
        return;
      }
      prepareAndOpenCertModal(certType, filteredFranchises);
    } else {
      setOpenCertModal(true);
    }
  }, [filteredFranchises, prepareAndOpenCertModal, startDate, endDate]);

  const handleGenerateCertificate = useCallback(async (franchise, certType) => {
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
    setOpenPreviewModal(true);
    
    // Generate PDF preview for PDF certificates
    if (certConfig.fileType === 'pdf') {
      await generatePDFPreview(franchise, certType, preparedData);
    }
  }, [user, formatUserRole]);

  const generatePDFPreview = useCallback(async (franchise, certType, preparedData) => {
    setLoadingPreview(true);
    try {
      const token = getAuthToken();
      const certConfig = Object.values(CERTIFICATE_TYPES).find(c => c.id === certType);
      
      if (!certConfig || certConfig.fileType !== 'pdf') return;

      const payload = {
        certificateType: certType,
        franchiseData: {
          franchiseNumber: franchise.franchiseNumber,
          operatorName: franchise.operatorName,
          operatorAddress: franchise.operatorAddress,
          operatorBarangay: franchise.operatorBarangay,
          barangay: franchise.operatorBarangay || extractBarangay(franchise.operatorAddress),
          mvPlateNo: franchise.mvPlateNo,
          unitModel: franchise.unitModel,
          makeModel: franchise.makeModel || franchise.unitModel,
          motorEngineNo: franchise.motorEngineNo,
          engineNumber: franchise.motorEngineNo,
          chasisNo: franchise.chasisNo,
          chassisNumber: franchise.chasisNo,
          resolutionNumber: franchise.resolutionNumber || franchise.sbResolutionNumber,
          sbResolutionNumber: franchise.resolutionNumber || franchise.sbResolutionNumber,
          sbApprovedAt: franchise.sbApprovedAt || franchise.approvedAt || franchise.createdAt,
          approvedAt: franchise.approvedAt,
          dateApproved: franchise.sbApprovedAt || franchise.approvedAt || franchise.createdAt,
          officialReceiptNumber: franchise.officialReceiptNumber || '',
          officialReceipNumber: franchise.officialReceiptNumber || '',
          generatedBy: preparedData.generatedBy || user?.name,
          generatedByRole: preparedData.generatedByRole || formatUserRole(user?.role),
          municipalityName: preparedData.municipalityName || 'Municipality of Solano, Nueva Vizcaya',
          dateGenerated: new Date().toISOString()
        },
        format: certConfig.fileType,
        generatedBy: preparedData.generatedBy || user?.name,
        generatedDate: new Date().toISOString()
      };

      const response = await certificateAPI.generate(payload);
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
    } catch (err) {
      logger.error('[Certificate] Error generating preview:', err);
      toast.error('Failed to generate preview. You can still download the certificate.');
    } finally {
      setLoadingPreview(false);
    }
  }, [getAuthToken, user, formatUserRole]);

  const handleDownloadCertificate = useCallback(async () => {
    setGenerating(true);

    try {
      const token = getAuthToken();
      const certConfig = certificateData.certificateType;
      
      if (!certConfig) throw new Error('Invalid certificate type');

      // Check if this is a MTOF report (no single franchise)
      if (!certificateData.franchise) {
        logger.error('[Certificate] MTOF reports should use handleFinalGenerate');
        setError('This certificate type requires a different download method');
        setGenerating(false);
        return;
      }

      // Prepare franchise data for PDF filling with all necessary fields
      const payload = {
        certificateType: selectedCertType,
        franchiseData: {
          // Core franchise information
          franchiseNumber: certificateData.franchise.franchiseNumber,
          operatorName: certificateData.franchise.operatorName,
          operatorAddress: certificateData.franchise.operatorAddress,
          operatorBarangay: certificateData.franchise.operatorBarangay,
          barangay: certificateData.franchise.operatorBarangay || extractBarangay(certificateData.franchise.operatorAddress),
          
          // Vehicle information
          mvPlateNo: certificateData.franchise.mvPlateNo,
          unitModel: certificateData.franchise.unitModel,
          makeModel: certificateData.franchise.makeModel || certificateData.franchise.unitModel,
          
          // Engine and chassis numbers (use actual database field names)
          motorEngineNo: certificateData.franchise.motorEngineNo, // Database field name
          engineNumber: certificateData.franchise.motorEngineNo, // Alternate
          chasisNo: certificateData.franchise.chasisNo, // Database field name (typo in schema)
          chassisNumber: certificateData.franchise.chasisNo, // Alternate
          
          // Approval information
          resolutionNumber: certificateData.franchise.resolutionNumber || certificateData.franchise.sbResolutionNumber,
          sbResolutionNumber: certificateData.franchise.resolutionNumber || certificateData.franchise.sbResolutionNumber,
          sbApprovedAt: certificateData.franchise.sbApprovedAt || certificateData.franchise.approvedAt || certificateData.franchise.createdAt,
          approvedAt: certificateData.franchise.approvedAt,
          dateApproved: certificateData.franchise.sbApprovedAt || certificateData.franchise.approvedAt || certificateData.franchise.createdAt,
          
          // Official receipt
          officialReceiptNumber: certificateData.franchise.officialReceiptNumber || '',
          officialReceipNumber: certificateData.franchise.officialReceiptNumber || '', // Alternate spelling in PDF
          
          // Administrative information
          generatedBy: certificateData.generatedBy || user?.name,
          generatedByRole: certificateData.generatedByRole || formatUserRole(user?.role),
          municipalityName: certificateData.municipalityName || 'Municipality of Solano, Nueva Vizcaya',
          dateGenerated: new Date().toISOString()
        },
        format: certConfig.fileType,
        generatedBy: certificateData.generatedBy || user?.name,
        generatedDate: new Date().toISOString()
      };

      const response = await certificateAPI.generate(payload);

      // Download the filled PDF
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certConfig.code}_${certificateData.franchise.franchiseNumber}_${Date.now()}.${certConfig.fileType}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setError('');
      setOpenPreviewModal(false);
      // Show success message
      toast.success('Certificate downloaded successfully!');
    } catch (err) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to generate certificate. Please try again.';
      logger.error('[Certificate] Error generating:', errorMsg);
      
      // Check if it's a network error
      if (err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error')) {
        toast.error('Cannot connect to server. Please check your connection.');
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setGenerating(false);
    }
  }, [selectedCertType, certificateData, user, formatUserRole]);  // Helper function to extract barangay from address
  const extractBarangay = (address) => {
    if (!address) return '';
    const match = address.match(/(?:Brgy\.?|Barangay)\s+([^,]+)/i);
    return match ? match[1].trim() : '';
  };

  /**
   * Handle final generation of MTOF reports (Word documents)
   * Includes generatedBy information for audit trail
   */
  const handleFinalGenerate = async () => {
    setGenerating(true);
    try {
      const token = getAuthToken();
      const certConfig = certificateData?.certificateType;
      
      if (!certConfig) {
        throw new Error('Certificate type not specified');
      }

      // Get current user information for generatedBy field
      const generatedByName = user?.name || 'Administrator';
      const generatedByRole = formatUserRole(user?.role) || 'Municipal Administrator';

      // Build payload based on certificate type
      let payload;
      
      if (selectedCertType === CERTIFICATE_TYPES.MTOF_DATE.id) {
        // MTOF DATE Report - Grouped franchises by application type
        payload = {
          certificateType: selectedCertType,
          franchiseData: {
            franchiseNumber: 'MTOF-DATE-REPORT',
            grouped: certificateData.grouped || {},
            franchises: certificateData.franchises || [],
            generatedBy: generatedByName,
            generatedByRole: generatedByRole,
            municipalityName: certificateData.municipalityName || 'Municipality of Solano, Nueva Vizcaya',
            dateRange: certificateData.dateRange || {
              start: startDate ? startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A',
              end: endDate ? endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'
            }
          },
          format: certConfig.fileType,
          generatedBy: generatedByName,
          generatedDate: new Date().toISOString()
        };
      } else if (selectedCertType === CERTIFICATE_TYPES.MTOF_SUMMARY.id) {
        // MTOF SUMMARY Report - Statistics and summary
        payload = {
          certificateType: selectedCertType,
          franchiseData: {
            franchiseNumber: 'MTOF-SUMMARY',
            statistics: certificateData.stats || {},
            summaryText: certificateData.summaryText || '',
            franchises: certificateData.franchises || [],
            generatedBy: generatedByName,
            generatedByRole: generatedByRole,
            municipalityName: certificateData.municipalityName || 'Municipality of Solano, Nueva Vizcaya'
          },
          format: certConfig.fileType,
          generatedBy: generatedByName,
          generatedDate: new Date().toISOString()
        };
      } else {
        throw new Error('Invalid certificate type for MTOF report');
      }

      const response = await certificateAPI.generate(payload);

      // Download the generated document
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${certConfig.code}_Report_${Date.now()}.${certConfig.fileType}`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      setError('');
      setOpenPreviewModal(false);
      toast.success('Report downloaded successfully!');
    } catch (err) {
      logger.error('[Certificate] Error generating MTOF report:', err);
      toast.error(err.message || 'Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintCertificate = useCallback(() => {
    window.print();
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
      <AnimatedPage className="content-container">
        <AnimatedSection index={0}>
          <Box className="header-container" sx={{ mb: 3 }}>
            <Typography variant="h4" className="page-title">
              Certificate Management
            </Typography>
          </Box>
        </AnimatedSection>

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

        <AnimatedSection index={1}>
          <Paper className="controls-section" elevation={0} sx={{ mb: 3, p: 3, border: '1px solid #e0e0e0', borderRadius: '12px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '8px', bgcolor: '#0A356B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DescriptionIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0A356B' }}>
                Certificate Management
              </Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>
                Generate individual certificates or MTOF reports by date range
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Field */}
            <TextField
              placeholder="Search by Name, Franchise #, or Plate #"
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flex: 1, minWidth: '250px' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#0A356B' }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* Date Range for MTOF Reports */}
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                slotProps={{
                  textField: { size: 'small', sx: { minWidth: '150px' } }
                }}
              />
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                minDate={startDate}
                slotProps={{
                  textField: { size: 'small', sx: { minWidth: '150px' } }
                }}
              />
            </LocalizationProvider>

            {/* Generate MTOF Report Button */}
            <Tooltip title={!startDate || !endDate ? 'Select date range to generate MTOF Report' : 'Generate MTOF Report'}>
              <span>
                <Button
                  variant="contained"
                  startIcon={<ArticleIcon />}
                  onClick={handleCertMenuClick}
                  disabled={!startDate || !endDate}
                  sx={{
                    bgcolor: '#0A356B',
                    '&:hover': { bgcolor: '#072a52' },
                    '&:disabled': { bgcolor: '#ccc' },
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 3
                  }}
                >
                  Generate MTOF Report
                </Button>
              </span>
            </Tooltip>
          </Box>

          {/* Info Chips */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
            <Chip
              icon={<CalendarTodayIcon sx={{ fontSize: 18 }} />}
              label={`Total: ${filteredFranchises.length} ${startDate && endDate ? 'applications' : 'franchises'}`}
              sx={{ bgcolor: '#e3f2fd', color: '#0A356B', fontWeight: 600, height: 32 }}
            />
            {startDate && endDate && (
              <Chip
                label={`Date Range: ${formatDate(startDate)} - ${formatDate(endDate)}`}
                onDelete={() => { setStartDate(null); setEndDate(null); }}
                sx={{ bgcolor: '#e3f2fd', color: '#0A356B', fontWeight: 600, height: 32 }}
              />
            )}
          </Box>
        </Paper>
        </AnimatedSection>

        <AnimatedSection index={2}>
          {startDate && endDate ? (
          <Paper className="admin-table-container">
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: '#f5f8fc' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#0A356B' }}>
                Franchise Applications for MTOF Report ({filteredFranchises.length} found)
              </Typography>
            </Box>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={6}>
                <CircularProgress size={40} sx={{ color: '#0A356B' }} />
              </Box>
            ) : (
              <TableContainer className="admin-table-wrapper">
                <Table className="admin-table" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell className="admin-table-header-cell">Franchise Number</TableCell>
                      <TableCell className="admin-table-header-cell">Operator Name</TableCell>
                      <TableCell className="admin-table-header-cell">Plate Number</TableCell>
                      <TableCell className="admin-table-header-cell">Application Type</TableCell>
                      <TableCell className="admin-table-header-cell">Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredFranchises.length > 0 ? (
                      filteredFranchises.map((franchise) => (
                        <TableRow className="admin-table-row" hover key={franchise._id}>
                          <TableCell className="admin-table-cell">{franchise.franchiseNumber || 'Pending'}</TableCell>
                          <TableCell className="admin-table-cell">{franchise.operatorName}</TableCell>
                          <TableCell className="admin-table-cell">{franchise.mvPlateNo}</TableCell>
                          <TableCell className="admin-table-cell">
                            <Chip 
                              label={(franchise.applicationType || 'N/A').toUpperCase()} 
                              size="small"
                              sx={{ 
                                fontWeight: 600,
                                bgcolor: franchise.applicationType === 'new' ? '#e8f5e9' : 
                                        franchise.applicationType === 'renewal' ? '#e3f2fd' : '#fff3e0',
                                color: franchise.applicationType === 'new' ? '#2e7d32' : 
                                       franchise.applicationType === 'renewal' ? '#1976d2' : '#ed6c02'
                              }}
                            />
                          </TableCell>
                          <TableCell className="admin-table-cell">{formatDate(franchise.createdAt)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Box py={4}>
                            <Typography variant="body1" color="text.secondary">
                              No applications found for selected date range
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        ) : (
          /* Individual Mode - Show approved franchises for individual certificates */
          <Paper className="admin-table-container">
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={6}>
                <CircularProgress size={40} sx={{ color: '#0A356B' }} />
              </Box>
            ) : (
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
                            <TableCell className="admin-table-cell col-contact">{franchise.resolutionNumber || franchise.sbResolutionNumber || 'N/A'}</TableCell>
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

            {!loading && filteredFranchises.length > 0 && !startDate && !endDate && (
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
        )}
        </AnimatedSection>

        {/* MTOF Report Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleCertMenuClose}
          PaperProps={{
            elevation: 8,
            sx: { mt: 1, minWidth: '420px', borderRadius: '12px', overflow: 'hidden' }
          }}
          TransitionComponent={Fade}
        >
          <Box sx={{ px: 2, py: 1.5, bgcolor: '#e3f2fd', borderBottom: '1px solid #bbdefb' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0A356B' }}>
              Select MTOF Report Type
            </Typography>
          </Box>
          {Object.values(CERTIFICATE_TYPES)
            .filter(cert => cert.id === CERTIFICATE_TYPES.MTOF_DATE.id || cert.id === CERTIFICATE_TYPES.MTOF_SUMMARY.id)
            .map((cert) => {
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
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                  <Box 
                    sx={{ 
                      width: 48, 
                      height: 48, 
                      borderRadius: '8px', 
                      bgcolor: `${cert.color}15`, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Icon sx={{ color: cert.color, fontSize: 24 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#333' }}>
                        {cert.name}
                      </Typography>
                      <Chip 
                        label={cert.fileType.toUpperCase()} 
                        size="small" 
                        sx={{ height: 20, fontSize: '0.65rem', bgcolor: cert.color, color: 'white', fontWeight: 600 }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                      {cert.description}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            );
          })}
        </Menu>

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
                      <Typography variant="body1" sx={{ mt: 0.5 }}>{selectedFranchise.resolutionNumber || selectedFranchise.sbResolutionNumber || 'N/A'}</Typography>
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
            <ModalContent sx={{ maxWidth: '650px' }}>
              <Box sx={{ px: 3, py: 2.5, borderBottom: '2px solid #0A356B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0A356B' }}>Select Certificate Type</Typography>
                <IconButton onClick={() => setOpenCertModal(false)} sx={{ color: '#666' }}><CloseIcon /></IconButton>
              </Box>
              <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
                {selectedFranchise && (
                  <Alert severity="info" sx={{ mb: 3, borderRadius: '8px', border: '1px solid #0288d1', bgcolor: '#e3f2fd' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#01579b' }}>Selected Franchise: {selectedFranchise.franchiseNumber}</Typography>
                    <Typography variant="caption" sx={{ color: '#0277bd' }}>{selectedFranchise.operatorName} - {selectedFranchise.mvPlateNo}</Typography>
                  </Alert>
                )}
                <Grid container spacing={2}>
                  {Object.values(CERTIFICATE_TYPES).filter(cert => 
                    cert.id !== CERTIFICATE_TYPES.MTOF_DATE.id && cert.id !== CERTIFICATE_TYPES.MTOF_SUMMARY.id
                  ).map((cert) => {
                    const Icon = cert.icon;
                    return (
                      <Grid item xs={12} key={cert.id} sx={{ width: '100%' }}>
                        <Box
                          className="cert-type-item"
                          onClick={() => handleGenerateCertificate(selectedFranchise, cert.id)}
                          sx={{ '--cert-color': cert.color }}
                        >
                          <Box 
                            className="cert-type-item-icon"
                            sx={{ bgcolor: `${cert.color}15` }}
                          >
                            <Icon sx={{ fontSize: 32, color: cert.color }} />
                          </Box>
                          <Box className="cert-type-item-content">
                            <Box className="cert-type-item-header">
                              <Typography className="cert-type-item-title" variant="h6">
                                {cert.name}
                              </Typography>
                              <Chip 
                                label={cert.code} 
                                size="small"
                                sx={{ bgcolor: cert.color, color: 'white', fontWeight: 700, height: 22, fontSize: '0.75rem' }} 
                              />
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {cert.description}
                            </Typography>
                          </Box>
                          <Box className="cert-type-item-badge">
                            <Chip 
                              label={cert.fileType.toUpperCase()} 
                              size="small"
                              icon={<PictureAsPdfIcon />}
                              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                            />
                          </Box>
                        </Box>
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
          onClose={() => {
            setOpenPreviewModal(false);
            if (pdfPreviewUrl) {
              URL.revokeObjectURL(pdfPreviewUrl);
              setPdfPreviewUrl(null);
            }
          }} 
          closeAfterTransition 
          BackdropComponent={Backdrop} 
          BackdropProps={{ 
            timeout: 500,
            sx: { backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1299 }
          }}
        >
          <Fade in={openPreviewModal}>
            <ModalContent sx={{ maxWidth: '1400px', maxHeight: '95vh' }}>
              <Box sx={{ px: 3, py: 2.5, borderBottom: '2px solid #0A356B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#0A356B' }}>Certificate Preview</Typography>
                  {certificateData?.certificateType && (
                    <Typography variant="caption" sx={{ color: '#666' }}>{certificateData.certificateType.name} ({certificateData.certificateType.code})</Typography>
                  )}
                </Box>
                <IconButton onClick={() => {
                  setOpenPreviewModal(false);
                  if (pdfPreviewUrl) {
                    URL.revokeObjectURL(pdfPreviewUrl);
                    setPdfPreviewUrl(null);
                  }
                }} sx={{ color: '#666' }}><CloseIcon /></IconButton>
              </Box>
              <Box sx={{ p: 3, overflowY: 'auto', flex: 1, display: 'flex', gap: 3 }}>
                {/* MTOF Reports Preview (DATE and SUMMARY) */}
                {certificateData && !certificateData.franchise && (certificateData.grouped || certificateData.stats) && (
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Header Info */}
                    <Paper elevation={0} sx={{ p: 3, border: `2px solid ${certificateData.certificateType.color}`, borderRadius: '12px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Box 
                          sx={{ 
                            width: 60, 
                            height: 60, 
                            borderRadius: '12px', 
                            bgcolor: `${certificateData.certificateType.color}15`, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center'
                          }}
                        >
                          {React.createElement(certificateData.certificateType.icon, { 
                            sx: { fontSize: 32, color: certificateData.certificateType.color } 
                          })}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0A356B', mb: 0.5 }}>
                            {certificateData.certificateType.name}
                          </Typography>
                          <Chip 
                            label={certificateData.certificateType.code} 
                            size="small"
                            sx={{ bgcolor: certificateData.certificateType.color, color: 'white', fontWeight: 700, height: 22 }} 
                          />
                        </Box>
                      </Box>
                      <Divider sx={{ my: 2 }} />
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>Generated By</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{certificateData.generatedBy}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>Role</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{certificateData.generatedByRole}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>Date Generated</Typography>
                          <Typography variant="body2">{certificateData.dateGenerated}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>Total Records</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: certificateData.certificateType.color }}>
                            {certificateData.franchises?.length || 0}
                          </Typography>
                        </Box>
                        {certificateData.dateRange && (
                          <>
                            <Box>
                              <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>Date Range Start</Typography>
                              <Typography variant="body2">{certificateData.dateRange.start}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>Date Range End</Typography>
                              <Typography variant="body2">{certificateData.dateRange.end}</Typography>
                            </Box>
                          </>
                        )}
                      </Box>
                    </Paper>

                    {/* MTOF DATE - Grouped Franchises Table */}
                    {certificateData.grouped && (
                      <Paper elevation={0} sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: '12px' }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#0A356B', mb: 2 }}>
                          Franchise Applications by Type
                        </Typography>
                        
                        {/* NEW Applications */}
                        {certificateData.grouped.new && certificateData.grouped.new.length > 0 && (
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2e7d32', mb: 1, bgcolor: '#e8f5e9', p: 1, borderRadius: '4px' }}>
                              NEW ({certificateData.grouped.new.length})
                            </Typography>
                            <TableContainer>
                              <Table size="small" sx={{ '& td, & th': { borderColor: '#e0e0e0' } }}>
                                <TableHead>
                                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                    <TableCell sx={{ fontWeight: 700, width: '50px' }}>No.</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Franchise No.</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Address</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {certificateData.grouped.new.map((franchise, index) => (
                                    <TableRow key={franchise.id || index}>
                                      <TableCell>{index + 1}</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }}>{franchise.operatorName || 'N/A'}</TableCell>
                                      <TableCell>{franchise.franchiseNumber || 'N/A'}</TableCell>
                                      <TableCell>{extractBarangay(franchise.operatorAddress) || franchise.operatorAddress || 'N/A'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </Box>
                        )}

                        {/* RENEWAL Applications */}
                        {certificateData.grouped.renewal && certificateData.grouped.renewal.length > 0 && (
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1976d2', mb: 1, bgcolor: '#e3f2fd', p: 1, borderRadius: '4px' }}>
                              RENEW ({certificateData.grouped.renewal.length})
                            </Typography>
                            <TableContainer>
                              <Table size="small" sx={{ '& td, & th': { borderColor: '#e0e0e0' } }}>
                                <TableHead>
                                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                    <TableCell sx={{ fontWeight: 700, width: '50px' }}>No.</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Franchise No.</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Address</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {certificateData.grouped.renewal.map((franchise, index) => (
                                    <TableRow key={franchise.id || index}>
                                      <TableCell>{index + 1}</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }}>{franchise.operatorName || 'N/A'}</TableCell>
                                      <TableCell>{franchise.franchiseNumber || 'N/A'}</TableCell>
                                      <TableCell>{extractBarangay(franchise.operatorAddress) || franchise.operatorAddress || 'N/A'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </Box>
                        )}

                        {/* AMENDMENT/CHANGE MOTOR Applications */}
                        {certificateData.grouped.amendment && certificateData.grouped.amendment.length > 0 && (
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#ed6c02', mb: 1, bgcolor: '#fff3e0', p: 1, borderRadius: '4px' }}>
                              CHANGE MOTOR ({certificateData.grouped.amendment.length})
                            </Typography>
                            <TableContainer>
                              <Table size="small" sx={{ '& td, & th': { borderColor: '#e0e0e0' } }}>
                                <TableHead>
                                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                    <TableCell sx={{ fontWeight: 700, width: '50px' }}>No.</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Franchise No.</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Address</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {certificateData.grouped.amendment.map((franchise, index) => (
                                    <TableRow key={franchise.id || index}>
                                      <TableCell>{index + 1}</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }}>{franchise.operatorName || 'N/A'}</TableCell>
                                      <TableCell>{franchise.franchiseNumber || 'N/A'}</TableCell>
                                      <TableCell>{extractBarangay(franchise.operatorAddress) || franchise.operatorAddress || 'N/A'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </Box>
                        )}
                      </Paper>
                    )}

                    {/* MTOF SUMMARY - Statistics */}
                    {certificateData.stats && (
                      <Paper elevation={0} sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: '12px' }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#0A356B', mb: 2 }}>
                          Summary Statistics
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                          <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: '8px' }}>
                            <Typography variant="caption" sx={{ color: '#666' }}>New Applications</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: '#2e7d32' }}>{certificateData.stats.newCount || 0}</Typography>
                          </Box>
                          <Box sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: '8px' }}>
                            <Typography variant="caption" sx={{ color: '#666' }}>Renewals</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1976d2' }}>{certificateData.stats.renewalCount || 0}</Typography>
                          </Box>
                          <Box sx={{ p: 2, bgcolor: '#fff3e0', borderRadius: '8px' }}>
                            <Typography variant="caption" sx={{ color: '#666' }}>Provisional</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: '#ed6c02' }}>{certificateData.stats.provisionalCount || 0}</Typography>
                          </Box>
                          <Box sx={{ p: 2, bgcolor: '#f3e5f5', borderRadius: '8px' }}>
                            <Typography variant="caption" sx={{ color: '#666' }}>Total</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: '#9c27b0' }}>{certificateData.stats.totalCount || 0}</Typography>
                          </Box>
                        </Box>
                        {certificateData.summaryText && (
                          <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: '8px' }}>
                            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>{certificateData.summaryText}</Typography>
                          </Box>
                        )}
                      </Paper>
                    )}

                    <Alert severity="info" sx={{ borderRadius: '12px' }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>📄 Word Document</Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                        This report will be generated as a Word document (.docx). Click "Download DOCX" to generate and save the file.
                      </Typography>
                    </Alert>
                  </Box>
                )}

                {/* Single Franchise Certificate Preview */}
                {certificateData && certificateData.franchise && (
                  <>
                    {/* Left Side: Certificate Info */}
                    <Box sx={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {/* Certificate Info */}
                      <Paper elevation={0} sx={{ p: 2.5, border: `2px solid ${certificateData.certificateType.color}`, borderRadius: '12px' }}>
                        <Box sx={{ textAlign: 'center', mb: 2 }}>
                          <Box 
                            sx={{ 
                              width: 60, 
                              height: 60, 
                              borderRadius: '12px', 
                              bgcolor: `${certificateData.certificateType.color}15`, 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              mx: 'auto',
                              mb: 1.5 
                            }}
                          >
                            {React.createElement(certificateData.certificateType.icon, { 
                              sx: { fontSize: 32, color: certificateData.certificateType.color } 
                            })}
                          </Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0A356B', mb: 0.5 }}>
                            {certificateData.certificateType.name}
                          </Typography>
                          <Chip 
                            label={certificateData.certificateType.code} 
                            size="small"
                            sx={{ bgcolor: certificateData.certificateType.color, color: 'white', fontWeight: 700, height: 22 }} 
                          />
                        </Box>
                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Box>
                            <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>Franchise Number</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0A356B' }}>{certificateData.franchise.franchiseNumber}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>Operator Name</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{certificateData.franchise.operatorName}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>Plate Number</Typography>
                            <Typography variant="body2">{certificateData.franchise.mvPlateNo}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>Date Approved</Typography>
                            <Typography variant="body2">{formatDate(certificateData.franchise.sbApprovedAt || certificateData.franchise.approvedAt)}</Typography>
                          </Box>
                        </Box>
                      </Paper>

                      <Alert severity="info" sx={{ borderRadius: '12px' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>📄 Certificate Preview</Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          Review the certificate preview and click "Download PDF" to save it.
                        </Typography>
                      </Alert>
                    </Box>

                    {/* Right Side: PDF Preview */}
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      {certificateData.certificateType.fileType === 'pdf' ? (
                        <Paper elevation={2} sx={{ flex: 1, border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
                          {loadingPreview ? (
                            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2, p: 4 }}>
                              <CircularProgress size={50} sx={{ color: '#0A356B' }} />
                              <Typography variant="body2" color="text.secondary">Loading PDF preview...</Typography>
                            </Box>
                          ) : pdfPreviewUrl ? (
                            <iframe
                              src={pdfPreviewUrl}
                              style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                flex: 1,
                                minHeight: '650px'
                              }}
                              title="Certificate Preview"
                            />
                          ) : (
                            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2, p: 4 }}>
                              <PictureAsPdfIcon sx={{ fontSize: 64, color: '#ccc' }} />
                              <Typography variant="body2" color="text.secondary">PDF preview unavailable</Typography>
                              <Typography variant="caption" color="text.secondary">You can still download the certificate</Typography>
                            </Box>
                          )}
                        </Paper>
                      ) : (
                        <Paper elevation={2} sx={{ p: 4, border: `3px solid ${certificateData.certificateType.color}`, borderRadius: '12px', overflow: 'auto' }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0A356B', mb: 2, textAlign: 'center' }}>
                            Word Document Preview Not Available
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3 }}>
                            Word documents cannot be previewed in browser. Click "Download DOCX" to generate and download the document.
                          </Typography>
                          <Alert severity="info" sx={{ borderRadius: '12px' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>📄 Ready to Generate</Typography>
                            <Typography variant="caption">
                              This will generate a {certificateData.certificateType.name} in DOCX format.
                            </Typography>
                          </Alert>
                        </Paper>
                      )}
                    </Box>
                  </>
                )}
              </Box>
              <Box sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => {
                    setOpenPreviewModal(false);
                    if (pdfPreviewUrl) {
                      URL.revokeObjectURL(pdfPreviewUrl);
                      setPdfPreviewUrl(null);
                    }
                  }} 
                  disabled={generating} 
                  sx={{ textTransform: 'none', fontWeight: 600, color: '#666', borderColor: '#e0e0e0' }}
                >
                  Cancel
                </Button>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button 
                    variant="contained" 
                    startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />} 
                    onClick={certificateData?.certificateType?.fileType === 'docx' ? handleFinalGenerate : handleDownloadCertificate} 
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
      </AnimatedPage>
    </div>
  );
}

export default Certificate;
