import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import '../../Styles/Administrator_Css/FranchiseMgmt.css'
import Sidebar from './Sidebar'
import { franchiseAPI, API_BASE_URL } from '../Services/api'
import websocketService from '../../services/websocket'
import { useAuth } from '../../contexts/AuthContext'
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
  Chip
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import ImageIcon from '@mui/icons-material/Image'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import VisibilityIcon from '@mui/icons-material/Visibility'
import DownloadIcon from '@mui/icons-material/Download'
import GetAppIcon from '@mui/icons-material/GetApp'
import { previewFilledPDF, downloadFilledPDF, getPdfFieldNames } from '../../utils/pdfFiller'

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
  const [sessionNumber, setSessionNumber] = useState('')
  const [sessionReportFile, setSessionReportFile] = useState(null)
  const [scannedRegistrationFile, setScannedRegistrationFile] = useState(null)
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
    documentPicture: null,
  })

 
  /**
   * Fetch all pending franchise applications from backend
   * Uses secure franchiseAPI.getPending() with automatic token refresh
   */
  // Helper function to determine file type from URL extension
  const getFileTypeFromUrl = (url) => {
    if (!url) return 'unknown'
    const ext = url.split('.').pop().toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image'
    if (ext === 'pdf') return 'pdf'
    return 'document'
  }

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
        birthDate: it.operatorBirthDate ? new Date(it.operatorBirthDate).toLocaleDateString() : '',
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
        driversID: it.driversID || '',
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
        // Documents - backend returns URLs as strings, convert to {name, path, type} format
        documentRegistration: it.documents?.motorRegistrationObj ? { name: it.documents.motorRegistrationObj.split('/').pop(), path: it.documents.motorRegistrationObj, type: getFileTypeFromUrl(it.documents.motorRegistrationObj) } : null,
        documentBarangayClearance: it.documents?.barangayClearanceObj ? { name: it.documents.barangayClearanceObj.split('/').pop(), path: it.documents.barangayClearanceObj, type: getFileTypeFromUrl(it.documents.barangayClearanceObj) } : null,
        documentCedula: it.documents?.cedulaObj ? { name: it.documents.cedulaObj.split('/').pop(), path: it.documents.cedulaObj, type: getFileTypeFromUrl(it.documents.cedulaObj) } : null,
        documentDriversLicense: it.documents?.driversLicenseObj ? { name: it.documents.driversLicenseObj.split('/').pop(), path: it.documents.driversLicenseObj, type: getFileTypeFromUrl(it.documents.driversLicenseObj) } : null,
        documentVotersAffidavit: it.documents?.votersAffidavitObj ? { name: it.documents.votersAffidavitObj.split('/').pop(), path: it.documents.votersAffidavitObj, type: getFileTypeFromUrl(it.documents.votersAffidavitObj) } : null,
        documentChassisStencil: it.documents?.motorChassisStencilObj ? { name: it.documents.motorChassisStencilObj.split('/').pop(), path: it.documents.motorChassisStencilObj, type: getFileTypeFromUrl(it.documents.motorChassisStencilObj) } : null,
        documentPicture: it.documents?.driverPictureObj ? { name: it.documents.driverPictureObj.split('/').pop(), path: it.documents.driverPictureObj, type: getFileTypeFromUrl(it.documents.driverPictureObj) } : null,
        documentOperatorPicture: it.documents?.operatorPictureObj ? { name: it.documents.operatorPictureObj.split('/').pop(), path: it.documents.operatorPictureObj, type: getFileTypeFromUrl(it.documents.operatorPictureObj) } : null,
        documentORLTO: it.documents?.oRLTOObj ? { name: it.documents.oRLTOObj.split('/').pop(), path: it.documents.oRLTOObj, type: getFileTypeFromUrl(it.documents.oRLTOObj) } : null,
        documentCRLTO: it.documents?.cRLTOObj ? { name: it.documents.cRLTOObj.split('/').pop(), path: it.documents.cRLTOObj, type: getFileTypeFromUrl(it.documents.cRLTOObj) } : null,
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
      // The server will emit current state upon connection
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
      
      // Already connected, fetch immediately as we may have missed the initial emit
      fetchAllPending()
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
        contactNumber: it.operatorContactNumber || '',
        email: it.operatorEmail || '',
        sidecarPlateNumber: it.sideCarPlateNumber || '',
        birthPlace: it.operatorBirthPlace || '',
        birthDate: it.operatorBirthDate || '',
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
        driversID: it.driversID || '',
        operatorBarangay: it.operatorBarangay || '',
        coOwnerName: it.coOwnerName || '',
        coOwnerAddress: it.coOwnerAddress || '',
        officialReceiptNumber: it.officialReceiptNumber || '',
        orSubmittedAt: it.orSubmittedAt || '',
        bploApprovedBy: it.bploApprovedBy || '',
        bploApprovedAt: it.bploApprovedAt || '',
        bploDisapprovedReason: it.bploDisapprovedReason || '',
        bploInspectionRequired: it.bploInspectionRequired || false,
        sbApprovedBy: it.sbApprovedBy || '',
        sbApprovedAt: it.sbApprovedAt || '',
        sbResolutionNumber: it.sbResolutionNumber || '',
        sbResolutionDocument: it.sbResolutionDocument || '',
        documentRegistration: it.documents?.motorRegistrationObj || null,
        documentBarangayClearance: it.documents?.barangayClearanceObj || null,
        documentCedula: it.documents?.cedulaObj || null,
        documentDriversLicense: it.documents?.driversLicenseObj || null,
        documentVotersAffidavit: it.documents?.votersAffidavitObj || null,
        documentChassisStencil: it.documents?.motorChassisStencilObj || null,
        documentPicture: it.documents?.driverPictureObj || null,
        documentOperatorPicture: it.documents?.operatorPictureObj || null,
        documentORLTO: it.documents?.oRLTOObj || null,
        documentCRLTO: it.documents?.cRLTOObj || null,
        documents: it.documents || {},
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
    
    // For SB admins, listen for new applications but DON'T refetch immediately
    // The backend should emit the full updated list via 'approved-applications'
    const handleNewSBApplication = (application) => {
      console.log('[FranchiseMgmt] New SB application received:', application?._id)
      // Don't refetch - wait for the 'approved-applications' event instead
      // This prevents duplicate fetches
    }
    
    if (userRole === 'sb-admin') {
      websocketService.on('new-sb-application', handleNewSBApplication)
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
      if (userRole === 'sb-admin') {
        websocketService.off('new-sb-application', handleNewSBApplication)
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
    let filtered = pendingApplications.filter(app => 
      app.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      app.franchiseNumber?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      app.plateNumber?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    )

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
      // New R2 format: r2://path/to/file -> route through backend proxy
      if (normalized.path && normalized.path.startsWith('r2://')) {
        const r2Key = normalized.path.substring(5) // Remove 'r2://' prefix
        normalized.path = `${API_BASE_URL.replace(/\/$/, '')}/api/franchise-applications/proxy-file?url=${encodeURIComponent(normalized.path)}`
        console.log('[Preview] R2 format detected, routing through proxy:', r2Key)
      }
      // Old Cloudflare public URL format -> route through backend proxy
      else if (normalized.path && /^https?:\/\/pub-[a-f0-9]+\.r2\.dev/i.test(normalized.path)) {
        normalized.path = `${API_BASE_URL.replace(/\/$/, '')}/api/franchise-applications/proxy-file?url=${encodeURIComponent(normalized.path)}`
        console.log('[Preview] Cloudflare R2 public URL detected, routing through proxy')
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
      const isImage = (normalized.type || '').includes('image') || /\.(png|jpe?g|webp|gif)$/i.test(path)
      const isPdf = (normalized.type || '').includes('pdf') || /\.pdf$/i.test(path)

      if (isImage || isPdf) {
        try {
          const resp = await fetch(path, { mode: 'cors' })
          if (!resp.ok) throw new Error(`Failed to fetch file: ${resp.status}`)
          const blob = await resp.blob()
          const objectUrl = URL.createObjectURL(blob)
          // Revoke previous if any
          if (currentBlobUrlRef.current) URL.revokeObjectURL(currentBlobUrlRef.current)
          currentBlobUrlRef.current = objectUrl
          setPreviewFile({ ...normalized, path: objectUrl })
          setOpenFilePreview(true)
          return
        } catch (err) {
          console.warn('[FilePreview] fetch failed, falling back to direct URL', err)
          setNotification({ open: true, message: 'Preview unavailable, file will open/download instead', type: 'info' })
          // fallthrough to open direct link in iframe/fallback
        }
      }

      // Not an image/pdf or fetch failed — use the path as-is (download link will still work)
      setPreviewFile(normalized)
      setOpenFilePreview(true)
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
  

  const handleFileChange = useCallback((e) => {
    const { name, files } = e.target
    if (files && files[0]) {
      const file = files[0]
      
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setNotification({
          open: true,
          message: 'File size exceeds 5MB limit',
          type: 'error'
        })
        return
      }
      
      setFormData(prev => {
        // Revoke previous blob URL if exists
        if (prev[name]?.path && prev[name].path.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(prev[name].path)
          } catch (e) {
            console.warn('Failed to revoke previous file blob:', e)
          }
        }
        
        // Create object URL for preview
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
   * Submit new application (auto-approved by admin)
   * Uses secure franchiseAPI.create() with FormData for file uploads
   */
  const handleSubmitApplication = async (e) => {
    e.preventDefault()
    
    setIsLoading(true)
    
    try {
      // Create FormData for file uploads
      const formDataToSend = new FormData()
      
      // Add all form fields to FormData
      Object.keys(formData).forEach(key => {
        if (key.startsWith('document') && formData[key]?.file) {
          // Add file uploads
          formDataToSend.append(key, formData[key].file)
        } else if (formData[key] !== null && formData[key] !== undefined) {
          // Add regular fields
          formDataToSend.append(key, formData[key])
        }
      })
      
      // Add application type if not present
      if (!formData.applicationType) {
        formDataToSend.append('applicationType', 'New')
      }
      
      // Add address if not present
      if (!formData.address && formData.driverAddress) {
        formDataToSend.append('address', formData.driverAddress)
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
        documentPicture: null,
      })
      
      setNotification({
        open: true,
        message: 'Franchise application submitted successfully',
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
      console.log('[FranchiseMgmt] SB approving application:', selectedApplication.id)
      
      // Create FormData for multipart upload if resolution document is provided
      const formData = new FormData()
      formData.append('resolutionNumber', resolutionNumber.trim())
      if (resolutionFile) {
        formData.append('resolutionDocument', resolutionFile)
      }
      
      const response = await franchiseAPI.approveSBWithDocument(selectedApplication.id, formData)
      
      console.log('[FranchiseMgmt] Application finally approved by SB:', response.data)

      await fetchAllPending()

      setNotification({ 
        open: true, 
        message: 'Application finally approved! Now you can accept it to create the franchise record.', 
        type: 'success' 
      })
      
      setOpenSBApprovalModal(false)
      setResolutionNumber('')
      setResolutionFile(null)
      // Don't close view modal - user needs to accept franchise next
    } catch (error) {
      console.error('[FranchiseMgmt] Error in SB approval:', error)
      
      setNotification({
        open: true,
        message: error.response?.data?.error || 'Failed to approve application',
        type: 'error'
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  /**
   * SB Admin accept franchise - creates FranchiseInformation record
   * This is the final step after SB approval that moves the application to the franchise list
   */
  const handleAcceptFranchise = async () => {
    if (!selectedApplication || !sessionNumber.trim()) {
      setNotification({
        open: true,
        message: 'Session number is required',
        type: 'error'
      })
      return
    }
    
    setIsLoading(true)
    
    try {
      console.log('[FranchiseMgmt] Accepting franchise for application:', selectedApplication.id)
      
      // Create FormData for multipart upload
      const formData = new FormData()
      formData.append('sessionNumber', sessionNumber.trim())
      
      if (scannedRegistrationFile) {
        formData.append('scannedSignedRegistrationObj', scannedRegistrationFile)
      }
      
      if (sessionReportFile) {
        formData.append('individualSessionReportObj', sessionReportFile)
      }
      
      // Determine which endpoint to call based on application type
      const isNew = selectedApplication.applicationType === 'new'
      const response = isNew 
        ? await franchiseAPI.acceptNewFranchise(selectedApplication.id, formData)
        : await franchiseAPI.acceptRenewAmend(selectedApplication.id, formData)
      
      console.log('[FranchiseMgmt] Franchise created/updated successfully:', response.data)

      await fetchAllPending()

      setNotification({ 
        open: true, 
        message: 'Franchise successfully created! It will now appear in the franchise list.', 
        type: 'success' 
      })
      
      setOpenAcceptFranchiseModal(false)
      setSessionNumber('')
      setSessionReportFile(null)
      setScannedRegistrationFile(null)
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
  const getStatusInfo = (statusOfBPLO, hasOR) => {
    switch (statusOfBPLO) {
      case 'pending':
        return { label: 'For BPLO Verification', color: '#F59E0B', bgColor: '#FEF3C7' }
      case 'bplo-approved':
        // Check if OR is submitted for more accurate status
        if (hasOR) {
          return { label: 'Approved by BPLO - OR Submitted', color: '#059669', bgColor: '#D1FAE5' }
        }
        return { label: 'Awaiting OR Document and OR Number from Client', color: '#DC8C09', bgColor: '#FFF4E6' }
      case 'awaiting-sb':
        return { label: 'Ready for SB Final Approval', color: '#0A356B', bgColor: '#DBEAFE' }
      case 'bplo-disapproved':
        return { label: 'Disapproved by BPLO', color: '#DC2626', bgColor: '#FEE2E2' }
      default:
        return { label: 'Unknown Status', color: '#6B7280', bgColor: '#F3F4F6' }
    }
  }

  return (
    <div className="main">
      <Sidebar />
      <div className="content-container">
        <h1 className="title">
          {userRole === 'sb-admin' ? 'SB Final Approval' : 'Franchise Management'}
        </h1>
        
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
          <Box className="loading-container">
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} className="table-container" elevation={2}>
            <Table className="pending-table" aria-label="pending franchises table">
              <TableHead>
                <TableRow>
                  <TableCell className="table-cell-head">Record No.</TableCell>
                  <TableCell className="table-cell-head">Franchisee Name</TableCell>
                  {/* <TableCell className="table-cell-head">Franchise Number</TableCell> */}
                  <TableCell className="table-cell-head">Make</TableCell>
                  <TableCell className="table-cell-head">Plate Number</TableCell>
                  <TableCell className="table-cell-head">Application Type</TableCell>
                  <TableCell className="table-cell-head">Status</TableCell>
                  <TableCell className="table-cell-head">Address</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredApplications.length > 0 ? (
                  filteredApplications.map((application, index) => {
                    const hasOR = !!(application.officialReceiptNumber && application.officialReceiptNumber.trim())
                    const statusInfo = getStatusInfo(application.statusOfBPLO || 'pending', hasOR)
                    return (
                      <TableRow 
                        key={application.id}
                        className={`table-row ${index % 2 !== 0 ? 'table-row-odd' : ''}`}
                        onClick={() => handleOpenViewModal(application)}
                      >
                        <TableCell className="table-cell-body">{index + 1}</TableCell>
                        <TableCell className="table-cell-body">{application.name}</TableCell>
                        {/* <TableCell className="table-cell-body">{application.franchiseNumber}</TableCell> */}
                        <TableCell className="table-cell-body">{application.make}</TableCell>
                        <TableCell className="table-cell-body">{application.plateNumber}</TableCell>
                        <TableCell className="table-cell-body">
                          <Chip 
                            label={application.applicationType}
                            size="small"
                            className={
                              application.applicationType === 'New' ? 'chip-new' : 
                              application.applicationType === 'Renewal' ? 'chip-renewal' : 'chip-transfer'
                            }
                          />
                        </TableCell>
                        <TableCell className="table-cell-body">
                          <Chip 
                            label={statusInfo.label}
                            size="small"
                            sx={{
                              backgroundColor: statusInfo.bgColor,
                              color: statusInfo.color,
                              fontWeight: 600,
                              fontSize: '0.75rem'
                            }}
                          />
                        </TableCell>
                        <TableCell className="table-cell-body">{application.address}</TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow className="table-row">
                    <TableCell className="table-cell-body table-cell-center" colSpan={8}>
                      {isLoading ? 'Loading...' : 'No pending applications found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
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
        <Box className="modal-container">
          <div className="modal-header">
            <Typography variant="h5" component="h2">
              FRANCHISE APPLICATION
            </Typography>
            <IconButton onClick={handleCloseAddModal}>
              <CloseIcon />
            </IconButton>
          </div>
          
          <form onSubmit={handleSubmitApplication}>
            <Typography variant="h6" className="section-header">
              PERSONAL INFORMATION
            </Typography>
            
            <div className="form-row">
              <TextField
                label="Date"
                type="date"
                name="date"
                value={formData.date}
                onChange={handleFormChange}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Sidecar Plate Number"
                name="sidecarPlateNumber"
                value={formData.sidecarPlateNumber}
                onChange={handleFormChange}
                fullWidth
                required
              />
            </div>
            
            <div className="form-row">
              <TextField
                label="Name of Operator"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                fullWidth
                required
              />
              <TextField
                label="Contact Number"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleFormChange}
                fullWidth
                required
              />
            </div>
            
            <TextField
              label="Email Address (for account linking)"
              name="operatorEmail"
              type="email"
              value={formData.operatorEmail}
              onChange={handleFormChange}
              fullWidth
              required
              placeholder="operator@example.com"
              helperText="This email will be used to link the franchise to the operator's account"
            />
            
            <div className="form-row">
              <TextField
                label="Birth Place"
                name="birthPlace"
                value={formData.birthPlace}
                onChange={handleFormChange}
                fullWidth
                required
              />
              <TextField
                label="Birth Date"
                type="date"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleFormChange}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
              />
              <FormControl fullWidth required>
                <InputLabel>Civil Status</InputLabel>
                <Select
                  name="civilStatus"
                  value={formData.civilStatus}
                  onChange={handleFormChange}
                  label="Civil Status"
                >
                  <MenuItem value="Single">Single</MenuItem>
                  <MenuItem value="Married">Married</MenuItem>
                  <MenuItem value="Divorced">Divorced</MenuItem>
                  <MenuItem value="Widowed">Widowed</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Citizenship"
                name="citizenship"
                value={formData.citizenship}
                onChange={handleFormChange}
                fullWidth
                required
              />
            </div>
            
            <TextField
              label="TODA Membership"
              name="todaMembership"
              value={formData.todaMembership}
              onChange={handleFormChange}
              fullWidth
              required
              className="toda-membership-field"
            />
            
            <Typography variant="h6" className="section-header">
              MOTORCYCLE INFORMATION
            </Typography>
            
            <div className="form-row">
              <TextField
                label="Unit Model"
                name="unitModel"
                value={formData.unitModel}
                onChange={handleFormChange}
                fullWidth
                required
              />
              <TextField
                label="Color (Motor)"
                name="colorMotor"
                value={formData.colorMotor}
                onChange={handleFormChange}
                fullWidth
                required
              />
              <TextField
                label="Color (Sidecar)"
                name="colorSidecar"
                value={formData.colorSidecar}
                onChange={handleFormChange}
                fullWidth
                required
              />
              <TextField
                label="MV Plate"
                name="mvPlate"
                value={formData.mvPlate}
                onChange={handleFormChange}
                fullWidth
                required
              />
            </div>
            
            <div className="form-row">
              <TextField
                label="Motor/Engine Number"
                name="motorEngineNumber"
                value={formData.motorEngineNumber}
                onChange={handleFormChange}
                fullWidth
                required
              />
              <TextField
                label="Chassis Number"
                name="chassisNumber"
                value={formData.chassisNumber}
                onChange={handleFormChange}
                fullWidth
                required
              />
            </div>
            
            <div className="form-row">
              <TextField
                label="Name of the Driver"
                name="driverName"
                value={formData.driverName}
                onChange={handleFormChange}
                fullWidth
                required
              />
              <TextField
                label="Address of the Driver"
                name="driverAddress"
                value={formData.driverAddress}
                onChange={handleFormChange}
                fullWidth
                required
              />
            </div>
            
            <Typography variant="h6" className="section-header">
              DOCUMENTARY REQUIREMENTS
            </Typography>
            
            <Typography variant="body2" className="document-requirements-info">
              Maximum file size: 5MB per file. Accepted formats: JPG, PNG, PDF
            </Typography>
            
            <div className="document-row">
              <Typography variant="subtitle2" className="document-title">
                Photocopy of Registration
              </Typography>
              <TextField
                type="file"
                name="documentRegistration"
                onChange={handleFileChange}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                inputProps={{ 
                  accept: "image/jpeg,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx"
                }}
              />
            </div>
            
            <div className="document-row">
              <Typography variant="subtitle2" className="document-title">
                Photocopy of Barangay Clearance
              </Typography>
              <TextField
                type="file"
                name="documentBarangayClearance"
                onChange={handleFileChange}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                inputProps={{ 
                  accept: "image/jpeg,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx"
                }}
              />
            </div>
            
            <div className="document-row">
              <Typography variant="subtitle2" className="document-title">
                Photocopy of Cedula
              </Typography>
              <TextField
                type="file"
                name="documentCedula"
                onChange={handleFileChange}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                inputProps={{ 
                  accept: "image/jpeg,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx"
                }}
              />
            </div>
            
            <div className="document-row">
              <Typography variant="subtitle2" className="document-title">
                Photocopy of Driver's License
              </Typography>
              <TextField
                type="file"
                name="documentDriversLicense"
                onChange={handleFileChange}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                inputProps={{ 
                  accept: "image/jpeg,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx"
                }}
              />
            </div>
            
            <div className="document-row">
              <Typography variant="subtitle2" className="document-title">
                Photocopy of Voter's Affidavit
              </Typography>
              <TextField
                type="file"
                name="documentVotersAffidavit"
                onChange={handleFileChange}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                inputProps={{ 
                  accept: "image/jpeg,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx"
                }}
              />
            </div>
            
            <div className="document-row">
              <Typography variant="subtitle2" className="document-title">
                1x1 Picture
              </Typography>
              <TextField
                type="file"
                name="documentPicture"
                onChange={handleFileChange}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                inputProps={{ 
                  accept: "image/jpeg,image/png"
                }}
              />
            </div>
            
            <div className="action-buttons">
              <Button
                type="submit"
                className="button-primary"
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress className="circular-progress-small" /> : 'Submit Application'}
              </Button>
            </div>
          </form>
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
              <Typography variant="h5" component="h2">
                FRANCHISE APPLICATION DETAILS
              </Typography>
              <IconButton onClick={handleCloseViewModal}>
                <CloseIcon />
              </IconButton>
            </div>
            
            {/* Approval Status Section */}
            <Box sx={{ 
              bgcolor: '#f5f5f5', 
              p: 2, 
              borderRadius: 1, 
              mb: 2,
              border: '1px solid #e0e0e0'
            }}>
              <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600 }}>
                📋 Approval Status
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
                    selectedApplication.statusOfBPLO
                  }
                  color={
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
                    <Typography sx={{ 
                      bgcolor: '#ffebee', 
                      p: 1, 
                      borderRadius: 1,
                      border: '1px solid #ffcdd2'
                    }}>
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
              <Typography variant="subtitle2" className="label">Driver's ID:</Typography>
              <Typography>{selectedApplication.driversID || 'N/A'}</Typography>
              
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
              <Box sx={{ mb: 2, p: 2, bgcolor: '#f9fafb', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600, fontSize: '0.95rem' }}>
                  📄 Application Form Preview
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
                  <Button
                    variant="text"
                    size="small"
                    onClick={handleShowPdfFields}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    🔍 Debug Fields
                  </Button>
                </Box>
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#6b7280' }}>
                  View or download the filled application form with all submitted details
                </Typography>
              </Box>
            )}

            {/* Action Buttons - Role Based */}
            <div className="action-buttons">
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
                (selectedApplication.statusOfBPLO === 'approved' && selectedApplication.officialReceiptNumber)
              ) && (
                <>
                  {selectedApplication.statusOfBPLO === 'bplo-approved' && !selectedApplication.officialReceiptNumber && (
                    <Typography variant="body2" sx={{ 
                      textAlign: 'center', 
                      p: 1.5, 
                      mb: 2,
                      bgcolor: '#FFF4E6',
                      borderRadius: 1,
                      color: '#DC8C09',
                      fontWeight: 600,
                      border: '1px solid #FBBF24'
                    }}>
                      ⚠️ Note: Client has not submitted OR document yet. You can proceed with approval, but it's recommended to wait for OR submission.
                    </Typography>
                  )}
                  <Button
                    className="button-success"
                    onClick={handleApproveApplication}
                    disabled={isLoading}
                    fullWidth
                  >
                    {isLoading ? <CircularProgress className="circular-progress-small circular-progress-inherit" /> : 'Final Approval with Resolution Number'}
                  </Button>
                </>
              )}
              
              {userRole === 'sb-admin' && selectedApplication.statusOfBPLO === 'sb-approved' && (
                <>
                  <Typography variant="body2" sx={{ 
                    textAlign: 'center', 
                    p: 1.5, 
                    mb: 2,
                    bgcolor: '#e8f5e9',
                    borderRadius: 1,
                    color: '#2e7d32',
                    fontWeight: 600,
                    border: '1px solid #4caf50'
                  }}>
                    ✅ Finally Approved - Click below to accept and create franchise record
                  </Typography>
                  <Button
                    className="button-success"
                    onClick={() => setOpenAcceptFranchiseModal(true)}
                    disabled={isLoading}
                    fullWidth
                  >
                    {isLoading ? <CircularProgress className="circular-progress-small circular-progress-inherit" /> : 'Accept Franchise & Create Record'}
                  </Button>
                </>
              )}
              
              {(selectedApplication.statusOfBPLO === 'bplo-approved' || 
                selectedApplication.statusOfBPLO === 'awaiting-sb' ||
                selectedApplication.statusOfBPLO === 'sb-approved' ||
                selectedApplication.statusOfBPLO === 'bplo-disapproved') && userRole !== 'sb-admin' && (
                <Typography variant="body2" sx={{ 
                  textAlign: 'center', 
                  p: 2, 
                  bgcolor: '#e3f2fd',
                  borderRadius: 1,
                  width: '100%'
                }}>
                  {selectedApplication.statusOfBPLO === 'bplo-approved' && 
                    '✓ Approved by BPLO - Waiting for applicant to submit OR number'}
                  {selectedApplication.statusOfBPLO === 'awaiting-sb' && 
                    '✓ OR Submitted - Ready for SB final approval'}
                  {selectedApplication.statusOfBPLO === 'sb-approved' && 
                    '✅ Finally Approved - Applicant can claim certificate'}
                  {selectedApplication.statusOfBPLO === 'bplo-disapproved' && 
                    '⚠ Disapproved by BPLO - Applicant has been notified'}
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
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(3px)',
            },
          },
        }}
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
          
          <Typography variant="body1" className="mb-2" sx={{ mb: 2 }}>
            This application has been approved by BPLO and the OR has been submitted. 
            Please enter the resolution number to complete the final approval.
          </Typography>
          
          {selectedApplication && (
            <Box sx={{ 
              bgcolor: '#e3f2fd', 
              p: 2, 
              borderRadius: 1, 
              mb: 2 
            }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                Applicant: {selectedApplication.name}
              </Typography>
              <Typography variant="body2">
                OR Number: {selectedApplication.officialReceiptNumber || 'N/A'}
              </Typography>
              <Typography variant="body2">
                Plate Number: {selectedApplication.plateNumber}
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
                ✓ Selected: {resolutionFile.name}
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
      
      {/* Accept Franchise Modal - SB Admin final step to create franchise record */}
      <Modal
        open={openAcceptFranchiseModal}
        onClose={() => {
          setOpenAcceptFranchiseModal(false)
          setSessionNumber('')
          setSessionReportFile(null)
          setScannedRegistrationFile(null)
        }}
        aria-labelledby="accept-franchise-modal"
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
              Accept Franchise - Create Franchise Record
            </Typography>
            <IconButton onClick={() => {
              setOpenAcceptFranchiseModal(false)
              setSessionNumber('')
              setSessionReportFile(null)
              setScannedRegistrationFile(null)
            }}>
              <CloseIcon />
            </IconButton>
          </div>
          
          <Typography variant="body1" className="mb-2" sx={{ mb: 2 }}>
            This will create the official franchise record and move it to the franchise list.
            The applicant will be able to download their certificate after this step.
          </Typography>
          
          {selectedApplication && (
            <Box sx={{ 
              bgcolor: '#e8f5e9', 
              p: 2, 
              borderRadius: 1, 
              mb: 2 
            }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                Applicant: {selectedApplication.name}
              </Typography>
              <Typography variant="body2">
                Franchise Number: {selectedApplication.franchiseNumber || 'Will be auto-assigned'}
              </Typography>
              <Typography variant="body2">
                Resolution Number: {selectedApplication.sbResolutionNumber || 'N/A'}
              </Typography>
              <Typography variant="body2">
                Application Type: {selectedApplication.applicationType || 'new'}
              </Typography>
            </Box>
          )}
          
          <TextField
            label="Session Number"
            value={sessionNumber}
            onChange={(e) => setSessionNumber(e.target.value)}
            fullWidth
            required
            placeholder="E.g., Session 2025-01"
            helperText="Enter the session number for this franchise acceptance"
            sx={{ mb: 2 }}
          />
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Scanned Signed Registration (Optional)
            </Typography>
            <TextField
              type="file"
              fullWidth
              onChange={(e) => setScannedRegistrationFile(e.target.files[0])}
              inputProps={{ 
                accept: "application/pdf,image/jpeg,image/png"
              }}
              helperText="Upload the scanned signed registration document (PDF, JPG, or PNG)"
            />
            {scannedRegistrationFile && (
              <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'success.main' }}>
                ✓ Selected: {scannedRegistrationFile.name}
              </Typography>
            )}
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Individual Session Report (Optional)
            </Typography>
            <TextField
              type="file"
              fullWidth
              onChange={(e) => setSessionReportFile(e.target.files[0])}
              inputProps={{ 
                accept: "application/pdf,image/jpeg,image/png"
              }}
              helperText="Upload the individual session report document (PDF, JPG, or PNG)"
            />
            {sessionReportFile && (
              <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'success.main' }}>
                ✓ Selected: {sessionReportFile.name}
              </Typography>
            )}
          </Box>
          
          <div className="action-buttons">
            <Button
              variant="outlined"
              onClick={() => {
                setOpenAcceptFranchiseModal(false)
                setSessionNumber('')
                setSessionReportFile(null)
                setScannedRegistrationFile(null)
              }}
            >
              Cancel
            </Button>
            <Button
              className="button-success"
              onClick={handleAcceptFranchise}
              disabled={!sessionNumber.trim() || isLoading}
            >
              {isLoading ? <CircularProgress className="circular-progress-small circular-progress-inherit" /> : 'Accept & Create Franchise'}
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
              📄 Franchise Application Form Preview
            </Typography>
            <IconButton onClick={handleClosePdfPreview}>
              <CloseIcon />
            </IconButton>
          </div>
          
          <Box sx={{ 
            flex: 1, 
            overflow: 'hidden',
            p: 0,
            bgcolor: '#525659'
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
