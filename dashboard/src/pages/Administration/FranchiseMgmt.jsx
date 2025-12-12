import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import '../../Styles/Administrator_Css/FranchiseMgmt.css'
import '../../Styles/Administrator_Css/SharedTable.css'
import Sidebar from './Sidebar'
import { franchiseAPI, API_BASE_URL } from '../Services/api'
import websocketService from '../../services/websocket'
import { useAuth } from '../../contexts/AuthContext'
import { validateFile, formatFileSize } from '../../utils/fileValidation'
import { compressFile } from '../../utils/compressFile'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Modal,
  Box,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  IconButton,
  InputAdornment,
  Link,
  CircularProgress,
  Snackbar,
  Alert,
  Chip,
  Fade,
  LinearProgress,
} from '@mui/material'
import PageLoader from '../../components/PageLoader'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import ImageIcon from '@mui/icons-material/Image'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import VisibilityIcon from '@mui/icons-material/Visibility'
import DownloadIcon from '@mui/icons-material/Download'
import GetAppIcon from '@mui/icons-material/GetApp'
import { previewFilledPDF, downloadFilledPDF, getPdfFieldNames } from '../../utils/pdfFiller'

// Application type constants for better type safety and maintainability
const APPLICATION_TYPES = {
  NEW: 'new',
  RENEWAL: 'renewal',
  CHANGE_UNIT: 'change-unit',
  UPDATE_OWNERSHIP: 'update-ownership'
}

const APPLICATION_TYPE_LABELS = {
  [APPLICATION_TYPES.NEW]: 'New',
  [APPLICATION_TYPES.RENEWAL]: 'Renewal',
  [APPLICATION_TYPES.CHANGE_UNIT]: 'Change Unit',
  [APPLICATION_TYPES.UPDATE_OWNERSHIP]: 'Update Ownership'
}

/**
 * Helper function to determine file type from URL extension
 * Moved outside component for use in normalizeDocument
 */
const getFileTypeFromUrl = (url) => {
  if (!url) return 'unknown'
  if (typeof url !== 'string') return 'unknown'
  const ext = url.split('.').pop().toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  return 'document'
}

/**
 * Convert gridfs:// URL to proper HTTP URL
 * @param {string} url - URL that might be gridfs:// format
 * @returns {string} Converted HTTP URL
 */
const convertGridFSUrl = (url) => {
  if (!url || typeof url !== 'string') return url
  if (url.startsWith('gridfs://')) {
    const fileId = url.substring(9) // Remove 'gridfs://' prefix
    return `${API_BASE_URL.replace(/\/$/, '')}/api/files/${fileId}`
  }
  if (url.startsWith('/')) {
    return `${API_BASE_URL.replace(/\/$/, '')}${url}`
  }
  return url
}

/**
 * Normalize document from backend to frontend format
 * Backend now returns enriched documents as objects with {url, displayName, type, ...}
 * Handles both new format and legacy string format for backward compatibility
 * @param {Object|string} doc - Document object or legacy URL string
 * @param {string} fallbackName - Fallback name if not available
 * @returns {Object|null} Normalized document object {name, path, type}
 */
const normalizeDocument = (doc, fallbackName = 'Document') => {
  if (!doc) return null
  
  // New enriched format from backend: {url, displayName, type, documentType, ...}
  if (typeof doc === 'object' && doc.url) {
    return {
      name: doc.displayName || fallbackName,
      path: convertGridFSUrl(doc.url),
      type: doc.type || 'application/octet-stream',
      documentType: doc.documentType || null,
      uploadedAt: doc.uploadedAt || null,
      fileSize: doc.fileSize || null
    }
  }
  
  // Legacy string format (just URL - could be gridfs://, /api/files/, or other)
  if (typeof doc === 'string') {
    return {
      name: fallbackName,
      path: convertGridFSUrl(doc),
      type: getFileTypeFromUrl(doc)
    }
  }
  
  return null
}

/**
 * Reusable File Upload Field Component with compression progress bar
 * Shows upload status, file size info, and compression progress
 */
const FileUploadField = React.memo(({ 
  name, 
  label, 
  required = true, 
  accept = "image/jpeg,image/png,application/pdf",
  formData,
  processingFiles,
  compressionProgress,
  handleFileChange
}) => {
  const isProcessing = processingFiles[name] || false
  const progress = compressionProgress[name] || 0
  const fileData = formData[name]
  
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151', mb: 1 }}>
        {label}
      </Typography>
      <TextField
        type="file"
        name={name}
        onChange={handleFileChange}
        fullWidth
        required={required}
        size="small"
        disabled={isProcessing}
        InputLabelProps={{ shrink: true }}
        inputProps={{ accept }}
      />
      
      {/* Compression Progress Bar */}
      {isProcessing && (
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <CircularProgress size={14} sx={{ color: '#0A356B' }} />
            <Typography variant="caption" sx={{ color: '#0A356B', fontWeight: 500 }}>
              Compressing... {progress}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ 
              height: 6, 
              borderRadius: 3,
              backgroundColor: '#E5E7EB',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#0A356B',
                borderRadius: 3,
              }
            }} 
          />
        </Box>
      )}
      
      {/* File Info Display */}
      {fileData && !isProcessing && (
        <Box sx={{ 
          mt: 1, 
          p: 1, 
          backgroundColor: '#F0FDF4', 
          borderRadius: 1,
          border: '1px solid #86EFAC',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Typography variant="caption" sx={{ color: '#166534', fontWeight: 500 }}>
            ✓ {fileData.name}
          </Typography>
          {fileData.originalSize && fileData.compressedSize && fileData.originalSize !== fileData.compressedSize && (
            <Chip 
              label={`${formatFileSize(fileData.originalSize)} → ${formatFileSize(fileData.compressedSize)}`}
              size="small"
              sx={{ 
                backgroundColor: '#DCFCE7',
                color: '#166534',
                fontSize: '0.7rem',
                height: 20
              }}
            />
          )}
        </Box>
      )}
    </Box>
  )
})

function FranchiseMgmt() {
  const { user } = useAuth() // Get current user for role-based rendering
  const userRole = user?.role || 'bplo-admin' // Default to bplo-admin for backward compatibility
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // Filter: all, pending, bplo-approved, awaiting-sb
  const [openAddModal, setOpenAddModal] = useState(false)
  const [openViewModal, setOpenViewModal] = useState(false)
  const [openRejectModal, setOpenRejectModal] = useState(false)
  const [openSBApprovalModal, setOpenSBApprovalModal] = useState(false)
  const [openAcceptFranchiseModal, setOpenAcceptFranchiseModal] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [resolutionNumber, setResolutionNumber] = useState('')
  const [resolutionFile, setResolutionFile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [notification, setNotification] = useState({ open: false, message: '', type: 'info' })
  
 
  const [openFilePreview, setOpenFilePreview] = useState(false)
  const [previewFile, setPreviewFile] = useState({ name: '', type: '', path: '' })
  const currentBlobUrlRef = useRef(null)
  const qrBlobUrlRef = useRef(null)
  const [qrBlobUrl, setQrBlobUrl] = useState(null)
  const isUpdatingRef = useRef(false) // Prevent duplicate WebSocket updates
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null)
  const [openPdfPreview, setOpenPdfPreview] = useState(false)
  
  // File compression states
  const [compressionProgress, setCompressionProgress] = useState({})
  const [processingFiles, setProcessingFiles] = useState({})
  
  const [pendingApplications, setPendingApplications] = useState([])

  // Polling interval (ms). Set to 0 to disable polling completely.
  // When WebSocket is connected, polling is automatically disabled
  const POLL_INTERVAL_MS = 0 // Disabled - relying on WebSocket for real-time updates

  // State for the form when adding a new franchise
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    sidecarPlateNumber: '',
    name: '',
    contactNumber: '',
    operatorEmail: '',
    address: '',
    barangay: '',
    birthPlace: '',
    birthDate: '',
    civilStatus: '',
    citizenship: '',
    todaMembership: '',
    unitModel: '',
    colorMotor: '',
    colorSidecar: '',
    mvPlate: '',
    motorEngineNumber: '',
    chassisNumber: '',
    driverName: '',
    driverAddress: '',
    documentRegistration: null,
    documentBarangayClearance: null,
    documentCedula: null,
    documentDriversLicense: null,
    documentVotersAffidavit: null,
    documentMotorChassisStencil: null,
    documentOrLTO: null,
    documentCR: null,
    documentPicture: null,
    documentOperatorPicture: null,
    // Walk-in specific fields (OR submitted during walk-in application)
    officialReceiptNumber: '',
    documentOfficialReceipt: null,
  })

 
  /**
   * Fetch all pending franchise applications from backend
   * Uses secure franchiseAPI.getPending() with automatic token refresh
   */

  const isFetchingRef = useRef(false)
  const fetchAllPending = useCallback(async () => {
    // Prevent duplicate simultaneous requests
    if (isFetchingRef.current) {
      console.log('[FranchiseMgmt] Fetch already in progress, skipping')
      return
    }
    
    isFetchingRef.current = true
    setIsLoading(true)
    try {
      // Fetch applications based on user role
      // SB Admin sees applications awaiting final approval (with OR submitted)
      // BPLO Admin sees pending applications
      const response = userRole === 'sb-admin' 
        ? await franchiseAPI.getApproved() 
        : await franchiseAPI.getPending()
      
      // Backend returns { success, data }, axios unwraps to response.data
      const serverApps = response.data?.data || response.data || []
      
      console.log(`[FranchiseMgmt] Fetched ${userRole === 'sb-admin' ? 'SB approval' : 'pending'} applications:`, Array.isArray(serverApps) ? serverApps.length : 0)
      console.log('[FranchiseMgmt] Application types breakdown:', 
        serverApps.reduce((acc, app) => {
          const type = app.applicationType || 'unknown'
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {})
      )
      
      // Map backend fields to frontend format
      // Backend uses operatorName, operatorContactNumber, operatorBirthPlace, etc.
      const normalizedServerApps = Array.isArray(serverApps) ? serverApps.map((it) => ({
        id: it.id || it._id,
        franchiseNumber: it.franchiseNumber || '',
        name: it.operatorName || it.driverName || '',
        make: it.unitModel || '',
        plateNumber: it.mvPlateNo || it.mvPlate || '',
        applicationType: it.applicationType || 'new',
        address: it.operatorAddress || '',
        barangay: it.operatorBarangay || '',
        contactNumber: it.operatorContactNumber || '',
        email: it.operatorEmail || '',
        coOwnerName: it.coOwnerName || '',
        coOwnerAddress: it.coOwnerAddress || '',
        sidecarPlateNumber: it.sideCarPlateNumber || '',
        birthPlace: it.operatorBirthPlace || '',
        birthDate: it.operatorBirthDate ? new Date(it.operatorBirthDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '',
        civilStatus: it.operatorCivilStatus || '',
        citizenship: it.operatorCitizenship || '',
        todaMembership: it.todaMembership || '',
        unitModel: it.unitModel || '',
        colorMotor: it.colorMotor || '',
        colorSidecar: it.sideCarColor || '',
        mvPlate: it.mvPlateNo || '',
        motorEngineNumber: it.motorEngineNo || '',
        chassisNumber: it.chasisNo || '',
        driverName: it.driverName || '',
        driverAddress: it.driversAddress || '',
        statusOfBPLO: it.statusOfBPLO || 'pending',
        submittedAt: it.submittedAt ? new Date(it.submittedAt).toLocaleDateString() : '',
        // OR and approval information (for SB admins)
        officialReceiptNumber: it.officialReceiptNumber || '',
        orSubmittedAt: it.orSubmittedAt ? new Date(it.orSubmittedAt).toLocaleDateString() : '',
        bploApprovedBy: it.bploApprovedBy || '',
        bploApprovedAt: it.bploApprovedAt || '',
        bploInspectionRequired: it.bploInspectionRequired || false,
        bploDisapprovedReason: it.bploDisapprovedReason || '',
        sbApprovedBy: it.sbApprovedBy || '',
        sbApprovedAt: it.sbApprovedAt || '',
        sbResolutionNumber: it.sbResolutionNumber || '',
        sbResolutionDocument: it.sbResolutionDocument || '',
        // Documents - backend now returns enriched objects with {url, displayName, type, ...}
        // Using normalizeDocument handles both new format and legacy string format
        documentRegistration: normalizeDocument(it.documents?.motorRegistrationObj, 'Motor Registration'),
        documentBarangayClearance: normalizeDocument(it.documents?.barangayClearanceObj, 'Barangay Clearance'),
        documentCedula: normalizeDocument(it.documents?.cedulaObj, 'Cedula'),
        documentDriversLicense: normalizeDocument(it.documents?.driversLicenseObj, "Driver's License"),
        documentVotersAffidavit: normalizeDocument(it.documents?.votersAffidavitObj, "Voter's Affidavit"),
        documentChassisStencil: normalizeDocument(it.documents?.motorChassisStencilObj, 'Chassis Stencil'),
        documentPicture: normalizeDocument(it.documents?.driverPictureObj, 'Driver Picture'),
        documentOperatorPicture: normalizeDocument(it.documents?.operatorPictureObj, 'Operator Picture'),
        documentORLTO: normalizeDocument(it.documents?.oRLTOObj, 'OR LTO'),
        documentCRLTO: normalizeDocument(it.documents?.cRLTOObj, 'CR LTO'),
        documents: {
          ...it.documents,
          oRTreasurerOfficeObj: it.documents?.oRTreasurerOfficeObj || null
        },
        qrCode: it.qrCode || null,
      })) : []

      setPendingApplications(normalizedServerApps)
    } catch (err) {
      console.error('[FranchiseMgmt] Error fetching pending applications:', err)
      
      setNotification({
        open: true,
        message: err.response?.data?.error || 'Failed to load pending applications',
        type: 'error'
      })
      
      setPendingApplications([])
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [userRole])

  // Pause polling when any modal is open
  const isAnyModalOpen = openAddModal || openViewModal || openRejectModal || openFilePreview

  // Initial fetch on mount - CRITICAL for reliable data loading
  useEffect(() => {
    console.log('[FranchiseMgmt] Component mounted, fetching initial data...')
    fetchAllPending()
  }, [fetchAllPending])

  // WebSocket real-time updates
  useEffect(() => {
    // Determine WebSocket room and event based on user role
    const websocketRoom = userRole === 'sb-admin' ? 'sb-admins' : 'bplo-admins'
    const websocketEvent = userRole === 'sb-admin' ? 'approved-applications' : 'pending-applications'
    
    let hasReceivedInitialData = false
    let connectionTimeout = null
    
    // Connect to WebSocket for real-time updates
    if (!websocketService.isConnected()) {
      console.log('[FranchiseMgmt] Connecting to WebSocket as:', websocketRoom)
      websocketService.connect(websocketRoom)
      
      // Wait for WebSocket to emit initial data before falling back to API
      connectionTimeout = setTimeout(() => {
        if (!hasReceivedInitialData) {
          console.log('[FranchiseMgmt] No WebSocket data received, fetching via API fallback')
          fetchAllPending()
        }
      }, 2000) // 2 second timeout
    } else {
      // If already connected, just join the correct room
      console.log('[FranchiseMgmt] Already connected, joining room:', websocketRoom)
      websocketService.joinRoom(websocketRoom)
    }

    // Subscribe to real-time application updates
    const handleApplicationUpdates = (applications) => {
      console.log(`[FranchiseMgmt] WebSocket update - ${websocketEvent}:`, applications?.length || 0)
      
      // Mark that we received data from WebSocket
      hasReceivedInitialData = true
      if (connectionTimeout) {
        clearTimeout(connectionTimeout)
        connectionTimeout = null
      }
      
      // Prevent duplicate updates during processing
      if (isUpdatingRef.current) {
        console.log('[FranchiseMgmt] Already updating, skipping duplicate WebSocket event')
        return
      }
      
      // Only update if we have applications or if this is an explicit clear
      if (!Array.isArray(applications)) {
        console.log('[FranchiseMgmt] Invalid applications data, skipping update')
        return
      }
      
      // For SB admins, ignore empty WebSocket updates if we already have data
      // This prevents the WebSocket from clearing data when BPLO approves (which triggers a re-emit)
      if (userRole === 'sb-admin' && applications.length === 0 && pendingApplications.length > 0) {
        console.log('[FranchiseMgmt] Ignoring empty WebSocket update for SB admin (preserving existing data)')
        return
      }
      
      isUpdatingRef.current = true
      console.log('[FranchiseMgmt] Processing WebSocket update...')
      
      const normalizedApps = applications.map((it) => ({
        id: it.id || it._id,
        franchiseNumber: it.franchiseNumber || '',
        name: it.operatorName || it.driverName || '',
        make: it.unitModel || '',
        plateNumber: it.mvPlateNo || '',
        applicationType: it.applicationType || 'new',
        address: it.operatorAddress || it.driversAddress || '',
        barangay: it.operatorBarangay || '',
        contactNumber: it.operatorContactNumber || '',
        email: it.operatorEmail || '',
        sidecarPlateNumber: it.sideCarPlateNumber || '',
        birthPlace: it.operatorBirthPlace || '',
        birthDate: it.operatorBirthDate ? new Date(it.operatorBirthDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '',
        civilStatus: it.operatorCivilStatus || '',
        citizenship: it.operatorCitizenship || '',
        todaMembership: it.todaMembership || '',
        unitModel: it.unitModel || '',
        colorMotor: it.colorMotor || '',
        colorSidecar: it.sideCarColor || '',
        mvPlate: it.mvPlateNo || '',
        motorEngineNumber: it.motorEngineNo || '',
        chassisNumber: it.chasisNo || '',
        driverName: it.driverName || '',
        driverAddress: it.driversAddress || '',
        coOwnerName: it.coOwnerName || '',
        coOwnerAddress: it.coOwnerAddress || '',
        officialReceiptNumber: it.officialReceiptNumber || '',
        orSubmittedAt: it.orSubmittedAt ? new Date(it.orSubmittedAt).toLocaleDateString() : '',
        bploApprovedBy: it.bploApprovedBy || '',
        bploApprovedAt: it.bploApprovedAt || '',
        bploDisapprovedReason: it.bploDisapprovedReason || '',
        bploInspectionRequired: it.bploInspectionRequired || false,
        sbApprovedBy: it.sbApprovedBy || '',
        sbApprovedAt: it.sbApprovedAt || '',
        sbResolutionNumber: it.sbResolutionNumber || '',
        sbResolutionDocument: it.sbResolutionDocument || '',
        // Documents - using normalizeDocument for enriched backend format
        documentRegistration: normalizeDocument(it.documents?.motorRegistrationObj, 'Motor Registration'),
        documentBarangayClearance: normalizeDocument(it.documents?.barangayClearanceObj, 'Barangay Clearance'),
        documentCedula: normalizeDocument(it.documents?.cedulaObj, 'Cedula'),
        documentDriversLicense: normalizeDocument(it.documents?.driversLicenseObj, "Driver's License"),
        documentVotersAffidavit: normalizeDocument(it.documents?.votersAffidavitObj, "Voter's Affidavit"),
        documentChassisStencil: normalizeDocument(it.documents?.motorChassisStencilObj, 'Chassis Stencil'),
        documentPicture: normalizeDocument(it.documents?.driverPictureObj, 'Driver Picture'),
        documentOperatorPicture: normalizeDocument(it.documents?.operatorPictureObj, 'Operator Picture'),
        documentORLTO: normalizeDocument(it.documents?.oRLTOObj, 'OR LTO'),
        documentCRLTO: normalizeDocument(it.documents?.cRLTOObj, 'CR LTO'),
        documents: {
          ...it.documents,
          oRTreasurerOfficeObj: it.documents?.oRTreasurerOfficeObj || null
        },
        qrCode: it.qrCode || null,
        statusOfBPLO: it.statusOfBPLO || 'pending',
        submittedAt: it.submittedAt || '',
      }))
      setPendingApplications(normalizedApps)
      console.log('[FranchiseMgmt] State updated with', normalizedApps.length, 'applications')
      
      // Reset the updating flag immediately after state update
      // Using setTimeout to ensure state has been committed
      setTimeout(() => {
        isUpdatingRef.current = false
        console.log('[FranchiseMgmt] Update lock released')
      }, 50)
    }

    websocketService.on(websocketEvent, handleApplicationUpdates)
    
    // Listen for all application type events - backend should re-emit full list
    const handleNewApplication = (application) => {
      const appType = application?.applicationType || 'unknown'
      console.log(`[FranchiseMgmt] New ${appType} application received:`, {
        id: application?._id,
        type: appType,
        status: application?.statusOfBPLO,
        role: userRole
      })
      // Backend should automatically re-emit full list via main event
      // No manual refetch needed to prevent duplicate requests
    }
    
    // Subscribe to all application type events
    const applicationEvents = ['new-application', 'new-renewal', 'new-amendment']
    applicationEvents.forEach(event => {
      websocketService.on(event, handleNewApplication)
    })
    
    // SB Admin specific event
    if (userRole === 'sb-admin') {
      websocketService.on('new-sb-application', handleNewApplication)
    }

    // Polling as fallback (only when modals are closed AND WebSocket is not connected)
    let pollId = null
    const isWebSocketActive = websocketService.isConnected()
    if (POLL_INTERVAL_MS > 0 && !isAnyModalOpen && !isWebSocketActive) {
      console.log('[FranchiseMgmt] WebSocket not active, starting polling fallback...')
      pollId = setInterval(() => {
        console.log('[FranchiseMgmt] Polling for updates (fallback mode)...')
        fetchAllPending()
      }, POLL_INTERVAL_MS)
    } else if (POLL_INTERVAL_MS > 0 && isWebSocketActive) {
      console.log('[FranchiseMgmt] WebSocket active, polling disabled')
    }

    return () => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout)
      }
      websocketService.off(websocketEvent, handleApplicationUpdates)
      
      // Clean up all application event listeners
      applicationEvents.forEach(event => {
        websocketService.off(event, handleNewApplication)
      })
      
      if (userRole === 'sb-admin') {
        websocketService.off('new-sb-application', handleNewApplication)
      }
      
      if (pollId) clearInterval(pollId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnyModalOpen, userRole]) // Removed fetchAllPending from dependencies to prevent refetch loops


  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchTerm])


  const filteredApplications = useMemo(() => {
    let filtered = pendingApplications.filter(app => {
      const searchLower = debouncedSearchTerm.toLowerCase()
      const appType = APPLICATION_TYPE_LABELS[app.applicationType] || app.applicationType || ''
      
      return (
        app.name?.toLowerCase().includes(searchLower) ||
        app.franchiseNumber?.toLowerCase().includes(searchLower) ||
        app.plateNumber?.toLowerCase().includes(searchLower) ||
        appType.toLowerCase().includes(searchLower)
      )
    })

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(app => {
        const status = app.statusOfBPLO || 'pending'
        if (statusFilter === 'pending') {
          return status === 'pending'
        } else if (statusFilter === 'bplo-approved') {
          return status === 'bplo-approved'
        } else if (statusFilter === 'awaiting-sb') {
          return status === 'awaiting-sb'
        } else if (statusFilter === 'sb-approved') {
          return status === 'sb-approved'
        }
        return true
      })
    }

    return filtered
  }, [pendingApplications, debouncedSearchTerm, statusFilter])

  

  const handleOpenAddModal = useCallback(() => setOpenAddModal(true), [])
  const handleCloseAddModal = useCallback(() => setOpenAddModal(false), [])
  
  const handleOpenViewModal = useCallback((application) => {
   
    // Use normalized fields directly, no further fallback needed
    setSelectedApplication({
      ...application,
      unitModel: application.unitModel,
      colorMotor: application.colorMotor,
      colorSidecar: application.colorSidecar,
      mvPlate: application.mvPlate,
      motorEngineNumber: application.motorEngineNumber,
      chassisNumber: application.chassisNumber,
      driverName: application.driverName,
      driverAddress: application.driverAddress,
      contactNumber: application.contactNumber,
      address: application.address,
    })
    setOpenViewModal(true)
  }, [])
  const handleCloseViewModal = useCallback(() => setOpenViewModal(false), [])

  // When a selected application changes, attempt to fetch its QR image and create a blob URL
  React.useEffect(() => {
    let cancelled = false
    
    // Cleanup previous QR blob using centralized function
    if (qrBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(qrBlobUrlRef.current)
        qrBlobUrlRef.current = null
      } catch (e) {
        console.warn('Failed to revoke previous QR blob:', e)
      }
    }

    const fetchQr = async () => {
      if (!selectedApplication || !selectedApplication.qrCode) {
        setQrBlobUrl(null)
        return
      }
      try {
        const raw = selectedApplication.qrCode
        const url = /^https?:\/\//i.test(raw) ? raw : (API_BASE_URL.replace(/\/$/, '') + (raw.startsWith('/') ? raw : '/' + raw))
        const resp = await fetch(url)
        if (!resp.ok) throw new Error('Failed to fetch QR')
        const blob = await resp.blob()
        if (cancelled) return
        const objUrl = URL.createObjectURL(blob)
        qrBlobUrlRef.current = objUrl
        setQrBlobUrl(objUrl)
      } catch (err) {
        console.warn('[FranchiseMgmt] Failed to fetch QR blob for inline display:', err)
        setQrBlobUrl(null)
      }
    }

    fetchQr()

    return () => {
      cancelled = true
      if (qrBlobUrlRef.current) {
        try {
          URL.revokeObjectURL(qrBlobUrlRef.current)
          qrBlobUrlRef.current = null
        } catch (e) {
          console.warn('Failed to revoke QR blob on cleanup:', e)
        }
      }
      setQrBlobUrl(null)
    }
  }, [selectedApplication])
  
  const handleOpenRejectModal = useCallback(() => {
    setOpenViewModal(false)
    setOpenRejectModal(true)
  }, [])
  const handleCloseRejectModal = useCallback(() => setOpenRejectModal(false), [])
  
  /**
   *For PReview ng files
   */
  const handleOpenFilePreview = useCallback((file) => {
    if (!file) {
      setNotification({ open: true, message: 'File not available for preview', type: 'info' })
      return
    }

    // Normalize legacy values: the backend previously stored string paths for files
    // (e.g. "/uploads/..") or newly stores objects { name, type, path }.
    let normalized = { name: '', type: '', path: '' }

    // If file is an object with expected properties, shallow-copy it
    if (typeof file === 'object' && (file.path || file.name)) {
      normalized = {
        name: file.name || file.originalname || '',
        type: file.type || file.mimetype || '',
        path: file.path || file.pathname || ''
      }
    } else if (typeof file === 'string') {
      // Legacy string path -> construct object
      normalized = {
        name: file.split('/').pop() || file,
        type: '',
        path: file
      }
    }

    // Handle different URL formats
    try {
      // GridFS format: gridfs://fileId -> convert to /api/files/fileId
      if (normalized.path && normalized.path.startsWith('gridfs://')) {
        const fileId = normalized.path.substring(9) // Remove 'gridfs://' prefix
        normalized.path = `${API_BASE_URL.replace(/\/$/, '')}/api/files/${fileId}`
        console.log('[Preview] GridFS format detected, converting to HTTP URL:', fileId)
      }
      // Relative path -> prefix with API_BASE_URL
      else if (normalized.path && !/^https?:\/\//i.test(normalized.path)) {
        const pathPart = normalized.path.startsWith('/') ? normalized.path : '/' + normalized.path
        normalized.path = API_BASE_URL.replace(/\/$/, '') + pathPart
      }
    } catch (err) {
      console.warn('[Preview] Error processing file path:', err)
    }

    // If it's an image or PDF, try fetching it and creating an object URL so
    // the browser does not need to embed the backend URL in an iframe (which
    // can be blocked by X-Frame-Options: SAMEORIGIN). This also avoids CORS
    // framing issues by loading the bytes via fetch and serving them from a
    // same-origin blob URL.
    const tryFetchAndPreview = async () => {
      const path = normalized.path
      
      // First, try to fetch the file to get its actual content type
      try {
        const resp = await fetch(path, { mode: 'cors' })
        if (!resp.ok) throw new Error(`Failed to fetch file: ${resp.status}`)
        
        const blob = await resp.blob()
        const contentType = blob.type || resp.headers.get('Content-Type') || ''
        
        console.log('[FilePreview] Fetched file, content type:', contentType)
        
        const isImage = contentType.includes('image')
        const isPdf = contentType.includes('pdf')
        
        if (isImage || isPdf) {
          // Ensure blob has correct MIME type
          const blobWithType = !blob.type ? new Blob([blob], { type: contentType }) : blob
          const objectUrl = URL.createObjectURL(blobWithType)
          
          // Revoke previous if any
          if (currentBlobUrlRef.current) URL.revokeObjectURL(currentBlobUrlRef.current)
          currentBlobUrlRef.current = objectUrl
          
          // Update normalized with detected type
          setPreviewFile({ 
            ...normalized, 
            path: objectUrl,
            type: contentType,
            name: normalized.name || 'document'
          })
          setOpenFilePreview(true)
          return
        }
        
        // Not an image/pdf - still show preview modal with download option
        const objectUrl = URL.createObjectURL(blob)
        if (currentBlobUrlRef.current) URL.revokeObjectURL(currentBlobUrlRef.current)
        currentBlobUrlRef.current = objectUrl
        
        setPreviewFile({ 
          ...normalized, 
          path: objectUrl,
          type: contentType,
          name: normalized.name || 'document'
        })
        setOpenFilePreview(true)
      } catch (err) {
        console.warn('[FilePreview] fetch failed:', err)
        setNotification({ open: true, message: 'Failed to load file preview', type: 'error' })
      }
    }

    tryFetchAndPreview()
  }, [])
  
  // Centralized blob URL cleanup function
  const revokeBlobUrl = useCallback((ref) => {
    try {
      if (ref.current) {
        URL.revokeObjectURL(ref.current)
        ref.current = null
      }
    } catch (err) {
      console.warn('Failed to revoke blob URL:', err)
    }
  }, [])

  const handleCloseFilePreview = useCallback(() => {
    revokeBlobUrl(currentBlobUrlRef)
    setOpenFilePreview(false)
  }, [revokeBlobUrl])
  
  /**
   * Get appropriate icon for file type (memoized)
   */
  const getFileIcon = useCallback((fileType) => {
    if (!fileType) return <InsertDriveFileIcon />
    
    if (fileType.includes('image')) {
      return <ImageIcon />
    } else if (fileType.includes('pdf')) {
      return <PictureAsPdfIcon />
    } else {
      return <InsertDriveFileIcon />
    }
  }, [])
  
  /**
   * Form handlers
   */
  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }, [])
  

  const handleFileChange = useCallback(async (e) => {
    const { name, files } = e.target
    if (!files || !files[0]) return
    
    const file = files[0]
    
    // Validate file using shared utility
    const validation = validateFile(file)
    if (!validation.success) {
      setNotification({
        open: true,
        message: validation.message,
        type: 'error'
      })
      // Reset the input
      e.target.value = ''
      return
    }
    
    // Check if file needs compression (larger than 300KB)
    const willCompress = file.size > 300 * 1024
    
    // Show loading state if file will be compressed
    if (willCompress) {
      setProcessingFiles(prev => ({ ...prev, [name]: true }))
      setCompressionProgress(prev => ({ ...prev, [name]: 0 }))
    }
    
    try {
      let processedFile = file
      
      if (willCompress) {
        // Simulate progressive compression steps for better UX
        setCompressionProgress(prev => ({ ...prev, [name]: 30 }))
        await new Promise(resolve => setTimeout(resolve, 200))
        setCompressionProgress(prev => ({ ...prev, [name]: 60 }))
        
        // Compress the file (images and PDFs)
        processedFile = await compressFile(file)
        
        setCompressionProgress(prev => ({ ...prev, [name]: 100 }))
        
        // Brief delay to show completion
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Show compression success message only if file was actually compressed
        if (processedFile.size !== file.size) {
          const originalSize = formatFileSize(file.size)
          const newSize = formatFileSize(processedFile.size)
          const savings = Math.round((1 - processedFile.size / file.size) * 100)
          
          setNotification({
            open: true,
            message: `Compression complete: ${originalSize} → ${newSize} (${savings}% smaller!)`,
            type: 'success'
          })
        }
      }
      
      setFormData(prev => {
        // Revoke previous blob URL if exists
        if (prev[name]?.path && prev[name].path.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(prev[name].path)
          } catch (err) {
            console.warn('Failed to revoke previous file blob:', err)
          }
        }
        
        // Create object URL for preview
        const objectURL = URL.createObjectURL(processedFile)
        return {
          ...prev,
          [name]: {
            name: processedFile.name,
            type: processedFile.type,
            path: objectURL,
            file: processedFile,
            originalSize: file.size,
            compressedSize: processedFile.size
          }
        }
      })
    } catch (error) {
      console.error('[FileCompression] Error:', error)
      setNotification({
        open: true,
        message: 'Compression failed. Using original file.',
        type: 'warning'
      })
      
      // Use original file if compression fails
      setFormData(prev => {
        if (prev[name]?.path && prev[name].path.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(prev[name].path)
          } catch (err) {
            console.warn('Failed to revoke previous file blob:', err)
          }
        }
        
        const objectURL = URL.createObjectURL(file)
        return {
          ...prev,
          [name]: {
            name: file.name,
            type: file.type,
            path: objectURL,
            file: file
          }
        }
      })
    } finally {
      setProcessingFiles(prev => ({ ...prev, [name]: false }))
      setCompressionProgress(prev => ({ ...prev, [name]: 0 }))
    }
  }, [])
  
  /**
   * Cleanup object URLs only when component unmounts
   */
  useEffect(() => {
    const currentFormData = { ...formData }
    return () => {
      // Cleanup all object URLs to prevent memory leaks
      Object.keys(currentFormData).forEach(key => {
        if (key.startsWith('document') && currentFormData[key]?.path && currentFormData[key]?.path.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(currentFormData[key].path)
          } catch (e) {
            console.warn('Failed to revoke blob URL:', e)
          }
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  /**
   * Submit new application (walk-in - admin-submitted)
   * Uses secure franchiseAPI.create() with FormData for file uploads
   * 
   * WALK-IN PROCESS:
   * 1. Admin enters applicant's information including email/phone
   * 2. Admin can optionally enter OR number and upload OR document
   * 3. Application is marked as walk-in (isWalkIn: true)
   * 4. Backend sends notification to applicant via email or SMS
   * 5. Application goes through normal BPLO/SB approval process
   * 6. Franchise number is generated and linked when SB accepts the application
   * 
   * Note: The franchise number is NOT assigned at submission time.
   * It will be generated and linked when the SB admin accepts the application
   * after final approval (handleAcceptFranchise or handleSBApproval)
   */
  const handleSubmitApplication = async (e) => {
    e.preventDefault()
    
    // Validate that at least email OR contact number is provided
    const hasEmail = formData.operatorEmail && formData.operatorEmail.trim() !== ''
    const hasContact = formData.contactNumber && formData.contactNumber.trim() !== ''
    
    if (!hasEmail && !hasContact) {
      setNotification({
        open: true,
        message: 'Please provide either an Email Address OR Contact Number for notifications',
        type: 'error'
      })
      return
    }
    
    setIsLoading(true)
    
    try {
      // Create FormData for file uploads
      const formDataToSend = new FormData()
      
      // Map frontend field names to backend expected names
      const fieldMapping = {
        name: 'operatorName',
        contactNumber: 'operatorContactNumber',
        operatorEmail: 'operatorEmail',
        address: 'operatorAddress',
        barangay: 'operatorBarangay',
        birthPlace: 'operatorBirthPlace',
        birthDate: 'operatorBirthDate',
        civilStatus: 'operatorCivilStatus',
        citizenship: 'operatorCitizenship',
        todaMembership: 'todaMembership',
        colorSidecar: 'sideCarColor',
        mvPlate: 'mvPlateNo',
        motorEngineNumber: 'motorEngineNo',
        chassisNumber: 'chasisNo',
        driverName: 'driverName',
        driverAddress: 'driversAddress',
        unitModel: 'unitModel',
        colorMotor: 'colorMotor',
        // Document mappings
        documentRegistration: 'motorRegistrationObj',
        documentBarangayClearance: 'barangayClearanceObj',
        documentCedula: 'cedulaObj',
        documentDriversLicense: 'driversLicenseObj',
        documentVotersAffidavit: 'votersAffidavitObj',
        documentMotorChassisStencil: 'motorChassisStencilObj',
        documentPicture: 'driverPictureObj',
        documentOperatorPicture: 'operatorPictureObj',
        documentOrLTO: 'oRLTOObj',
        documentCR: 'cRLTOObj',
        documentOfficialReceipt: 'oRTreasurerOfficeObj'
      }
      
      // Add form fields with correct backend names
      Object.keys(formData).forEach(key => {
        const backendKey = fieldMapping[key] || key
        
        // Skip officialReceiptNumber and documentOfficialReceipt - handled separately below
        if (key === 'officialReceiptNumber' || key === 'documentOfficialReceipt') {
          return
        }
        
        if (key.startsWith('document') && formData[key]?.file) {
          // Add file uploads with backend field name
          formDataToSend.append(backendKey, formData[key].file)
        } else if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
          // Add regular fields with backend field name
          formDataToSend.append(backendKey, formData[key])
        }
      })
      
      // Add application type
      formDataToSend.append('applicationType', 'new')
      
      // Mark as walk-in application (admin-submitted)
      formDataToSend.append('isWalkIn', 'true')
      
      // Add OR number if provided (walk-in)
      if (formData.officialReceiptNumber?.trim()) {
        formDataToSend.append('officialReceiptNumber', formData.officialReceiptNumber.trim())
        formDataToSend.append('orSubmittedAt', new Date().toISOString())
      }
      
      // Add OR document if provided (walk-in)
      if (formData.documentOfficialReceipt?.file) {
        formDataToSend.append('oRTreasurerOfficeObj', formData.documentOfficialReceipt.file)
      }

      // Submit to backend using secure API
      const response = await franchiseAPI.create(formDataToSend)
      
      console.log('[FranchiseMgmt] Application submitted:', response.data)

      // Refresh pending applications list
      await fetchAllPending()
      
      // Close modal
      handleCloseAddModal()
      
      // Revoke all blob URLs before resetting form
      Object.keys(formData).forEach(key => {
        if (key.startsWith('document') && formData[key]?.path && formData[key].path.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(formData[key].path)
          } catch (e) {
            console.warn('Failed to revoke blob URL on form reset:', e)
          }
        }
      })
      
      // Reset form
      setFormData({
        date: new Date().toISOString().slice(0, 10),
        sidecarPlateNumber: '',
        name: '',
        contactNumber: '',
        operatorEmail: '',
        address: '',
        barangay: '',
        birthPlace: '',
        birthDate: '',
        civilStatus: '',
        citizenship: '',
        todaMembership: '',
        unitModel: '',
        colorMotor: '',
        colorSidecar: '',
        mvPlate: '',
        motorEngineNumber: '',
        chassisNumber: '',
        driverName: '',
        driverAddress: '',
        documentRegistration: null,
        documentBarangayClearance: null,
        documentCedula: null,
        documentDriversLicense: null,
        documentVotersAffidavit: null,
        documentMotorChassisStencil: null,
        documentPicture: null,
        documentOperatorPicture: null,
        documentOrLTO: null,
        documentCR: null,
        officialReceiptNumber: '',
        documentOfficialReceipt: null,
      })
      
      setNotification({
        open: true,
        message: response.data?.message || 'Walk-in application submitted and forwarded to SB for approval. The applicant will be notified via email or phone.',
        type: 'success'
      })
    } catch (error) {
      console.error('[FranchiseMgmt] Error submitting application:', error)
      setNotification({
        open: true,
        message: error.response?.data?.error || 'Failed to submit application',
        type: 'error'
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  /**
   * Approve application (role-based: BPLO or SB)
   */
  const handleApproveApplication = async () => {
    if (!selectedApplication) return
    
    // Prevent double-submission
    if (isLoading) {
      console.log('[FranchiseMgmt] Already processing, ignoring duplicate click')
      return
    }
    
    // SB Admin requires resolution number - show modal
    if (userRole === 'sb-admin') {
      setOpenViewModal(false)
      setOpenSBApprovalModal(true)
      return
    }
    
    // BPLO Admin approval
    setIsLoading(true)
    
    try {
      console.log('[FranchiseMgmt] BPLO approving application:', selectedApplication.id)
      
      // BPLO approve via secure API
      const response = await franchiseAPI.approveBPLO(selectedApplication.id)
      
      console.log('[FranchiseMgmt] Application approved by BPLO:', response.data)

      // Refresh pending applications list
      await fetchAllPending()

      setNotification({ 
        open: true, 
        message: 'Application approved by BPLO. Applicant will be notified to proceed with inspection and OR submission.', 
        type: 'success' 
      })
      
      handleCloseViewModal()
    } catch (error) {
      console.error('[FranchiseMgmt] Error approving application:', error)
      
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to approve application'
      const isConflict = error.response?.status === 409
      
      setNotification({
        open: true,
        message: isConflict 
          ? `Already approved: ${errorMessage}` 
          : errorMessage,
        type: 'error'
      })
      
      if (isConflict) {
        await fetchAllPending()
        handleCloseViewModal()
      }
    } finally {
      setIsLoading(false)
    }
  }
  
  /**
   * SB Admin final approval with resolution number and optional document
   * This is the FINAL step - automatically creates franchise record
   */
  const handleSBApproval = async () => {
    if (!selectedApplication || !resolutionNumber.trim()) {
      setNotification({
        open: true,
        message: 'Resolution number is required',
        type: 'error'
      })
      return
    }
    
    setIsLoading(true)
    
    try {
      console.log('[FranchiseMgmt] SB final approval - this will create franchise:', selectedApplication.id)
      
      // Create FormData for multipart upload if resolution document is provided
      const formData = new FormData()
      formData.append('resolutionNumber', resolutionNumber.trim())
      if (resolutionFile) {
        formData.append('resolutionDocument', resolutionFile)
      }
      
      // Step 1: SB Approval with resolution
      console.log('[FranchiseMgmt] Step 1/2: Approving with resolution number...')
      const approvalResponse = await franchiseAPI.approveSBWithDocument(selectedApplication.id, formData)
      console.log('[FranchiseMgmt] Step 1/2 completed - SB approval done:', approvalResponse.data)

      // Small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 500))

      // Step 2: Immediately create franchise record (FINAL STEP)
      console.log('[FranchiseMgmt] Step 2/2: Creating franchise record in FranchiseList...')
      const isNew = selectedApplication.applicationType === 'new' || !selectedApplication.applicationType
      
      let franchiseResponse
      try {
        franchiseResponse = await (isNew 
          ? franchiseAPI.acceptNewFranchise(selectedApplication.id, {})
          : franchiseAPI.acceptRenewAmend(selectedApplication.id, {}))
        console.log('[FranchiseMgmt] Step 2/2 completed - Franchise created successfully:', franchiseResponse.data)
      } catch (acceptError) {
        console.error('[FranchiseMgmt] Error in Step 2 (franchise creation):', acceptError)
        throw new Error(`Approval successful but failed to create franchise: ${acceptError.response?.data?.error || acceptError.message}. The application is now in 'sb-approved' status and can be manually accepted from the list.`)
      }

      // Refresh list to remove completed application
      await fetchAllPending()

      setNotification({ 
        open: true, 
        message: 'Franchise approved and created successfully! The franchise is now active in the system.', 
        type: 'success' 
      })
      
      setOpenSBApprovalModal(false)
      setResolutionNumber('')
      setResolutionFile(null)
      handleCloseViewModal()
    } catch (error) {
      console.error('[FranchiseMgmt] Error in SB final approval process:', error)
      
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to complete franchise approval'
      
      setNotification({
        open: true,
        message: errorMessage,
        type: 'error'
      })
      
      // Refresh the list in case the approval succeeded but franchise creation failed
      await fetchAllPending()
    } finally {
      setIsLoading(false)
    }
  }
  
  /**
   * SB Admin accept franchise - creates FranchiseInformation record
   * This is the final step after SB approval that moves the application to the franchise list
   */
  const handleAcceptFranchise = async () => {
    if (!selectedApplication) {
      setNotification({
        open: true,
        message: 'No application selected',
        type: 'error'
      })
      return
    }
    
    setIsLoading(true)
    
    try {
      console.log('[FranchiseMgmt] Accepting franchise for application:', selectedApplication.id)
      
      // Determine which endpoint to call based on application type
      const isNew = selectedApplication.applicationType === 'new'
      const response = isNew 
        ? await franchiseAPI.acceptNewFranchise(selectedApplication.id, {})
        : await franchiseAPI.acceptRenewAmend(selectedApplication.id, {})
      
      console.log('[FranchiseMgmt] Franchise created/updated successfully:', response.data)

      await fetchAllPending()

      setNotification({ 
        open: true, 
        message: 'Franchise record created successfully. The franchise is now active in the system.', 
        type: 'success' 
      })
      
      setOpenAcceptFranchiseModal(false)
      handleCloseViewModal()
    } catch (error) {
      console.error('[FranchiseMgmt] Error accepting franchise:', error)
      
      const errorMessage = error.response?.data?.error || error.message || 'Failed to accept franchise'
      setNotification({
        open: true,
        message: errorMessage,
        type: 'error'
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  /**
   * Submit disapproval/rejection (BPLO only)
   */
  const handleSubmitRejection = async () => {
    if (!selectedApplication || !rejectionReason.trim()) {
      setNotification({
        open: true,
        message: 'Please provide a reason for disapproval',
        type: 'error'
      })
      return
    }
    
    setIsLoading(true)
    
    try {
      console.log('[FranchiseMgmt] BPLO disapproving application:', selectedApplication.id)
      
      // BPLO disapprove via secure API
      await franchiseAPI.disapproveBPLO(selectedApplication.id, rejectionReason.trim())

      console.log('[FranchiseMgmt] Application disapproved by BPLO')
      
      // Refresh pending applications list
      await fetchAllPending()

      setNotification({ 
        open: true, 
        message: 'Application disapproved. Applicant has been notified.', 
        type: 'success' 
      })
      
      handleCloseRejectModal()
      setRejectionReason('')
    } catch (error) {
      console.error('[FranchiseMgmt] Error disapproving application:', error)
      setNotification({
        open: true,
        message: error.response?.data?.error || 'Failed to disapprove application',
        type: 'error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle notification close
   */
  const handleNotificationClose = useCallback(() => {
    setNotification({ open: false, message: '', type: 'info' })
  }, [])

  /**
   * Handle PDF Preview
   */
  const handlePdfPreview = async () => {
    if (!selectedApplication) return
    
    setIsLoading(true)
    try {
      const url = await previewFilledPDF(selectedApplication)
      setPdfPreviewUrl(url)
      setOpenPdfPreview(true)
      
      setNotification({
        open: true,
        message: 'PDF preview generated successfully',
        type: 'success'
      })
    } catch (error) {
      console.error('[FranchiseMgmt] Error previewing PDF:', error)
      setNotification({
        open: true,
        message: 'Failed to generate PDF preview',
        type: 'error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle PDF Download
      */
  const handlePdfDownload = async () => {
    if (!selectedApplication) return
    
    setIsLoading(true)
    try {
      const filename = `franchise-application-${selectedApplication.name?.replace(/\s+/g, '-') || selectedApplication.id}.pdf`
      await downloadFilledPDF(selectedApplication, filename)
      
      setNotification({
        open: true,
        message: 'PDF downloaded successfully',
        type: 'success'
      })
    } catch (error) {
      console.error('[FranchiseMgmt] Error downloading PDF:', error)
      setNotification({
        open: true,
        message: 'Failed to download PDF',
        type: 'error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Close PDF preview modal
   */
  const handleClosePdfPreview = () => {
    setOpenPdfPreview(false)
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl)
      setPdfPreviewUrl(null)
    }
  }

  /**
   * Debug: Show PDF field names
   */
  const handleShowPdfFields = async () => {
    try {
      const fields = await getPdfFieldNames()
      console.log('[FranchiseMgmt] PDF Fields:', fields)
      setNotification({
        open: true,
        message: `Found ${fields.length} fields in PDF. Check console for details.`,
        type: 'info'
      })
    } catch (error) {
      console.error('[FranchiseMgmt] Error getting PDF fields:', error)
      setNotification({
        open: true,
        message: 'Failed to read PDF fields',
        type: 'error'
      })
    }
  }

  /**
   * Get status display information
   */
  const getStatusInfo = (statusOfBPLO, hasOR, applicationType = 'new') => {
    const typeLabel = APPLICATION_TYPE_LABELS[applicationType] || 'Application'
    
    switch (statusOfBPLO) {
      case 'pending':
        return { label: `${typeLabel} - For BPLO Verification`, color: '#F59E0B', bgColor: '#FEF3C7' }
      case 'bplo-approved':
        // Check if OR is submitted for more accurate status
        if (hasOR) {
          return { label: `${typeLabel} - Ready for SB Final Approval`, color: '#059669', bgColor: '#D1FAE5' }
        }
        return { label: `${typeLabel} - Awaiting Client OR Number`, color: '#DC8C09', bgColor: '#FFF4E6' }
      case 'awaiting-sb':
        return { label: `${typeLabel} - Ready for SB Final Approval`, color: '#0A356B', bgColor: '#DBEAFE' }
      case 'sb-approved':
        return { label: `${typeLabel} - Completing Franchise Creation...`, color: '#059669', bgColor: '#D1FAE5' }
      case 'bplo-disapproved':
        return { label: `${typeLabel} - Disapproved by BPLO`, color: '#DC2626', bgColor: '#FEE2E2' }
      default:
        return { label: `${typeLabel} - Unknown Status`, color: '#6B7280', bgColor: '#F3F4F6' }
    }
  }

  return (
    <div className="franchise-mgmt-container">
      <Sidebar />
      <div className="franchise-mgmt-content">
        <Typography variant="h4" className="page-title">
          {userRole === 'sb-admin' ? 'SB Final Approval' : 'Franchise Management'}
        </Typography>
        
        {/* Search bar and Add button */}
        <div className="search-bar">
          <TextField
            placeholder="Search Franchisee"
            variant="outlined"
            fullWidth
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            className="add-button"
            onClick={handleOpenAddModal}
          >
            Add New Franchise
          </Button>
        </div>
        
        {/* Status Filter */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            Filter by Status:
          </Typography>
          <FormControl sx={{ minWidth: 280 }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              size="small"
              displayEmpty
            >
              <MenuItem value="all">All Applications</MenuItem>
              <MenuItem value="pending">For BPLO Verification</MenuItem>
              <MenuItem value="bplo-approved">Approved by BPLO - Awaiting OR</MenuItem>
              <MenuItem value="awaiting-sb">Awaiting SB Resolution</MenuItem>
              {userRole === 'sb-admin' && (
                <MenuItem value="sb-approved">Resolution Approved - Completing</MenuItem>
              )}
            </Select>
          </FormControl>
          <Typography variant="body2" sx={{ color: '#6B7280', ml: 'auto' }}>
            Total: {filteredApplications.length} application(s)
          </Typography>
        </Box>
        
        {/* Pending Applications Table */}
        <Typography variant="h6" className="pending-header">
          PENDING FRANCHISE APPLICATIONS
        </Typography>
        
        {isLoading && !pendingApplications.length ? (
          <PageLoader 
            loading={isLoading} 
            message="Loading applications..."
            minHeight={300}
          />
        ) : (
          <Fade in={!isLoading || pendingApplications.length > 0} timeout={400}>
          <Paper className="admin-table-container" elevation={2}>
            <TableContainer className="admin-table-wrapper">
              <Table className="admin-table" stickyHeader aria-label="pending franchises table">
                <TableHead>
                  <TableRow>
                    <TableCell className="admin-table-header-cell col-id">Record No.</TableCell>
                    <TableCell className="admin-table-header-cell col-name" align="left">Franchisee Name</TableCell>
                    <TableCell className="admin-table-header-cell col-contact">Make</TableCell>
                    <TableCell className="admin-table-header-cell col-status">Application Type</TableCell>
                    <TableCell className="admin-table-header-cell col-status">Status</TableCell>
                    <TableCell className="admin-table-header-cell col-barangay" align="left">Address</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredApplications.length > 0 ? (
                    filteredApplications.map((application, index) => {
                      const hasOR = !!(application.officialReceiptNumber && application.officialReceiptNumber.trim())
                      const statusInfo = getStatusInfo(application.statusOfBPLO || 'pending', hasOR, application.applicationType)
                      return (
                        <TableRow 
                          key={application.id}
                          className="admin-table-row"
                          onClick={() => handleOpenViewModal(application)}
                          hover
                        >
                          <TableCell className="admin-table-cell">{index + 1}</TableCell>
                          <TableCell className="admin-table-cell col-name" align="left">{application.name}</TableCell>
                          <TableCell className="admin-table-cell">{application.make}</TableCell>
                          <TableCell className="admin-table-cell">
                            <span className={`status-badge ${
                              application.applicationType === APPLICATION_TYPES.NEW ? 'status-pending' : 
                              application.applicationType === APPLICATION_TYPES.RENEWAL ? 'status-active' : 
                              application.applicationType === APPLICATION_TYPES.CHANGE_UNIT ? 'status-investigating' :
                              application.applicationType === APPLICATION_TYPES.UPDATE_OWNERSHIP ? 'status-warning' :
                              'status-default'
                            }`}>
                              {APPLICATION_TYPE_LABELS[application.applicationType] || application.applicationType || 'Unknown'}
                            </span>
                          </TableCell>
                          <TableCell className="admin-table-cell">
                            <span className="status-badge" style={{
                              backgroundColor: statusInfo.bgColor,
                              color: statusInfo.color
                            }}>
                              {statusInfo.label}
                            </span>
                          </TableCell>
                          <TableCell className="admin-table-cell col-barangay" align="left">{application.address}</TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="admin-table-empty">
                        <Typography className="admin-table-empty-text">
                          {isLoading ? 'Loading...' : 'No pending applications found'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
          </Fade>
        )}
      </div>
      
      {/* Add New Franchise Modal */}
      <Modal
        open={openAddModal}
        onClose={handleCloseAddModal}
        aria-labelledby="add-franchise-modal"
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(3px)',
            },
          },
        }}
      >
        <Box className="modal-container" sx={{ 
          maxWidth: '900px', 
          width: '90%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}>
          <Box className="modal-header" sx={{ 
            p: 3, 
            borderBottom: '2px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Typography variant="h5" component="h2" sx={{ 
              fontWeight: 700, 
              color: '#fff',
              fontSize: '1.5rem',
              letterSpacing: '0.5px'
            }}>
               WALK-IN FRANCHISE APPLICATION
            </Typography>
            <IconButton 
              onClick={handleCloseAddModal} 
              sx={{ 
                color: '#fff',
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          
          <Box className="modal-body" sx={{ 
            maxHeight: 'calc(90vh - 180px)', 
            overflowY: 'auto', 
            p: 3,
            background: '#FAFBFC',
            '&::-webkit-scrollbar': {
              width: '8px'
            },
            '&::-webkit-scrollbar-track': {
              background: '#F1F5F9'
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#CBD5E1',
              borderRadius: '4px',
              '&:hover': {
                background: '#94A3B8'
              }
            }
          }}>
            <form onSubmit={handleSubmitApplication} id="franchise-form">
              {/* Walk-in Information Banner */}
              <Box sx={{ 
                mb: 3, 
                p: 2.5, 
                background: 'linear-gradient(135deg, #EBF4FF 0%, #E0F2FE 100%)',
                borderRadius: 2,
                border: '2px solid #93C5FD',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
              }}>
                <Typography variant="body1" sx={{ fontWeight: 600, color: '#1E40AF', mb: 1 }}>
                  👤 Walk-In Application Process
                </Typography>
                <Typography variant="body2" sx={{ color: '#3B82F6', fontSize: '0.9rem' }}>
                  Complete all required information. <strong>Provide either Email OR Phone Number</strong> - applicant will be notified via available contact method.
                </Typography>
              </Box>

              {/* Date Row */}
              <Box sx={{ mb: 3 }}>
                <TextField
                  label="Date"
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleFormChange}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                  size="small"
                  disabled
                  sx={{ maxWidth: '300px' }}
                />
              </Box>

              {/* Personal Information Section */}
              <Typography variant="h6" sx={{ 
                fontWeight: 700, 
                color: '#0A356B', 
                mb: 2,
                pb: 1,
                borderBottom: '3px solid #0A356B',
                fontSize: '1.1rem',
                letterSpacing: '0.5px'
              }}>
                PERSONAL INFORMATION
              </Typography>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
              <TextField
                label="Name of Operator"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                fullWidth
                required
                size="small"
              />
              <TextField
                label="Contact Number"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleFormChange}
                fullWidth
                size="small"
                placeholder="09123456789"
                helperText="Required if no email provided"
                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
              />
            </Box>
            
            <TextField
              label="Email Address (for notifications)"
              name="operatorEmail"
              type="email"
              value={formData.operatorEmail}
              onChange={handleFormChange}
              fullWidth
              size="small"
              placeholder="operator@example.com"
              helperText="Required if no contact number provided - notifications will be sent here"
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2, mb: 2 }}>
              <TextField
                label="House No., Street, Purok/Subdivision"
                name="address"
                value={formData.address}
                onChange={handleFormChange}
                fullWidth
                required
                size="small"
                placeholder="123 Main Street, Purok 1"
              />
              <FormControl fullWidth required size="small">
                <InputLabel>Barangay</InputLabel>
                <Select
                  name="barangay"
                  value={formData.barangay}
                  onChange={handleFormChange}
                  label="Barangay"
                >
                  <MenuItem value="Aggub">Aggub</MenuItem>
                  <MenuItem value="Bagahabag">Bagahabag</MenuItem>
                  <MenuItem value="Bangaan">Bangaan</MenuItem>
                  <MenuItem value="Bangar">Bangar</MenuItem>
                  <MenuItem value="Bascaran">Bascaran</MenuItem>
                  <MenuItem value="Communal">Communal</MenuItem>
                  <MenuItem value="Concepcion">Concepcion</MenuItem>
                  <MenuItem value="Curifang">Curifang</MenuItem>
                  <MenuItem value="Dadap">Dadap</MenuItem>
                  <MenuItem value="Lactawan">Lactawan</MenuItem>
                  <MenuItem value="Osmeña">Osmeña</MenuItem>
                  <MenuItem value="Pilar D. Galima">Pilar D. Galima</MenuItem>
                  <MenuItem value="Poblacion North">Poblacion North</MenuItem>
                  <MenuItem value="Poblacion South">Poblacion South</MenuItem>
                  <MenuItem value="Quezon">Quezon</MenuItem>
                  <MenuItem value="Quirino">Quirino</MenuItem>
                  <MenuItem value="Roxas">Roxas</MenuItem>
                  <MenuItem value="San Juan">San Juan</MenuItem>
                  <MenuItem value="San Luis">San Luis</MenuItem>
                  <MenuItem value="Tucal">Tucal</MenuItem>
                  <MenuItem value="Uddiawan">Uddiawan</MenuItem>
                  <MenuItem value="Wacal">Wacal</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mb: 2 }}>
              <TextField
                label="Place of Birth"
                name="birthPlace"
                value={formData.birthPlace}
                onChange={handleFormChange}
                fullWidth
                required
                size="small"
              />
              <TextField
                label="Date of Birth"
                type="date"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleFormChange}
                fullWidth
                required
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mb: 2 }}>
              <FormControl fullWidth required size="small">
                <InputLabel>Civil Status</InputLabel>
                <Select
                  name="civilStatus"
                  value={formData.civilStatus}
                  onChange={handleFormChange}
                  label="Civil Status"
                >
                  <MenuItem value="Single">Single</MenuItem>
                  <MenuItem value="Married">Married</MenuItem>
                  <MenuItem value="Widowed">Widowed</MenuItem>
                  <MenuItem value="Separated">Separated</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Citizenship"
                name="citizenship"
                value={formData.citizenship}
                onChange={handleFormChange}
                fullWidth
                required
                size="small"
              />
            </Box>
            
            <TextField
              label="TODA Membership (Optional)"
              name="todaMembership"
              value={formData.todaMembership}
              onChange={handleFormChange}
              fullWidth
              size="small"
              sx={{ mb: 3 }}
            />
            
            {/* Motorcycle Information Section */}
            <Typography variant="h6" sx={{ 
              fontWeight: 700, 
              color: '#0A356B', 
              mb: 2,
              pb: 1,
              borderBottom: '3px solid #0A356B',
              fontSize: '1.1rem',
              letterSpacing: '0.5px'
            }}>
              MOTORCYCLE INFORMATION
            </Typography>

            <TextField
              label="Name of the Driver"
              name="driverName"
              value={formData.driverName}
              onChange={handleFormChange}
              fullWidth
              required
              size="small"
              sx={{ mb: 2 }}
            />
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mb: 2 }}>
              <TextField
                label="Unit Model"
                name="unitModel"
                value={formData.unitModel}
                onChange={handleFormChange}
                fullWidth
                required
                size="small"
              />
              <TextField
                label="Color (Motor)"
                name="colorMotor"
                value={formData.colorMotor}
                onChange={handleFormChange}
                fullWidth
                required
                size="small"
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mb: 2 }}>
              <TextField
                label="Color (Sidecar)"
                name="colorSidecar"
                value={formData.colorSidecar}
                onChange={handleFormChange}
                fullWidth
                required
                size="small"
                placeholder="Blue and Yellow"
                helperText="Default: Blue and Yellow"
              />
              <TextField
                label="MV Plate Number"
                name="mvPlate"
                value={formData.mvPlate}
                onChange={handleFormChange}
                fullWidth
                required
                size="small"
              />
            </Box>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mb: 2 }}>
              <TextField
                label="Motor/Engine Number"
                name="motorEngineNumber"
                value={formData.motorEngineNumber}
                onChange={handleFormChange}
                fullWidth
                required
                size="small"
              />
              <TextField
                label="Chassis Number"
                name="chassisNumber"
                value={formData.chassisNumber}
                onChange={handleFormChange}
                fullWidth
                required
                size="small"
              />
            </Box>
            
            <TextField
              label="Address of the Driver"
              name="driverAddress"
              value={formData.driverAddress}
              onChange={handleFormChange}
              fullWidth
              required
              size="small"
              placeholder="House No., Street, Purok, Barangay"
              sx={{ mb: 3 }}
            />
            
            {/* Documentary Requirements Section */}
            <Typography variant="h6" sx={{ 
              fontWeight: 700, 
              color: '#0A356B', 
              mb: 2,
              pb: 1,
              borderBottom: '3px solid #0A356B',
              fontSize: '1.1rem',
              letterSpacing: '0.5px'
            }}>
              DOCUMENTARY REQUIREMENTS
            </Typography>
            
            <Box sx={{ 
              mb: 3, 
              p: 2, 
              background: '#FFF7ED',
              borderRadius: 2,
              border: '1px solid #FDBA74'
            }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#EA580C', mb: 0.5 }}>
                Upload Instructions:
              </Typography>
              <Typography variant="body2" sx={{ color: '#9A3412', fontSize: '0.85rem' }}>
                • Maximum: 10MB per file • Formats: JPG, PNG, PDF • Files larger than 300KB will be automatically compressed
              </Typography>
              <Typography variant="body2" sx={{ color: '#9A3412', fontSize: '0.85rem', mt: 0.5 }}>
                • All documents must be clear and readable • Files will be optimized for quality and size
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FileUploadField
                name="documentRegistration"
                label="Photocopy of Registration"
                formData={formData}
                processingFiles={processingFiles}
                compressionProgress={compressionProgress}
                handleFileChange={handleFileChange}
              />
              
              <FileUploadField
                name="documentBarangayClearance"
                label="Photocopy of Barangay Clearance"
                formData={formData}
                processingFiles={processingFiles}
                compressionProgress={compressionProgress}
                handleFileChange={handleFileChange}
              />
              
              <FileUploadField
                name="documentCedula"
                label="Photocopy of Cedula"
                formData={formData}
                processingFiles={processingFiles}
                compressionProgress={compressionProgress}
                handleFileChange={handleFileChange}
              />
            
              <FileUploadField
                name="documentDriversLicense"
                label="Photocopy of Driver's License"
                formData={formData}
                processingFiles={processingFiles}
                compressionProgress={compressionProgress}
                handleFileChange={handleFileChange}
              />
            
              <FileUploadField
                name="documentVotersAffidavit"
                label="Photocopy of Voter's Affidavit"
                formData={formData}
                processingFiles={processingFiles}
                compressionProgress={compressionProgress}
                handleFileChange={handleFileChange}
              />
            
              <FileUploadField
                name="documentMotorChassisStencil"
                label="Photocopy of Motor Chassis Stencil"
                formData={formData}
                processingFiles={processingFiles}
                compressionProgress={compressionProgress}
                handleFileChange={handleFileChange}
              />
            
              <FileUploadField
                name="documentOrLTO"
                label="Photocopy of OR/LTO"
                formData={formData}
                processingFiles={processingFiles}
                compressionProgress={compressionProgress}
                handleFileChange={handleFileChange}
              />
            
              <FileUploadField
                name="documentCR"
                label="Photocopy of CR"
                formData={formData}
                processingFiles={processingFiles}
                compressionProgress={compressionProgress}
                handleFileChange={handleFileChange}
              />
            
              <FileUploadField
                name="documentPicture"
                label="1x1 Picture of Driver"
                accept="image/jpeg,image/png"
                formData={formData}
                processingFiles={processingFiles}
                compressionProgress={compressionProgress}
                handleFileChange={handleFileChange}
              />
            
              <FileUploadField
                name="documentOperatorPicture"
                label="1x1 Picture of Operator"
                accept="image/jpeg,image/png"
                formData={formData}
                processingFiles={processingFiles}
                compressionProgress={compressionProgress}
                handleFileChange={handleFileChange}
              />
            </Box>
            
            {/* Walk-in OR Section */}
            <Typography variant="h6" sx={{ 
              fontWeight: 700, 
              color: '#0A356B', 
              mb: 2,
              mt: 3,
              pb: 1,
              borderBottom: '3px solid #0A356B',
              fontSize: '1.1rem',
              letterSpacing: '0.5px'
            }}>
              WALK-IN - OFFICIAL RECEIPT (OR) - OPTIONAL
            </Typography>
            
            <Box sx={{ 
              mb: 3, 
              p: 2, 
              background: '#EFF6FF',
              borderRadius: 2,
              border: '1px solid #93C5FD'
            }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1E40AF', mb: 0.5 }}>
                Optional OR Submission:
              </Typography>
              <Typography variant="body2" sx={{ color: '#1E3A8A', fontSize: '0.85rem' }}>
                If the applicant has already paid and submitted the OR during walk-in, enter it below. Otherwise, they can submit it later online.
              </Typography>
            </Box>
            
            <TextField
              label="Official Receipt Number (Optional)"
              name="officialReceiptNumber"
              value={formData.officialReceiptNumber}
              onChange={handleFormChange}
              fullWidth
              size="small"
              placeholder="OR-2025-XXXX"
              helperText="Enter OR number if applicant submitted it during walk-in"
              sx={{ mb: 2 }}
            />
            
            <FileUploadField
              name="documentOfficialReceipt"
              label="Official Receipt Document (Optional)"
              required={false}
              formData={formData}
              processingFiles={processingFiles}
              compressionProgress={compressionProgress}
              handleFileChange={handleFileChange}
            />
            </form>
          </Box>
          
          <Box className="modal-footer" sx={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: 2, 
            p: 3, 
            borderTop: '1px solid #E5E7EB',
            background: '#F9FAFB'
          }}>
            <Button
              variant="outlined"
              onClick={handleCloseAddModal}
              disabled={isLoading}
              sx={{ 
                minWidth: '120px',
                color: '#374151',
                borderColor: '#D1D5DB',
                '&:hover': {
                  borderColor: '#9CA3AF',
                  background: '#F3F4F6'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="franchise-form"
              variant="contained"
              disabled={isLoading}
              startIcon={isLoading && <CircularProgress size={20} sx={{ color: 'white' }} />}
              sx={{ 
                minWidth: '200px',
                background: 'linear-gradient(135deg, #0A356B 0%, #174D7A 100%)',
                color: '#fff',
                fontWeight: 600,
                px: 4,
                py: 1.2,
                fontSize: '0.95rem',
                '&:hover': {
                  background: 'linear-gradient(135deg, #082746 0%, #0F3A5F 100%)',
                  boxShadow: '0 4px 12px rgba(10, 53, 107, 0.3)'
                },
                '&:disabled': {
                  background: '#9CA3AF',
                  color: '#fff'
                }
              }}
            >
              {isLoading ? 'Submitting...' : '📝 Submit Walk-in Application'}
            </Button>
          </Box>
        </Box>
      </Modal>
      
      {/* View Application Modal */}
      {selectedApplication && (
        <Modal
          open={openViewModal}
          onClose={handleCloseViewModal}
          aria-labelledby="view-franchise-modal"
          slotProps={{
            backdrop: {
              sx: {
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(3px)',
              },
            },
          }}
        >
          <Box className="modal-container">
            <div className="modal-header">
              <Typography variant="h5" component="h2" sx={{ fontWeight: 700, color: '#0A356B' }}>
                FRANCHISE APPLICATION DETAILS
              </Typography>
              <IconButton onClick={handleCloseViewModal} sx={{ color: '#666' }}>
                <CloseIcon />
              </IconButton>
            </div>
            
            <div className="modal-body">
            {/* Approval Status Section */}
            <Box className="info-box" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600, color: 'text.primary' }}>
                Approval Status
              </Typography>
              <div className="info-grid">
                <Typography variant="subtitle2" className="label">Current Status:</Typography>
                <Chip 
                  label={
                    selectedApplication.statusOfBPLO === 'pending' ? 'Pending Review' :
                    selectedApplication.statusOfBPLO === 'bplo-approved' ? 'BPLO Approved - Awaiting OR' :
                    selectedApplication.statusOfBPLO === 'bplo-disapproved' ? 'BPLO Disapproved' :
                    selectedApplication.statusOfBPLO === 'awaiting-sb' ? 'Awaiting SB Approval' :
                    selectedApplication.statusOfBPLO === 'sb-approved' ? 'Finally Approved' :
                    selectedApplication.statusOfBPLO === 'completed' ? 'Completed - Franchise Created' :
                    selectedApplication.statusOfBPLO
                  }
                  color={
                    selectedApplication.statusOfBPLO === 'completed' ? 'success' :
                    selectedApplication.statusOfBPLO === 'sb-approved' ? 'success' :
                    selectedApplication.statusOfBPLO === 'bplo-approved' ? 'info' :
                    selectedApplication.statusOfBPLO === 'awaiting-sb' ? 'primary' :
                    selectedApplication.statusOfBPLO === 'bplo-disapproved' ? 'error' :
                    'default'
                  }
                  sx={{ fontWeight: 'bold' }}
                />
                
                {selectedApplication.bploApprovedBy && (
                  <>
                    <Typography variant="subtitle2" className="label">BPLO Reviewed By:</Typography>
                    <Typography>{selectedApplication.bploApprovedBy}</Typography>
                    
                    <Typography variant="subtitle2" className="label">BPLO Review Date:</Typography>
                    <Typography>
                      {selectedApplication.bploApprovedAt 
                        ? new Date(selectedApplication.bploApprovedAt).toLocaleString() 
                        : 'N/A'}
                    </Typography>
                  </>
                )}
                
                {selectedApplication.bploDisapprovedReason && (
                  <>
                    <Typography variant="subtitle2" className="label" sx={{ color: 'error.main' }}>
                      Disapproval Reason:
                    </Typography>
                    <Typography className="error-box">
                      {selectedApplication.bploDisapprovedReason}
                    </Typography>
                  </>
                )}
                
                {(selectedApplication.statusOfBPLO === 'bplo-approved' || 
                  selectedApplication.statusOfBPLO === 'awaiting-sb' ||
                  selectedApplication.statusOfBPLO === 'sb-approved') && (
                  <>
                    <Typography variant="subtitle2" className="label">Inspection Required:</Typography>
                    <Chip 
                      label={selectedApplication.bploInspectionRequired ? 'Yes - Visit BPLO' : 'Not Required'} 
                      color={selectedApplication.bploInspectionRequired ? 'warning' : 'default'}
                      size="small"
                    />
                  </>
                )}
                
                {/* OR Number and Document - Always show for BPLO/SB */}
                <Typography variant="subtitle2" className="label">OR Number:</Typography>
                <Typography sx={{ 
                  fontWeight: selectedApplication.officialReceiptNumber ? 'bold' : 'normal', 
                  color: selectedApplication.officialReceiptNumber ? 'primary.main' : 'text.secondary',
                  fontStyle: selectedApplication.officialReceiptNumber ? 'normal' : 'italic'
                }}>
                  {selectedApplication.officialReceiptNumber || 'To be uploaded by the client'}
                </Typography>
                
                <Typography variant="subtitle2" className="label">OR Document:</Typography>
                {selectedApplication.documents?.oRTreasurerOfficeObj ? (
                  <Link 
                    className="document-link" 
                    onClick={() => handleOpenFilePreview({
                      name: 'OR Document',
                      type: 'application/pdf',
                      path: selectedApplication.documents.oRTreasurerOfficeObj
                    })}
                    sx={{ cursor: 'pointer', textDecoration: 'underline', color: 'primary.main' }}
                  >
                    View OR Document
                  </Link>
                ) : (
                  <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                    To be uploaded by the client
                  </Typography>
                )}
                
                {selectedApplication.orSubmittedAt && (
                  <>
                    <Typography variant="subtitle2" className="label">OR Submitted:</Typography>
                    <Typography>
                      {new Date(selectedApplication.orSubmittedAt).toLocaleString()}
                    </Typography>
                  </>
                )}
                
                {selectedApplication.sbApprovedBy && (
                  <>
                    <Typography variant="subtitle2" className="label">SB Approved By:</Typography>
                    <Typography>{selectedApplication.sbApprovedBy}</Typography>
                    
                    <Typography variant="subtitle2" className="label">SB Approval Date:</Typography>
                    <Typography>
                      {selectedApplication.sbApprovedAt 
                        ? new Date(selectedApplication.sbApprovedAt).toLocaleString() 
                        : 'N/A'}
                    </Typography>
                    
                    <Typography variant="subtitle2" className="label">Resolution Number:</Typography>
                    <Typography sx={{ 
                      fontWeight: 'bold', 
                      color: 'success.main',
                      fontSize: '1.1rem'
                    }}>
                      {selectedApplication.sbResolutionNumber}
                    </Typography>
                    
                    <Typography variant="subtitle2" className="label">Resolution Document:</Typography>
                    {selectedApplication.sbResolutionDocument ? (
                      <Link 
                        className="document-link" 
                        onClick={() => handleOpenFilePreview({
                          name: 'Resolution Document',
                          type: 'application/pdf',
                          path: selectedApplication.sbResolutionDocument
                        })}
                        sx={{ cursor: 'pointer', textDecoration: 'underline', color: 'success.main' }}
                      >
                        View Resolution Document
                      </Link>
                    ) : (
                      <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                        Not uploaded
                      </Typography>
                    )}
                  </>
                )}
              </div>
            </Box>
            
            <Typography variant="h6" className="section-header">
              PERSONAL INFORMATION
            </Typography>
            
            <div className="info-grid">
              <Typography variant="subtitle2" className="label">Franchise Number:</Typography>
              <Typography>{selectedApplication.franchiseNumber}</Typography>
              
              <Typography variant="subtitle2" className="label">Name:</Typography>
              <Typography>{selectedApplication.name}</Typography>
              
              <Typography variant="subtitle2" className="label">Contact Number:</Typography>
              <Typography>{selectedApplication.contactNumber}</Typography>
              
              <Typography variant="subtitle2" className="label">Email:</Typography>
              <Typography>{selectedApplication.email || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Barangay:</Typography>
              <Typography>{selectedApplication.barangay || 'N/A'}</Typography>
              
              <Typography variant="subtitle2" className="label">Birth Place:</Typography>
              <Typography>{selectedApplication.birthPlace}</Typography>
              
              <Typography variant="subtitle2" className="label">Birth Date:</Typography>
              <Typography>{selectedApplication.birthDate}</Typography>
              
              <Typography variant="subtitle2" className="label">Civil Status:</Typography>
              <Typography>{selectedApplication.civilStatus}</Typography>
              
              <Typography variant="subtitle2" className="label">Citizenship:</Typography>
              <Typography>{selectedApplication.citizenship}</Typography>
              
              <Typography variant="subtitle2" className="label">TODA Membership:</Typography>
              <Typography>{selectedApplication.todaMembership}</Typography>
              
              <Typography variant="subtitle2" className="label">Address:</Typography>
              <Typography>{selectedApplication.address}</Typography>
              
              {(selectedApplication.coOwnerName || selectedApplication.coOwnerAddress) && (
                <>
                  <Typography variant="subtitle2" className="label">Co-Owner Name:</Typography>
                  <Typography>{selectedApplication.coOwnerName || 'N/A'}</Typography>
                  
                  <Typography variant="subtitle2" className="label">Co-Owner Address:</Typography>
                  <Typography>{selectedApplication.coOwnerAddress || 'N/A'}</Typography>
                </>
              )}
            </div>
            
            <Typography variant="h6" className="section-header">
              DRIVER INFORMATION
            </Typography>
            
            <div className="info-grid">
              <Typography variant="subtitle2" className="label">Driver Name:</Typography>
              <Typography>{selectedApplication.driverName}</Typography>
              
              <Typography variant="subtitle2" className="label">Driver Address:</Typography>
              <Typography>{selectedApplication.driverAddress}</Typography>
            </div>
            
            <Typography variant="h6" className="section-header">
              MOTORCYCLE INFORMATION
            </Typography>
            
            <div className="info-grid">
              <Typography variant="subtitle2" className="label">Unit Model:</Typography>
              <Typography>{selectedApplication.unitModel}</Typography>
              
              <Typography variant="subtitle2" className="label">Color (Motor):</Typography>
              <Typography>{selectedApplication.colorMotor}</Typography>
              
              <Typography variant="subtitle2" className="label">Color (Sidecar):</Typography>
              <Typography>{selectedApplication.colorSidecar}</Typography>
              
              <Typography variant="subtitle2" className="label">MV Plate:</Typography>
              <Typography>{selectedApplication.mvPlate}</Typography>
              
              <Typography variant="subtitle2" className="label">Motor/Engine Number:</Typography>
              <Typography>{selectedApplication.motorEngineNumber}</Typography>
              
              <Typography variant="subtitle2" className="label">Chassis Number:</Typography>
              <Typography>{selectedApplication.chassisNumber}</Typography>
              
              <Typography variant="subtitle2" className="label">Sidecar Plate Number:</Typography>
              <Typography>{selectedApplication.sidecarPlateNumber || 'N/A'}</Typography>
            </div>
            
            <Typography variant="h6" className="section-header">
              DOCUMENTS
            </Typography>
            
            <div className="info-grid">
              <Typography variant="subtitle2" className="label">Registration:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentRegistration)}>
                {getFileIcon(selectedApplication.documentRegistration?.type)}
                <span>{selectedApplication.documentRegistration?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Barangay Clearance:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentBarangayClearance)}>
                {getFileIcon(selectedApplication.documentBarangayClearance?.type)}
                <span>{selectedApplication.documentBarangayClearance?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Cedula:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentCedula)}>
                {getFileIcon(selectedApplication.documentCedula?.type)}
                <span>{selectedApplication.documentCedula?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Driver's License:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentDriversLicense)}>
                {getFileIcon(selectedApplication.documentDriversLicense?.type)}
                <span>{selectedApplication.documentDriversLicense?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Voter's Affidavit:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentVotersAffidavit)}>
                {getFileIcon(selectedApplication.documentVotersAffidavit?.type)}
                <span>{selectedApplication.documentVotersAffidavit?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Chassis Stencil:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentChassisStencil)}>
                {getFileIcon(selectedApplication.documentChassisStencil?.type)}
                <span>{selectedApplication.documentChassisStencil?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Driver Picture:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentPicture)}>
                {getFileIcon(selectedApplication.documentPicture?.type)}
                <span>{selectedApplication.documentPicture?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Operator Picture:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentOperatorPicture)}>
                {getFileIcon(selectedApplication.documentOperatorPicture?.type)}
                <span>{selectedApplication.documentOperatorPicture?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">OR LTO:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentORLTO)}>
                {getFileIcon(selectedApplication.documentORLTO?.type)}
                <span>{selectedApplication.documentORLTO?.name || 'No file'}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">CR LTO:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentCRLTO)}>
                {getFileIcon(selectedApplication.documentCRLTO?.type)}
                <span>{selectedApplication.documentCRLTO?.name || 'No file'}</span>
              </Link>
            </div>
            
            {/* PDF Preview and Download Section - Available for BPLO */}
            {userRole === 'bplo-admin' && (
              <Box className="info-box" sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600, fontSize: '0.95rem', color: 'text.primary' }}>
                  Application Form Preview
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    onClick={handlePdfPreview}
                    disabled={isLoading}
                    sx={{ flex: '1 1 auto', minWidth: '150px' }}
                  >
                    Preview PDF
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={handlePdfDownload}
                    disabled={isLoading}
                    sx={{ flex: '1 1 auto', minWidth: '150px' }}
                  >
                    Download PDF
                  </Button>
                </Box>
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#6b7280' }}>
                  View or download the filled application form with all submitted details
                </Typography>
              </Box>
            )}

            </div>
            
            {/* Action Buttons - Role Based */}
            <div className="modal-footer">
              {userRole === 'bplo-admin' && selectedApplication.statusOfBPLO === 'pending' && (
                <>
                  <Button
                    className="button-error"
                    onClick={handleOpenRejectModal}
                    disabled={isLoading}
                  >
                    Disapprove
                  </Button>
                  <Button
                    className="button-success"
                    onClick={handleApproveApplication}
                    disabled={isLoading}
                  >
                    {isLoading ? <CircularProgress className="circular-progress-small circular-progress-inherit" /> : 'Approve for Inspection'}
                  </Button>
                </>
              )}
              
              {userRole === 'sb-admin' && (
                selectedApplication.statusOfBPLO === 'bplo-approved' ||
                selectedApplication.statusOfBPLO === 'awaiting-sb' || 
                selectedApplication.statusOfBPLO === 'sb-approved' ||
                (selectedApplication.statusOfBPLO === 'approved' && selectedApplication.officialReceiptNumber)
              ) && (
                <>
                  {selectedApplication.statusOfBPLO === 'bplo-approved' && !selectedApplication.officialReceiptNumber && (
                    <Typography variant="body2" className="warning-box" sx={{ textAlign: 'center', mb: 2 }}>
                      Note: Official Receipt has not been submitted yet. You may proceed with approval or wait for OR submission.
                    </Typography>
                  )}
                  
                  {selectedApplication.statusOfBPLO === 'sb-approved' && (
                    <>
                      <Typography variant="body2" className="info-message-box" sx={{ textAlign: 'center', mb: 2, bgcolor: '#FFF4E6', color: '#D97706' }}>
                        <strong>Resolution Approved:</strong> {selectedApplication.sbResolutionNumber}<br/>
                        Franchise creation is pending. Click below to complete the process.
                      </Typography>
                      <Button
                        className="button-success"
                        onClick={async () => {
                          setIsLoading(true)
                          try {
                            const isNew = selectedApplication.applicationType === 'new' || !selectedApplication.applicationType
                            const franchiseResponse = await (isNew 
                              ? franchiseAPI.acceptNewFranchise(selectedApplication.id, {})
                              : franchiseAPI.acceptRenewAmend(selectedApplication.id, {}))
                            
                            console.log('[FranchiseMgmt] Franchise created successfully:', franchiseResponse.data)
                            await fetchAllPending()
                            
                            setNotification({ 
                              open: true, 
                              message: 'Franchise record created successfully! The franchise is now active in the system.', 
                              type: 'success' 
                            })
                            handleCloseViewModal()
                          } catch (error) {
                            console.error('[FranchiseMgmt] Error completing franchise creation:', error)
                            setNotification({
                              open: true,
                              message: error.response?.data?.error || error.message || 'Failed to create franchise record',
                              type: 'error'
                            })
                          } finally {
                            setIsLoading(false)
                          }
                        }}
                        disabled={isLoading}
                        fullWidth
                      >
                        {isLoading ? <CircularProgress className="circular-progress-small circular-progress-inherit" /> : 'Complete Franchise Creation'}
                      </Button>
                    </>
                  )}
                  
                  {(selectedApplication.statusOfBPLO === 'bplo-approved' || 
                    selectedApplication.statusOfBPLO === 'awaiting-sb' ||
                    (selectedApplication.statusOfBPLO === 'approved' && selectedApplication.officialReceiptNumber)) && (
                    <Button
                      className="button-success"
                      onClick={handleApproveApplication}
                      disabled={isLoading}
                      fullWidth
                    >
                      {isLoading ? <CircularProgress className="circular-progress-small circular-progress-inherit" /> : 'Final Approval - Create Franchise'}
                    </Button>
                  )}
                </>
              )}
              
              {(selectedApplication.statusOfBPLO === 'bplo-approved' || 
                selectedApplication.statusOfBPLO === 'awaiting-sb' ||
                selectedApplication.statusOfBPLO === 'bplo-disapproved') && userRole !== 'sb-admin' && (
                <Typography variant="body2" className="info-message-box" sx={{ textAlign: 'center', width: '100%' }}>
                  {selectedApplication.statusOfBPLO === 'bplo-approved' && 
                    'Approved by BPLO. Waiting for applicant to submit Official Receipt.'}
                  {selectedApplication.statusOfBPLO === 'awaiting-sb' && 
                    'Official Receipt submitted. Ready for SB final approval.'}
                  {selectedApplication.statusOfBPLO === 'bplo-disapproved' && 
                    'Disapproved by BPLO. Applicant has been notified.'}
                </Typography>
              )}
            </div>
          </Box>
        </Modal>
      )}
      
      {/* File Preview Modal */}
      <Modal
        open={openFilePreview}
        onClose={handleCloseFilePreview}
        aria-labelledby="file-preview-modal"
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
                    console.error('Image preview failed:', e);
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
      
      {/* BPLO Disapproval Reason Modal */}
      <Modal
        open={openRejectModal}
        onClose={handleCloseRejectModal}
        aria-labelledby="rejection-modal"
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(3px)',
            },
          },
        }}
      >
        <Box className="modal-container rejection-modal">
          <div className="modal-header">
            <Typography variant="h5" component="h2">
              Disapproval Reason
            </Typography>
            <IconButton onClick={handleCloseRejectModal}>
              <CloseIcon />
            </IconButton>
          </div>
          
          <Typography variant="body1" className="mb-2">
            Please provide a reason for disapproving this franchise application:
          </Typography>
          
          <TextField
            label="Reason for Disapproval"
            className="textfield-multiline"
            multiline
            rows={4}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            fullWidth
            required
            placeholder="E.g., Documents incomplete, tricycle does not meet safety standards, etc."
          />
          
          <div className="action-buttons">
            <Button
              className="button-primary"
              onClick={handleSubmitRejection}
              disabled={!rejectionReason.trim() || isLoading}
            >
              {isLoading ? <CircularProgress className="circular-progress-small" /> : 'Submit Disapproval'}
            </Button>
          </div>
        </Box>
      </Modal>
      
      {/* SB Admin Final Approval Modal */}
      <Modal
        open={openSBApprovalModal}
        onClose={() => setOpenSBApprovalModal(false)}
        aria-labelledby="sb-approval-modal"
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(3px)',
            },
          },
        }}
      >
        <Box className="modal-container rejection-modal">
          <div className="modal-header">
            <Typography variant="h5" component="h2">
              Final Approval - Resolution Number
            </Typography>
            <IconButton onClick={() => setOpenSBApprovalModal(false)}>
              <CloseIcon />
            </IconButton>
          </div>
          
          <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary' }}>
            Enter the Sangguniang Bayan resolution number to finalize approval of this franchise application.
          </Typography>
          
          {selectedApplication && (
            <Box className="info-box" sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
                Application Details
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Applicant: <strong>{selectedApplication.name}</strong>
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                OR Number: <strong>{selectedApplication.officialReceiptNumber || 'Not submitted'}</strong>
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Plate Number: <strong>{selectedApplication.plateNumber}</strong>
              </Typography>
            </Box>
          )}
          
          <TextField
            label="Resolution Number"
            value={resolutionNumber}
            onChange={(e) => setResolutionNumber(e.target.value)}
            fullWidth
            required
            placeholder="E.g., Resolution No. 2025-123"
            helperText="This will appear on the certificate of approval"
            sx={{ mb: 2 }}
          />
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Resolution Document (Optional)
            </Typography>
            <TextField
              type="file"
              fullWidth
              onChange={(e) => setResolutionFile(e.target.files[0])}
              inputProps={{ 
                accept: "application/pdf,image/jpeg,image/png"
              }}
              helperText="Upload the official resolution document (PDF, JPG, or PNG)"
            />
            {resolutionFile && (
              <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'success.main' }}>
                Selected: {resolutionFile.name}
              </Typography>
            )}
          </Box>
          
          <div className="action-buttons">
            <Button
              variant="outlined"
              onClick={() => {
                setOpenSBApprovalModal(false)
                setResolutionNumber('')
                setResolutionFile(null)
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              className="button-success"
              onClick={handleSBApproval}
              disabled={!resolutionNumber.trim() || isLoading}
            >
              {isLoading ? <CircularProgress className="circular-progress-small circular-progress-inherit" /> : 'Approve & Issue Certificate'}
            </Button>
          </div>
        </Box>
      </Modal>
      
      {/* PDF Preview Modal */}
      <Modal
        open={openPdfPreview}
        onClose={handleClosePdfPreview}
        aria-labelledby="pdf-preview-modal"
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(3px)',
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
            height: '90vh',
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 24,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="modal-header">
            <Typography variant="h6">
              Franchise Application Form Preview
            </Typography>
            <IconButton onClick={handleClosePdfPreview}>
              <CloseIcon />
            </IconButton>
          </div>
          
          <Box sx={{ 
            flex: 1, 
            overflow: 'hidden',
            p: 0,
            bgcolor: 'grey.800'
          }}>
            {pdfPreviewUrl && (
              <iframe
                src={pdfPreviewUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
                title="PDF Preview"
              />
            )}
          </Box>
          
          <Box sx={{ 
            p: 2, 
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2
          }}>
            <Button
              variant="outlined"
              onClick={handleClosePdfPreview}
            >
              Close
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handlePdfDownload}
              disabled={isLoading}
            >
              Download PDF
            </Button>
          </Box>
        </Box>
      </Modal>
      
      <Snackbar 
        open={notification.open} 
        autoHideDuration={6000} 
        onClose={handleNotificationClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleNotificationClose} severity={notification.type} className="alert-full-width">
          {notification.message}
        </Alert>
      </Snackbar>
    </div>
  )
}

export default FranchiseMgmt
