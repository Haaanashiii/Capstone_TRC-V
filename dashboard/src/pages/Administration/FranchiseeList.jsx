import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import { franchiseInformationAPI, API_BASE_URL, getToken } from '../Services/api';
import websocketService from '../../services/websocket';
import { useAuth } from '../../contexts/AuthContext';
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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
  RadioGroup,
  Radio,
  Tooltip,
} from '@mui/material';
import { styled } from "@mui/material/styles";
import PageLoader from '../../components/PageLoader';
import SearchIcon from '@mui/icons-material/Search';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FilterListIcon from '@mui/icons-material/FilterList';
import CancelIcon from '@mui/icons-material/Cancel';
import SortIcon from '@mui/icons-material/Sort';
import DateRangeIcon from '@mui/icons-material/DateRange';
import CategoryIcon from '@mui/icons-material/Category';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import HistoryIcon from '@mui/icons-material/History';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import * as XLSX from 'xlsx';
import { logger } from '../../utils/logger';
import '../../Styles/Administrator_Css/FranchiseeList.css';
import '../../Styles/Administrator_Css/SharedTable.css';

// ============================================================================
// CONSTANTS
// ============================================================================

const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'];
const FRANCHISE_STATUS_OPTIONS = ['Active', 'Inactive', 'Suspended', 'Expired', 'Revoked'];
const APPLICATION_TYPE_OPTIONS = ['New', 'Renewal', 'Update ownership', 'Change unit', 'Auto expired', 'Auto revoked'];

// Change type to color mapping
const CHANGE_TYPE_COLORS = {
  new: 'success',
  renewal: 'primary',
  update_ownership: 'warning',
  change_unit: 'info',
  auto_expired: 'error',
  auto_revoked: 'error',
};

// Franchise status to color mapping
const FRANCHISE_STATUS_COLORS = {
  Active: 'success',
  Expired: 'warning',
  Revoked: 'error',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get chip color based on change type
 * @param {string} changeType - The change type from backend
 * @returns {string} MUI color name
 */
const getChangeTypeColor = (changeType) => CHANGE_TYPE_COLORS[changeType] || 'default';

/**
 * Get chip color based on franchise status
 * @param {string} status - The franchise status
 * @returns {string} MUI color name
 */
const getStatusColor = (status) => FRANCHISE_STATUS_COLORS[status] || 'default';

/**
 * Format change type for display (capitalize and replace underscores)
 * @param {string} changeType - Raw change type from backend
 * @returns {string} Formatted display string
 */
const formatChangeType = (changeType) => {
  if (!changeType) return 'New';
  return changeType.charAt(0).toUpperCase() + changeType.slice(1).replace(/_/g, ' ');
};

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

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

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

/**
 * EditableField - Inline editable field component
 * Renders as TextField/Select in edit mode, Typography in view mode
 */
const EditableField = ({ label, value, field, isEditing, editData, onChange, type = 'text', options = [] }) => {
  const renderEditMode = () => {
    if (type === 'select') {
      return (
        <FormControl size="small" fullWidth>
          <Select
            value={editData[field] || ''}
            onChange={(e) => onChange(field, e.target.value)}
            sx={{ bgcolor: 'white' }}
          >
            {options.map((opt) => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }
    return (
      <TextField
        size="small"
        fullWidth
        type={type}
        value={editData[field] || ''}
        onChange={(e) => onChange(field, e.target.value)}
        sx={{ bgcolor: 'white' }}
      />
    );
  };

  return (
    <>
      <Typography variant="subtitle2" className="label">{label}:</Typography>
      {isEditing ? renderEditMode() : <Typography>{value || 'N/A'}</Typography>}
    </>
  );
};

/**
 * FranchiseHistorySection - Collapsible section showing franchise ownership history in table format
 */
const FranchiseHistorySection = ({ franchisee, isEditing, onViewHistoryItem }) => {
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!franchisee?.franchiseNumber) return;
    
    setLoadingHistory(true);
    try {
      const response = await franchiseInformationAPI.getHistory(franchisee.franchiseNumber);
      if (response.data?.success) {
        setHistoryData(response.data);
      }
    } catch (error) {
      logger.error('Error fetching franchise history:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [franchisee?.franchiseNumber]);

  const handleToggleHistory = () => {
    if (!showHistory && !historyData) {
      fetchHistory();
    }
    setShowHistory(prev => !prev);
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderHistoryTable = () => {
    if (!historyData?.ownershipHistory?.length) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
          No ownership history found
        </Typography>
      );
    }

    return (
      <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow
              sx={{
                 bgcolor: '#f5f5f5',
                        '& th': {
                        color: '#fff',
                       fontWeight: 600,
                          }, }}>
              <TableCell sx={{ fontWeight: 600 }}>Franchise Number</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Owner Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Versions</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Registered</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Expired On</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Revoked On</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Ownership</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {historyData.ownershipHistory.map((owner, idx) => {
              const isCurrentOwner = owner.franchiseChainId === franchisee.franchiseChainId;
              const ownerName = owner.franchises[0]?.operatorName || 'Unknown';
              const firstRegistered = owner.franchises[0]?.changedAt;
              const isActiveOwner = owner.currentStatus === 'Active';
              // Get the latest version for this owner to show in detail modal
              const latestVersion = owner.franchises?.length > 0 
                ? owner.franchises.reduce((latest, current) => 
                    (current.version > latest.version) ? current : latest
                  )
                : null;
              
              // Find when the franchise was expired (auto_expired changeType)
              const expiredVersion = owner.franchises?.find(f => 
                f.changeType === 'auto_expired' || f.changeType === 'auto_expired_catchup'
              );
              const expiredOn = expiredVersion?.changedAt || 
                (owner.currentStatus === 'Expired' || owner.currentStatus === 'Revoked' 
                  ? latestVersion?.expiryDate 
                  : null);
              
              // Find when the franchise was revoked (auto_revoked changeType or revokedAt field)
              const revokedVersion = owner.franchises?.find(f => 
                f.changeType === 'auto_revoked'
              );
              const revokedOn = revokedVersion?.revokedAt || revokedVersion?.changedAt ||
                (owner.currentStatus === 'Revoked' ? latestVersion?.revokedAt : null);
              
              return (
                <TableRow 
                  key={owner.franchiseChainId}
                  onClick={() => latestVersion && onViewHistoryItem?.(latestVersion)}
                  sx={{ 
                    bgcolor: isCurrentOwner ? '#e3f2fd' : 'inherit',
                    '&:hover': { 
                      bgcolor: isCurrentOwner ? '#bbdefb' : '#f5f5f5',
                      cursor: 'pointer'
                    },
                    transition: 'background-color 0.2s'
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {historyData.franchiseNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">{ownerName}</Typography>
                      {isCurrentOwner && (
                        <Chip label="Viewing" size="small" color="info" sx={{ height: 20, fontSize: '0.7rem' }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={owner.currentStatus} 
                      size="small"
                      color={getStatusColor(owner.currentStatus)}
                      sx={{ fontWeight: 500 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{owner.versions}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatDate(firstRegistered)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: expiredOn ? '#ed6c02' : 'text.secondary',
                        fontStyle: expiredOn ? 'normal' : 'italic'
                      }}
                    >
                      {expiredOn ? formatDate(expiredOn) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: revokedOn ? '#d32f2f' : 'text.secondary',
                        fontStyle: revokedOn ? 'normal' : 'italic'
                      }}
                    >
                      {revokedOn ? formatDate(revokedOn) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={isActiveOwner ? 'Current Owner' : 'Previous Owner'} 
                      size="small"
                      variant={isActiveOwner ? 'filled' : 'outlined'}
                      color={isActiveOwner ? 'success' : 'default'}
                      sx={{ fontWeight: 500 }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderHistoryContent = () => {
    if (loadingHistory) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <CircularProgress size={24} />
          <Typography sx={{ ml: 1 }}>Loading history...</Typography>
        </Box>
      );
    }

    if (!historyData) {
      return (
        <Typography variant="body2" color="text.secondary">
          No history data available
        </Typography>
      );
    }

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ color: '#0A356B', fontWeight: 600 }}>
            Franchise Number {historyData.franchiseNumber} - Ownership History
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {historyData.uniqueOwners} owner(s) | {historyData.totalVersions} version(s)
          </Typography>
        </Box>
        {renderHistoryTable()}
      </Box>
    );
  };

  return (
    <Box sx={{ mt: 2, mb: 2 }}>
      <Button
        variant="outlined"
        size="small"
        startIcon={<HistoryIcon />}
        endIcon={showHistory ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={handleToggleHistory}
        disabled={isEditing}
        sx={{ mb: 1 }}
      >
        {showHistory ? 'Hide History' : 'View Franchise History'}
      </Button>
      
      {showHistory && (
        <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: '#f8f9fa' }}>
          {renderHistoryContent()}
        </Paper>
      )}
    </Box>
  );
};

// ============================================================================
// FRANCHISEE DETAILS MODAL COMPONENT
// ============================================================================

const FranchiseeDetailsModal = ({ 
  open, 
  onClose, 
  franchisee, 
  isEditing, 
  onEdit, 
  onSave, 
  onCancelEdit,
  onFilePreview, 
  getFileIcon, 
  getDocumentDisplayName, 
  qrBlobUrl,
  saving,
  user
}) => {
  // Only sb-admin and super-admin can edit franchisees
  const canEdit = user?.role === 'sb-admin' || user?.role === 'super-admin';
  const [editData, setEditData] = useState({});
  const [historyItemModalOpen, setHistoryItemModalOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [loadingHistoryItem, setLoadingHistoryItem] = useState(false);
  const [historyItemQrBlobUrl, setHistoryItemQrBlobUrl] = useState(null);
  const historyItemQrBlobUrlRef = useRef(null);

  // Initialize edit data when entering edit mode
  useEffect(() => {
    if (isEditing && franchisee) {
      setEditData({
        franchiseeName: franchisee.franchiseeName || '',
        contactNumber: franchisee.contactNumber || '',
        email: franchisee.email || '',
        address: franchisee.address || '',
        barangay: franchisee.barangay || '',
        birthPlace: franchisee.birthPlace || '',
        birthDate: franchisee.birthDate || '',
        civilStatus: franchisee.civilStatus || '',
        citizenship: franchisee.citizenship || '',
        todaMembership: franchisee.todaMembership || '',
        coOwnerName: franchisee.coOwnerName || '',
        coOwnerAddress: franchisee.coOwnerAddress || '',
        driverName: franchisee.driverName || '',
        driversAddress: franchisee.driversAddress || '',
        franchiseStatus: franchisee.franchiseStatus || '',
        rate: franchisee.rate || '',
        resolutionNumber: franchisee.resolutionNumber || '',
        orNumber: franchisee.orNumber || '',
        unitModel: franchisee.unitModel || '',
        colorMotor: franchisee.colorMotor || '',
        colorSidecar: franchisee.colorSidecar || '',
        mvPlate: franchisee.mvPlate || '',
        motorEngineNumber: franchisee.motorEngineNumber || '',
        chassisNumber: franchisee.chassisNumber || '',
        make: franchisee.make || '',
        plateNumber: franchisee.plateNumber || '',
      });
    }
  }, [isEditing, franchisee]);

  const handleFieldChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveClick = () => {
    onSave({ ...franchisee, ...editData });
  };

  // Helper function to determine file type from URL
  const getFileTypeFromUrl = (url) => {
    if (!url) return 'unknown';
    const ext = url.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    return 'document';
  };

  /**
   * Handle viewing a historical franchise record
   */
  const handleViewHistoryItem = useCallback(async (historyRecord) => {
    if (!historyRecord?._id) return;
    
    setLoadingHistoryItem(true);
    setHistoryItemModalOpen(true);
    
    try {
      // Fetch full details of the historical franchise record
      const response = await franchiseInformationAPI.getById(historyRecord._id);
      const data = response.data?.data || response.data;
      
      // Transform the data to match expected format
      const docs = data.documents || {};
      
      // Log document data for debugging
      logger.log('[History Item] Raw document data:', docs);
      
      const transformedData = {
        id: data._id || data.id,
        franchiseeName: data.operatorName || '',
        franchiseNumber: data.franchiseNumber || '',
        make: data.unitModel || 'N/A',
        plateNumber: data.mvPlateNo || 'N/A',
        applicationType: data.changeType ? formatChangeType(data.changeType) : 'New',
        changeType: data.changeType || 'new',
        franchiseChainId: data.franchiseChainId || '',
        version: data.version || 1,
        address: data.operatorAddress || '',
        barangay: data.operatorBarangay || '',
        contactNumber: data.operatorContactNumber || '',
        email: data.operatorEmail || '',
        coOwnerName: data.coOwnerName || '',
        coOwnerAddress: data.coOwnerAddress || '',
        civilStatus: data.operatorCivilStatus || '',
        birthPlace: data.operatorBirthPlace || '',
        birthDate: data.operatorBirthDate ? new Date(data.operatorBirthDate).toLocaleDateString() : '',
        citizenship: data.operatorCitizenship || '',
        todaMembership: data.todaMembership || '',
        unitModel: data.unitModel || '',
        colorMotor: data.colorMotor || '',
        colorSidecar: data.sideCarColor || '',
        mvPlate: data.mvPlateNo || '',
        motorEngineNumber: data.motorEngineNo || '',
        chassisNumber: data.chasisNo || '',
        driverName: data.driverName || '',
        driversAddress: data.driversAddress || '',
        rate: data.rate || '',
        franchiseStatus: data.franchiseStatus || '',
        approvedAt: data.approvedAt ? new Date(data.approvedAt).toLocaleDateString() : '',
        expiryDate: data.expiryDate ? new Date(data.expiryDate).toLocaleDateString() : '',
        resolutionNumber: data.resolutionNumber || data.sbResolutionNumber || '',
        resolutionDocument: (data.resolutionDocument || data.sbResolutionDocument || docs.resolutionDocumentObj) ? {
          name: (data.resolutionDocument || data.sbResolutionDocument || docs.resolutionDocumentObj).split('/').pop(),
          path: data.resolutionDocument || data.sbResolutionDocument || docs.resolutionDocumentObj,
          type: getFileTypeFromUrl(data.resolutionDocument || data.sbResolutionDocument || docs.resolutionDocumentObj)
        } : null,
        orNumber: data.officialReceiptNumber || '',
        qrCode: data.qrCode || null,
        // Document files - check both URL string and enriched object format
        documentRegistration: docs.motorRegistrationObj || docs.motorRegistration ? { 
          name: (typeof docs.motorRegistrationObj === 'string' ? docs.motorRegistrationObj : (docs.motorRegistration?.url || docs.motorRegistrationObj?.url || docs.motorRegistrationObj))?.split('/').pop() || 'Registration',
          path: typeof docs.motorRegistrationObj === 'string' ? docs.motorRegistrationObj : (docs.motorRegistration?.url || docs.motorRegistrationObj?.url || docs.motorRegistrationObj),
          type: getFileTypeFromUrl(typeof docs.motorRegistrationObj === 'string' ? docs.motorRegistrationObj : (docs.motorRegistration?.url || docs.motorRegistrationObj?.url || docs.motorRegistrationObj))
        } : null,
        documentBarangayClearance: docs.barangayClearanceObj || docs.barangayClearance ? {
          name: (typeof docs.barangayClearanceObj === 'string' ? docs.barangayClearanceObj : docs.barangayClearance?.url || docs.barangayClearanceObj?.url)?.split('/').pop() || 'Barangay Clearance',
          path: typeof docs.barangayClearanceObj === 'string' ? docs.barangayClearanceObj : (docs.barangayClearance?.url || docs.barangayClearanceObj?.url),
          type: getFileTypeFromUrl(typeof docs.barangayClearanceObj === 'string' ? docs.barangayClearanceObj : (docs.barangayClearance?.url || docs.barangayClearanceObj?.url))
        } : null,
        documentCedula: docs.cedulaObj || docs.cedula ? {
          name: (typeof docs.cedulaObj === 'string' ? docs.cedulaObj : docs.cedula?.url || docs.cedulaObj?.url)?.split('/').pop() || 'Cedula',
          path: typeof docs.cedulaObj === 'string' ? docs.cedulaObj : (docs.cedula?.url || docs.cedulaObj?.url),
          type: getFileTypeFromUrl(typeof docs.cedulaObj === 'string' ? docs.cedulaObj : (docs.cedula?.url || docs.cedulaObj?.url))
        } : null,
        documentDriversLicense: docs.driversLicenseObj || docs.driversLicense ? {
          name: (typeof docs.driversLicenseObj === 'string' ? docs.driversLicenseObj : docs.driversLicense?.url || docs.driversLicenseObj?.url)?.split('/').pop() || 'Drivers License',
          path: typeof docs.driversLicenseObj === 'string' ? docs.driversLicenseObj : (docs.driversLicense?.url || docs.driversLicenseObj?.url),
          type: getFileTypeFromUrl(typeof docs.driversLicenseObj === 'string' ? docs.driversLicenseObj : (docs.driversLicense?.url || docs.driversLicenseObj?.url))
        } : null,
        documentVotersAffidavit: docs.votersAffidavitObj || docs.votersAffidavit ? {
          name: (typeof docs.votersAffidavitObj === 'string' ? docs.votersAffidavitObj : docs.votersAffidavit?.url || docs.votersAffidavitObj?.url)?.split('/').pop() || 'Voters Affidavit',
          path: typeof docs.votersAffidavitObj === 'string' ? docs.votersAffidavitObj : (docs.votersAffidavit?.url || docs.votersAffidavitObj?.url),
          type: getFileTypeFromUrl(typeof docs.votersAffidavitObj === 'string' ? docs.votersAffidavitObj : (docs.votersAffidavit?.url || docs.votersAffidavitObj?.url))
        } : null,
        documentChassisStencil: docs.motorChassisStencilObj || docs.motorChassisStencil ? {
          name: (typeof docs.motorChassisStencilObj === 'string' ? docs.motorChassisStencilObj : docs.motorChassisStencil?.url || docs.motorChassisStencilObj?.url)?.split('/').pop() || 'Chassis Stencil',
          path: typeof docs.motorChassisStencilObj === 'string' ? docs.motorChassisStencilObj : (docs.motorChassisStencil?.url || docs.motorChassisStencilObj?.url),
          type: getFileTypeFromUrl(typeof docs.motorChassisStencilObj === 'string' ? docs.motorChassisStencilObj : (docs.motorChassisStencil?.url || docs.motorChassisStencilObj?.url))
        } : null,
        documentORLTO: docs.oRLTOObj || docs.oRLTO ? {
          name: (typeof docs.oRLTOObj === 'string' ? docs.oRLTOObj : docs.oRLTO?.url || docs.oRLTOObj?.url)?.split('/').pop() || 'OR LTO',
          path: typeof docs.oRLTOObj === 'string' ? docs.oRLTOObj : (docs.oRLTO?.url || docs.oRLTOObj?.url),
          type: getFileTypeFromUrl(typeof docs.oRLTOObj === 'string' ? docs.oRLTOObj : (docs.oRLTO?.url || docs.oRLTOObj?.url))
        } : null,
        documentCRLTO: docs.cRLTOObj || docs.cRLTO ? {
          name: (typeof docs.cRLTOObj === 'string' ? docs.cRLTOObj : docs.cRLTO?.url || docs.cRLTOObj?.url)?.split('/').pop() || 'CR LTO',
          path: typeof docs.cRLTOObj === 'string' ? docs.cRLTOObj : (docs.cRLTO?.url || docs.cRLTOObj?.url),
          type: getFileTypeFromUrl(typeof docs.cRLTOObj === 'string' ? docs.cRLTOObj : (docs.cRLTO?.url || docs.cRLTOObj?.url))
        } : null,
        documentPicture: docs.driverPictureObj || docs.driverPicture ? {
          name: (typeof docs.driverPictureObj === 'string' ? docs.driverPictureObj : docs.driverPicture?.url || docs.driverPictureObj?.url)?.split('/').pop() || 'Driver Picture',
          path: typeof docs.driverPictureObj === 'string' ? docs.driverPictureObj : (docs.driverPicture?.url || docs.driverPictureObj?.url),
          type: getFileTypeFromUrl(typeof docs.driverPictureObj === 'string' ? docs.driverPictureObj : (docs.driverPicture?.url || docs.driverPictureObj?.url))
        } : null,
        documentOperatorPicture: docs.operatorPictureObj || docs.operatorPicture ? {
          name: (typeof docs.operatorPictureObj === 'string' ? docs.operatorPictureObj : docs.operatorPicture?.url || docs.operatorPictureObj?.url)?.split('/').pop() || 'Operator Picture',
          path: typeof docs.operatorPictureObj === 'string' ? docs.operatorPictureObj : (docs.operatorPicture?.url || docs.operatorPictureObj?.url),
          type: getFileTypeFromUrl(typeof docs.operatorPictureObj === 'string' ? docs.operatorPictureObj : (docs.operatorPicture?.url || docs.operatorPictureObj?.url))
        } : null,
        documentTreasurerOR: docs.oRTreasurerOfficeObj || docs.oRTreasurerOffice ? {
          name: (typeof docs.oRTreasurerOfficeObj === 'string' ? docs.oRTreasurerOfficeObj : docs.oRTreasurerOffice?.url || docs.oRTreasurerOfficeObj?.url)?.split('/').pop() || 'OR Treasurer',
          path: typeof docs.oRTreasurerOfficeObj === 'string' ? docs.oRTreasurerOfficeObj : (docs.oRTreasurerOffice?.url || docs.oRTreasurerOfficeObj?.url),
          type: getFileTypeFromUrl(typeof docs.oRTreasurerOfficeObj === 'string' ? docs.oRTreasurerOfficeObj : (docs.oRTreasurerOffice?.url || docs.oRTreasurerOfficeObj?.url))
        } : null
      };
      
      setSelectedHistoryItem(transformedData);
      
      // Fetch QR code if available
      if (data.qrCode) {
        try {
          const apiBase = API_BASE_URL || 'http://localhost:5170';
          const qrUrl = data.qrCode.startsWith('gridfs://') 
            ? `${apiBase}/api/files/${data.qrCode.substring(9)}`
            : data.qrCode.startsWith('/') 
            ? `${apiBase}${data.qrCode}`
            : data.qrCode;
          
          const qrResp = await fetch(qrUrl, { mode: 'cors' });
          if (qrResp.ok) {
            const qrBlob = await qrResp.blob();
            const qrObjUrl = URL.createObjectURL(qrBlob);
            
            if (historyItemQrBlobUrlRef.current) {
              URL.revokeObjectURL(historyItemQrBlobUrlRef.current);
            }
            historyItemQrBlobUrlRef.current = qrObjUrl;
            setHistoryItemQrBlobUrl(qrObjUrl);
          }
        } catch (qrError) {
          logger.warn('Failed to load QR code for history item:', qrError);
        }
      }
    } catch (error) {
      logger.error('Error fetching history item details:', error);
      setSelectedHistoryItem(null);
    } finally {
      setLoadingHistoryItem(false);
    }
  }, []);

  /**
   * Handle closing history item modal
   */
  const handleCloseHistoryItemModal = useCallback(() => {
    setHistoryItemModalOpen(false);
    if (historyItemQrBlobUrlRef.current) {
      URL.revokeObjectURL(historyItemQrBlobUrlRef.current);
      historyItemQrBlobUrlRef.current = null;
    }
    setHistoryItemQrBlobUrl(null);
    // Delay clearing the selected item to allow modal close animation
    setTimeout(() => setSelectedHistoryItem(null), 300);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (historyItemQrBlobUrlRef.current) {
        URL.revokeObjectURL(historyItemQrBlobUrlRef.current);
      }
    };
  }, []);

  if (!franchisee) return null;

  // Only mark as previous owner if franchise was revoked (taken away and given to someone else)
  const isPreviousOwner = franchisee.franchiseStatus === 'Revoked';

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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h5" component="h2">
                {isEditing ? 'EDIT FRANCHISEE' : 'FRANCHISEE DETAILS'}
              </Typography>
              {isPreviousOwner && !isEditing && (
                <Chip 
                  label="Previous Owner" 
                  size="small" 
                  color="warning"
                  sx={{ 
                    fontWeight: 600, 
                    bgcolor: '#ff9800',
                    color: 'white'
                  }} 
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {!isEditing && canEdit ? (
                <Tooltip title="Edit Franchisee">
                  <IconButton onClick={onEdit} sx={{ color: 'white' }}>
                    <EditIcon />
                  </IconButton>
                </Tooltip>
              ) : isEditing ? (
                <>
                  <Tooltip title="Save Changes">
                    <IconButton 
                      onClick={handleSaveClick} 
                      sx={{ color: '#4caf50' }}
                      disabled={saving}
                    >
                      {saving ? <CircularProgress size={24} color="inherit" /> : <SaveIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Cancel Edit">
                    <IconButton onClick={onCancelEdit} sx={{ color: '#f44336' }}>
                      <CancelIcon />
                    </IconButton>
                  </Tooltip>
                </>
              ) : null}
              <IconButton onClick={onClose} sx={{ color: 'white' }}>
                <CloseIcon />
              </IconButton>
            </Box>
          </div>
          
          <div className="modal-body">
            {isPreviousOwner && !isEditing && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                This franchisee is a <strong>previous owner</strong> of franchise #{franchisee.franchiseNumber}. 
                Status: <strong>{franchisee.franchiseStatus}</strong>
              </Alert>
            )}
            {isEditing && (
              <Alert severity="info" sx={{ mb: 2 }}>
                You are now editing franchisee information. Click the save icon to save changes or cancel to discard.
              </Alert>
            )}
            
            <Typography variant="h6" className="section-header">
              PERSONAL INFORMATION
            </Typography>
            
            <div className="info-grid">
              <Typography variant="subtitle2" className="label">Franchise Number:</Typography>
              <Typography sx={{ fontWeight: 600, color: '#0A356B' }}>{franchisee.franchiseNumber}</Typography>
              
              <EditableField 
                label="Name" 
                value={franchisee.franchiseeName}
                field="franchiseeName"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Contact Number" 
                value={franchisee.contactNumber}
                field="contactNumber"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Email" 
                value={franchisee.email}
                field="email"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
                type="email"
              />
              
              <EditableField 
                label="Barangay" 
                value={franchisee.barangay}
                field="barangay"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Birth Place" 
                value={franchisee.birthPlace}
                field="birthPlace"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Birth Date" 
                value={franchisee.birthDate}
                field="birthDate"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Civil Status" 
                value={franchisee.civilStatus}
                field="civilStatus"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
                type="select"
                options={CIVIL_STATUS_OPTIONS}
              />
              
              <EditableField 
                label="Citizenship" 
                value={franchisee.citizenship}
                field="citizenship"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="TODA Membership" 
                value={franchisee.todaMembership}
                field="todaMembership"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Address" 
                value={franchisee.address}
                field="address"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Co-Owner Name" 
                value={franchisee.coOwnerName}
                field="coOwnerName"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Co-Owner Address" 
                value={franchisee.coOwnerAddress}
                field="coOwnerAddress"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
            </div>
            
            <Typography variant="h6" className="section-header">
              DRIVER INFORMATION
            </Typography>
            
            <div className="info-grid">
              <EditableField 
                label="Driver Name" 
                value={franchisee.driverName}
                field="driverName"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Driver Address" 
                value={franchisee.driversAddress}
                field="driversAddress"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
            </div>
            
            <Typography variant="h6" className="section-header">
              FRANCHISE STATUS
            </Typography>
            
            <div className="info-grid">
              <EditableField 
                label="Status" 
                value={franchisee.franchiseStatus}
                field="franchiseStatus"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
                type="select"
                options={FRANCHISE_STATUS_OPTIONS}
              />
              
              <EditableField 
                label="Rate" 
                value={franchisee.rate}
                field="rate"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <Typography variant="subtitle2" className="label">Approved Date:</Typography>
              <Typography>{franchisee.approvedAt || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Driver Picture:</Typography>
              {franchisee.documentPicture ? (
                <Link className="document-link" onClick={() => onFilePreview(franchisee.documentPicture)}>
                  {getFileIcon(franchisee.documentPicture?.type)}
                  <span>{getDocumentDisplayName(franchisee.documentPicture)}</span>
                </Link>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Not uploaded</Typography>
              )}
              
              <Typography variant="subtitle2" className="label">Expiry Date:</Typography>
              <Typography>{franchisee.expiryDate || 'N/A'}</Typography>
              
              <EditableField 
                label="Resolution Number" 
                value={franchisee.resolutionNumber}
                field="resolutionNumber"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <Typography variant="subtitle2" className="label">Resolution Document:</Typography>
              {franchisee.resolutionDocument ? (
                <Link 
                  className="document-link" 
                  onClick={() => onFilePreview(franchisee.resolutionDocument)}
                  sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  {getFileIcon(franchisee.resolutionDocument?.type)}
                  <span>{getDocumentDisplayName(franchisee.resolutionDocument)}</span>
                </Link>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Not uploaded</Typography>
              )}
            </div>
            
            <Typography variant="h6" className="section-header">
              FRANCHISE INFORMATION
            </Typography>
            
            <div className="info-grid">
              <Typography variant="subtitle2" className="label">Application Type:</Typography>
              <Chip 
                label={franchisee.applicationType || 'New'} 
                size="small"
                color={getChangeTypeColor(franchisee.changeType)}
                sx={{ fontWeight: 600 }}
              />
              
              <Typography variant="subtitle2" className="label">Version:</Typography>
              <Typography>{franchisee.version || 1}</Typography>
              
              <EditableField 
                label="OR Number" 
                value={franchisee.orNumber}
                field="orNumber"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
            </div>

            {/* Franchise History Section */}
            <FranchiseHistorySection 
              franchisee={franchisee} 
              isEditing={isEditing}
              onViewHistoryItem={handleViewHistoryItem}
            />
            
            <Typography variant="h6" className="section-header">
              MOTORCYCLE INFORMATION
            </Typography>
            
            <div className="info-grid">
              <EditableField 
                label="Unit Model" 
                value={franchisee.unitModel}
                field="unitModel"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Color (Motor)" 
                value={franchisee.colorMotor}
                field="colorMotor"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Color (Sidecar)" 
                value={franchisee.colorSidecar}
                field="colorSidecar"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="MV Plate" 
                value={franchisee.mvPlate}
                field="mvPlate"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Motor/Engine Number" 
                value={franchisee.motorEngineNumber}
                field="motorEngineNumber"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Chassis Number" 
                value={franchisee.chassisNumber}
                field="chassisNumber"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Make" 
                value={franchisee.make}
                field="make"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
              
              <EditableField 
                label="Plate Number" 
                value={franchisee.plateNumber}
                field="plateNumber"
                isEditing={isEditing}
                editData={editData}
                onChange={handleFieldChange}
              />
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
                      logger.error('QR Code image failed to load');
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
              {franchisee.documentRegistration ? (
                <Link className="document-link" onClick={() => onFilePreview(franchisee.documentRegistration)}>
                  {getFileIcon(franchisee.documentRegistration?.type)}
                  <span>{getDocumentDisplayName(franchisee.documentRegistration)}</span>
                </Link>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Not uploaded</Typography>
              )}
              
              <Typography variant="subtitle2" className="label">Barangay Clearance:</Typography>
              {franchisee.documentBarangayClearance ? (
                <Link className="document-link" onClick={() => onFilePreview(franchisee.documentBarangayClearance)}>
                  {getFileIcon(franchisee.documentBarangayClearance?.type)}
                  <span>{getDocumentDisplayName(franchisee.documentBarangayClearance)}</span>
                </Link>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Not uploaded</Typography>
              )}
              
              <Typography variant="subtitle2" className="label">Cedula:</Typography>
              {franchisee.documentCedula ? (
                <Link className="document-link" onClick={() => onFilePreview(franchisee.documentCedula)}>
                  {getFileIcon(franchisee.documentCedula?.type)}
                  <span>{getDocumentDisplayName(franchisee.documentCedula)}</span>
                </Link>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Not uploaded</Typography>
              )}
              
              <Typography variant="subtitle2" className="label">Driver's License:</Typography>
              {franchisee.documentDriversLicense ? (
                <Link className="document-link" onClick={() => onFilePreview(franchisee.documentDriversLicense)}>
                  {getFileIcon(franchisee.documentDriversLicense?.type)}
                  <span>{getDocumentDisplayName(franchisee.documentDriversLicense)}</span>
                </Link>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Not uploaded</Typography>
              )}
              
              <Typography variant="subtitle2" className="label">Voter's Affidavit:</Typography>
              {franchisee.documentVotersAffidavit ? (
                <Link className="document-link" onClick={() => onFilePreview(franchisee.documentVotersAffidavit)}>
                  {getFileIcon(franchisee.documentVotersAffidavit?.type)}
                  <span>{getDocumentDisplayName(franchisee.documentVotersAffidavit)}</span>
                </Link>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Not uploaded</Typography>
              )}
              
              <Typography variant="subtitle2" className="label">Chassis Stencil:</Typography>
              {franchisee.documentChassisStencil ? (
                <Link className="document-link" onClick={() => onFilePreview(franchisee.documentChassisStencil)}>
                  {getFileIcon(franchisee.documentChassisStencil?.type)}
                  <span>{getDocumentDisplayName(franchisee.documentChassisStencil)}</span>
                </Link>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Not uploaded</Typography>
              )}
              
              <Typography variant="subtitle2" className="label">Operator Picture:</Typography>
              {franchisee.documentOperatorPicture ? (
                <Link className="document-link" onClick={() => onFilePreview(franchisee.documentOperatorPicture)}>
                  {getFileIcon(franchisee.documentOperatorPicture?.type)}
                  <span>{getDocumentDisplayName(franchisee.documentOperatorPicture)}</span>
                </Link>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Not uploaded</Typography>
              )}
              
              <Typography variant="subtitle2" className="label">OR LTO:</Typography>
              {franchisee.documentORLTO ? (
                <Link className="document-link" onClick={() => onFilePreview(franchisee.documentORLTO)}>
                  {getFileIcon(franchisee.documentORLTO?.type)}
                  <span>{getDocumentDisplayName(franchisee.documentORLTO)}</span>
                </Link>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Not uploaded</Typography>
              )}
              
              <Typography variant="subtitle2" className="label">CR LTO:</Typography>
              {franchisee.documentCRLTO ? (
                <Link className="document-link" onClick={() => onFilePreview(franchisee.documentCRLTO)}>
                  {getFileIcon(franchisee.documentCRLTO?.type)}
                  <span>{getDocumentDisplayName(franchisee.documentCRLTO)}</span>
                </Link>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Not uploaded</Typography>
              )}
              
              <Typography variant="subtitle2" className="label">OR Treasurer:</Typography>
              {franchisee.documentTreasurerOR ? (
                <Link className="document-link" onClick={() => onFilePreview(franchisee.documentTreasurerOR)}>
                  {getFileIcon(franchisee.documentTreasurerOR?.type)}
                  <span>{getDocumentDisplayName(franchisee.documentTreasurerOR)}</span>
                </Link>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Not uploaded</Typography>
              )}
            </div>
          </div>

          {/* Nested Modal for History Item Details */}
          {selectedHistoryItem && (
            <Modal
              open={historyItemModalOpen}
              onClose={handleCloseHistoryItemModal}
              aria-labelledby="history-item-details-modal"
              closeAfterTransition
              BackdropProps={{
                timeout: 500,
                sx: { backgroundColor: 'rgba(0, 0, 0, 0.7)' }
              }}
              sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
            >
              <Fade in={historyItemModalOpen}>
                <Box className="modal-container" sx={{ maxWidth: '850px' }}>
                  <div className="modal-header">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <HistoryIcon />
                      <Typography variant="h5" component="h2">
                        HISTORICAL FRANCHISE RECORD
                      </Typography>
                      <Chip 
                        label={`Version ${selectedHistoryItem.version}`}
                        size="small" 
                        color="primary"
                        sx={{ fontWeight: 600 }} 
                      />
                    </Box>
                    <IconButton onClick={handleCloseHistoryItemModal} sx={{ color: 'white' }}>
                      <CloseIcon />
                    </IconButton>
                  </div>
                  
                  <div className="modal-body">
                    {loadingHistoryItem ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                        <Typography sx={{ ml: 2 }}>Loading details...</Typography>
                      </Box>
                    ) : (
                      <>
                        <Alert severity="info" sx={{ mb: 2 }}>
                          This is a historical snapshot of franchise #{selectedHistoryItem.franchiseNumber} (Version {selectedHistoryItem.version}).
                          {selectedHistoryItem.franchiseStatus === 'Revoked' && ' This record represents a previous owner.'}
                        </Alert>

                        <Typography variant="h6" className="section-header">
                          PERSONAL INFORMATION
                        </Typography>
                        
                        <div className="info-grid">
                          <Typography variant="subtitle2" className="label">Franchise Number:</Typography>
                          <Typography sx={{ fontWeight: 600, color: '#0A356B' }}>{selectedHistoryItem.franchiseNumber}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Name:</Typography>
                          <Typography>{selectedHistoryItem.franchiseeName}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Contact Number:</Typography>
                          <Typography>{selectedHistoryItem.contactNumber || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Email:</Typography>
                          <Typography>{selectedHistoryItem.email || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Barangay:</Typography>
                          <Typography>{selectedHistoryItem.barangay || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Birth Place:</Typography>
                          <Typography>{selectedHistoryItem.birthPlace || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Birth Date:</Typography>
                          <Typography>{selectedHistoryItem.birthDate || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Civil Status:</Typography>
                          <Typography>{selectedHistoryItem.civilStatus || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Citizenship:</Typography>
                          <Typography>{selectedHistoryItem.citizenship || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">TODA Membership:</Typography>
                          <Typography>{selectedHistoryItem.todaMembership || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Address:</Typography>
                          <Typography>{selectedHistoryItem.address || 'N/A'}</Typography>
                          
                          {selectedHistoryItem.coOwnerName && (
                            <>
                              <Typography variant="subtitle2" className="label">Co-Owner Name:</Typography>
                              <Typography>{selectedHistoryItem.coOwnerName}</Typography>
                              
                              <Typography variant="subtitle2" className="label">Co-Owner Address:</Typography>
                              <Typography>{selectedHistoryItem.coOwnerAddress || 'N/A'}</Typography>
                            </>
                          )}
                        </div>
                        
                        <Typography variant="h6" className="section-header">
                          DRIVER INFORMATION
                        </Typography>
                        
                        <div className="info-grid">
                          <Typography variant="subtitle2" className="label">Driver Name:</Typography>
                          <Typography>{selectedHistoryItem.driverName || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Driver Address:</Typography>
                          <Typography>{selectedHistoryItem.driversAddress || 'N/A'}</Typography>
                        </div>
                        
                        <Typography variant="h6" className="section-header">
                          FRANCHISE STATUS
                        </Typography>
                        
                        <div className="info-grid">
                          <Typography variant="subtitle2" className="label">Status:</Typography>
                          <Chip 
                            label={selectedHistoryItem.franchiseStatus || 'N/A'}
                            size="small"
                            color={getStatusColor(selectedHistoryItem.franchiseStatus)}
                            sx={{ fontWeight: 600 }}
                          />
                          
                          <Typography variant="subtitle2" className="label">Rate:</Typography>
                          <Typography>{selectedHistoryItem.rate || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Approved Date:</Typography>
                          <Typography>{selectedHistoryItem.approvedAt || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Expiry Date:</Typography>
                          <Typography>{selectedHistoryItem.expiryDate || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Resolution Number:</Typography>
                          <Typography>{selectedHistoryItem.resolutionNumber || 'N/A'}</Typography>
                        </div>
                        
                        <Typography variant="h6" className="section-header">
                          FRANCHISE INFORMATION
                        </Typography>
                        
                        <div className="info-grid">
                          <Typography variant="subtitle2" className="label">Application Type:</Typography>
                          <Chip 
                            label={selectedHistoryItem.applicationType || 'New'}
                            size="small"
                            color={getChangeTypeColor(selectedHistoryItem.changeType)}
                            sx={{ fontWeight: 600 }}
                          />
                          
                          <Typography variant="subtitle2" className="label">Version:</Typography>
                          <Typography>{selectedHistoryItem.version || 1}</Typography>
                          
                          <Typography variant="subtitle2" className="label">OR Number:</Typography>
                          <Typography>{selectedHistoryItem.orNumber || 'N/A'}</Typography>
                        </div>
                        
                        <Typography variant="h6" className="section-header">
                          MOTORCYCLE INFORMATION
                        </Typography>
                        
                        <div className="info-grid">
                          <Typography variant="subtitle2" className="label">Unit Model:</Typography>
                          <Typography>{selectedHistoryItem.unitModel || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Color (Motor):</Typography>
                          <Typography>{selectedHistoryItem.colorMotor || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Color (Sidecar):</Typography>
                          <Typography>{selectedHistoryItem.colorSidecar || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">MV Plate:</Typography>
                          <Typography>{selectedHistoryItem.mvPlate || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Motor/Engine Number:</Typography>
                          <Typography>{selectedHistoryItem.motorEngineNumber || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Chassis Number:</Typography>
                          <Typography>{selectedHistoryItem.chassisNumber || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Make:</Typography>
                          <Typography>{selectedHistoryItem.make || 'N/A'}</Typography>
                          
                          <Typography variant="subtitle2" className="label">Plate Number:</Typography>
                          <Typography>{selectedHistoryItem.plateNumber || 'N/A'}</Typography>
                        </div>

                        {historyItemQrBlobUrl && (
                          <>
                            <Typography variant="h6" className="section-header">
                              QR CODE
                            </Typography>
                            
                            <div className="qr-code-container">
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                                <img 
                                  src={historyItemQrBlobUrl}
                                  alt="Historical QR Code"
                                  className="qr-code-image"
                                  style={{ maxWidth: '200px', maxHeight: '200px' }}
                                />
                                <Button
                                  variant="contained"
                                  href={historyItemQrBlobUrl}
                                  download={`QR-${selectedHistoryItem.franchiseNumber}-v${selectedHistoryItem.version}.png`}
                                  className="button-primary"
                                  size="small"
                                >
                                  Download QR Code
                                </Button>
                              </div>
                            </div>
                          </>
                        )}

                        <Typography variant="h6" className="section-header">
                          DOCUMENTS
                        </Typography>
                        
                        <div className="info-grid">
                          {[
                            { label: 'Registration', doc: selectedHistoryItem.documentRegistration },
                            { label: 'Barangay Clearance', doc: selectedHistoryItem.documentBarangayClearance },
                            { label: 'Cedula', doc: selectedHistoryItem.documentCedula },
                            { label: "Driver's License", doc: selectedHistoryItem.documentDriversLicense },
                            { label: "Voter's Affidavit", doc: selectedHistoryItem.documentVotersAffidavit },
                            { label: 'Chassis Stencil', doc: selectedHistoryItem.documentChassisStencil },
                            { label: 'Operator Picture', doc: selectedHistoryItem.documentOperatorPicture },
                            { label: 'Driver Picture', doc: selectedHistoryItem.documentPicture },
                            { label: 'OR LTO', doc: selectedHistoryItem.documentORLTO },
                            { label: 'CR LTO', doc: selectedHistoryItem.documentCRLTO },
                            { label: 'OR Treasurer', doc: selectedHistoryItem.documentTreasurerOR },
                            { label: 'Resolution Document', doc: selectedHistoryItem.resolutionDocument },
                          ].map(({ label, doc }) => (
                            <React.Fragment key={label}>
                              <Typography variant="subtitle2" className="label">{label}:</Typography>
                              {doc ? (
                                <Link 
                                  className="document-link" 
                                  onClick={() => onFilePreview(doc)}
                                  sx={{ cursor: 'pointer' }}
                                >
                                  {getFileIcon(doc.type)}
                                  <span>{getDocumentDisplayName(doc)}</span>
                                </Link>
                              ) : (
                                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Not uploaded</Typography>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  
                  <Box sx={{ 
                    p: 2, 
                    borderTop: '1px solid #E5E7EB',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    bgcolor: '#F9FAFB'
                  }}>
                    <Button
                      variant="contained"
                      onClick={handleCloseHistoryItemModal}
                      sx={{ minWidth: '120px' }}
                    >
                      Close
                    </Button>
                  </Box>
                </Box>
              </Fade>
            </Modal>
          )}
        </Box>
      </Fade>
    </Modal>
  );
};

// Export Options Dialog Component
const ExportOptionsDialog = ({ open, onClose, onExport, franchisees, barangays }) => {
  const [exportOptions, setExportOptions] = useState({
    groupBy: 'none',
    sortBy: 'franchiseNumber',
    sortOrder: 'asc',
    dateRange: 'all',
    customStartDate: '',
    customEndDate: '',
    selectedBarangays: [],
    selectedStatuses: [],
    includeFields: {
      basic: true,
      personal: true,
      driver: true,
      vehicle: true,
      franchise: true,
    },
    separateSheets: false,
  });

  const [activeTab, setActiveTab] = useState(0);

  const handleOptionChange = (field, value) => {
    setExportOptions(prev => ({ ...prev, [field]: value }));
  };

  const handleFieldToggle = (field) => {
    setExportOptions(prev => ({
      ...prev,
      includeFields: {
        ...prev.includeFields,
        [field]: !prev.includeFields[field]
      }
    }));
  };

  const handleBarangayToggle = (barangay) => {
    setExportOptions(prev => ({
      ...prev,
      selectedBarangays: prev.selectedBarangays.includes(barangay)
        ? prev.selectedBarangays.filter(b => b !== barangay)
        : [...prev.selectedBarangays, barangay]
    }));
  };

  const handleStatusToggle = (status) => {
    setExportOptions(prev => ({
      ...prev,
      selectedStatuses: prev.selectedStatuses.includes(status)
        ? prev.selectedStatuses.filter(s => s !== status)
        : [...prev.selectedStatuses, status]
    }));
  };

  const handleExport = () => {
    onExport(exportOptions);
    onClose();
  };

  const handleSelectAllBarangays = () => {
    if (exportOptions.selectedBarangays.length === barangays.length) {
      setExportOptions(prev => ({ ...prev, selectedBarangays: [] }));
    } else {
      setExportOptions(prev => ({ ...prev, selectedBarangays: [...barangays] }));
    }
  };

  const handleSelectAllStatuses = () => {
    if (exportOptions.selectedStatuses.length === APPLICATION_TYPE_OPTIONS.length) {
      setExportOptions(prev => ({ ...prev, selectedStatuses: [] }));
    } else {
      setExportOptions(prev => ({ ...prev, selectedStatuses: [...APPLICATION_TYPE_OPTIONS] }));
    }
  };

  const getPreviewCount = () => {
    let filtered = [...franchisees];
    
    if (exportOptions.selectedBarangays.length > 0) {
      filtered = filtered.filter(f => exportOptions.selectedBarangays.includes(f.barangay));
    }
    
    if (exportOptions.selectedStatuses.length > 0) {
      filtered = filtered.filter(f => 
        exportOptions.selectedStatuses.includes(f.franchiseStatus) ||
        exportOptions.selectedStatuses.includes(f.applicationType)
      );
    }
    
    if (exportOptions.dateRange !== 'all') {
      const now = new Date();
      filtered = filtered.filter(f => {
        if (!f.approvedAt) return false;
        const approvedDate = new Date(f.approvedAt);
        if (isNaN(approvedDate)) return false;
        
        switch (exportOptions.dateRange) {
          case 'thisMonth':
            return approvedDate.getMonth() === now.getMonth() && 
                   approvedDate.getFullYear() === now.getFullYear();
          case 'thisYear':
            return approvedDate.getFullYear() === now.getFullYear();
          case 'custom':
            const start = exportOptions.customStartDate ? new Date(exportOptions.customStartDate) : null;
            const end = exportOptions.customEndDate ? new Date(exportOptions.customEndDate) : null;
            if (start && approvedDate < start) return false;
            if (end && approvedDate > end) return false;
            return true;
          default:
            return true;
        }
      });
    }
    
    return filtered.length;
  };

  const SectionTitle = ({ icon: Icon, title }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Icon sx={{ color: '#0A356B', fontSize: 20 }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#0A356B' }}>
        {title}
      </Typography>
    </Box>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: 3,
          overflow: 'hidden',
          maxHeight: '85vh',
        }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: '#0A356B', 
        color: 'white', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        py: 2,
        px: 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <FileDownloadIcon />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Export to Excel</Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        {/* Sort & Group Section */}
        <Box sx={{ p: 3, bgcolor: '#f8fafc' }}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, mb: 0.5, display: 'block' }}>
                Sort By
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={exportOptions.sortBy}
                  onChange={(e) => handleOptionChange('sortBy', e.target.value)}
                  sx={{ bgcolor: 'white' }}
                >
                  <MenuItem value="franchiseNumber">Franchise Number</MenuItem>
                  <MenuItem value="franchiseeName">Franchisee Name</MenuItem>
                  <MenuItem value="approvedAt">Approved Date</MenuItem>
                  <MenuItem value="barangay">Barangay</MenuItem>
                  <MenuItem value="todaMembership">TODA</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, mb: 0.5, display: 'block' }}>
                Order
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={exportOptions.sortOrder}
                  onChange={(e) => handleOptionChange('sortOrder', e.target.value)}
                  sx={{ bgcolor: 'white' }}
                >
                  <MenuItem value="asc">Ascending (A-Z)</MenuItem>
                  <MenuItem value="desc">Descending (Z-A)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, mb: 0.5, display: 'block' }}>
                Group By
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={exportOptions.groupBy}
                  onChange={(e) => handleOptionChange('groupBy', e.target.value)}
                  sx={{ bgcolor: 'white' }}
                >
                  <MenuItem value="none">No Grouping</MenuItem>
                  <MenuItem value="barangay">Barangay</MenuItem>
                  <MenuItem value="month">Month</MenuItem>
                  <MenuItem value="status">Status</MenuItem>
                  <MenuItem value="toda">TODA</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, mb: 0.5, display: 'block' }}>
                Date Range
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={exportOptions.dateRange}
                  onChange={(e) => handleOptionChange('dateRange', e.target.value)}
                  sx={{ bgcolor: 'white' }}
                >
                  <MenuItem value="all">All Time</MenuItem>
                  <MenuItem value="thisMonth">This Month</MenuItem>
                  <MenuItem value="thisYear">This Year</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {exportOptions.dateRange === 'custom' && (
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <TextField
                size="small"
                label="From"
                type="date"
                value={exportOptions.customStartDate}
                onChange={(e) => handleOptionChange('customStartDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                sx={{ bgcolor: 'white' }}
              />
              <TextField
                size="small"
                label="To"
                type="date"
                value={exportOptions.customEndDate}
                onChange={(e) => handleOptionChange('customEndDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                sx={{ bgcolor: 'white' }}
              />
            </Box>
          )}

          {exportOptions.groupBy !== 'none' && (
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={exportOptions.separateSheets}
                  onChange={(e) => handleOptionChange('separateSheets', e.target.checked)}
                />
              }
              label={<Typography variant="body2">Create separate sheets for each group</Typography>}
              sx={{ mt: 1.5 }}
            />
          )}
        </Box>

        <Divider />

        {/* Filters Section */}
        <Box sx={{ p: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#334155', mb: 2 }}>
            Filter Records
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {/* Barangay Filter */}
            <Box sx={{ 
              flex: 1,
              border: '1px solid #e2e8f0', 
              borderRadius: 2, 
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                px: 1.5,
                py: 1,
                bgcolor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569' }}>
                  Barangay
                </Typography>
                <Button 
                  size="small" 
                  onClick={handleSelectAllBarangays}
                  sx={{ 
                    textTransform: 'none', 
                    fontSize: '0.7rem', 
                    minWidth: 'auto', 
                    py: 0,
                    px: 1,
                    color: '#0A356B',
                  }}
                >
                  {exportOptions.selectedBarangays.length === barangays.length ? 'Clear' : 'Select All'}
                </Button>
              </Box>
              <Box sx={{ p: 1.5, height: 160, overflow: 'auto' }}>
                {barangays.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {barangays.map((barangay) => (
                      <FormControlLabel
                        key={barangay}
                        control={
                          <Checkbox
                            size="small"
                            checked={exportOptions.selectedBarangays.includes(barangay)}
                            onChange={() => handleBarangayToggle(barangay)}
                            sx={{ p: 0.5 }}
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#334155' }}>
                            {barangay}
                          </Typography>
                        }
                        sx={{ m: 0, ml: -0.5 }}
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                    No barangays available
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Status Filter */}
            <Box sx={{ 
              flex: 1,
              border: '1px solid #e2e8f0', 
              borderRadius: 2, 
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                px: 1.5,
                py: 1,
                bgcolor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569' }}>
                  Status
                </Typography>
                <Button 
                  size="small" 
                  onClick={handleSelectAllStatuses}
                  sx={{ 
                    textTransform: 'none', 
                    fontSize: '0.7rem', 
                    minWidth: 'auto', 
                    py: 0,
                    px: 1,
                    color: '#0A356B',
                  }}
                >
                  {exportOptions.selectedStatuses.length === APPLICATION_TYPE_OPTIONS.length ? 'Clear' : 'Select All'}
                </Button>
              </Box>
              <Box sx={{ p: 1.5, height: 160, overflow: 'auto' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {APPLICATION_TYPE_OPTIONS.map((status) => (
                    <FormControlLabel
                      key={status}
                      control={
                        <Checkbox
                          size="small"
                          checked={exportOptions.selectedStatuses.includes(status)}
                          onChange={() => handleStatusToggle(status)}
                          sx={{ p: 0.5 }}
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#334155' }}>
                          {status}
                        </Typography>
                      }
                      sx={{ m: 0, ml: -0.5 }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, textAlign: 'center' }}>
            Leave unselected to include all records
          </Typography>
        </Box>

        <Divider />

        {/* Fields Section */}
        <Box sx={{ p: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#334155', mb: 1.5 }}>
            Fields to Include
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {[
              { key: 'basic', label: 'Basic Info', desc: 'Franchise #, Name, Plate' },
              { key: 'personal', label: 'Personal', desc: 'Contact, Address' },
              { key: 'driver', label: 'Driver', desc: 'Driver Details' },
              { key: 'vehicle', label: 'Vehicle', desc: 'Model, Engine' },
              { key: 'franchise', label: 'Franchise', desc: 'Status, Dates' },
            ].map((field) => (
              <Chip
                key={field.key}
                label={field.label}
                onClick={() => handleFieldToggle(field.key)}
                color={exportOptions.includeFields[field.key] ? 'primary' : 'default'}
                variant={exportOptions.includeFields[field.key] ? 'filled' : 'outlined'}
                sx={{ 
                  borderRadius: 2,
                  '&.MuiChip-colorPrimary': {
                    bgcolor: '#0A356B',
                  }
                }}
              />
            ))}
          </Box>
        </Box>
      </DialogContent>
      
      {/* Footer */}
      <Box sx={{ 
        p: 2.5, 
        bgcolor: '#f8fafc', 
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Typography variant="body2" sx={{ color: '#64748b' }}>
          <strong style={{ color: '#0A356B' }}>{getPreviewCount()}</strong> records to export
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button 
            onClick={onClose} 
            sx={{ 
              color: '#64748b',
              textTransform: 'none',
              fontWeight: 500,
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            variant="contained" 
            startIcon={<FileDownloadIcon />}
            disabled={getPreviewCount() === 0}
            sx={{ 
              bgcolor: '#0A356B', 
              '&:hover': { bgcolor: '#082548' },
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              borderRadius: 2,
            }}
          >
            Export
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

function FranchiseeList() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
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
  const [selectedBarangay, setSelectedBarangay] = useState('all');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Helper function to get document display name with proper status
  const getDocumentDisplayName = (document) => {
    if (!document) return 'Not uploaded';
    
    let fileName = '';
    
    // Extract filename from document
    if (typeof document === 'string') {
      fileName = document.split('/').pop();
    } else if (document.name) {
      fileName = document.name;
    } else if (document.path) {
      fileName = document.path.split('/').pop();
    }
    
    if (!fileName) return 'Available';
    
    // Clean and format the filename
    // Remove timestamps, UUIDs, and other technical prefixes
    fileName = fileName
      .replace(/^\d+[-_]/, '') // Remove leading numbers with dash/underscore
      .replace(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}[-_]/i, '') // Remove UUIDs
      .replace(/[-_]\d{13,}[-_]/, '-') // Remove timestamps (13+ digits)
      .replace(/[-_]+/g, ' ') // Replace dashes and underscores with spaces
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .trim();
    
    // Capitalize first letter of each word for professional appearance
    fileName = fileName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return fileName;
  };

  // Helper function to determine file type from URL extension
  const getFileTypeFromUrl = (url) => {
    if (!url) return 'unknown'
    const ext = url.split('.').pop().toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image'
    if (ext === 'pdf') return 'pdf'
    return 'document'
  }

  // Get auth token using centralized secure token manager
  const getAuthToken = () => {
    return getToken();
  };

  // Fetch franchisees from API (from franchise information, not applications)
  const fetchFranchisees = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await franchiseInformationAPI.getAll();
      // Backend returns { success, data, count }, axios unwraps to response.data
      const data = response.data?.data || response.data || [];
      
      // Transform the data to match the expected format
      // Data comes from FranchiseInformation model (approved franchises)
      const serverApps = Array.isArray(data) ? data : [];
      const transformedData = serverApps.map((app, index) => {
        // Get documents from subdocument
        const docs = app.documents || {};
        
        return {
          id: app._id || app.id,
          recordNumber: String(index + 1).padStart(4, '0'),
          franchiseeName: app.operatorName || '',
          franchiseNumber: app.franchiseNumber || '',
          make: app.unitModel || 'N/A',
          plateNumber: app.mvPlateNo || 'N/A',
          // Use changeType from backend: new, renewal, update_ownership, change_unit, auto_expired, auto_revoked
          applicationType: app.changeType ? app.changeType.charAt(0).toUpperCase() + app.changeType.slice(1).replace(/_/g, ' ') : 'New',
          changeType: app.changeType || 'new',
          franchiseChainId: app.franchiseChainId || '',
          version: app.version || 1,
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
          resolutionNumber: app.resolutionNumber || app.sbResolutionNumber || '',
          resolutionDocument: (app.resolutionDocument || app.sbResolutionDocument || docs.resolutionDocumentObj) ? {
            name: (app.resolutionDocument || app.sbResolutionDocument || docs.resolutionDocumentObj).split('/').pop(),
            path: app.resolutionDocument || app.sbResolutionDocument || docs.resolutionDocumentObj,
            type: getFileTypeFromUrl(app.resolutionDocument || app.sbResolutionDocument || docs.resolutionDocumentObj)
          } : null,
          orNumber: app.officialReceiptNumber || '',
          orDocument: (app.officialReceiptDocument || docs.oRTreasurerOfficeObj) ? {
            name: (app.officialReceiptDocument || docs.oRTreasurerOfficeObj).split('/').pop(),
            path: app.officialReceiptDocument || docs.oRTreasurerOfficeObj,
            type: getFileTypeFromUrl(app.officialReceiptDocument || docs.oRTreasurerOfficeObj)
          } : null,
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
          documentOperatorPicture: docs.operatorPictureObj ? {
            name: docs.operatorPictureObj.split('/').pop(),
            path: docs.operatorPictureObj,
            type: getFileTypeFromUrl(docs.operatorPictureObj)
          } : null,
          documentTreasurerOR: docs.oRTreasurerOfficeObj ? {
            name: docs.oRTreasurerOfficeObj.split('/').pop(),
            path: docs.oRTreasurerOfficeObj,
            type: getFileTypeFromUrl(docs.oRTreasurerOfficeObj)
          } : null
        };
      });

      setFranchisees(transformedData);
    } catch (err) {
      logger.error('Error fetching franchisees:', err);
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
      websocketService.connect('general')
    }

    // Subscribe to franchisee updates
    const handleFranchiseeUpdates = (data) => {
      logger.log('[FranchiseeList] WebSocket franchisee update received:', data);
      fetchFranchisees();
    };

    websocketService.on('franchises-list-updated', handleFranchiseeUpdates);
    websocketService.on('franchisee-updated', handleFranchiseeUpdates);
    websocketService.on('franchise-created', handleFranchiseeUpdates);
    websocketService.on('franchise-updated', handleFranchiseeUpdates);

    return () => {
      websocketService.off('franchises-list-updated', handleFranchiseeUpdates);
      websocketService.off('franchisee-updated', handleFranchiseeUpdates);
      websocketService.off('franchise-created', handleFranchiseeUpdates);
      websocketService.off('franchise-updated', handleFranchiseeUpdates);
    };
  }, [fetchFranchisees]);

  // Get unique barangays for filter dropdown
  const barangays = useMemo(() => {
    const uniqueBarangays = [...new Set(franchisees.map(f => f.barangay).filter(Boolean))];
    return uniqueBarangays.sort();
  }, [franchisees]);

  // Filtered franchisees based on search term and barangay
  const filteredFranchisees = useMemo(() => {
    let filtered = franchisees;
    
    // Filter by barangay
    if (selectedBarangay !== 'all') {
      filtered = filtered.filter(f => f.barangay === selectedBarangay);
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (franchisee) =>
          franchisee.franchiseeName.toLowerCase().includes(searchLower) ||
          franchisee.franchiseNumber.includes(searchLower) ||
          franchisee.plateNumber.toLowerCase().includes(searchLower) ||
          franchisee.recordNumber.includes(searchLower) ||
          franchisee.applicationType.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [franchisees, searchTerm, selectedBarangay]);

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
        
        // Handle GridFS format: gridfs://fileId -> /api/files/fileId
        if (qrPath.startsWith('gridfs://')) {
          const fileId = qrPath.substring(9);
          qrUrl = `${apiBase.replace(/\/$/, '')}/api/files/${fileId}`;
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
      } catch (err) {
        logger.error('[FranchiseeList] Error fetching QR code:', err);
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

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(async (editedData) => {
    setSaving(true);
    setError('');
    
    try {
      // Map frontend fields to backend API fields
      const updatePayload = {
        operatorName: editedData.franchiseeName,
        operatorAddress: editedData.address,
        operatorBarangay: editedData.barangay,
        operatorContactNumber: editedData.contactNumber,
        operatorEmail: editedData.email,
        operatorBirthPlace: editedData.birthPlace,
        operatorCivilStatus: editedData.civilStatus,
        operatorCitizenship: editedData.citizenship,
        todaMembership: editedData.todaMembership,
        coOwnerName: editedData.coOwnerName,
        coOwnerAddress: editedData.coOwnerAddress,
        driverName: editedData.driverName,
        driversAddress: editedData.driversAddress,
        franchiseStatus: editedData.franchiseStatus,
        rate: editedData.rate,
        resolutionNumber: editedData.resolutionNumber,
        officialReceiptNumber: editedData.orNumber,
        unitModel: editedData.unitModel,
        colorMotor: editedData.colorMotor,
        sideCarColor: editedData.colorSidecar,
        mvPlateNo: editedData.mvPlate,
        motorEngineNo: editedData.motorEngineNumber,
        chasisNo: editedData.chassisNumber,
        make: editedData.make,
        plateNumber: editedData.plateNumber,
      };

      // Use the API service for update
      await franchiseInformationAPI.update(editedData.id, updatePayload);

      setSelectedFranchisee(editedData);
      setIsEditing(false);
      
      // Refresh the list
      await fetchFranchisees();
      
      // Show success message
      setNotification({ open: true, message: 'Franchisee information updated successfully!', type: 'success' });
    } catch (err) {
      logger.error('Error saving franchisee:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to save changes. Please try again.';
      setNotification({ open: true, message: errorMessage, type: 'error' });
    } finally {
      setSaving(false);
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

    // Handle different URL formats
    try {
      // GridFS format: gridfs://fileId -> convert to /api/files/fileId
      if (normalized.path && normalized.path.startsWith('gridfs://')) {
        const fileId = normalized.path.substring(9); // Remove 'gridfs://' prefix
        normalized.path = `${API_BASE_URL.replace(/\/$/, '')}/api/files/${fileId}`;
      }
      // Relative path -> prefix with API_BASE_URL
      else if (normalized.path && !/^https?:\/\//i.test(normalized.path)) {
        const pathPart = normalized.path.startsWith('/') ? normalized.path : '/' + normalized.path;
        normalized.path = API_BASE_URL.replace(/\/$/, '') + pathPart;
      }
    } catch (err) {
      logger.warn('[Preview] Error processing file path:', err);
    }

    // If it's an image or PDF, try fetching it and creating an object URL so
    // the browser does not need to embed the backend URL in an iframe (which
    // can be blocked by X-Frame-Options: SAMEORIGIN). This also avoids CORS
    // framing issues by loading the bytes via fetch and serving them from a
    // same-origin blob URL.
    const tryFetchAndPreview = async () => {
      const path = normalized.path;
      
      logger.log('[FilePreview] Attempting to fetch file:', { 
        originalFile: file,
        normalized,
        path 
      });
      
      // Get auth token for secure file access using centralized token manager
      const token = getToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // First, try to fetch the file to get its actual content type
      try {
        const resp = await fetch(path, { 
          mode: 'cors',
          headers
        });
        if (!resp.ok) {
          logger.error('[FilePreview] Fetch failed with status:', resp.status, resp.statusText);
          throw new Error(`Failed to fetch file: ${resp.status} ${resp.statusText}`);
        }
        
        const blob = await resp.blob();
        const contentType = blob.type || resp.headers.get('Content-Type') || '';
        
        const isImage = contentType.includes('image');
        const isPdf = contentType.includes('pdf');
        
        if (isImage || isPdf) {
          // Ensure blob has correct MIME type
          const blobWithType = !blob.type ? new Blob([blob], { type: contentType }) : blob;
          const objectUrl = URL.createObjectURL(blobWithType);
          
          // Revoke previous if any
          if (currentBlobUrlRef.current) URL.revokeObjectURL(currentBlobUrlRef.current);
          currentBlobUrlRef.current = objectUrl;
          
          // Update normalized with detected type
          setPreviewFile({ 
            ...normalized, 
            path: objectUrl,
            type: contentType,
            name: normalized.name || 'document'
          });
          setOpenFilePreview(true);
          return;
        }
        
        // Not an image/pdf - still show preview modal with download option
        const objectUrl = URL.createObjectURL(blob);
        if (currentBlobUrlRef.current) URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = objectUrl;
        
        setPreviewFile({ 
          ...normalized, 
          path: objectUrl,
          type: contentType,
          name: normalized.name || 'document'
        });
        setOpenFilePreview(true);
      } catch (err) {
        logger.warn('[FilePreview] fetch failed:', err);
        setNotification({ open: true, message: 'Failed to load file preview', type: 'error' });
      }
    };

    tryFetchAndPreview();
  }, []);

  const handleCloseFilePreview = useCallback(() => {
    if (currentBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      } catch (err) {
        logger.warn('Failed to revoke blob URL:', err);
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

  const handleBarangayChange = useCallback((event) => {
    setSelectedBarangay(event.target.value);
    setPage(0); // Reset to first page when filter changes
  }, []);

  // Comprehensive export function with options
  const exportToXLSX = useCallback((options) => {
    try {
      let dataToExport = [...filteredFranchisees];
      
      // Apply filters from export options
      // Filter by selected barangays
      if (options.selectedBarangays.length > 0) {
        dataToExport = dataToExport.filter(f => options.selectedBarangays.includes(f.barangay));
      }
      
      // Filter by selected statuses
      if (options.selectedStatuses.length > 0) {
        dataToExport = dataToExport.filter(f => 
          options.selectedStatuses.includes(f.franchiseStatus) ||
          options.selectedStatuses.includes(f.applicationType)
        );
      }
      
      // Filter by date range
      if (options.dateRange !== 'all') {
        const now = new Date();
        dataToExport = dataToExport.filter(f => {
          if (!f.approvedAt) return false;
          const approvedDate = new Date(f.approvedAt);
          if (isNaN(approvedDate)) return false;
          
          switch (options.dateRange) {
            case 'thisMonth':
              return approvedDate.getMonth() === now.getMonth() && 
                     approvedDate.getFullYear() === now.getFullYear();
            case 'thisYear':
              return approvedDate.getFullYear() === now.getFullYear();
            case 'custom':
              const start = options.customStartDate ? new Date(options.customStartDate) : null;
              const end = options.customEndDate ? new Date(options.customEndDate) : null;
              if (start && approvedDate < start) return false;
              if (end && approvedDate > end) return false;
              return true;
            default:
              return true;
          }
        });
      }
      
      // Sort data
      dataToExport.sort((a, b) => {
        let valA = a[options.sortBy] || '';
        let valB = b[options.sortBy] || '';
        
        // Handle date sorting
        if (options.sortBy === 'approvedAt') {
          valA = valA ? new Date(valA) : new Date(0);
          valB = valB ? new Date(valB) : new Date(0);
        } else {
          valA = String(valA).toLowerCase();
          valB = String(valB).toLowerCase();
        }
        
        if (options.sortOrder === 'asc') {
          return valA > valB ? 1 : valA < valB ? -1 : 0;
        } else {
          return valA < valB ? 1 : valA > valB ? -1 : 0;
        }
      });

      // Build columns based on included fields
      const buildRowData = (f) => {
        const row = {};
        
        if (options.includeFields.basic) {
          row['Record Number'] = f.recordNumber;
          row['Franchise Number'] = f.franchiseNumber;
          row['Franchisee Name'] = f.franchiseeName;
          row['Plate Number'] = f.plateNumber;
          row['Application Type'] = f.applicationType;
        }
        
        if (options.includeFields.personal) {
          row['Contact Number'] = f.contactNumber || 'N/A';
          row['Email'] = f.email || 'N/A';
          row['Barangay'] = f.barangay || 'N/A';
          row['Address'] = f.address || 'N/A';
          row['Birth Date'] = f.birthDate || 'N/A';
          row['Birth Place'] = f.birthPlace || 'N/A';
          row['Civil Status'] = f.civilStatus || 'N/A';
          row['Citizenship'] = f.citizenship || 'N/A';
          row['TODA Membership'] = f.todaMembership || 'N/A';
          row['Co-Owner Name'] = f.coOwnerName || 'N/A';
          row['Co-Owner Address'] = f.coOwnerAddress || 'N/A';
        }
        
        if (options.includeFields.driver) {
          row['Driver Name'] = f.driverName || 'N/A';
          row['Driver Address'] = f.driversAddress || 'N/A';
        }
        
        if (options.includeFields.vehicle) {
          row['Unit Model'] = f.unitModel || 'N/A';
          row['Make'] = f.make || 'N/A';
          row['MV Plate'] = f.mvPlate || 'N/A';
          row['Motor/Engine Number'] = f.motorEngineNumber || 'N/A';
          row['Chassis Number'] = f.chassisNumber || 'N/A';
          row['Color (Motor)'] = f.colorMotor || 'N/A';
          row['Color (Sidecar)'] = f.colorSidecar || 'N/A';
        }
        
        if (options.includeFields.franchise) {
          row['Franchise Status'] = f.franchiseStatus || 'N/A';
          row['Rate'] = f.rate || 'N/A';
          row['Approved Date'] = f.approvedAt || 'N/A';
          row['Expiry Date'] = f.expiryDate || 'N/A';
          row['Resolution Number'] = f.resolutionNumber || 'N/A';
          row['OR Number'] = f.orNumber || 'N/A';
        }
        
        return row;
      };

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Build header information based on export conditions
      const buildHeaderInfo = () => {
        const headers = [];
        const now = new Date();
        const exportDate = now.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        headers.push(['FRANCHISEE LIST EXPORT REPORT']);
        headers.push([`Exported on: ${exportDate}`]);
        headers.push([`Generated by: ${user?.name || 'Unknown User'}`]);
        headers.push(['']); // Empty row for spacing
        
        // Add filter conditions
        headers.push(['EXPORT CONDITIONS:']);
        
        // Sort info
        const sortByLabels = {
          franchiseNumber: 'Franchise Number',
          franchiseeName: 'Franchisee Name',
          approvedAt: 'Approved Date',
          barangay: 'Barangay',
          todaMembership: 'TODA'
        };
        headers.push([`Sort By: ${sortByLabels[options.sortBy] || options.sortBy} (${options.sortOrder === 'asc' ? 'Ascending' : 'Descending'})`]);
        
        // Group info
        if (options.groupBy !== 'none') {
          const groupByLabels = {
            barangay: 'Barangay',
            month: 'Month',
            status: 'Status',
            toda: 'TODA'
          };
          headers.push([`Grouped By: ${groupByLabels[options.groupBy] || options.groupBy}`]);
        }
        
        // Date range info
        if (options.dateRange !== 'all') {
          let dateRangeText = '';
          switch (options.dateRange) {
            case 'thisMonth':
              dateRangeText = `This Month (${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`;
              break;
            case 'thisYear':
              dateRangeText = `This Year (${now.getFullYear()})`;
              break;
            case 'custom':
              const startStr = options.customStartDate ? new Date(options.customStartDate).toLocaleDateString('en-US') : 'N/A';
              const endStr = options.customEndDate ? new Date(options.customEndDate).toLocaleDateString('en-US') : 'N/A';
              dateRangeText = `Custom Range: ${startStr} to ${endStr}`;
              break;
            default:
              dateRangeText = 'All Time';
          }
          headers.push([`Date Range: ${dateRangeText}`]);
        } else {
          headers.push(['Date Range: All Time']);
        }
        
        // Barangay filter info
        if (options.selectedBarangays.length > 0) {
          headers.push([`Barangay Filter: ${options.selectedBarangays.join(', ')}`]);
        } else {
          headers.push(['Barangay Filter: All Barangays']);
        }
        
        // Status filter info
        if (options.selectedStatuses.length > 0) {
          headers.push([`Status Filter: ${options.selectedStatuses.join(', ')}`]);
        } else {
          headers.push(['Status Filter: All Statuses']);
        }
        
        // Fields included
        const includedFields = [];
        if (options.includeFields.basic) includedFields.push('Basic Info');
        if (options.includeFields.personal) includedFields.push('Personal Info');
        if (options.includeFields.driver) includedFields.push('Driver Info');
        if (options.includeFields.vehicle) includedFields.push('Vehicle Info');
        if (options.includeFields.franchise) includedFields.push('Franchise Info');
        headers.push([`Fields Included: ${includedFields.join(', ')}`]);
        
        headers.push([`Total Records: ${dataToExport.length}`]);
        headers.push(['']); // Empty row before data
        
        return headers;
      };

      // Handle grouping
      if (options.groupBy !== 'none' && options.separateSheets) {
        // Group data
        const groups = {};
        dataToExport.forEach(f => {
          let groupKey = 'Other';
          
          switch (options.groupBy) {
            case 'barangay':
              groupKey = f.barangay || 'No Barangay';
              break;
            case 'month':
              if (f.approvedAt) {
                const date = new Date(f.approvedAt);
                if (!isNaN(date)) {
                  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                      'July', 'August', 'September', 'October', 'November', 'December'];
                  groupKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                }
              } else {
                groupKey = 'No Date';
              }
              break;
            case 'status':
              groupKey = f.franchiseStatus || f.applicationType || 'Unknown';
              break;
            case 'toda':
              groupKey = f.todaMembership || 'No TODA';
              break;
          }
          
          if (!groups[groupKey]) groups[groupKey] = [];
          groups[groupKey].push(f);
        });

        // Create separate sheets for each group
        Object.keys(groups).sort().forEach(groupKey => {
          const groupData = groups[groupKey].map(buildRowData);
          
          // Create worksheet with header info for each group
          const headerInfo = buildHeaderInfo();
          headerInfo.push([`Group: ${groupKey} (${groups[groupKey].length} records)`]);
          headerInfo.push(['']);
          
          const worksheet = XLSX.utils.aoa_to_sheet(headerInfo);
          XLSX.utils.sheet_add_json(worksheet, groupData, { origin: -1 });
          
          // Auto-adjust column widths
          const maxWidths = {};
          groupData.forEach(row => {
            Object.keys(row).forEach(key => {
              const val = String(row[key] || '');
              maxWidths[key] = Math.max(maxWidths[key] || key.length, val.length);
            });
          });
          worksheet['!cols'] = Object.keys(maxWidths).map(key => ({ wch: Math.min(maxWidths[key] + 2, 50) }));
          
          // Sanitize sheet name (max 31 chars, no special chars)
          let sheetName = groupKey.substring(0, 31).replace(/[*?:/\\[\]]/g, '-');
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        });

        // Add summary sheet with header
        const summaryHeaderInfo = buildHeaderInfo();
        summaryHeaderInfo.push(['GROUP SUMMARY']);
        summaryHeaderInfo.push(['']);
        
        const summaryData = Object.keys(groups).sort().map(key => ({
          'Group': key,
          'Count': groups[key].length
        }));
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryHeaderInfo);
        XLSX.utils.sheet_add_json(summarySheet, summaryData, { origin: -1 });
        
        // Set column widths for summary
        summarySheet['!cols'] = [{ wch: 30 }, { wch: 10 }];
        
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      } else {
        // Single sheet with optional grouping indicator
        let exportData = dataToExport;
        
        if (options.groupBy !== 'none') {
          // Sort by group first
          exportData = [...dataToExport].sort((a, b) => {
            let groupA = '', groupB = '';
            
            switch (options.groupBy) {
              case 'barangay':
                groupA = a.barangay || 'zzz';
                groupB = b.barangay || 'zzz';
                break;
              case 'month':
                groupA = a.approvedAt || 'zzz';
                groupB = b.approvedAt || 'zzz';
                break;
              case 'status':
                groupA = a.franchiseStatus || a.applicationType || 'zzz';
                groupB = b.franchiseStatus || b.applicationType || 'zzz';
                break;
              case 'toda':
                groupA = a.todaMembership || 'zzz';
                groupB = b.todaMembership || 'zzz';
                break;
            }
            
            return groupA.localeCompare(groupB);
          });
        }
        
        const sheetData = exportData.map(f => {
          const row = buildRowData(f);
          // Add group column if grouping is enabled
          if (options.groupBy !== 'none') {
            let groupValue = '';
            switch (options.groupBy) {
              case 'barangay':
                groupValue = f.barangay || 'No Barangay';
                break;
              case 'month':
                if (f.approvedAt) {
                  const date = new Date(f.approvedAt);
                  if (!isNaN(date)) {
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                        'July', 'August', 'September', 'October', 'November', 'December'];
                    groupValue = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                  }
                } else {
                  groupValue = 'No Date';
                }
                break;
              case 'status':
                groupValue = f.franchiseStatus || f.applicationType || 'Unknown';
                break;
              case 'toda':
                groupValue = f.todaMembership || 'No TODA';
                break;
            }
            return { 'Group': groupValue, ...row };
          }
          return row;
        });

        // Create worksheet with header info
        const headerInfo = buildHeaderInfo();
        const worksheet = XLSX.utils.aoa_to_sheet(headerInfo);
        XLSX.utils.sheet_add_json(worksheet, sheetData, { origin: -1 });
        
        // Auto-adjust column widths
        const maxWidths = {};
        sheetData.forEach(row => {
          Object.keys(row).forEach(key => {
            const val = String(row[key] || '');
            maxWidths[key] = Math.max(maxWidths[key] || key.length, val.length);
          });
        });
        worksheet['!cols'] = Object.keys(maxWidths).map(key => ({ wch: Math.min(maxWidths[key] + 2, 50) }));
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Franchisee List');
      }

      // Generate filename
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      let filename = `franchisee_export_${dateStr}`;
      
      if (options.groupBy !== 'none') {
        filename += `_by_${options.groupBy}`;
      }
      
      filename += '.xlsx';

      // Export file
      XLSX.writeFile(workbook, filename);

      setNotification({ open: true, message: `Successfully exported ${dataToExport.length} franchisees to Excel`, type: 'success' });
      setExportDialogOpen(false);
    } catch (error) {
      logger.error('Export error:', error);
      setNotification({ open: true, message: 'Failed to export data', type: 'error' });
    }
  }, [filteredFranchisees, user]);

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
          <Typography variant="h4" className="page-title">
            Franchisee List
          </Typography>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Search Bar and Filters */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Box sx={{ flex: '1 1 400px', display: 'flex', gap: 1 }}>
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
              sx={{ minWidth: 'auto', px: 2 }}
            >
              <SearchIcon />
            </Button>
          </Box>
          
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="barangay-filter-label">
              <FilterListIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} />
              Filter by Barangay
            </InputLabel>
            <Select
              labelId="barangay-filter-label"
              value={selectedBarangay}
              onChange={handleBarangayChange}
              label="Filter by Barangay"
            >
              <MenuItem value="all">All Barangays</MenuItem>
              {barangays.map((barangay) => (
                <MenuItem key={barangay} value={barangay}>
                  {barangay}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<FileDownloadIcon />}
            onClick={() => setExportDialogOpen(true)}
            sx={{
              bgcolor: '#0A356B',
              '&:hover': { bgcolor: '#082548' },
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
            }}
          >
            Export to Excel
          </Button>
        </Box>

        {/* Results count */}
        {(searchTerm || selectedBarangay !== 'all') && (
          <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
            {selectedBarangay !== 'all' && `Barangay: ${selectedBarangay} - `}
            Found {filteredFranchisees.length} result{filteredFranchisees.length !== 1 ? 's' : ''}
          </Typography>
        )}

        {/* Franchisee Records Table */}
        {loading ? (
          <PageLoader 
            loading={loading} 
            message="Loading franchisees..." 
            minHeight={400}
          />
        ) : (
          <Fade in={!loading} timeout={400}>
            <Box>
        <Paper className="admin-table-container" elevation={2}>
          <TableContainer className="admin-table-wrapper">
            <Table className="admin-table" stickyHeader aria-label="franchisee table">
            <TableHead>
              <TableRow>
                <TableCell className="admin-table-header-cell col-id">Franchise Number</TableCell>
                <TableCell className="admin-table-header-cell col-name" align="left">Franchisee Name</TableCell>
                <TableCell className="admin-table-header-cell col-contact">Plate Number</TableCell>
                <TableCell className="admin-table-header-cell col-status">Type</TableCell>
                <TableCell className="admin-table-header-cell col-status">Status</TableCell>
                <TableCell className="admin-table-header-cell col-barangay" align="left">Address</TableCell>
                <TableCell className="admin-table-header-cell col-actions">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedFranchisees.length > 0 ? (
                paginatedFranchisees.map((row) => {
                  // Only mark as previous owner if franchise was revoked
                  const isPreviousOwner = row.franchiseStatus === 'Revoked';
                  
                  return (
                    <TableRow 
                      key={row.id}
                      className="admin-table-row"
                      onClick={() => handleRowClick(row)}
                      hover
                      sx={isPreviousOwner ? { bgcolor: '#fff3e0' } : {}}
                    >
                      <TableCell className="admin-table-cell">{row.franchiseNumber}</TableCell>
                      <TableCell className="admin-table-cell col-name" align="left">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {row.franchiseeName}
                          {isPreviousOwner && (
                            <Chip 
                              label="Past" 
                              size="small" 
                              variant="outlined"
                              color="warning"
                              sx={{ height: 20, fontSize: '0.65rem' }} 
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell className="admin-table-cell">{row.plateNumber}</TableCell>
                      <TableCell className="admin-table-cell">
                        <Chip 
                          label={row.applicationType}
                          size="small"
                          color={getChangeTypeColor(row.changeType)}
                          sx={{ fontWeight: 500, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell className="admin-table-cell">
                        <Chip 
                          label={row.franchiseStatus || 'N/A'}
                          size="small"
                          color={getStatusColor(row.franchiseStatus)}
                          variant={isPreviousOwner ? 'outlined' : 'filled'}
                          sx={{ fontWeight: 500, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell className="admin-table-cell col-barangay" align="left">{row.address}</TableCell>
                      <TableCell className="admin-table-cell">
                        <IconButton 
                          size="small" 
                          className="action-icon-button view"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(row);
                          }}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="admin-table-empty">
                    <Typography className="admin-table-empty-text">
                      No franchisees found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            </Table>
          </TableContainer>
          
          <div className="admin-table-pagination">
            <TablePagination
              rowsPerPageOptions={[10, 15, 25, 50]}
              component="div"
              count={filteredFranchisees.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </div>
        </Paper>
            </Box>
          </Fade>
        )}

        {/* Franchisee Details Modal */}
        <FranchiseeDetailsModal
          open={modalOpen}
          onClose={handleCloseModal}
          franchisee={selectedFranchisee}
          isEditing={isEditing}
          onEdit={handleEdit}
          onSave={handleSave}
          onCancelEdit={handleCancelEdit}
          onFilePreview={handleOpenFilePreview}
          getFileIcon={getFileIcon}
          getDocumentDisplayName={getDocumentDisplayName}
          qrBlobUrl={qrBlobUrl}
          saving={saving}
          user={user}
        />

        {/* Export Options Dialog */}
        <ExportOptionsDialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          onExport={exportToXLSX}
          franchisees={filteredFranchisees}
          barangays={barangays}
        />

        {/* File Preview Modal */}
        <Modal
          open={openFilePreview}
          onClose={handleCloseFilePreview}
          aria-labelledby="file-preview-modal"
          sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
          slotProps={{
            backdrop: {
              sx: {
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(4px)',
              },
            },
          }}
        >
          <Box 
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%',
              maxWidth: '900px',
              height: '85vh',
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <Box 
              sx={{ 
                p: 2.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: '#f8f9fa',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                {previewFile.type?.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(previewFile.name) ? (
                  <ImageIcon sx={{ color: '#2196f3', fontSize: 28 }} />
                ) : previewFile.type?.includes('pdf') || previewFile.name?.toLowerCase().endsWith('.pdf') ? (
                  <PictureAsPdfIcon sx={{ color: '#d32f2f', fontSize: 28 }} />
                ) : (
                  <InsertDriveFileIcon sx={{ color: '#757575', fontSize: 28 }} />
                )}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 600,
                      fontSize: '1.125rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#1a1a1a',
                    }}
                  >
                    {previewFile.name}
                  </Typography>
                  {previewFile.type && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                      {previewFile.type}
                    </Typography>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = previewFile.path;
                    link.download = previewFile.name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  sx={{ 
                    borderColor: '#0A356B',
                    color: '#0A356B',
                    textTransform: 'none',
                    fontWeight: 500,
                    '&:hover': { 
                      borderColor: '#082548',
                      bgcolor: 'rgba(10, 53, 107, 0.04)'
                    }
                  }}
                >
                  Download
                </Button>
                <IconButton
                  onClick={handleCloseFilePreview}
                  sx={{ 
                    color: '#666',
                    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.08)' }
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>
            
            {/* Preview Content */}
            <Box 
              sx={{ 
                flex: 1,
                overflow: 'hidden',
                bgcolor: '#2b2b2b',
              }}
            >
              {previewFile.type?.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(previewFile.name) ? (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 3,
                  }}
                >
                  <img 
                    src={previewFile.path} 
                    alt={previewFile.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    }}
                    onError={(e) => {
                      logger.error('Image preview failed:', e);
                      e.target.style.display = 'none';
                    }}
                  />
                </Box>
              ) : previewFile.type?.includes('pdf') || previewFile.name?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewFile.path}
                  title={previewFile.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    backgroundColor: '#525252',
                  }}
                />
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2.5,
                    p: 4,
                    textAlign: 'center',
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    m: 4,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <InsertDriveFileIcon sx={{ fontSize: 80, color: '#bdbdbd' }} />
                  <Typography variant="h6" sx={{ color: '#424242', fontWeight: 500 }}>
                    Preview Not Available
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
                    This file type cannot be previewed directly in the browser. Please download the file to view its contents.
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<DownloadIcon />}
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = previewFile.path;
                      link.download = previewFile.name;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    sx={{
                      mt: 1,
                      bgcolor: '#0A356B',
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 4,
                      py: 1.5,
                      '&:hover': { bgcolor: '#082548' }
                    }}
                  >
                    Download File
                  </Button>
                </Box>
              )}
            </Box>
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