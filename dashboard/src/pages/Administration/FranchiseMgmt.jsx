import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'

// Styles
import '../../Styles/Administrator_Css/FranchiseMgmt.css'
import '../../Styles/Administrator_Css/SharedTable.css'

// Components
import Sidebar from './Sidebar'
import PageLoader from '../../components/PageLoader'
import { FileUploadField, DocumentLink } from './components/FranchiseFormComponents'

// Services & Context
import { franchiseAPI, franchiseInformationAPI } from '../Services/api'
import websocketService from '../../services/websocket'
import { useAuth } from '../../contexts/AuthContext'
import { useIsMounted } from '../../hooks/useIsMounted'
import { useDebounce } from '../../hooks/useDebounce'

// Utilities
import { validateFile, formatFileSize } from '../../utils/fileValidation'
import { compressFile } from '../../utils/compressFile'
import { previewFilledPDF, downloadFilledPDF } from '../../utils/pdfFiller'
import { logger } from '../../utils/logger'
import { debounce } from '../../utils/rateLimiter'

// Franchise-specific constants and utilities
import {
  APPLICATION_TYPES,
  APPLICATION_TYPE_LABELS,
  BARANGAY_LIST,
  CIVIL_STATUS_OPTIONS,
  MODAL_STATUS_CONFIG,
  DOCUMENT_FIELDS,
  MODAL_BACKDROP_PROPS,
  SCROLLBAR_STYLES,
  SECTION_HEADER_STYLES,
  INITIAL_FORM_DATA,
} from './constants/franchiseConstants'

import {
  triggerFileDownload,
  formatDate,
  getApplicationTypeClass,
  isImageFile,
  isPdfFile,
  normalizeApplication,
  sanitizeBaseUrl,
} from './utils/franchiseUtils'

// API configuration
import { API_BASE_URL } from '../Services/api'

// MUI Components
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
  Tooltip,
  Tabs,
  Tab,
  Autocomplete,
} from '@mui/material'

// MUI Icons
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import ImageIcon from '@mui/icons-material/Image'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import VisibilityIcon from '@mui/icons-material/Visibility'
import DownloadIcon from '@mui/icons-material/Download'

function FranchiseMgmt() {
  const { user } = useAuth()
  const userRole = user?.role || 'bplo-admin'
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [statusFilter, setStatusFilter] = useState('all')
  
  // Modal states
  const [openAddModal, setOpenAddModal] = useState(false)
  const [openViewModal, setOpenViewModal] = useState(false)
  const [openRejectModal, setOpenRejectModal] = useState(false)
  const [openSBApprovalModal, setOpenSBApprovalModal] = useState(false)
  const [openFilePreview, setOpenFilePreview] = useState(false)
  const [openPdfPreview, setOpenPdfPreview] = useState(false)
  
  // Walk-in application type tab state
  const [applicationTypeTab, setApplicationTypeTab] = useState(0) // 0: New, 1: Renewal, 2: Amendment
  
  // Franchise search state for Renewal/Amendment
  const [franchiseSearch, setFranchiseSearch] = useState('')
  const [allActiveFranchises, setAllActiveFranchises] = useState([])
  const [selectedFranchise, setSelectedFranchise] = useState(null)
  const [loadingFranchises, setLoadingFranchises] = useState(false)
  
  // Application state
  const [selectedApplication, setSelectedApplication] = useState(null)
  const [pendingApplications, setPendingApplications] = useState([])
  
  // Form state
  const [formData, setFormData] = useState(INITIAL_FORM_DATA)
  const [rejectionReason, setRejectionReason] = useState('')
  const [resolutionNumber, setResolutionNumber] = useState('')
  const [resolutionFile, setResolutionFile] = useState(null)
  
  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [notification, setNotification] = useState({ open: false, message: '', type: 'info' })
  const [previewFile, setPreviewFile] = useState({ name: '', type: '', path: '' })
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null)
  const [qrBlobUrl, setQrBlobUrl] = useState(null)
  
  // File compression states
  const [compressionProgress, setCompressionProgress] = useState({})
  const [processingFiles, setProcessingFiles] = useState({})
  
  // Refs for cleanup and preventing duplicate operations
  const currentBlobUrlRef = useRef(null)
  const qrBlobUrlRef = useRef(null)
  const isUpdatingRef = useRef(false)
  const isFetchingRef = useRef(false)
  const isMountedRef = useIsMounted()

  // Polling disabled by default (WebSocket handles real-time updates)
  const POLL_INTERVAL_MS = 0
  const isAnyModalOpen = openAddModal || openViewModal || openRejectModal || openFilePreview

  /** Deduplicate applications by ID */
  const deduplicateApplications = useCallback((applications) => {
    const seen = new Map()
    const deduplicated = []
    
    for (const app of applications) {
      const id = app.id || app._id
      if (!id) continue
      
      if (!seen.has(id)) {
        seen.set(id, true)
        deduplicated.push(app)
      } else {
        logger.warn('[FranchiseMgmt] Duplicate application removed:', id)
      }
    }
    
    return deduplicated
  }, [])

  /** Fetch pending applications from backend */
  const fetchAllPending = useCallback(async () => {
    if (isFetchingRef.current) {
      logger.log('[FranchiseMgmt] Fetch already in progress, skipping')
      return
    }
    
    isFetchingRef.current = true
    setIsLoading(true)
    
    try {
      const response = userRole === 'sb-admin' 
        ? await franchiseAPI.getApproved() 
        : await franchiseAPI.getPending()
      
      const serverApps = response.data?.data || response.data || []
      
      logger.log(`[FranchiseMgmt] Fetched ${userRole === 'sb-admin' ? 'SB approval' : 'pending'} applications:`, Array.isArray(serverApps) ? serverApps.length : 0)
      logger.log('[FranchiseMgmt] Application types breakdown:', 
        serverApps.reduce((acc, app) => {
          const type = app.applicationType || app.changeType || 'unknown'
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {})
      )
      
      // Debug first few applications
      if (serverApps.length > 0) {
        logger.log('[FranchiseMgmt] Sample application data:', serverApps.slice(0, 2).map(app => ({
          id: app._id || app.id,
          franchiseNumber: app.franchiseNumber,
          applicationType: app.applicationType,
          changeType: app.changeType
        })))
      }
      
      // Map backend fields to frontend format
      const normalizedServerApps = Array.isArray(serverApps) 
        ? serverApps.map(normalizeApplication) 
        : []

      // Deduplicate before setting state (safety check)
      const deduplicatedServerApps = deduplicateApplications(normalizedServerApps)
      
      setPendingApplications(deduplicatedServerApps)
      logger.log('[FranchiseMgmt] fetchAllPending complete:', deduplicatedServerApps.length, 'applications')
    } catch (err) {
      logger.error('[FranchiseMgmt] Error fetching pending applications:', err)
      
      setNotification({
        open: true,
        message: err.response?.data?.error || 'Failed to load pending applications',
        type: 'error',
      })
      
      setPendingApplications([])
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [userRole, deduplicateApplications])

  // Effects - Initial data fetch
  useEffect(() => {
    logger.log('[FranchiseMgmt] Component mounted, fetching initial data...')
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
      logger.log('[FranchiseMgmt] Connecting to WebSocket as:', websocketRoom)
      websocketService.connect(websocketRoom)
      
      // Wait for WebSocket to emit initial data before falling back to API
      connectionTimeout = setTimeout(() => {
        if (!hasReceivedInitialData) {
          logger.log('[FranchiseMgmt] No WebSocket data received, fetching via API fallback')
          fetchAllPending()
        }
      }, 2000) // 2 second timeout
    } else {
      // If already connected, just join the correct room
      logger.log('[FranchiseMgmt] Already connected, joining room:', websocketRoom)
      websocketService.joinRoom(websocketRoom)
    }

    // Subscribe to real-time application updates
    const handleApplicationUpdates = (applications) => {
      logger.log(`[FranchiseMgmt] WebSocket update - ${websocketEvent}:`, applications?.length || 0)
      
      // Mark that we received data from WebSocket
      hasReceivedInitialData = true
      if (connectionTimeout) {
        clearTimeout(connectionTimeout)
        connectionTimeout = null
      }
      
      // Prevent duplicate updates during processing
      if (isUpdatingRef.current) {
        logger.log('[FranchiseMgmt] Already updating, skipping duplicate WebSocket event')
        return
      }
      
      // Only update if we have applications or if this is an explicit clear
      if (!Array.isArray(applications)) {
        logger.log('[FranchiseMgmt] Invalid applications data, skipping update')
        return
      }
      
      // For SB admins, ignore empty WebSocket updates if we already have data
      // This prevents the WebSocket from clearing data when BPLO approves (which triggers a re-emit)
      if (userRole === 'sb-admin' && applications.length === 0 && pendingApplications.length > 0) {
        logger.log('[FranchiseMgmt] Ignoring empty WebSocket update for SB admin (preserving existing data)')
        return
      }
      
      isUpdatingRef.current = true
      logger.log('[FranchiseMgmt] Processing WebSocket update...')
      
      const normalizedApps = applications.map(normalizeApplication)
      
      // Deduplicate applications before setting state
      const deduplicatedApps = deduplicateApplications(normalizedApps)
      
      if (isMountedRef.current) {
        setPendingApplications(deduplicatedApps)
        logger.log('[FranchiseMgmt] State updated with', deduplicatedApps.length, 'applications', normalizedApps.length !== deduplicatedApps.length ? `(removed ${normalizedApps.length - deduplicatedApps.length} duplicates)` : '')
      }
      
      // Reset the updating flag after state update
      // Using setTimeout to ensure state has been committed
      setTimeout(() => {
        isUpdatingRef.current = false
        logger.log('[FranchiseMgmt] Update lock released')
      }, 150)
    }

    websocketService.on(websocketEvent, handleApplicationUpdates)
    
    // Listen for individual application updates - merge into existing list
    const handleNewApplication = (application) => {
      const appType = application?.applicationType || 'unknown'
      const appId = application?._id || application?.id
      
      logger.log(`[FranchiseMgmt] New ${appType} application received:`, {
        id: appId,
        type: appType,
        status: application?.statusOfBPLO,
        role: userRole
      })
      
      // Don't process if we're currently updating or no valid ID
      if (isUpdatingRef.current || !appId) {
        logger.log('[FranchiseMgmt] Skipping individual app update - lock active or invalid ID')
        return
      }
      
      // Merge this application into the existing list (or wait for full list update)
      // Individual events are just notifications - the main event will update the full list
      logger.log('[FranchiseMgmt] Waiting for full list update from main WebSocket event')
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
      logger.log('[FranchiseMgmt] WebSocket not active, starting polling fallback...')
      pollId = setInterval(() => {
        logger.log('[FranchiseMgmt] Polling for updates (fallback mode)...')
        fetchAllPending()
      }, POLL_INTERVAL_MS)
    } else if (POLL_INTERVAL_MS > 0 && isWebSocketActive) {
      logger.log('[FranchiseMgmt] WebSocket active, polling disabled')
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
  }, [isAnyModalOpen, userRole, deduplicateApplications]) // Removed fetchAllPending from dependencies to prevent refetch loops

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchTerm])

  /** Filter applications based on search term and status */
  const filteredApplications = useMemo(() => {
    const searchLower = debouncedSearchTerm.toLowerCase()
    
    return pendingApplications.filter((app) => {
      const appType = APPLICATION_TYPE_LABELS[app.applicationType] ?? app.applicationType ?? ''
      const matchesSearch = !searchLower || (
        app.name?.toLowerCase().includes(searchLower) ||
        app.franchiseNumber?.toLowerCase().includes(searchLower) ||
        app.plateNumber?.toLowerCase().includes(searchLower) ||
        appType.toLowerCase().includes(searchLower)
      )
      
      if (!matchesSearch) return false
      
      // Status filter
      if (statusFilter === 'all') return true
      
      const status = app.statusOfBPLO || 'pending'
      return status === statusFilter
    })
  }, [pendingApplications, debouncedSearchTerm, statusFilter])

  /**
   * Revoke all document blob URLs in form data
   */
  const revokeAllFormBlobs = useCallback(() => {
    Object.entries(formData).forEach(([key, value]) => {
      if (key.startsWith('document') && value?.path?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(value.path)
        } catch (e) {
          logger.warn('Failed to revoke blob URL on form reset:', e)
        }
      }
    })
  }, [formData])

  // Modal Handlers
  const handleOpenAddModal = useCallback(() => setOpenAddModal(true), [])
  const handleCloseAddModal = useCallback(() => {
    // Revoke blob URLs before resetting form
    revokeAllFormBlobs()
    
    // Reset all state
    setOpenAddModal(false)
    setApplicationTypeTab(0)
    setFranchiseSearch('')
    setAllActiveFranchises([])
    setSelectedFranchise(null)
    setFormData(INITIAL_FORM_DATA)
    
    // Clear any processing states
    setProcessingFiles({})
    setCompressionProgress({})
  }, [revokeAllFormBlobs])
  
  /**
   * Load all franchises for Renewal/Amendment (Active, Expired, Revoked)
   * Loaded once, filtered client-side
   */
  const loadAllActiveFranchises = useCallback(async () => {
    if (allActiveFranchises.length > 0) return // Already loaded
    
    try {
      setLoadingFranchises(true)
      logger.log('[FranchiseMgmt] Loading all franchises (Active, Expired, Revoked)...')
      
      const response = await franchiseInformationAPI.getAll()
      
      logger.log('[FranchiseMgmt] Franchises response:', response.data)
      
      // Extract franchises from response (similar to FranchiseeList)
      let franchises = []
      if (response.data?.success && response.data?.data) {
        franchises = response.data.data
      } else if (response.data && Array.isArray(response.data.franchises)) {
        franchises = response.data.franchises
      } else if (Array.isArray(response.data)) {
        franchises = response.data
      }
      
      // Keep ALL franchises (Active, Expired, Revoked) for proper validation
      logger.log('[FranchiseMgmt] Loaded all franchises:', franchises.length)
      setAllActiveFranchises(franchises)
    } catch (error) {
      logger.error('[FranchiseMgmt] Error loading franchises:', error)
      setNotification({ 
        open: true, 
        message: error.response?.data?.error || 'Failed to load franchises', 
        type: 'error' 
      })
      setAllActiveFranchises([])
    } finally {
      setLoadingFranchises(false)
    }
  }, [allActiveFranchises.length])
  
  /**
   * Filter franchises client-side based on search term (like FranchiseeList)
   */
  const filteredFranchises = useMemo(() => {
    if (!franchiseSearch || franchiseSearch.length < 2) {
      return []
    }
    
    const searchLower = franchiseSearch.toLowerCase()
    return allActiveFranchises.filter(
      (franchise) =>
        franchise.franchiseNumber?.toLowerCase().includes(searchLower) ||
        franchise.operatorName?.toLowerCase().includes(searchLower) ||
        franchise.mvPlateNo?.toLowerCase().includes(searchLower) ||
        franchise.operatorBarangay?.toLowerCase().includes(searchLower)
    )
  }, [allActiveFranchises, franchiseSearch])
  
  /**
   * Prefill form data from selected franchise (excluding documents)
   * @param {Object} franchise - Selected franchise object
   */
  const prefillFromFranchise = useCallback((franchise) => {
    if (!franchise) {
      logger.warn('[FranchiseMgmt] Attempted to prefill with null franchise')
      return
    }
    
    logger.log('[FranchiseMgmt] Prefilling form from franchise:', franchise.franchiseNumber)
    
    // Validate franchise status
    const franchiseStatus = franchise.franchiseStatus?.toLowerCase() || 'active'
    const isRenewal = applicationTypeTab === 1
    const isAmendment = applicationTypeTab === 2
    
    // Check if franchise is revoked
    if (franchiseStatus === 'revoked') {
      if (isRenewal || isAmendment) {
        setNotification({
          open: true,
          message: `Franchise #${franchise.franchiseNumber} is REVOKED and cannot be renewed or amended. Please create a NEW application instead.`,
          type: 'error'
        })
        return
      }
    }
    
    // Check if franchise is expired
    if (franchiseStatus === 'expired') {
      if (isAmendment) {
        // Block amendment for expired franchises
        setNotification({
          open: true,
          message: `Franchise #${franchise.franchiseNumber} is EXPIRED and cannot be amended. Please use RENEWAL to extend the franchise period first.`,
          type: 'error'
        })
        return
      }
      // Allow renewal for expired franchises with info message
      if (isRenewal) {
        setNotification({
          open: true,
          message: `Franchise #${franchise.franchiseNumber} is EXPIRED. Renewal will extend the franchise period.`,
          type: 'info'
        })
      }
    }
    
    // Check if franchise is active and user is trying to renew
    if (franchiseStatus === 'active' && isRenewal) {
      setNotification({
        open: true,
        message: `Note: Franchise #${franchise.franchiseNumber} is still ACTIVE. Renewal will extend the franchise period after the current expiry date.`,
        type: 'info'
      })
    }
    
    setSelectedFranchise(franchise)
    
    // Helper function to format date for input field (YYYY-MM-DD)
    const formatDateForInput = (dateValue) => {
      if (!dateValue) return ''
      try {
        const date = new Date(dateValue)
        if (isNaN(date.getTime())) return ''
        // Format as YYYY-MM-DD
        return date.toISOString().split('T')[0]
      } catch (error) {
        logger.warn('[FranchiseMgmt] Error formatting date:', error)
        return ''
      }
    }
    
    // Prefill personal information (operator details)
    setFormData(prev => ({
      ...prev,
      // Keep these fields from INITIAL_FORM_DATA
      date: prev.date,
      applicationType: applicationTypeTab === 1 ? 'Renewal' : 'Amendment',
      
      // Prefill from existing franchise
      name: franchise.operatorName || '',
      contactNumber: franchise.operatorContactNumber || '',
      operatorEmail: franchise.operatorEmail || '',
      address: franchise.operatorAddress || '',
      barangay: franchise.operatorBarangay || '',
      birthPlace: franchise.operatorBirthPlace || '',
      birthDate: formatDateForInput(franchise.operatorBirthDate),
      civilStatus: franchise.operatorCivilStatus || '',
      citizenship: franchise.operatorCitizenship || '',
      todaMembership: franchise.todaMembership || '',
      
      // Motorcycle information (for Amendment, these can be changed)
      driverName: franchise.driverName || '',
      driverAddress: franchise.driversAddress || '',
      unitModel: franchise.unitModel || '',
      colorMotor: franchise.colorMotor || '',
      colorSidecar: franchise.sideCarColor || '',
      mvPlate: franchise.mvPlateNo || '',
      motorEngineNumber: franchise.motorEngineNo || '',
      chassisNumber: franchise.chasisNo || '',
      
      // Store franchise number and ID for reference
      existingFranchiseNumber: franchise.franchiseNumber,
      existingFranchiseId: franchise._id || franchise.id,
      
      // Documents remain empty - must be re-uploaded
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
    }))
    
    setNotification({
      open: true,
      message: `Pre-filled data from Franchise #${franchise.franchiseNumber}. Please update information and upload new documents.`,
      type: 'info'
    })
  }, [applicationTypeTab])
  
  /**
   * Handle tab change for application type
   */
  const handleApplicationTypeTabChange = useCallback((event, newValue) => {
    logger.log('[FranchiseMgmt] Changing application type tab to:', newValue)
    
    // Revoke blobs before resetting
    revokeAllFormBlobs()
    
    // Update tab
    setApplicationTypeTab(newValue)
    
    // Reset search and selection when changing tabs
    setFranchiseSearch('')
    setSelectedFranchise(null)
    setFormData(INITIAL_FORM_DATA)
    
    // Clear processing states
    setProcessingFiles({})
    setCompressionProgress({})
    
    // Load franchises when switching to Renewal or Amendment tab
    if (newValue === 1 || newValue === 2) {
      loadAllActiveFranchises()
    }
  }, [revokeAllFormBlobs, loadAllActiveFranchises])
  
  /**
   * Open view modal with selected application data
   * Application is already normalized, so we use it directly
   */
  const handleOpenViewModal = useCallback((application) => {
    setSelectedApplication(application)
    setOpenViewModal(true)
  }, [])
  
  const handleCloseViewModal = useCallback(() => setOpenViewModal(false), [])

  /**
   * Safely revoke a blob URL from a ref
   * @param {React.MutableRefObject} ref - Ref containing blob URL
   */
  const safeRevokeUrl = useCallback((ref) => {
    if (ref.current) {
      try {
        URL.revokeObjectURL(ref.current)
      } catch (e) {
        logger.warn('Failed to revoke blob URL:', e)
      }
      ref.current = null
    }
  }, [])

  /**
   * Build full URL from raw path
   * @param {string} raw - Raw URL or path
   * @returns {string} Full URL
   */
  const buildFullUrl = useCallback((raw) => {
    if (/^https?:\/\//i.test(raw)) return raw
    const baseUrl = sanitizeBaseUrl(API_BASE_URL)
    return `${baseUrl}${raw.startsWith('/') ? '' : '/'}${raw}`
  }, [])

  // Fetch QR image when selected application changes
  useEffect(() => {
    let isCancelled = false
    
    safeRevokeUrl(qrBlobUrlRef)

    const fetchQrCode = async () => {
      const qrPath = selectedApplication?.qrCode
      if (!qrPath) {
        setQrBlobUrl(null)
        return
      }
      
      try {
        const url = buildFullUrl(qrPath)
        const response = await fetch(url)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch QR: ${response.status}`)
        }
        
        const blob = await response.blob()
        if (isCancelled) return
        
        const objectUrl = URL.createObjectURL(blob)
        qrBlobUrlRef.current = objectUrl
        setQrBlobUrl(objectUrl)
      } catch (err) {
        logger.warn('[FranchiseMgmt] Failed to fetch QR blob:', err)
        setQrBlobUrl(null)
      }
    }

    fetchQrCode()

    return () => {
      isCancelled = true
      safeRevokeUrl(qrBlobUrlRef)
      setQrBlobUrl(null)
    }
  }, [selectedApplication, safeRevokeUrl, buildFullUrl])
  
  const handleOpenRejectModal = useCallback(() => {
    setOpenViewModal(false)
    setOpenRejectModal(true)
  }, [])
  
  const handleCloseRejectModal = useCallback(() => setOpenRejectModal(false), [])
  
  // File Preview Handlers
  /** Normalize file data from various formats */
  const normalizeFileData = useCallback((file) => {
    if (!file) return null
    
    // Object format: { name, type, path }
    if (typeof file === 'object' && (file.path || file.name)) {
      return {
        name: file.name || file.originalname || '',
        type: file.type || file.mimetype || '',
        path: file.path || file.pathname || '',
      }
    }
    
    // Legacy string path format
    if (typeof file === 'string') {
      return {
        name: file.split('/').pop() || file,
        type: '',
        path: file,
      }
    }
    
    return null
  }, [])

  /**
   * Convert path to full HTTP URL
   * Handles GridFS format and relative paths
   * @param {string} path - File path to convert
   * @returns {string} Full HTTP URL
   */
  const convertToHttpUrl = useCallback((path) => {
    if (!path) return ''
    
    const baseUrl = sanitizeBaseUrl(API_BASE_URL)
    
    // GridFS format: gridfs://fileId -> /api/files/fileId
    if (path.startsWith('gridfs://')) {
      const fileId = path.substring(9)
      logger.log('[Preview] GridFS format detected, converting:', fileId)
      return `${baseUrl}/api/files/${fileId}`
    }
    
    // Already an HTTP URL
    if (/^https?:\/\//i.test(path)) {
      return path
    }
    
    // Relative path -> prefix with API_BASE_URL
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
  }, [])

  /**
   * Open file preview modal
   * Fetches file and creates blob URL for secure preview
   */
  const handleOpenFilePreview = useCallback(async (file) => {
    if (!file) {
      setNotification({ open: true, message: 'File not available for preview', type: 'info' })
      return
    }

    const normalized = normalizeFileData(file)
    if (!normalized?.path) {
      setNotification({ open: true, message: 'Invalid file data', type: 'error' })
      return
    }

    const fullUrl = convertToHttpUrl(normalized.path)

    try {
      const response = await fetch(fullUrl, { mode: 'cors' })
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`)
      }
      
      const blob = await response.blob()
      const contentType = blob.type || response.headers.get('Content-Type') || ''
      
      logger.log('[FilePreview] Fetched file, content type:', contentType)
      
      // Ensure blob has correct MIME type
      const finalBlob = blob.type ? blob : new Blob([blob], { type: contentType })
      const objectUrl = URL.createObjectURL(finalBlob)
      
      // Revoke previous blob URL if exists
      safeRevokeUrl(currentBlobUrlRef)
      currentBlobUrlRef.current = objectUrl
      
      setPreviewFile({
        name: normalized.name || 'document',
        type: contentType,
        path: objectUrl,
      })
      setOpenFilePreview(true)
    } catch (err) {
      logger.warn('[FilePreview] Fetch failed:', err)
      setNotification({ open: true, message: 'Failed to load file preview', type: 'error' })
    }
  }, [normalizeFileData, convertToHttpUrl, safeRevokeUrl])

  const handleCloseFilePreview = useCallback(() => {
    safeRevokeUrl(currentBlobUrlRef)
    setOpenFilePreview(false)
  }, [safeRevokeUrl])
  
  /**
   * Get appropriate icon for file type
   * @param {string} fileType - MIME type of file
   * @returns {JSX.Element} Icon component
   */
  const getFileIcon = useCallback((fileType) => {
    if (!fileType) return <InsertDriveFileIcon />
    if (fileType.includes('image')) return <ImageIcon />
    if (fileType.includes('pdf')) return <PictureAsPdfIcon />
    return <InsertDriveFileIcon />
  }, [])
  
  // Form Handlers
  /** Compression threshold in bytes (300KB) */
  const COMPRESSION_THRESHOLD = 300 * 1024

  /**
   * Handle form field changes
   */
  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])
  
  /**
   * Handle contact number changes - only allow numeric input
   * Matches FranchiseApplication.jsx validation
   */
  const handleContactNumberChange = useCallback((e) => {
    const value = e.target.value
    const numbersOnly = /^[0-9]*$/
    
    if (value === "" || numbersOnly.test(value)) {
      setFormData((prev) => ({ ...prev, contactNumber: value }))
    }
  }, [])
  
  /**
   * Handle MV Plate changes with Philippine format validation (ABC1234)
   * Matches FranchiseApplication.jsx validation exactly
   */
  const handleMVPlateChange = useCallback((e) => {
    let inputValue = e.target.value.toUpperCase().trim()
    let validatedValue = ""
    let error = ""
    
    // Handle empty input
    if (inputValue === "") {
      setFormData((prev) => ({ ...prev, mvPlate: "" }))
      return
    }
    
    // Process character by character to enforce strict rules
    for (let i = 0; i < inputValue.length; i++) {
      const char = inputValue[i]
      
      // Skip spaces
      if (char === " ") {
        continue
      }
      
      // First 3 characters: MUST be letters only
      if (validatedValue.length < 3) {
        const charCode = char.charCodeAt(0)
        if ((charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122)) {
          validatedValue += char.toUpperCase()
        } else {
          error = "First 3 characters must be letters (A-Z)"
          break
        }
      }
      // After 3 letters: MUST be digits only
      else {
        if (/[0-9]/.test(char)) {
          validatedValue += char
        } else {
          error = "Characters after position 3 must be numbers (0-9)"
          break
        }
      }
      
      // Enforce maximum length (3 letters + 4 numbers = 7 total)
      if (validatedValue.length >= 7) {
        break
      }
    }
    
    // Set the validated value
    setFormData((prev) => ({ ...prev, mvPlate: validatedValue }))
  }, [])
  
  /**
   * Revoke blob URL in form data if it exists
   * @param {Object} prevData - Previous form data
   * @param {string} fieldName - Field name to check
   */
  const revokePreviousBlob = useCallback((prevData, fieldName) => {
    const path = prevData[fieldName]?.path
    if (path?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(path)
      } catch (err) {
        logger.warn('Failed to revoke previous file blob:', err)
      }
    }
  }, [])

  /**
   * Create file data object for form state
   * @param {File} processedFile - Processed file
   * @param {File} originalFile - Original file
   * @returns {Object} File data object
   */
  const createFileData = useCallback((processedFile, originalFile) => ({
    name: processedFile.name,
    type: processedFile.type,
    path: URL.createObjectURL(processedFile),
    file: processedFile,
    originalSize: originalFile.size,
    compressedSize: processedFile.size,
  }), [])

  /**
   * Handle file input changes with validation and compression
   */
  const handleFileChange = useCallback(async (e) => {
    const { name, files } = e.target
    const file = files?.[0]
    if (!file) return
    
    // Validate file
    const validation = validateFile(file)
    if (!validation.success) {
      setNotification({ open: true, message: validation.message, type: 'error' })
      e.target.value = ''
      return
    }
    
    const shouldCompress = file.size > COMPRESSION_THRESHOLD
    
    if (shouldCompress) {
      setProcessingFiles((prev) => ({ ...prev, [name]: true }))
      setCompressionProgress((prev) => ({ ...prev, [name]: 0 }))
    }
    
    try {
      let processedFile = file
      
      if (shouldCompress) {
        // Progressive compression feedback
        setCompressionProgress((prev) => ({ ...prev, [name]: 30 }))
        await new Promise((resolve) => setTimeout(resolve, 200))
        setCompressionProgress((prev) => ({ ...prev, [name]: 60 }))
        
        processedFile = await compressFile(file)
        
        setCompressionProgress((prev) => ({ ...prev, [name]: 100 }))
        await new Promise((resolve) => setTimeout(resolve, 300))
        
        // Show compression result if file was actually compressed
        if (processedFile.size !== file.size) {
          const savings = Math.round((1 - processedFile.size / file.size) * 100)
          setNotification({
            open: true,
            message: `Compression complete: ${formatFileSize(file.size)} → ${formatFileSize(processedFile.size)} (${savings}% smaller!)`,
            type: 'success',
          })
        }
      }
      
      setFormData((prev) => {
        revokePreviousBlob(prev, name)
        return { ...prev, [name]: createFileData(processedFile, file) }
      })
    } catch (error) {
      logger.error('[FileCompression] Error:', error)
      setNotification({
        open: true,
        message: 'Compression failed. Using original file.',
        type: 'warning',
      })
      
      // Fallback to original file
      setFormData((prev) => {
        revokePreviousBlob(prev, name)
        return {
          ...prev,
          [name]: {
            name: file.name,
            type: file.type,
            path: URL.createObjectURL(file),
            file,
          },
        }
      })
    } finally {
      setProcessingFiles((prev) => ({ ...prev, [name]: false }))
      setCompressionProgress((prev) => ({ ...prev, [name]: 0 }))
    }
  }, [revokePreviousBlob, createFileData])
  
  /**
   * Cleanup blob URLs when component unmounts
   */
  useEffect(() => {
    // Capture current form data for cleanup
    const formDataSnapshot = { ...formData }
    
    return () => {
      Object.entries(formDataSnapshot).forEach(([key, value]) => {
        if (key.startsWith('document') && value?.path?.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(value.path)
          } catch (e) {
            logger.warn('Failed to revoke blob URL:', e)
          }
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Form Field Mapping (Frontend -> Backend)
  /** Maps frontend field names to backend expected names */
  const FIELD_MAPPING = {
    // Operator fields
    name: 'operatorName',
    contactNumber: 'operatorContactNumber',
    operatorEmail: 'operatorEmail',
    address: 'operatorAddress',
    barangay: 'operatorBarangay',
    birthPlace: 'operatorBirthPlace',
    birthDate: 'operatorBirthDate',
    civilStatus: 'operatorCivilStatus',
    citizenship: 'operatorCitizenship',
    // Vehicle fields
    todaMembership: 'todaMembership',
    colorSidecar: 'sideCarColor',
    mvPlate: 'mvPlateNo',
    motorEngineNumber: 'motorEngineNo',
    chassisNumber: 'chasisNo',
    driverName: 'driverName',
    driverAddress: 'driversAddress',
    unitModel: 'unitModel',
    colorMotor: 'colorMotor',
    // Document fields
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
    documentOfficialReceipt: 'oRTreasurerOfficeObj',
  }

  /** Fields to skip during form submission (handled separately) */
  const SKIP_FIELDS = ['officialReceiptNumber', 'documentOfficialReceipt']

  /**
   * Submit new franchise application
   */
  const handleSubmitApplication = async (e) => {
    e.preventDefault()
    
    // Validate contact information
    const hasEmail = formData.operatorEmail?.trim()
    const hasContact = formData.contactNumber?.trim()
    
    if (!hasEmail && !hasContact) {
      setNotification({
        open: true,
        message: 'Please provide either an Email Address OR Contact Number for notifications',
        type: 'error',
      })
      return
    }
    
    // Determine application type based on tab
    const applicationType = applicationTypeTab === 0 ? 'new' : (applicationTypeTab === 1 ? 'renewal' : 'amendment')
    
    // For Renewal/Amendment, ensure a franchise is selected
    if ((applicationTypeTab === 1 || applicationTypeTab === 2) && !selectedFranchise) {
      setNotification({
        open: true,
        message: 'Please search and select an existing franchise first',
        type: 'error',
      })
      return
    }
    
    // Additional validation for Renewal/Amendment
    if (applicationTypeTab === 1 || applicationTypeTab === 2) {
      if (!selectedFranchise.franchiseNumber) {
        setNotification({
          open: true,
          message: 'Invalid franchise selection. Please select again.',
          type: 'error',
        })
        return
      }
      
      logger.log(`[FranchiseMgmt] Submitting ${applicationType} for franchise #${selectedFranchise.franchiseNumber}`)
    }
    
    setIsLoading(true)
    
    try {
      const formDataToSend = new FormData()
      
      // Add form fields with mapped backend names
      Object.entries(formData).forEach(([key, value]) => {
        if (SKIP_FIELDS.includes(key)) return
        if (key === 'existingFranchiseNumber' || key === 'existingFranchiseId') return // Skip internal fields
        
        const backendKey = FIELD_MAPPING[key] || key
        
        if (key.startsWith('document') && value?.file) {
          formDataToSend.append(backendKey, value.file)
        } else if (value != null && value !== '') {
          formDataToSend.append(backendKey, value)
        }
      })
      
      // Application metadata
      formDataToSend.append('applicationType', applicationType)
      formDataToSend.append('isWalkIn', 'true')
      
      // Always include changeType (backend uses this to determine application type)
      let changeType
      if (applicationType === 'new') {
        changeType = 'new'
      } else if (applicationType === 'renewal') {
        changeType = 'renewal'
      } else if (applicationType === 'amendment') {
        changeType = 'amendment'
      }
      formDataToSend.append('changeType', changeType)
      
      // Debug logging - verify what's being sent
      logger.log('[FranchiseMgmt] Submitting application with:', {
        applicationType,
        changeType,
        isWalkIn: true,
        hasSelectedFranchise: !!selectedFranchise,
        franchiseNumber: selectedFranchise?.franchiseNumber
      })
      
      // For Renewal/Amendment, include existing franchise reference
      if (selectedFranchise) {
        formDataToSend.append('existingFranchiseNumber', selectedFranchise.franchiseNumber)
        formDataToSend.append('existingFranchiseId', selectedFranchise._id || selectedFranchise.id)
        
        // For renewals, keep existing pictures by passing their references
        if (applicationType === 'renewal') {
          if (selectedFranchise.documents?.driverPictureObj) {
            formDataToSend.append('existingDriverPicture', selectedFranchise.documents.driverPictureObj)
          }
          if (selectedFranchise.documents?.operatorPictureObj) {
            formDataToSend.append('existingOperatorPicture', selectedFranchise.documents.operatorPictureObj)
          }
        }
      }
      
      // OR information (walk-in)
      if (formData.officialReceiptNumber?.trim()) {
        formDataToSend.append('officialReceiptNumber', formData.officialReceiptNumber.trim())
        formDataToSend.append('orSubmittedAt', new Date().toISOString())
      }
      
      if (formData.documentOfficialReceipt?.file) {
        formDataToSend.append('oRTreasurerOfficeObj', formData.documentOfficialReceipt.file)
      }

      // Use franchiseAPI.create for all walk-in applications (new, renewal, amendment)
      // The backend will handle it based on applicationType and isWalkIn flags
      const response = await franchiseAPI.create(formDataToSend)
      
      logger.log(`[FranchiseMgmt] ${applicationType.toUpperCase()} application submitted successfully:`, response.data)
      
      // Debug logging - verify what backend returned
      if (response.data?.application || response.data?.data) {
        const returnedApp = response.data?.application || response.data?.data
        logger.log('[FranchiseMgmt] Backend returned application type:', {
          applicationType: returnedApp.applicationType,
          changeType: returnedApp.changeType,
          id: returnedApp._id || returnedApp.id
        })
      }

      // Refresh applications list
      await fetchAllPending()
      
      // Close modal (includes cleanup)
      handleCloseAddModal()
      
      const typeLabel = applicationType === 'new' ? 'New' : (applicationType === 'renewal' ? 'Renewal' : 'Amendment')
      const franchiseRef = selectedFranchise ? ` (Franchise #${selectedFranchise.franchiseNumber})` : ''
      
      setNotification({
        open: true,
        message: response.data?.message || `Walk-in ${typeLabel} application${franchiseRef} submitted successfully. The applicant will be notified via available contact method.`,
        type: 'success',
      })
    } catch (error) {
      logger.error(`[FranchiseMgmt] Error submitting ${applicationType} application:`, error)
      
      // Provide specific error messages based on error type
      let errorMessage = 'Failed to submit application'
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.response?.status === 404) {
        errorMessage = 'Franchise not found. Please search again.'
      } else if (error.response?.status === 400) {
        errorMessage = 'Invalid application data. Please check all fields.'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      setNotification({
        open: true,
        message: errorMessage,
        type: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Application Approval Handlers
  /** Approve application (role-based: BPLO or SB) */
  const handleApproveApplication = async () => {
    if (!selectedApplication || isLoading) {
      if (isLoading) logger.log('[FranchiseMgmt] Already processing, ignoring duplicate click')
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
      logger.log('[FranchiseMgmt] BPLO approving application:', selectedApplication.id)
      const response = await franchiseAPI.approveBPLO(selectedApplication.id)
      logger.log('[FranchiseMgmt] Application approved by BPLO:', response.data)

      await fetchAllPending()
      setNotification({ 
        open: true, 
        message: 'Application approved by BPLO. Applicant will be notified to proceed with inspection and OR submission.', 
        type: 'success',
      })
      handleCloseViewModal()
    } catch (error) {
      logger.error('[FranchiseMgmt] Error approving application:', error)
      
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to approve application'
      const isConflict = error.response?.status === 409
      
      setNotification({
        open: true,
        message: isConflict ? `Already approved: ${errorMessage}` : errorMessage,
        type: 'error',
      })
      
      if (isConflict) {
        await fetchAllPending()
        handleCloseViewModal()
      }
    } finally {
      setIsLoading(false)
    }
  }
  
  /** SB Admin final approval with resolution number */
  const handleSBApproval = async () => {
    const trimmedResolution = resolutionNumber.trim()
    
    if (!selectedApplication || !trimmedResolution) {
      setNotification({
        open: true,
        message: 'Resolution number is required',
        type: 'error',
      })
      return
    }
    
    setIsLoading(true)
    
    try {
      logger.log('[FranchiseMgmt] SB final approval - creating franchise:', selectedApplication.id)
      
      // Prepare form data for resolution
      const sbFormData = new FormData()
      sbFormData.append('resolutionNumber', trimmedResolution)
      if (resolutionFile) {
        sbFormData.append('resolutionDocument', resolutionFile)
      }
      
      // Step 1: SB Approval with resolution
      logger.log('[FranchiseMgmt] Step 1/2: Approving with resolution number...')
      const approvalResponse = await franchiseAPI.approveSBWithDocument(selectedApplication.id, sbFormData)
      logger.log('[FranchiseMgmt] Step 1/2 completed:', approvalResponse.data)

      // Brief delay for database consistency
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Step 2: Create franchise record
      logger.log('[FranchiseMgmt] Step 2/2: Creating franchise record...')
      const isNewApplication = selectedApplication.applicationType === 'new' || !selectedApplication.applicationType
      
      const acceptFranchise = isNewApplication 
        ? franchiseAPI.acceptNewFranchise 
        : franchiseAPI.acceptRenewAmend
      
      try {
        const franchiseResponse = await acceptFranchise(selectedApplication.id, {})
        logger.log('[FranchiseMgmt] Step 2/2 completed:', franchiseResponse.data)
      } catch (acceptError) {
        logger.error('[FranchiseMgmt] Franchise creation failed:', acceptError)
        const errorMsg = acceptError.response?.data?.error || acceptError.message
        throw new Error(
          `Approval successful but franchise creation failed: ${errorMsg}. ` +
          "The application is now 'sb-approved' and can be manually accepted."
        )
      }

      await fetchAllPending()

      setNotification({ 
        open: true, 
        message: 'Franchise approved and created successfully! The franchise is now active.', 
        type: 'success',
      })
      
      // Reset modal state
      setOpenSBApprovalModal(false)
      setResolutionNumber('')
      setResolutionFile(null)
      handleCloseViewModal()
    } catch (error) {
      logger.error('[FranchiseMgmt] SB approval error:', error)
      
      setNotification({
        open: true,
        message: error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to complete franchise approval',
        type: 'error',
      })
      
      // Refresh in case approval succeeded but creation failed
      await fetchAllPending()
    } finally {
      setIsLoading(false)
    }
  }
  
  /**
   * Submit disapproval/rejection (BPLO only)
   */
  const handleSubmitRejection = async () => {
    const trimmedReason = rejectionReason.trim()
    
    if (!selectedApplication || !trimmedReason) {
      setNotification({
        open: true,
        message: 'Please provide a reason for disapproval',
        type: 'error',
      })
      return
    }
    
    setIsLoading(true)
    
    try {
      logger.log('[FranchiseMgmt] BPLO disapproving:', selectedApplication.id)
      await franchiseAPI.disapproveBPLO(selectedApplication.id, trimmedReason)
      logger.log('[FranchiseMgmt] Application disapproved')
      
      await fetchAllPending()
      
      setNotification({ 
        open: true, 
        message: 'Application disapproved. Applicant has been notified.', 
        type: 'success',
      })
      
      handleCloseRejectModal()
      setRejectionReason('')
    } catch (error) {
      logger.error('[FranchiseMgmt] Disapproval error:', error)
      setNotification({
        open: true,
        message: error.response?.data?.error || 'Failed to disapprove application',
        type: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Notification & PDF Handlers
  /** Close notification snackbar */
  const handleNotificationClose = useCallback(() => {
    setNotification({ open: false, message: '', type: 'info' })
  }, [])

  /** Generate PDF preview */
  const handlePdfPreview = async () => {
    if (!selectedApplication) return
    
    setIsLoading(true)
    try {
      const url = await previewFilledPDF(selectedApplication)
      setPdfPreviewUrl(url)
      setOpenPdfPreview(true)
      setNotification({ open: true, message: 'PDF preview generated successfully', type: 'success' })
    } catch (error) {
      logger.error('[FranchiseMgmt] PDF preview error:', error)
      setNotification({ open: true, message: 'Failed to generate PDF preview', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  /** Download filled PDF */
  const handlePdfDownload = async () => {
    if (!selectedApplication) return
    
    setIsLoading(true)
    try {
      const safeName = selectedApplication.name?.replace(/\s+/g, '-') || selectedApplication.id
      await downloadFilledPDF(selectedApplication, `franchise-application-${safeName}.pdf`)
      setNotification({ open: true, message: 'PDF downloaded successfully', type: 'success' })
    } catch (error) {
      logger.error('[FranchiseMgmt] PDF download error:', error)
      setNotification({ open: true, message: 'Failed to download PDF', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  /** Close PDF preview and cleanup */
  const handleClosePdfPreview = useCallback(() => {
    setOpenPdfPreview(false)
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl)
      setPdfPreviewUrl(null)
    }
  }, [pdfPreviewUrl])

  // Status Display
  /** Status configuration map */
  const STATUS_CONFIG = useMemo(() => ({
    pending: { suffix: 'For BPLO Verification', color: '#F59E0B', bgColor: '#FEF3C7' },
    'bplo-approved-with-or': { suffix: 'Ready for SB Final Approval', color: '#059669', bgColor: '#D1FAE5' },
    'bplo-approved': { suffix: 'Awaiting Client OR Number', color: '#DC8C09', bgColor: '#FFF4E6' },
    'awaiting-sb': { suffix: 'Ready for SB Final Approval', color: '#0A356B', bgColor: '#DBEAFE' },
    'sb-approved': { suffix: 'Completing Franchise Creation...', color: '#059669', bgColor: '#D1FAE5' },
    'bplo-disapproved': { suffix: 'Disapproved by BPLO', color: '#DC2626', bgColor: '#FEE2E2' },
    default: { suffix: 'Unknown Status', color: '#6B7280', bgColor: '#F3F4F6' },
  }), [])

  /**
   * Get status display information
   * @param {string} statusOfBPLO - Current status
   * @param {boolean} hasOR - Whether OR is submitted
   * @param {string} applicationType - Type of application
   * @returns {Object} Status display info with label, color, bgColor
   */
  const getStatusInfo = useCallback((statusOfBPLO, hasOR, applicationType = 'new') => {
    const typeLabel = APPLICATION_TYPE_LABELS[applicationType] || 'Application'
    
    // Determine effective status key
    let statusKey = statusOfBPLO
    if (statusOfBPLO === 'bplo-approved' && hasOR) {
      statusKey = 'bplo-approved-with-or'
    }
    
    const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.default
    
    return {
      label: `${typeLabel} - ${config.suffix}`,
      color: config.color,
      bgColor: config.bgColor,
    }
  }, [STATUS_CONFIG])

  // Render Helpers
  /** Render application table row */
  const renderApplicationRow = useCallback((application) => {
    const hasOR = Boolean(application.officialReceiptNumber?.trim())
    const statusInfo = getStatusInfo(application.statusOfBPLO || 'pending', hasOR, application.applicationType)
    const appTypeLabel = APPLICATION_TYPE_LABELS[application.applicationType] || application.applicationType || 'Unknown'
    
    return (
      <TableRow 
        key={application.id}
        className="admin-table-row"
        onClick={() => handleOpenViewModal(application)}
        hover
      >
        <TableCell className="admin-table-cell">
          {application.franchiseNumber || 'Pending'}
        </TableCell>
        <TableCell className="admin-table-cell col-name" align="left">
          <Tooltip title={application.name} arrow placement="top" enterDelay={500}>
            <span className="truncate-text">{application.name}</span>
          </Tooltip>
        </TableCell>
        <TableCell className="admin-table-cell">{application.make}</TableCell>
        <TableCell className="admin-table-cell">
          <Tooltip title={appTypeLabel} arrow placement="top" enterDelay={300}>
            <span>{appTypeLabel}</span>
          </Tooltip>
        </TableCell>
        <TableCell className="admin-table-cell">
          <Tooltip title={statusInfo.label} arrow placement="top" enterDelay={300}>
            <span 
              className="status-badge" 
              style={{ backgroundColor: statusInfo.bgColor, color: statusInfo.color }}
            >
              {statusInfo.label}
            </span>
          </Tooltip>
        </TableCell>
        <TableCell className="admin-table-cell col-barangay" align="left">
          <Tooltip title={application.address} arrow placement="top" enterDelay={500}>
            <span className="truncate-text">{application.address}</span>
          </Tooltip>
        </TableCell>
      </TableRow>
    )
  }, [getStatusInfo, handleOpenViewModal])

  /** Empty table row when no applications */
  const emptyTableMessage = isLoading ? 'Loading...' : 'No pending applications found'

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
           Walk In Application
            
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
                    <TableCell className="admin-table-header-cell col-id">Franchise Number</TableCell>
                    <TableCell className="admin-table-header-cell col-name" align="left">Franchisee Name</TableCell>
                    <TableCell className="admin-table-header-cell col-contact">Make</TableCell>
                    <TableCell className="admin-table-header-cell col-status">Application Type</TableCell>
                    <TableCell className="admin-table-header-cell col-status">Status</TableCell>
                    <TableCell className="admin-table-header-cell col-barangay" align="left">Address</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredApplications.length > 0 ? (
                    filteredApplications.map(renderApplicationRow)
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="admin-table-empty">
                        <Typography className="admin-table-empty-text">
                          {emptyTableMessage}
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
        slotProps={{ backdrop: MODAL_BACKDROP_PROPS }}
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
            borderBottom: '2px solid #0A356B',
            background: '#FFFFFF !important',
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}>
            <Box sx={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Typography variant="h5" component="h2" sx={{ 
                fontWeight: 700, 
                color: '#0A356B',
                fontSize: '1.5rem',
                letterSpacing: '0.5px'
              }}>
                WALK-IN FRANCHISE APPLICATION
              </Typography>
              <IconButton 
                onClick={handleCloseAddModal} 
                sx={{ 
                  color: '#0A356B',
                  '&:hover': {
                    background: 'rgba(10, 53, 107, 0.1)'
                  }
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
            
            {/* Application Type Tabs */}
            <Tabs 
              value={applicationTypeTab} 
              onChange={handleApplicationTypeTabChange}
              sx={{
                minHeight: '48px',
                '& .MuiTab-root': {
                  color: '#6B7280',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  minHeight: '48px',
                  textTransform: 'none',
                  transition: 'all 0.3s ease',
                  '&.Mui-selected': {
                    color: '#0A356B',
                    fontWeight: 700
                  },
                  '&:hover': {
                    color: '#0A356B',
                    backgroundColor: 'rgba(10, 53, 107, 0.05)'
                  }
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#0A356B',
                  height: '3px',
                  borderRadius: '3px 3px 0 0'
                }
              }}
            >
              <Tab label="New Application" />
              <Tab label="Renewal" />
              <Tab label="Amendment" />
            </Tabs>
          </Box>
          
          <Box className="modal-body" sx={{ 
            maxHeight: 'calc(90vh - 180px)', 
            overflowY: 'auto', 
            p: 3,
            background: '#FAFBFC',
            ...SCROLLBAR_STYLES,
          }}>
            {/* Franchise Search Section - Only for Renewal/Amendment */}
            {(applicationTypeTab === 1 || applicationTypeTab === 2) && (
              <Box sx={{ 
                mb: 3, 
                p: 2.5, 
                background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
                borderRadius: 2,
                border: '2px solid #FDBA74',
                boxShadow: '0 2px 8px rgba(249, 115, 22, 0.1)'
              }}>
                <Typography variant="body1" sx={{ fontWeight: 600, color: '#C2410C', mb: 1.5 }}>
                  {applicationTypeTab === 1 ? 'Renewal Application' : 'Amendment Application'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#9A3412', fontSize: '0.9rem', mb: 2 }}>
                  {applicationTypeTab === 1 
                    ? 'Search and select an existing franchise to renew. The system will prefill operator information.'
                    : 'Search and select an existing franchise to amend. Update any information that has changed and upload new documents.'}
                </Typography>
                
                {/* Franchise Search Autocomplete */}
                <Autocomplete
                  freeSolo
                  options={filteredFranchises}
                  inputValue={franchiseSearch}
                  getOptionLabel={(option) => {
                    if (typeof option === 'string') return option
                    return `#${option.franchiseNumber} - ${option.operatorName || 'N/A'}`
                  }}
                  loading={loadingFranchises}
                  value={selectedFranchise}
                  onChange={(event, newValue) => {
                    if (newValue && typeof newValue === 'object') {
                      prefillFromFranchise(newValue)
                    } else {
                      setSelectedFranchise(null)
                    }
                  }}
                  onInputChange={(event, newInputValue, reason) => {
                    if (reason === 'input') {
                      setFranchiseSearch(newInputValue)
                    } else if (reason === 'clear') {
                      setFranchiseSearch('')
                      setSelectedFranchise(null)
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search Franchise"
                      placeholder="Enter franchise number or operator name"
                      fullWidth
                      size="small"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingFranchises ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                      helperText="Type at least 2 characters to search all franchises (Active, Expired, Revoked)"
                    />
                  )}
                  renderOption={(props, option) => {
                    const status = option.franchiseStatus?.toLowerCase() || 'active'
                    const statusColors = {
                      active: { bg: '#D1FAE5', text: '#059669', label: 'Active' },
                      expired: { bg: '#FEE2E2', text: '#DC2626', label: 'Expired' },
                      revoked: { bg: '#FEE2E2', text: '#DC2626', label: 'Revoked' }
                    }
                    const statusStyle = statusColors[status] || statusColors.active
                    
                    return (
                      <Box component="li" {...props} key={option._id || option.id}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Franchise #{option.franchiseNumber}
                            </Typography>
                            <Chip 
                              label={statusStyle.label}
                              size="small"
                              sx={{
                                height: '20px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                bgcolor: statusStyle.bg,
                                color: statusStyle.text,
                                '& .MuiChip-label': { px: 1 }
                              }}
                            />
                          </Box>
                          <Typography variant="caption" sx={{ color: '#6B7280' }}>
                            {option.operatorName} • {option.operatorBarangay || 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                    )
                  }}
                  noOptionsText={
                    franchiseSearch.length < 2 
                      ? "Type at least 2 characters to search" 
                      : "No franchises found (searching all statuses: Active, Expired, Revoked)"
                  }
                />
                
                {/* Selected Franchise Info */}
                {selectedFranchise && (
                  <Box sx={{ 
                    mt: 2, 
                    p: 2, 
                    background: '#fff',
                    borderRadius: 1,
                    border: '1px solid #E5E7EB'
                  }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#059669', mb: 1 }}>
                      ✓ Selected Franchise
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1, fontSize: '0.85rem' }}>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>Number:</Typography>
                      <Typography variant="caption">#{selectedFranchise.franchiseNumber}</Typography>
                      
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>Operator:</Typography>
                      <Typography variant="caption">{selectedFranchise.operatorName}</Typography>
                      
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>Plate:</Typography>
                      <Typography variant="caption">{selectedFranchise.mvPlateNo || 'N/A'}</Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            )}
            
            <form onSubmit={handleSubmitApplication} id="franchise-form">
              {/* Walk-in Information Banner - Only for New Applications */}
              {applicationTypeTab === 0 && (
                <Box sx={{ 
                  mb: 3, 
                  p: 2.5, 
                  background: 'linear-gradient(135deg, #EBF4FF 0%, #E0F2FE 100%)',
                  borderRadius: 2,
                  border: '2px solid #93C5FD',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
                }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#1E40AF', mb: 1 }}>
                    Walk-In Application Process
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#3B82F6', fontSize: '0.9rem' }}>
                    Complete all required information. <strong>Provide either Email OR Phone Number</strong> - applicant will be notified via available contact method.
                  </Typography>
                </Box>
              )}

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
              <Typography variant="h6" sx={SECTION_HEADER_STYLES}>
                PERSONAL INFORMATION
                {selectedFranchise && (
                  <Chip 
                    label="Pre-filled from existing franchise" 
                    size="small" 
                    color="info" 
                    sx={{ ml: 2, fontSize: '0.75rem' }} 
                  />
                )}
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
                onChange={handleContactNumberChange}
                fullWidth
                size="small"
                placeholder="09123456789"
                helperText="Required if no email provided - numbers only"
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
                  {BARANGAY_LIST.map((barangay) => (
                    <MenuItem key={barangay} value={barangay}>{barangay}</MenuItem>
                  ))}
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
                  {CIVIL_STATUS_OPTIONS.map((status) => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
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
            <Typography variant="h6" sx={SECTION_HEADER_STYLES}>
              MOTORCYCLE INFORMATION
              {selectedFranchise && applicationTypeTab === 2 && (
                <Chip 
                  label="Update changed information only" 
                  size="small" 
                  color="warning" 
                  sx={{ ml: 2, fontSize: '0.75rem' }} 
                />
              )}
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
                onChange={handleMVPlateChange}
                fullWidth
                required
                size="small"
                placeholder="ABC1234"
                helperText="Format: 3 letters + up to 4 numbers (e.g., ABC1234)"
                inputProps={{
                  maxLength: 7,
                  autoComplete: "off"
                }}
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
            <Typography variant="h6" sx={SECTION_HEADER_STYLES}>
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
              {(applicationTypeTab === 1 || applicationTypeTab === 2) && (
                <Typography variant="body2" sx={{ color: '#C2410C', fontSize: '0.85rem', mt: 1, fontWeight: 600 }}>
                  ⚠ For {applicationTypeTab === 1 ? 'Renewal' : 'Amendment'}: New documents must be uploaded even if information hasn't changed
                </Typography>
              )}
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
            
              {/* Pictures - Hidden for Renewal (retained from existing franchise) */}
              {applicationTypeTab !== 1 && (
                <>
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
                </>
              )}
              
              {/* Info banner for Renewal - Pictures are retained */}
              {applicationTypeTab === 1 && (
                <Box sx={{ 
                  p: 2, 
                  background: '#F0F9FF',
                  borderRadius: 2,
                  border: '1px solid #BAE6FD'
                }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#0369A1', mb: 0.5 }}>
                    📸 Existing Photos Retained
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#075985', fontSize: '0.85rem' }}>
                    For renewal applications, the existing 1x1 pictures of the driver and operator will be automatically retained from the original franchise record. No need to re-upload.
                  </Typography>
                </Box>
              )}
            </Box>
            
            {/* Walk-in OR Section */}
            <Typography variant="h6" sx={{ ...SECTION_HEADER_STYLES, mt: 3 }}>
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
              disabled={isLoading || ((applicationTypeTab === 1 || applicationTypeTab === 2) && !selectedFranchise)}
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
              {isLoading 
                ? 'Submitting...' 
                : applicationTypeTab === 0 
                  ? 'Submit Walk-in Application'
                  : applicationTypeTab === 1
                    ? 'Submit Renewal Application'
                    : 'Submit Amendment Application'}
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
          slotProps={{ backdrop: MODAL_BACKDROP_PROPS }}
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
                  label={MODAL_STATUS_CONFIG[selectedApplication.statusOfBPLO]?.label ?? selectedApplication.statusOfBPLO}
                  color={MODAL_STATUS_CONFIG[selectedApplication.statusOfBPLO]?.color ?? 'default'}
                  sx={{ fontWeight: 'bold' }}
                />
                
                {selectedApplication.bploApprovedBy && (
                  <>
                    <Typography variant="subtitle2" className="label">BPLO Reviewed By:</Typography>
                    <Typography>{selectedApplication.bploApprovedBy}</Typography>
                    
                    <Typography variant="subtitle2" className="label">BPLO Review Date:</Typography>
                    <Typography>{formatDate(selectedApplication.bploApprovedAt)}</Typography>
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
                    <Typography>{formatDate(selectedApplication.orSubmittedAt)}</Typography>
                  </>
                )}
                
                {selectedApplication.sbApprovedBy && (
                  <>
                    <Typography variant="subtitle2" className="label">SB Approved By:</Typography>
                    <Typography>{selectedApplication.sbApprovedBy}</Typography>
                    
                    <Typography variant="subtitle2" className="label">SB Approval Date:</Typography>
                    <Typography>{formatDate(selectedApplication.sbApprovedAt)}</Typography>
                    
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
              {DOCUMENT_FIELDS.map(({ key, label }) => (
                <DocumentLink
                  key={key}
                  label={label}
                  document={selectedApplication[key]}
                  onPreview={handleOpenFilePreview}
                  getFileIcon={getFileIcon}
                />
              ))}
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
                            
                            logger.log('[FranchiseMgmt] Franchise created successfully:', franchiseResponse.data)
                            await fetchAllPending()
                            
                            setNotification({ 
                              open: true, 
                              message: 'Franchise record created successfully! The franchise is now active in the system.', 
                              type: 'success' 
                            })
                            handleCloseViewModal()
                          } catch (error) {
                            logger.error('[FranchiseMgmt] Error completing franchise creation:', error)
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
              ...MODAL_BACKDROP_PROPS.sx,
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
              {isImageFile(previewFile) ? (
                <ImageIcon sx={{ color: '#2196f3', fontSize: 28 }} />
              ) : isPdfFile(previewFile) ? (
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
                onClick={() => triggerFileDownload(previewFile.path, previewFile.name)}
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
            {isImageFile(previewFile) ? (
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
            ) : isPdfFile(previewFile) ? (
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
                  onClick={() => triggerFileDownload(previewFile.path, previewFile.name)}
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
        slotProps={{ backdrop: MODAL_BACKDROP_PROPS }}
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
