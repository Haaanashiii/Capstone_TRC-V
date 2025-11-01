import React, { useState, useEffect, useMemo, useCallback } from 'react'
import './FranchiseMgmt.css'
import Sidebar from './Sidebar'
import api from '../Services/api'
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
  
  // File preview modal state
  const [openFilePreview, setOpenFilePreview] = useState(false)
  const [previewFile, setPreviewFile] = useState({ name: '', type: '', path: '' })
  
  // Pending applications state
  const [pendingApplications, setPendingApplications] = useState([])
  
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
   * Fetch pending franchise applications from the API
   */
  useEffect(() => {
    const fetchPendingApplications = async () => {
      setIsLoading(true)
      try {
        const response = await api.get('/api/pending-apps')
        const data = response.data
        
        if (Array.isArray(data)) {
          setPendingApplications(data)
        } else {
          setPendingApplications([])
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error('Error fetching applications:', error)
        setNotification({
          open: true,
          message: 'Failed to load franchise applications',
          type: 'error'
        })
        setIsLoading(false)
      }
    }

    fetchPendingApplications()
  }, [])

  // Handle search with debouncing
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchTerm])
  
  // Filter applications based on search term (memoized)
  const filteredApplications = useMemo(() => {
    return pendingApplications.filter(app => 
      app.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      app.franchiseNumber?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      app.plateNumber?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    )
  }, [pendingApplications, debouncedSearchTerm])
  
  /**
   * Modal handlers
   */
  const handleOpenAddModal = useCallback(() => setOpenAddModal(true), [])
  const handleCloseAddModal = useCallback(() => setOpenAddModal(false), [])
  
  const handleOpenViewModal = useCallback((application) => {
    setSelectedApplication(application)
    setOpenViewModal(true)
  }, [])
  const handleCloseViewModal = useCallback(() => setOpenViewModal(false), [])
  
  const handleOpenRejectModal = useCallback(() => {
    setOpenViewModal(false)
    setOpenRejectModal(true)
  }, [])
  const handleCloseRejectModal = useCallback(() => setOpenRejectModal(false), [])
  
  /**
   * File preview handlers
   */
  const handleOpenFilePreview = useCallback((file) => {
    if (!file) {
      setNotification({ open: true, message: 'File not available for preview', type: 'info' })
      return
    }
    setPreviewFile(file)
    setOpenFilePreview(true)
  }, [])
  
  const handleCloseFilePreview = useCallback(() => {
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
  
  /**
   * File upload handler
   * This will integrate with the secureUpload middleware in production
   */
  const handleFileChange = useCallback((e) => {
    const { name, files } = e.target
    if (files && files[0]) {
      const file = files[0]
      
      // In production, this should validate file size and type
      // based on the secureUpload middleware restrictions
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
          file: file // Store the actual file object for upload
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
   */
  const handleSubmitApplication = async (e) => {
    e.preventDefault()
    
    setIsLoading(true)
    
    try {
      // Create FormData object with all the fields including file uploads
      const formDataToSend = new FormData()
      
      // Add all text fields
      Object.keys(formData).forEach(key => {
        if (key.startsWith('document') && formData[key]?.file) {
          // Add file fields
          formDataToSend.append(key, formData[key].file)
        } else if (!key.startsWith('document')) {
          // Add non-file fields
          formDataToSend.append(key, formData[key])
        }
      })
      
      // Submit to backend - this will create the application
      const response = await api.post('/api/pending-apps', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      
      // Automatically approve it since it's created by admin
      await api.put(`/api/pending-apps/${response.data.id}/approve`)
      
      // Don't add to pending list since it's auto-approved
      handleCloseAddModal()
      
      // Reset form data
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
        message: 'Franchise added and approved successfully',
        type: 'success'
      })
      
      setIsLoading(false)
    } catch (error) {
      console.error('Error submitting application:', error)
      setNotification({
        open: true,
        message: error.response?.data?.error || 'Failed to add franchise',
        type: 'error'
      })
      setIsLoading(false)
    }
  }
  
  /**
   * Approve application
   */
  const handleApproveApplication = async () => {
    if (!selectedApplication) return
    
    setIsLoading(true)
    
    try {
      // Call backend to approve the application
      await api.put(`/api/pending-apps/${selectedApplication.id}/approve`)

      // Remove from pending list locally
      setPendingApplications(prev => prev.filter(app => String(app.id) !== String(selectedApplication.id)))

      setNotification({ 
        open: true, 
        message: 'Application approved successfully', 
        type: 'success' 
      })
      handleCloseViewModal()
      setIsLoading(false)
    } catch (error) {
      console.error('Error approving application:', error)
      setNotification({
        open: true,
        message: error.response?.data?.error || 'Failed to approve application',
        type: 'error'
      })
      setIsLoading(false)
    }
  }
  
  /**
   * Submit rejection
   */
  const handleSubmitRejection = async () => {
    if (!selectedApplication || !rejectionReason.trim()) return
    
    setIsLoading(true)
    
    try {
      // API call to reject the application
      await api.put(`/api/pending-apps/${selectedApplication.id}/reject`, {
        reason: rejectionReason
      })
      
      // Remove from pending list
      setPendingApplications(pendingApplications.filter(app => app.id !== selectedApplication.id))
      
      setNotification({
        open: true,
        message: 'Application rejected successfully',
        type: 'success'
      })
      
      handleCloseRejectModal()
      setRejectionReason('')
      setIsLoading(false)
    } catch (error) {
      console.error('Error rejecting application:', error)
      setNotification({
        open: true,
        message: error.response?.data?.error || 'Failed to reject application',
        type: 'error'
      })
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
          <TableContainer component={Paper} elevation={2}>
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
                      <TableCell className="table-cell-body">{application.id}</TableCell>
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
                  accept: "image/jpeg,image/png,application/pdf"
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
                  accept: "image/jpeg,image/png,application/pdf"
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
                  accept: "image/jpeg,image/png,application/pdf"
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
                  accept: "image/jpeg,image/png,application/pdf"
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
                  accept: "image/jpeg,image/png,application/pdf"
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
                {getFileIcon(selectedApplication.documentRegistration.type)}
                <span>{selectedApplication.documentRegistration.name}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Barangay Clearance:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentBarangayClearance)}>
                {getFileIcon(selectedApplication.documentBarangayClearance.type)}
                <span>{selectedApplication.documentBarangayClearance.name}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Cedula:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentCedula)}>
                {getFileIcon(selectedApplication.documentCedula.type)}
                <span>{selectedApplication.documentCedula.name}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Driver's License:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentDriversLicense)}>
                {getFileIcon(selectedApplication.documentDriversLicense.type)}
                <span>{selectedApplication.documentDriversLicense.name}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Voter's Affidavit:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentVotersAffidavit)}>
                {getFileIcon(selectedApplication.documentVotersAffidavit.type)}
                <span>{selectedApplication.documentVotersAffidavit.name}</span>
              </Link>
              
              <Typography variant="subtitle2" className="label">Picture:</Typography>
              <Link className="document-link" onClick={() => handleOpenFilePreview(selectedApplication.documentPicture)}>
                {getFileIcon(selectedApplication.documentPicture.type)}
                <span>{selectedApplication.documentPicture.name}</span>
              </Link>
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
      
      {/* Notifications */}
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
