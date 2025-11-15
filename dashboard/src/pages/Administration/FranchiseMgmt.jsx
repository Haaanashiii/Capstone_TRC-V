import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import '../../Styles/Administrator_Css/FranchiseMgmt.css'
import Sidebar from './Sidebar'
import { franchiseAPI, API_BASE_URL } from '../Services/api'
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

function FranchiseMgmt() {
  const [searchTerm, setSearchTerm] = useState('')
  const [openAddModal, setOpenAddModal] = useState(false)
  const [openViewModal, setOpenViewModal] = useState(false)
  const [openRejectModal, setOpenRejectModal] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [notification, setNotification] = useState({ open: false, message: '', type: 'info' })
  
 
  const [openFilePreview, setOpenFilePreview] = useState(false)
  const [previewFile, setPreviewFile] = useState({ name: '', type: '', path: '' })
  const currentBlobUrlRef = useRef(null)
  const [qrBlobUrl, setQrBlobUrl] = useState(null)
  const qrBlobUrlRef = useRef(null)
  
  
  const [pendingApplications, setPendingApplications] = useState([])

  // Polling interval (ms). Set to 0 to disable polling. 10000 = 10s
  const POLL_INTERVAL_MS = 10000

  // State for the form when adding a new franchise
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    sidecarPlateNumber: '',
    name: '',
    contactNumber: '',
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
  const fetchAllPending = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await franchiseAPI.getPending()
      const serverApps = response.data
      
      console.log('[FranchiseMgmt] Fetched pending applications:', serverApps?.length || 0)
      
      // Normalize application data structure
      const normalizedServerApps = Array.isArray(serverApps) ? serverApps.map((it) => ({
        id: it.id || it._id,
        franchiseNumber: it.franchiseNumber || it.franchise_number || '',
        name: it.name || it.driverName || it.operatorName || '',
        make: it.make || it.unitModel || it.vehicleMake || '',
        plateNumber: it.plateNumber || it.mvPlate || it.plate_number || '',
        applicationType: it.applicationType || it.type || 'New',
        address: it.address || it.driverAddress || it.address_of_driver || '',
        contactNumber: it.contactNumber || it.phone || it.contact || '',
        sidecarPlateNumber: it.sidecarPlateNumber || it.sidecar_plate || '',
        birthPlace: it.birthPlace || it.placeOfBirth || '',
        birthDate: it.birthDate || it.dateOfBirth || '',
        civilStatus: it.civilStatus || '',
        citizenship: it.citizenship || '',
        todaMembership: it.todaMembership || '',
        unitModel: it.unitModel || it.make || '',
        colorMotor: it.colorMotor || it.color || '',
        colorSidecar: it.colorSidecar || it.sidecarColor || it.sidecar_color || '',
        mvPlate: it.mvPlate || it.plateNumber || '',
        motorEngineNumber: it.motorEngineNumber || it.engineNumber || '',
        chassisNumber: it.chassisNumber || it.chassis || it.chassis_number || '',
        driverName: it.driverName || it.name || it.operatorName || '',
        driverAddress: it.driverAddress || it.address || '',
        documentRegistration: it.documentRegistration || null,
        documentBarangayClearance: it.documentBarangayClearance || null,
        documentCedula: it.documentCedula || null,
        documentDriversLicense: it.documentDriversLicense || null,
        documentVotersAffidavit: it.documentVotersAffidavit || null,
        documentPicture: it.documentPicture || null,
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
    }
  }, [])

  
  useEffect(() => {
    fetchAllPending()
    let pollId = null
    if (POLL_INTERVAL_MS > 0) {
      pollId = setInterval(() => {
        fetchAllPending()
      }, POLL_INTERVAL_MS)
    }
    return () => {
      if (pollId) clearInterval(pollId)
    }
  }, [fetchAllPending])


  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchTerm])


  const filteredApplications = useMemo(() => {
    return pendingApplications.filter(app => 
      app.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      app.franchiseNumber?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      app.plateNumber?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    )
  }, [pendingApplications, debouncedSearchTerm])

  

  const handleOpenAddModal = useCallback(() => setOpenAddModal(true), [])
  const handleCloseAddModal = useCallback(() => setOpenAddModal(false), [])
  
  const handleOpenViewModal = useCallback((application) => {
   
    const normalized = {
      ...application,
      unitModel: application.unitModel || application.make || application.vehicleModel || '',
      colorMotor: application.colorMotor || application.color || application.motorColor || '',
      colorSidecar: application.colorSidecar || application.sidecarColor || application.sidecar_color || '',
      mvPlate: application.mvPlate || application.plateNumber || application.mv_plate || '',
      motorEngineNumber: application.motorEngineNumber || application.engineNumber || application.motor_engine_number || '',
      chassisNumber: application.chassisNumber || application.chassis || application.chassis_number || '',
      driverName: application.driverName || application.name || '',
      driverAddress: application.driverAddress || application.address || application.driver_address || '',
      contactNumber: application.contactNumber || application.phone || application.contact || '',
    }

    setSelectedApplication(normalized)
    setOpenViewModal(true)
  }, [])
  const handleCloseViewModal = useCallback(() => setOpenViewModal(false), [])

  // When a selected application changes, attempt to fetch its QR image and create a blob URL
  React.useEffect(() => {
    let cancelled = false
    // cleanup previous blob
  try { if (qrBlobUrlRef.current) { URL.revokeObjectURL(qrBlobUrlRef.current); qrBlobUrlRef.current = null; } } catch (e) { console.warn('Failed to revoke previous qr blob', e) }

    const fetchQr = async () => {
      if (!selectedApplication || !selectedApplication.qrCode) return
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
        console.warn('[FranchiseMgmt] Failed to fetch QR blob for inline display', err)
        setQrBlobUrl(null)
      }
    }

    fetchQr()

    return () => {
      cancelled = true
  try { if (qrBlobUrlRef.current) { URL.revokeObjectURL(qrBlobUrlRef.current); qrBlobUrlRef.current = null; } } catch (e) { console.warn('Failed to revoke qr blob on cleanup', e) }
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

    // If the path is relative (starts with '/') or missing protocol, prefix API_BASE_URL
    try {
      if (normalized.path && !/^https?:\/\//i.test(normalized.path)) {
        // Ensure no double slash when concatenating
        const pathPart = normalized.path.startsWith('/') ? normalized.path : '/' + normalized.path
        normalized.path = API_BASE_URL.replace(/\/$/, '') + pathPart
      }
    } catch {
      // If API_BASE_URL isn't available for some reason, leave path as-is
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
  
  const handleCloseFilePreview = useCallback(() => {
    // Revoke any temporary object URL created from fetch
    try {
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current)
        currentBlobUrlRef.current = null
      }
    } catch (err) {
      console.warn('Failed to revoke object URL', err)
    }

    setOpenFilePreview(false)
  }, [])
  
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
      
      // Create object URL for preview
      const objectURL = URL.createObjectURL(file)
      setFormData(prev => ({
        ...prev,
        [name]: {
          name: file.name,
          type: file.type,
          path: objectURL,
          file: file 
        }
      }))
    }
  }, [])
  
  /**
   * Cleanup object URLs when component unmounts or form data changes
   */
  useEffect(() => {
    return () => {
      // Cleanup all object URLs to prevent memory leaks
      Object.keys(formData).forEach(key => {
        if (key.startsWith('document') && formData[key]?.path) {
          URL.revokeObjectURL(formData[key].path)
        }
      })
    }
  }, [formData])
  
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
      
      // Reset form
      setFormData({
        date: new Date().toISOString().slice(0, 10),
        sidecarPlateNumber: '',
        name: '',
        contactNumber: '',
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
   * Approve application
   * Uses secure franchiseAPI.approve() with automatic token refresh
   */
  const handleApproveApplication = async () => {
    if (!selectedApplication) return
    
    setIsLoading(true)
    
    try {
      console.log('[FranchiseMgmt] Approving application:', selectedApplication.id)
      
      // Approve via secure API (generates QR code, updates DB)
      const response = await franchiseAPI.approve(selectedApplication.id)
      
      console.log('[FranchiseMgmt] Application approved:', response.data)

      // Refresh pending applications list
      await fetchAllPending()

      setNotification({ 
        open: true, 
        message: 'Application approved successfully', 
        type: 'success' 
      })
      
      handleCloseViewModal()
    } catch (error) {
      console.error('[FranchiseMgmt] Error approving application:', error)
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
   * Submit rejection
   * Uses secure franchiseAPI.delete() (or reject if endpoint exists)
   */
  const handleSubmitRejection = async () => {
    if (!selectedApplication || !rejectionReason.trim()) return
    
    setIsLoading(true)
    
    try {
      console.log('[FranchiseMgmt] Rejecting application:', selectedApplication.id)
      
      // Delete the pending application using secure API
      // TODO: If backend has a reject endpoint, use franchiseAPI.reject(id, reason)
      await franchiseAPI.delete(selectedApplication.id)

      console.log('[FranchiseMgmt] Application rejected')
      
      // Refresh pending applications list
      await fetchAllPending()

      setNotification({ 
        open: true, 
        message: 'Application rejected successfully', 
        type: 'success' 
      })
      
      handleCloseRejectModal()
      setRejectionReason('')
    } catch (error) {
      console.error('[FranchiseMgmt] Error rejecting application:', error)
      setNotification({
        open: true,
        message: error.response?.data?.error || 'Failed to reject application',
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
    setNotification(prev => ({ ...prev, open: false }))
  }, [])

  return (
    <div className="main">
      <Sidebar />
      <div className="content-container">
        <h1 className="title">Franchise Management</h1>
        
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
            ADD NEW FRANCHISE
          </Button>
        </div>
        
        {/* Pending Applications Table */}
        <Typography variant="h6" className="pending-header">
          PENDING FRANCHISE
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
                  <TableCell className="table-cell-head">Franchise Number</TableCell>
                  <TableCell className="table-cell-head">Make</TableCell>
                  <TableCell className="table-cell-head">Plate Number</TableCell>
                  <TableCell className="table-cell-head">Application Type</TableCell>
                  <TableCell className="table-cell-head">Address</TableCell>
                  <TableCell className="table-cell-head">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredApplications.length > 0 ? (
                  filteredApplications.map((application, index) => (
                    <TableRow 
                      key={application.id}
                      className={`table-row ${index % 2 !== 0 ? 'table-row-odd' : ''}`}
                      onClick={() => handleOpenViewModal(application)}
                    >
                      <TableCell className="table-cell-body">{index + 1}</TableCell>
                      <TableCell className="table-cell-body">{application.name}</TableCell>
                      <TableCell className="table-cell-body">{application.franchiseNumber}</TableCell>
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
                      <TableCell className="table-cell-body">{application.address}</TableCell>
                      <TableCell className="table-cell-body">
                        <IconButton 
                          size="small"
                          className="view-icon-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenViewModal(application);
                          }}
                        >
                          <VisibilityIcon />
                        </IconButton>
                        {application.qrCode && (
                          <IconButton
                            size="small"
                            className="view-icon-button"
                            onClick={(e) => { e.stopPropagation(); handleOpenFilePreview({ name: application.name + '-qr.png', type: 'image/png', path: application.qrCode }); }}
                            title="View QR"
                          >
                            <img src={(application.qrCode && !/^https?:\/\//i.test(application.qrCode) ? (API_BASE_URL.replace(/\/$/, '') + (application.qrCode.startsWith('/') ? application.qrCode : '/' + application.qrCode)) : application.qrCode)} alt="QR" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
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
              
              <Typography variant="subtitle2" className="label">Driver Name:</Typography>
              <Typography>{selectedApplication.driverName}</Typography>
              
              <Typography variant="subtitle2" className="label">Driver Address:</Typography>
              <Typography>{selectedApplication.driverAddress}</Typography>
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
              
              <Typography variant="subtitle2" className="label">Picture:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentPicture)}>
                {getFileIcon(selectedApplication.documentPicture?.type)}
                <span>{selectedApplication.documentPicture?.name || 'No file'}</span>
              </Link>
            </div>

            {/* QR Code display */}
            <Typography variant="h6" className="section-header">
              QR CODE
            </Typography>
            <div className="info-grid">
              <Typography variant="subtitle2" className="label">Operator QR:</Typography>
              {selectedApplication.qrCode ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img
                    src={qrBlobUrl || (!/^https?:\/\//i.test(selectedApplication.qrCode) ? (API_BASE_URL.replace(/\/$/, '') + (selectedApplication.qrCode.startsWith('/') ? selectedApplication.qrCode : '/' + selectedApplication.qrCode)) : selectedApplication.qrCode)}
                    alt="QR"
                    style={{ width: 140, height: 140, objectFit: 'contain', border: '1px solid #eee', borderRadius: 8 }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Button className="button-primary" onClick={() => handleOpenFilePreview({ name: 'qr.png', type: 'image/png', path: selectedApplication.qrCode })}>Preview</Button>
                    <Button className="button-primary" href={(!/^https?:\/\//i.test(selectedApplication.qrCode) ? (API_BASE_URL.replace(/\/$/, '') + (selectedApplication.qrCode.startsWith('/') ? selectedApplication.qrCode : '/' + selectedApplication.qrCode)) : selectedApplication.qrCode)} download>Download</Button>
                  </div>
                </div>
              ) : (
                <Typography>No QR generated yet</Typography>
              )}
            </div>
            
            <div className="action-buttons">
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
                {isLoading ? <CircularProgress className="circular-progress-small circular-progress-inherit" /> : 'Approve'}
              </Button>
            </div>
          </Box>
        </Modal>
      )}
      
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
            {previewFile.type?.includes('image') ? (
              <img 
                src={previewFile.path} 
                alt={previewFile.name}
                className="preview-image"
              />
            ) : previewFile.type?.includes('pdf') ? (
              <iframe
                src={previewFile.path}
                title={previewFile.name}
                className="preview-iframe"
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
      
      {/* Rejection Reason Modal */}
      <Modal
        open={openRejectModal}
        onClose={handleCloseRejectModal}
        aria-labelledby="rejection-modal"
      >
        <Box className="modal-container rejection-modal">
          <div className="modal-header">
            <Typography variant="h5" component="h2">
              Rejection Reason
            </Typography>
            <IconButton onClick={handleCloseRejectModal}>
              <CloseIcon />
            </IconButton>
          </div>
          
          <Typography variant="body1" className="mb-2">
            Please provide a reason for rejecting this franchise application:
          </Typography>
          
          <TextField
            label="Reason for Rejection"
            className="textfield-multiline"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            fullWidth
            required
          />
          
          <div className="action-buttons">
            <Button
              className="button-primary"
              onClick={handleSubmitRejection}
              disabled={!rejectionReason.trim() || isLoading}
            >
              {isLoading ? <CircularProgress className="circular-progress-small" /> : 'Submit'}
            </Button>
          </div>
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
