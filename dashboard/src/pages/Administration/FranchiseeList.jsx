import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import { API_BASE_URL } from '../Services/api';

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
  bgcolor: 'background.paper',
  boxShadow: 24,
  borderRadius: 2,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

// FranchiseeDetailsModal Component
const FranchiseeDetailsModal = ({ open, onClose, franchisee, isEditing, onEdit, onSave, onFilePreview, getFileIcon }) => {
  const [editedData, setEditedData] = useState(franchisee || {});

  // Update editedData when franchisee changes
  React.useEffect(() => {
    if (franchisee) {
      setEditedData(franchisee);
    }
  }, [franchisee]);

  const handleFieldChange = useCallback((field, value) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(() => {
    onSave(editedData);
  }, [editedData, onSave]);

  if (!franchisee) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="franchisee-details-modal"
      aria-describedby="franchisee-details-description"
    >
      <Box sx={modalStyle}>
        {/* Modal Header */}
        <Box
          sx={{
            bgcolor: '#0a3161',
            color: 'white',
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" component="h2" fontWeight="bold">
              Franchisee Details
            </Typography>
            <Chip 
              label={`Record #${franchisee.recordNumber}`} 
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 'bold' }}
            />
          </Box>
          <IconButton
            onClick={onClose}
            sx={{ color: 'white' }}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Modal Content */}
        <Box sx={{ overflowY: 'auto', flex: 1, p: 3 }}>
          {/* Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="contained"
              startIcon={isEditing ? <SaveIcon /> : <EditIcon />}
              onClick={isEditing ? handleSave : onEdit}
              sx={{
                bgcolor: '#0a3161',
                '&:hover': { bgcolor: '#082648' },
              }}
            >
              {isEditing ? 'Save Changes' : 'Edit Details'}
            </Button>
          </Box>

          {/* Franchisee Information Card */}
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardHeader
              title="FRANCHISEE INFORMATION"
              sx={{
                bgcolor: '#0a3161',
                color: 'white',
                '& .MuiCardHeader-title': { fontWeight: 'bold', fontSize: '1rem' },
              }}
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    FULL NAME
                  </Typography>
                  <TextField
                    fullWidth
                    value={isEditing ? editedData.franchiseeName : franchisee.franchiseeName}
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                    onChange={(e) => handleFieldChange('franchiseeName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    ADDRESS
                  </Typography>
                  <TextField
                    fullWidth
                    value={isEditing ? editedData.address : franchisee.address}
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    CIVIL STATUS
                  </Typography>
                  <TextField
                    fullWidth
                    defaultValue="SINGLE"
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    CO-OWNER
                  </Typography>
                  <TextField
                    fullWidth
                    defaultValue="N/A"
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Franchise Card */}
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardHeader
              title="MOTORIZED TRICYCLE OPERATORS FRANCHISE"
              sx={{
                bgcolor: '#0a3161',
                color: 'white',
                '& .MuiCardHeader-title': { fontWeight: 'bold', fontSize: '1rem' },
              }}
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    OR NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    defaultValue="7163721"
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    FRANCHISE NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    value={isEditing ? editedData.franchiseNumber : franchisee.franchiseNumber}
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                    onChange={(e) => handleFieldChange('franchiseNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    DATE APPROVED
                  </Typography>
                  <TextField
                    fullWidth
                    defaultValue="2025-09-01"
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                    type="date"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    EXPIRY DATE
                  </Typography>
                  <TextField
                    fullWidth
                    defaultValue="2029-09-01"
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                    type="date"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Motorcycle Information Card */}
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardHeader
              title="MOTORCYCLE INFORMATION"
              sx={{
                bgcolor: '#0a3161',
                color: 'white',
                '& .MuiCardHeader-title': { fontWeight: 'bold', fontSize: '1rem' },
              }}
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    MAKE
                  </Typography>
                  <TextField
                    fullWidth
                    value={isEditing ? editedData.make : franchisee.make}
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                    onChange={(e) => handleFieldChange('make', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    SIDECAR NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    value={franchisee.franchiseNumber}
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    PLATE NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    value={isEditing ? editedData.plateNumber : franchisee.plateNumber}
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                    onChange={(e) => handleFieldChange('plateNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    CHASSIS NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    defaultValue="LXRSF8J813NDD"
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    MOTOR NUMBER
                  </Typography>
                  <TextField
                    fullWidth
                    defaultValue="12655G8775758"
                    variant="outlined"
                    size="small"
                    disabled={!isEditing}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Documents Card */}
          <Card elevation={2}>
            <CardHeader
              title="DOCUMENTARY REQUIREMENTS"
              sx={{
                bgcolor: '#0a3161',
                color: 'white',
                '& .MuiCardHeader-title': { fontWeight: 'bold', fontSize: '1rem' },
              }}
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    Registration
                  </Typography>
                  {franchisee.documentRegistration ? (
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => onFilePreview(franchisee.documentRegistration)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        textDecoration: 'none',
                        color: '#0a3161',
                        '&:hover': { textDecoration: 'underline' }
                      }}
                    >
                      {getFileIcon(franchisee.documentRegistration?.type)}
                      <span>{franchisee.documentRegistration?.name || 'View Document'}</span>
                    </Link>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No file</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    Barangay Clearance
                  </Typography>
                  {franchisee.documentBarangayClearance ? (
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => onFilePreview(franchisee.documentBarangayClearance)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        textDecoration: 'none',
                        color: '#0a3161',
                        '&:hover': { textDecoration: 'underline' }
                      }}
                    >
                      {getFileIcon(franchisee.documentBarangayClearance?.type)}
                      <span>{franchisee.documentBarangayClearance?.name || 'View Document'}</span>
                    </Link>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No file</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    Cedula
                  </Typography>
                  {franchisee.documentCedula ? (
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => onFilePreview(franchisee.documentCedula)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        textDecoration: 'none',
                        color: '#0a3161',
                        '&:hover': { textDecoration: 'underline' }
                      }}
                    >
                      {getFileIcon(franchisee.documentCedula?.type)}
                      <span>{franchisee.documentCedula?.name || 'View Document'}</span>
                    </Link>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No file</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    Driver's License
                  </Typography>
                  {franchisee.documentDriversLicense ? (
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => onFilePreview(franchisee.documentDriversLicense)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        textDecoration: 'none',
                        color: '#0a3161',
                        '&:hover': { textDecoration: 'underline' }
                      }}
                    >
                      {getFileIcon(franchisee.documentDriversLicense?.type)}
                      <span>{franchisee.documentDriversLicense?.name || 'View Document'}</span>
                    </Link>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No file</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    Voter's Affidavit
                  </Typography>
                  {franchisee.documentVotersAffidavit ? (
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => onFilePreview(franchisee.documentVotersAffidavit)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        textDecoration: 'none',
                        color: '#0a3161',
                        '&:hover': { textDecoration: 'underline' }
                      }}
                    >
                      {getFileIcon(franchisee.documentVotersAffidavit?.type)}
                      <span>{franchisee.documentVotersAffidavit?.name || 'View Document'}</span>
                    </Link>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No file</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    Picture
                  </Typography>
                  {franchisee.documentPicture ? (
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => onFilePreview(franchisee.documentPicture)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        textDecoration: 'none',
                        color: '#0a3161',
                        '&:hover': { textDecoration: 'underline' }
                      }}
                    >
                      {getFileIcon(franchisee.documentPicture?.type)}
                      <span>{franchisee.documentPicture?.name || 'View Document'}</span>
                    </Link>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No file</Typography>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      </Box>
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

  // Get auth token
  const getAuthToken = () => {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
  };

  // Fetch franchisees from API (from franchise information, not applications)
  const fetchFranchisees = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const apiBase = API_BASE_URL || 'http://localhost:5170';
      
      // Fetch from franchise-information endpoint (approved franchises with correct file paths)
      const response = await fetch(`${apiBase}/api/franchise-information`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
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
          franchiseNumber: app.mtopNumber || app.operatorId || '',
          make: 'N/A', // Not stored in FranchiseInformation model
          plateNumber: 'N/A', // Not stored in FranchiseInformation model
          applicationType: 'Approved', // All are approved franchises
          address: app.address || '',
          // Additional fields for details modal
          civilStatus: app.civilStatus || '',
          birthPlace: '',
          birthDate: '',
          citizenship: '',
          todaMembership: '',
          colorMotor: '',
          colorSidecar: '',
          motorEngineNumber: '',
          chassisNumber: '',
          driversID: app.driversID || '',
          driversAddress: app.address || '',
          contactNumber: app.contactNumber || '',
          qrCode: app.qrCode || null,
          profilePhoto: app.profilePhoto || null,
          // Document files from documents subdocument
          documentRegistration: docs.motorRegistration || null,
          documentBarangayClearance: docs.barangayClearance || null,
          documentCedula: docs.cedula || null,
          documentDriversLicense: docs.driversLicense || null,
          documentVotersAffidavit: docs.votersAffidavit || null,
          documentPicture: docs.picture || app.profilePhoto || null
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
                        sx={{ 
                          bgcolor: getApplicationTypeColor(row.applicationType),
                          color: 'white',
                          fontWeight: 'bold'
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
