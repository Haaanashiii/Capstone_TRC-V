import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import { franchiseInformationAPI, API_BASE_URL } from '../Services/api';
import websocketService from '../../services/websocket';
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
  CircularProgress,
  Alert,
  Link,
  Snackbar,
  Fade,
  Backdrop,
} from '@mui/material';
import { styled } from "@mui/material/styles";
import SearchIcon from '@mui/icons-material/Search';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import '../../Styles/Administrator_Css/FranchiseeList.css';

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
  boxShadow: 24,
  borderRadius: 2,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

// FranchiseeDetailsModal Component
const FranchiseeDetailsModal = ({ open, onClose, franchisee, isEditing, onEdit, onSave, onFilePreview, getFileIcon, qrBlobUrl }) => {
  if (!franchisee) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="franchisee-details-modal"
      closeAfterTransition
      BackdropProps={{
        timeout: 500,
      }}
    >
      <Fade in={open}>
        <Box className="modal-container">
          <div className="modal-header">
            <Typography variant="h5" component="h2">
              FRANCHISEE DETAILS
            </Typography>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </div>
          
          <div className="modal-body">
            <Typography variant="h6" className="section-header">
              PERSONAL INFORMATION
            </Typography>
            
            <div className="info-grid">
              <Typography variant="subtitle2" className="label">Franchise Number:</Typography>
              <Typography>{franchisee.franchiseNumber}</Typography>
              
              <Typography variant="subtitle2" className="label">Name:</Typography>
              <Typography>{franchisee.franchiseeName}</Typography>
              
              <Typography variant="subtitle2" className="label">Session Number:</Typography>
              <Typography>{franchisee.sessionNumber || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Contact Number:</Typography>
              <Typography>{franchisee.contactNumber || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Email:</Typography>
              <Typography>{franchisee.email || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Barangay:</Typography>
              <Typography>{franchisee.barangay || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Birth Place:</Typography>
              <Typography>{franchisee.birthPlace || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Birth Date:</Typography>
              <Typography>{franchisee.birthDate || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Civil Status:</Typography>
              <Typography>{franchisee.civilStatus || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Citizenship:</Typography>
              <Typography>{franchisee.citizenship || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">TODA Membership:</Typography>
              <Typography>{franchisee.todaMembership || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Address:</Typography>
              <Typography>{franchisee.address}</Typography>
              
              {(franchisee.coOwnerName || franchisee.coOwnerAddress) && (
                <>
                  <Typography variant="subtitle2" className="label">Co-Owner Name:</Typography>
                  <Typography>{franchisee.coOwnerName || 'N/A'}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Co-Owner Address:</Typography>
                  <Typography>{franchisee.coOwnerAddress || 'N/A'}</Typography>
                </>
              )}
            </div>
            
            <Typography variant="h6" className="section-header">
              DRIVER INFORMATION
            </Typography>
            
            <div className="info-grid">
              <Typography variant="subtitle2" className="label">Driver's ID:</Typography>
              <Typography>{franchisee.driversID || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Driver Name:</Typography>
              <Typography>{franchisee.driverName || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Driver Address:</Typography>
              <Typography>{franchisee.driversAddress || 'N/A'}</Typography>
            </div>
            
            <Typography variant="h6" className="section-header">
              FRANCHISE STATUS
            </Typography>
            
            <div className="info-grid">
              <Typography variant="subtitle2" className="label">Status:</Typography>
              <Typography>{franchisee.franchiseStatus || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Rate:</Typography>
              <Typography>{franchisee.rate || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Approved Date:</Typography>
              <Typography>{franchisee.approvedAt || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Expiry Date:</Typography>
              <Typography>{franchisee.expiryDate || 'N/A'}</Typography>
            </div>
            
            <Typography variant="h6" className="section-header">
              MOTORCYCLE INFORMATION
            </Typography>
            
            <div className="info-grid">
              <Typography variant="subtitle2" className="label">Unit Model:</Typography>
              <Typography>{franchisee.unitModel || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Color (Motor):</Typography>
              <Typography>{franchisee.colorMotor || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Color (Sidecar):</Typography>
              <Typography>{franchisee.colorSidecar || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">MV Plate:</Typography>
              <Typography>{franchisee.mvPlate || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Motor/Engine Number:</Typography>
              <Typography>{franchisee.motorEngineNumber || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Chassis Number:</Typography>
              <Typography>{franchisee.chassisNumber || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Sidecar Plate Number:</Typography>
              <Typography>{franchisee.sidecarPlateNumber || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Make:</Typography>
              <Typography>{franchisee.make}</Typography>
              
              <Typography variant="subtitle2" className="label">Plate Number:</Typography>
              <Typography>{franchisee.plateNumber}</Typography>
            </div>

            <Typography variant="h6" className="section-header">
              QR CODE
            </Typography>
            
            <div className="qr-code-container">
              {qrBlobUrl ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                  <img 
                    src={qrBlobUrl} 
                    alt="Franchisee QR Code" 
                    className="qr-code-image"
                    onError={(e) => {
                      console.error('QR Code image failed to load');
                      e.target.style.display = 'none';
                    }}
                  />
                  <Button
                    variant="contained"
                    href={qrBlobUrl}
                    download={`QR-${franchisee.franchiseNumber}.png`}
                    className="button-primary"
                  >
                    Download QR Code
                  </Button>
                </div>
              ) : franchisee.qrCode ? (
                <Typography variant="body2" color="text.secondary">
                  Loading QR code...
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No QR code available
                </Typography>
              )}
            </div>
            
            <Typography variant="h6" className="section-header">
              DOCUMENTS
            </Typography>
            
            <div className="info-grid">
              <Typography variant="subtitle2" className="label">Registration:</Typography>
              <Link className="document-link" onClick={() => onFilePreview(franchisee.documentRegistration)}>
                {getFileIcon(franchisee.documentRegistration?.type)}
                <span>{franchisee.documentRegistration?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Barangay Clearance:</Typography>
              <Link className="document-link" onClick={() => onFilePreview(franchisee.documentBarangayClearance)}>
                {getFileIcon(franchisee.documentBarangayClearance?.type)}
                <span>{franchisee.documentBarangayClearance?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Cedula:</Typography>
              <Link className="document-link" onClick={() => onFilePreview(franchisee.documentCedula)}>
                {getFileIcon(franchisee.documentCedula?.type)}
                <span>{franchisee.documentCedula?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Driver's License:</Typography>
              <Link className="document-link" onClick={() => onFilePreview(franchisee.documentDriversLicense)}>
                {getFileIcon(franchisee.documentDriversLicense?.type)}
                <span>{franchisee.documentDriversLicense?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Voter's Affidavit:</Typography>
              <Link className="document-link" onClick={() => onFilePreview(franchisee.documentVotersAffidavit)}>
                {getFileIcon(franchisee.documentVotersAffidavit?.type)}
                <span>{franchisee.documentVotersAffidavit?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Chassis Stencil:</Typography>
              <Link className="document-link" onClick={() => onFilePreview(franchisee.documentChassisStencil)}>
                {getFileIcon(franchisee.documentChassisStencil?.type)}
                <span>{franchisee.documentChassisStencil?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Driver Picture:</Typography>
              <Link className="document-link" onClick={() => onFilePreview(franchisee.documentPicture)}>
                {getFileIcon(franchisee.documentPicture?.type)}
                <span>{franchisee.documentPicture?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">OR LTO:</Typography>
              <Link className="document-link" onClick={() => onFilePreview(franchisee.documentORLTO)}>
                {getFileIcon(franchisee.documentORLTO?.type)}
                <span>{franchisee.documentORLTO?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">CR LTO:</Typography>
              <Link className="document-link" onClick={() => onFilePreview(franchisee.documentCRLTO)}>
                {getFileIcon(franchisee.documentCRLTO?.type)}
                <span>{franchisee.documentCRLTO?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">OR Treasurer:</Typography>
              <Link className="document-link" onClick={() => onFilePreview(franchisee.documentTreasurerOR)}>
                {getFileIcon(franchisee.documentTreasurerOR?.type)}
                <span>{franchisee.documentTreasurerOR?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Session Report:</Typography>
              <Link className="document-link" onClick={() => onFilePreview(franchisee.documentSessionReport)}>
                {getFileIcon(franchisee.documentSessionReport?.type)}
                <span>{franchisee.documentSessionReport?.name || 'No file'}</span>
              </Link>
            </div>
          </div>
        </Box>
      </Fade>
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
  const [franchisees, setFranchisees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState({ open: false, message: '', type: 'info' });
  const [openFilePreview, setOpenFilePreview] = useState(false);
  const [previewFile, setPreviewFile] = useState({ name: '', type: '', path: '' });
  const currentBlobUrlRef = useRef(null);
  const qrBlobUrlRef = useRef(null);
  const [qrBlobUrl, setQrBlobUrl] = useState(null);

  // Helper function to determine file type from URL extension
  const getFileTypeFromUrl = (url) => {
    if (!url) return 'unknown'
    const ext = url.split('.').pop().toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image'
    if (ext === 'pdf') return 'pdf'
    return 'document'
  }

  // Get auth token
  const getAuthToken = () => {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
  };

  // Fetch franchisees from API (from franchise information, not applications)
  const fetchFranchisees = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('[FranchiseeList] Fetching franchisees from franchise-information API...');
      const response = await franchiseInformationAPI.getAll();
      // Backend returns { success, data, count }, axios unwraps to response.data
      const data = response.data?.data || response.data || [];
      
      console.log('[FranchiseeList] Received franchisees:', Array.isArray(data) ? data.length : 0);
      
      // Transform the data to match the expected format
      // Data comes from FranchiseInformation model (approved franchises)
      const serverApps = Array.isArray(data) ? data : [];
      const transformedData = serverApps.map((app, index) => {
        // Get documents from subdocument
        const docs = app.documents || {};
        
        return {
          id: app._id || app.id,
          recordNumber: String(index + 1).padStart(3, '0'),
          franchiseeName: app.operatorName || '',
          franchiseNumber: app.franchiseNumber || '',
          sessionNumber: app.sessionNumber || '',
          make: app.unitModel || 'N/A',
          plateNumber: app.mvPlateNo || 'N/A',
          applicationType: 'Approved', // All are approved franchises
          address: app.operatorAddress || '',
          barangay: app.operatorBarangay || '',
          contactNumber: app.operatorContactNumber || '',
          email: app.operatorEmail || '',
          coOwnerName: app.coOwnerName || '',
          coOwnerAddress: app.coOwnerAddress || '',
          // Additional fields for details modal
          civilStatus: app.operatorCivilStatus || '',
          birthPlace: app.operatorBirthPlace || '',
          birthDate: app.operatorBirthDate ? new Date(app.operatorBirthDate).toLocaleDateString() : '',
          citizenship: app.operatorCitizenship || '',
          todaMembership: app.todaMembership || '',
          unitModel: app.unitModel || '',
          colorMotor: app.colorMotor || '',
          colorSidecar: app.sideCarColor || '',
          sidecarPlateNumber: app.sideCarPlateNumber || '',
          mvPlate: app.mvPlateNo || '',
          motorEngineNumber: app.motorEngineNo || '',
          chassisNumber: app.chasisNo || '',
          driversID: app.driversID || '',
          driverName: app.driverName || '',
          driversAddress: app.driversAddress || '',
          rate: app.rate || '',
          franchiseStatus: app.franchiseStatus || '',
          approvedAt: app.approvedAt ? new Date(app.approvedAt).toLocaleDateString() : '',
          expiryDate: app.expiryDate ? new Date(app.expiryDate).toLocaleDateString() : '',
          qrCode: app.qrCode || null,
          profilePhoto: app.profilePhoto || null,
          // Document files from documents subdocument - normalize to objects with name, path, and type
          documentRegistration: docs.motorRegistrationObj ? { 
            name: docs.motorRegistrationObj.split('/').pop(),
            path: docs.motorRegistrationObj,
            type: getFileTypeFromUrl(docs.motorRegistrationObj)
          } : null,
          documentBarangayClearance: docs.barangayClearanceObj ? {
            name: docs.barangayClearanceObj.split('/').pop(),
            path: docs.barangayClearanceObj,
            type: getFileTypeFromUrl(docs.barangayClearanceObj)
          } : null,
          documentCedula: docs.cedulaObj ? {
            name: docs.cedulaObj.split('/').pop(),
            path: docs.cedulaObj,
            type: getFileTypeFromUrl(docs.cedulaObj)
          } : null,
          documentDriversLicense: docs.driversLicenseObj ? {
            name: docs.driversLicenseObj.split('/').pop(),
            path: docs.driversLicenseObj,
            type: getFileTypeFromUrl(docs.driversLicenseObj)
          } : null,
          documentVotersAffidavit: docs.votersAffidavitObj ? {
            name: docs.votersAffidavitObj.split('/').pop(),
            path: docs.votersAffidavitObj,
            type: getFileTypeFromUrl(docs.votersAffidavitObj)
          } : null,
          documentChassisStencil: docs.motorChassisStencilObj ? {
            name: docs.motorChassisStencilObj.split('/').pop(),
            path: docs.motorChassisStencilObj,
            type: getFileTypeFromUrl(docs.motorChassisStencilObj)
          } : null,
          documentORLTO: docs.oRLTOObj ? {
            name: docs.oRLTOObj.split('/').pop(),
            path: docs.oRLTOObj,
            type: getFileTypeFromUrl(docs.oRLTOObj)
          } : null,
          documentCRLTO: docs.cRLTOObj ? {
            name: docs.cRLTOObj.split('/').pop(),
            path: docs.cRLTOObj,
            type: getFileTypeFromUrl(docs.cRLTOObj)
          } : null,
          documentPicture: docs.driverPictureObj ? {
            name: docs.driverPictureObj.split('/').pop(),
            path: docs.driverPictureObj,
            type: getFileTypeFromUrl(docs.driverPictureObj)
          } : null,
          documentTreasurerOR: docs.oRTreasurerOfficeObj ? {
            name: docs.oRTreasurerOfficeObj.split('/').pop(),
            path: docs.oRTreasurerOfficeObj,
            type: getFileTypeFromUrl(docs.oRTreasurerOfficeObj)
          } : null,
          documentSessionReport: docs.individualSessionReportObj ? {
            name: docs.individualSessionReportObj.split('/').pop(),
            path: docs.individualSessionReportObj,
            type: getFileTypeFromUrl(docs.individualSessionReportObj)
          } : null
        };
      });

      setFranchisees(transformedData);
    } catch (err) {
      console.error('Error fetching franchisees:', err);
      setError('Failed to load franchisees. Please try again.');
      setFranchisees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load franchisees on component mount
  useEffect(() => {
    fetchFranchisees();

    // Connect to WebSocket for real-time updates
    if (!websocketService.isConnected()) {
      console.log('[FranchiseeList] Connecting to WebSocket');
      websocketService.connect('general')
    }

    // Subscribe to franchisee updates
    const handleFranchiseeUpdates = (franchisees) => {
      console.log('[FranchiseeList] WebSocket update - franchisees:', franchisees?.length || 0);
      if (Array.isArray(franchisees) && franchisees.length > 0) {
        fetchFranchisees();
      }
    };

    websocketService.on('franchisees', handleFranchiseeUpdates);
    websocketService.on('franchisee-updated', handleFranchiseeUpdates);

    return () => {
      websocketService.off('franchisees', handleFranchiseeUpdates);
      websocketService.off('franchisee-updated', handleFranchiseeUpdates);
    };
  }, [fetchFranchisees]);

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

  // When a selected franchisee changes, fetch QR code if available
  React.useEffect(() => {
    const fetchQRCode = async () => {
      if (!selectedFranchisee?.qrCode) {
        if (qrBlobUrlRef.current) {
          URL.revokeObjectURL(qrBlobUrlRef.current);
          qrBlobUrlRef.current = null;
        }
        setQrBlobUrl(null);
        return;
      }

      try {
        const apiBase = API_BASE_URL || 'http://localhost:5170';
        const token = getAuthToken();
        
        const qrPath = selectedFranchisee.qrCode;
        let qrUrl = qrPath;
        
        // Handle R2 format: r2://path/to/file -> route through backend proxy
        if (qrPath.startsWith('r2://')) {
          qrUrl = `${apiBase.replace(/\/$/, '')}/api/franchise-information/proxy-file?url=${encodeURIComponent(qrPath)}`;
          console.log('[FranchiseeList] R2 format detected for QR code, routing through proxy');
        }
        // Old Cloudflare public URL format -> route through backend proxy
        else if (/^https?:\/\/pub-[a-f0-9]+\.r2\.dev/i.test(qrPath)) {
          qrUrl = `${apiBase.replace(/\/$/, '')}/api/franchise-information/proxy-file?url=${encodeURIComponent(qrPath)}`;
          console.log('[FranchiseeList] Cloudflare R2 public URL detected for QR code, routing through proxy');
        }
        // Full HTTP/HTTPS URL
        else if (qrPath.startsWith('http://') || qrPath.startsWith('https://')) {
          qrUrl = qrPath;
        }
        // Relative path
        else if (qrPath.startsWith('/')) {
          qrUrl = `${apiBase}${qrPath}`;
        } else {
          qrUrl = `${apiBase}/${qrPath}`;
        }

        console.log('[FranchiseeList] Fetching QR code from:', qrUrl);

        const response = await fetch(qrUrl, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch QR code: ${response.statusText}`);
        }

        const blob = await response.blob();
        
        if (qrBlobUrlRef.current) {
          URL.revokeObjectURL(qrBlobUrlRef.current);
        }
        
        const blobUrl = URL.createObjectURL(blob);
        qrBlobUrlRef.current = blobUrl;
        setQrBlobUrl(blobUrl);
        
        console.log('[FranchiseeList] QR code loaded successfully');
      } catch (err) {
        console.error('[FranchiseeList] Error fetching QR code:', err);
        setQrBlobUrl(null);
      }
    };

    fetchQRCode();
  }, [selectedFranchisee]);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setIsEditing(false);
  }, []);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleSave = useCallback(async (editedData) => {
    setLoading(true);
    setError('');
    
    try {
      const apiBase = API_BASE_URL || 'http://localhost:5170';

      const response = await fetch(`${apiBase}/api/franchise-information/${editedData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operatorName: editedData.franchiseeName,
          address: editedData.address,
          mtopNumber: editedData.franchiseNumber,
          civilStatus: editedData.civilStatus,
          driversID: editedData.driversID,
          contactNumber: editedData.contactNumber
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update franchisee');
      }

      setSelectedFranchisee(editedData);
      setIsEditing(false);
      
      // Refresh the list
      await fetchFranchisees();
      
      // Show success message
      setError('');
    } catch (err) {
      console.error('Error saving franchisee:', err);
      setError(err.message || 'Failed to save changes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchFranchisees]);

  const handleSearch = useCallback(() => {
    setPage(0); // Reset to first page when searching
  }, []);

  /**
   * File preview handlers (similar to FranchiseMgmt)
   */
  const handleOpenFilePreview = useCallback((file) => {
    if (!file) {
      setNotification({ open: true, message: 'File not available for preview', type: 'info' });
      return;
    }

    console.log('[FranchiseeList] Opening file preview for:', file);

    // Normalize file object
    let normalized = { name: '', type: '', path: '' };

    if (typeof file === 'object' && (file.path || file.name)) {
      normalized = {
        name: file.name || file.originalname || '',
        type: file.type || file.mimetype || '',
        path: file.path || file.pathname || ''
      };
    } else if (typeof file === 'string') {
      normalized = {
        name: file.split('/').pop() || file,
        type: '',
        path: file
      };
    }

    console.log('[FranchiseeList] Normalized file:', normalized);

    // Handle different URL formats
    try {
      // R2 format: r2://path/to/file -> route through backend proxy
      if (normalized.path && normalized.path.startsWith('r2://')) {
        const r2Key = normalized.path.substring(5); // Remove 'r2://' prefix
        normalized.path = `${API_BASE_URL.replace(/\/$/, '')}/api/franchise-information/proxy-file?url=${encodeURIComponent(normalized.path)}`;
        console.log('[FranchiseeList] R2 format detected, routing through proxy:', r2Key);
      }
      // Old Cloudflare public URL format -> route through backend proxy
      else if (normalized.path && /^https?:\/\/pub-[a-f0-9]+\.r2\.dev/i.test(normalized.path)) {
        normalized.path = `${API_BASE_URL.replace(/\/$/, '')}/api/franchise-information/proxy-file?url=${encodeURIComponent(normalized.path)}`;
        console.log('[FranchiseeList] Cloudflare R2 public URL detected, routing through proxy');
      }
      // Relative path -> prefix with API_BASE_URL
      else if (normalized.path && !/^https?:\/\//i.test(normalized.path)) {
        const pathPart = normalized.path.startsWith('/') ? normalized.path : '/' + normalized.path;
        normalized.path = API_BASE_URL.replace(/\/$/, '') + pathPart;
      }
    } catch (err) {
      console.warn('[Preview] Error processing file path:', err);
    }

    // If it's an image or PDF, try fetching it and creating an object URL so
    // the browser does not need to embed the backend URL in an iframe (which
    // can be blocked by X-Frame-Options: SAMEORIGIN). This also avoids CORS
    // framing issues by loading the bytes via fetch and serving them from a
    // same-origin blob URL.
    const tryFetchAndPreview = async () => {
      const path = normalized.path;
      const isImage = (normalized.type || '').includes('image') || /\.(png|jpe?g|webp|gif)$/i.test(path);
      const isPdf = (normalized.type || '').includes('pdf') || /\.pdf$/i.test(path);

      if (isImage || isPdf) {
        try {
          const resp = await fetch(path, { mode: 'cors' });
          if (!resp.ok) throw new Error(`Failed to fetch file: ${resp.status}`);
          const blob = await resp.blob();
          const objectUrl = URL.createObjectURL(blob);
          // Revoke previous if any
          if (currentBlobUrlRef.current) URL.revokeObjectURL(currentBlobUrlRef.current);
          currentBlobUrlRef.current = objectUrl;
          setPreviewFile({ ...normalized, path: objectUrl });
          setOpenFilePreview(true);
          return;
        } catch (err) {
          console.warn('[FilePreview] fetch failed, falling back to direct URL', err);
          setNotification({ open: true, message: 'Preview unavailable, file will open/download instead', type: 'info' });
          // fallthrough to open direct link in iframe/fallback
        }
      }

      // Not an image/pdf or fetch failed — use the path as-is (download link will still work)
      setPreviewFile(normalized);
      setOpenFilePreview(true);
    };

    tryFetchAndPreview();
  }, []);

  const handleCloseFilePreview = useCallback(() => {
    if (currentBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      } catch (err) {
        console.warn('Failed to revoke blob URL:', err);
      }
    }
    setOpenFilePreview(false);
  }, []);

  // Cleanup blob URLs on component unmount
  useEffect(() => {
    return () => {
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
      if (qrBlobUrlRef.current) {
        URL.revokeObjectURL(qrBlobUrlRef.current);
        qrBlobUrlRef.current = null;
      }
    };
  }, []);

  const getFileIcon = useCallback((fileType) => {
    if (!fileType) return <InsertDriveFileIcon />;
    
    if (fileType.includes('image')) {
      return <ImageIcon />;
    } else if (fileType.includes('pdf')) {
      return <PictureAsPdfIcon />;
    } else {
      return <InsertDriveFileIcon />;
    }
  }, []);

  const handleNotificationClose = useCallback(() => {
    setNotification({ open: false, message: '', type: 'info' });
  }, []);

  const getApplicationTypeColor = (type) => {
    switch (type) {
      case 'New':
        return '#4caf50';
      case 'Renewal':
        return '#2196f3';
      case 'Transfer':
        return '#ff9800';
      case 'Approved':
        return '#4caf50';
      default:
        return '#757575';
    }
  };

  return (
    <div className="franchisee-list-container">
      <Sidebar />
      <div className="content-container">
        <div className="header-container">
          <div className="page-title">
            Franchisee List
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

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
        <Paper className="table-container" elevation={2}>
          {loading && (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          )}
          
          <TableContainer sx={{ maxHeight: 500 }}>
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
              {!loading && paginatedFranchisees.length > 0 ? (
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
                        className="chip-application-type"
                        sx={{ 
                          bgcolor: getApplicationTypeColor(row.applicationType)
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
                      {loading ? 'Loading...' : 'No franchisees found'}
                    </Typography>
                  </StyledTableCell>
                </StyledTableRow>
              )}
            </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredFranchisees.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>

        {/* Franchisee Details Modal */}
        <FranchiseeDetailsModal
          open={modalOpen}
          onClose={handleCloseModal}
          franchisee={selectedFranchisee}
          isEditing={isEditing}
          onEdit={handleEdit}
          onSave={handleSave}
          onFilePreview={handleOpenFilePreview}
          getFileIcon={getFileIcon}
          qrBlobUrl={qrBlobUrl}
        />

        {/* File Preview Modal */}
        <Modal
          open={openFilePreview}
          onClose={handleCloseFilePreview}
          aria-labelledby="file-preview-modal"
        >
          <Box className="file-preview-modal">
            <div className="modal-header">
              <Typography variant="h6">
                {previewFile.name}
              </Typography>
              <IconButton onClick={handleCloseFilePreview}>
                <CloseIcon />
              </IconButton>
            </div>
            
            <div className="file-preview-content">
              {previewFile.type?.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(previewFile.name) ? (
                <img 
                  src={previewFile.path} 
                  alt={previewFile.name}
                  className="preview-image"
                  onError={(e) => {
                    console.error('Image preview failed:', e);
                    e.target.style.display = 'none';
                  }}
                />
              ) : previewFile.type?.includes('pdf') || previewFile.name?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewFile.path}
                  title={previewFile.name}
                  className="preview-iframe"
                  onError={(e) => {
                    console.error('PDF preview failed:', e);
                  }}
                />
              ) : (
                <div className="file-preview-fallback">
                  <InsertDriveFileIcon className="file-icon-large" />
                  <Typography variant="body1" className="mt-2">
                    This file type cannot be previewed. Download to view.
                  </Typography>
                  <Button
                    className="mt-2 button-primary"
                    href={previewFile.path}
                    download={previewFile.name}
                  >
                    Download File
                  </Button>
                </div>
              )}
            </div>
          </Box>
        </Modal>

        {/* Notification Snackbar */}
        <Snackbar 
          open={notification.open} 
          autoHideDuration={6000} 
          onClose={handleNotificationClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={handleNotificationClose} severity={notification.type} sx={{ width: '100%' }}>
            {notification.message}
          </Alert>
        </Snackbar>
      </div>
    </div>
  );
}

export default FranchiseeList;