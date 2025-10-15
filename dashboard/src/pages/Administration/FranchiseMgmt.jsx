import React, { useState, useEffect } from 'react'
import './FranchiseMgmt.css'
import Sidebar from './Sidebar'
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
  Alert
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import ImageIcon from '@mui/icons-material/Image'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'


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
   * 
   * This should be replaced with a real API call to:
   * GET /api/franchise-applications?status=pending
   */
  useEffect(() => {
    const fetchPendingApplications = async () => {
      setIsLoading(true)
      try {
        // API INTEGRATION POINT: Replace this with actual API call
        // const response = await fetch('/api/franchise-applications?status=pending');
        // if (!response.ok) throw new Error('Failed to fetch applications');
        // const data = await response.json();
        // setPendingApplications(data);
        
        // Mock data for development
        setTimeout(() => {
setPendingApplications([
  {
    id: 1,
    franchiseNumber: 'F001',
    name: 'Luke Dominic Corpuz',
    make: 'Honda',
    plateNumber: 'NV-1234',
    applicationType: 'New',
    address: 'Brgy. Communal, Solano, Nueva Vizcaya',
    contactNumber: '0917-245-6789',
    sidecarPlateNumber: 'SP-11223',
    birthPlace: 'Solano, Nueva Vizcaya',
    birthDate: '2002-04-10',
    civilStatus: 'Single',
    citizenship: 'Filipino',
    todaMembership: 'Yes',
    unitModel: 'Wave 125',
    colorMotor: 'Red',
    colorSidecar: 'Black',
    mvPlate: 'MV-9821',
    motorEngineNumber: 'EN-53241',
    chassisNumber: 'CH-87234',
    driverName: 'Luke Dominic Corpuz',
    driverAddress: 'Brgy. Communal, Solano, Nueva Vizcaya',
    documentRegistration: { name: 'Registration Document', path: 'reg-corpuz.jpg', type: 'image/jpeg' },
    documentBarangayClearance: { name: 'Barangay Clearance', path: 'clearance-corpuz.jpg', type: 'image/jpeg' },
    documentCedula: { name: 'Cedula', path: 'cedula-corpuz.pdf', type: 'application/pdf' },
    documentDriversLicense: { name: 'Driver\'s License', path: 'license-corpuz.jpg', type: 'image/jpeg' },
    documentVotersAffidavit: { name: 'Voter\'s Affidavit', path: 'voter-corpuz.pdf', type: 'application/pdf' },
    documentPicture: { name: '1x1 Picture', path: 'picture-corpuz.jpg', type: 'image/jpeg' },
  },
  {
    id: 2,
    franchiseNumber: 'F002',
    name: 'Kevin Klein Ananayo',
    make: 'Kawasaki',
    plateNumber: 'NV-5678',
    applicationType: 'Renewal',
    address: 'Brgy. Quezon, Solano, Nueva Vizcaya',
    contactNumber: '0928-563-2147',
    sidecarPlateNumber: 'SP-33456',
    birthPlace: 'Bayombong, Nueva Vizcaya',
    birthDate: '1998-09-12',
    civilStatus: 'Married',
    citizenship: 'Filipino',
    todaMembership: 'Yes',
    unitModel: 'Barako 175',
    colorMotor: 'Blue',
    colorSidecar: 'Gray',
    mvPlate: 'MV-4532',
    motorEngineNumber: 'EN-65783',
    chassisNumber: 'CH-98211',
    driverName: 'Kevin Klein Ananayo',
    driverAddress: 'Brgy. Quezon, Solano, Nueva Vizcaya',
    documentRegistration: { name: 'Registration Document', path: 'reg-ananayo.jpg', type: 'image/jpeg' },
    documentBarangayClearance: { name: 'Barangay Clearance', path: 'clearance-ananayo.jpg', type: 'image/jpeg' },
    documentCedula: { name: 'Cedula', path: 'cedula-ananayo.pdf', type: 'application/pdf' },
    documentDriversLicense: { name: 'Driver\'s License', path: 'license-ananayo.jpg', type: 'image/jpeg' },
    documentVotersAffidavit: { name: 'Voter\'s Affidavit', path: 'voter-ananayo.pdf', type: 'application/pdf' },
    documentPicture: { name: '1x1 Picture', path: 'picture-ananayo.jpg', type: 'image/jpeg' },
  },
]);

          setIsLoading(false)
        }, 1000)
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

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
  }
  
  // Filter applications based on search term
  const filteredApplications = pendingApplications.filter(app => 
    app.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.franchiseNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.plateNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  /**
   * Modal handlers
   */
  const handleOpenAddModal = () => setOpenAddModal(true)
  const handleCloseAddModal = () => setOpenAddModal(false)
  
  const handleOpenViewModal = (application) => {
    setSelectedApplication(application)
    setOpenViewModal(true)
  }
  const handleCloseViewModal = () => setOpenViewModal(false)
  
  const handleOpenRejectModal = () => {
    setOpenViewModal(false)
    setOpenRejectModal(true)
  }
  const handleCloseRejectModal = () => setOpenRejectModal(false)
  
  /**
   * File preview handlers
   */
  const handleOpenFilePreview = (file) => {
    setPreviewFile(file)
    setOpenFilePreview(true)
  }
  
  const handleCloseFilePreview = () => {
    setOpenFilePreview(false)
  }
  
  /**
   * Get appropriate icon for file type
   */
  const getFileIcon = (fileType) => {
    if (!fileType) return <InsertDriveFileIcon />
    
    if (fileType.includes('image')) {
      return <ImageIcon />
    } else if (fileType.includes('pdf')) {
      return <PictureAsPdfIcon />
    } else {
      return <InsertDriveFileIcon />
    }
  }
  
  /**
   * Form handlers
   */
  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
  }
  
  /**
   * File upload handler
   * This will integrate with the secureUpload middleware in production
   */
  const handleFileChange = (e) => {
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
      setFormData({
        ...formData,
        [name]: {
          name: file.name,
          type: file.type,
          path: URL.createObjectURL(file),
          file: file // Store the actual file object for upload
        }
      })
    }
  }
  
  /**
   * Submit new application
   * 
   * API INTEGRATION POINT:
   * This should send a multipart/form-data request to:
   * POST /api/franchise-applications
   */
  const handleSubmitApplication = async (e) => {
    e.preventDefault()
    
    setIsLoading(true)
    
    try {
      // In production, this would be a FormData object with all the fields
      // including the file uploads, sent to the server
      
      // const formDataToSend = new FormData();
      // Object.keys(formData).forEach(key => {
      //   if (key.startsWith('document') && formData[key]?.file) {
      //     formDataToSend.append(key, formData[key].file);
      //   } else {
      //     formDataToSend.append(key, formData[key]);
      //   }
      // });
      
      // const response = await fetch('/api/franchise-applications', {
      //   method: 'POST',
      //   body: formDataToSend,
      // });
      
      // if (!response.ok) throw new Error('Failed to submit application');
      
      // Mock successful submission
      setTimeout(() => {
        // Create a new application with a unique ID
        const newApplication = {
          id: pendingApplications.length + 1,
          franchiseNumber: `F${String(pendingApplications.length + 1).padStart(3, '0')}`,
          applicationType: 'New',
          address: formData.driverAddress, // For display in the table
          ...formData
        }
        
        setPendingApplications([...pendingApplications, newApplication])
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
          message: 'Application submitted successfully',
          type: 'success'
        })
        
        setIsLoading(false)
      }, 1500)
    } catch (error) {
      console.error('Error submitting application:', error)
      setNotification({
        open: true,
        message: 'Failed to submit application',
        type: 'error'
      })
      setIsLoading(false)
    }
  }
  
  /**
   * Approve application
   * 
   * API INTEGRATION POINT:
   * This should call PUT /api/franchise-applications/:id/approve
   */
  const handleApproveApplication = async () => {
    if (!selectedApplication) return
    
    setIsLoading(true)
    
    try {
      // API call to approve the application
      // const response = await fetch(`/api/franchise-applications/${selectedApplication.id}/approve`, {
      //   method: 'PUT',
      // });
      
      // if (!response.ok) throw new Error('Failed to approve application');
      
      // Mock successful approval
      setTimeout(() => {
        // In a real app, this would update the status in the database
        // and move the application to the franchisee list
        setPendingApplications(pendingApplications.filter(app => app.id !== selectedApplication.id))
        
        setNotification({
          open: true,
          message: 'Application approved successfully',
          type: 'success'
        })
        
        handleCloseViewModal()
        setIsLoading(false)
      }, 1000)
    } catch (error) {
      console.error('Error approving application:', error)
      setNotification({
        open: true,
        message: 'Failed to approve application',
        type: 'error'
      })
      setIsLoading(false)
    }
  }
  
  /**
   * Submit rejection
   * 
   * API INTEGRATION POINT:
   * This should call PUT /api/franchise-applications/:id/reject
   * with the rejection reason in the request body
   */
  const handleSubmitRejection = async () => {
    if (!selectedApplication || !rejectionReason.trim()) return
    
    setIsLoading(true)
    
    try {
      // API call to reject the application
      // const response = await fetch(`/api/franchise-applications/${selectedApplication.id}/reject`, {
      //   method: 'PUT',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ reason: rejectionReason }),
      // });
      
      // if (!response.ok) throw new Error('Failed to reject application');
      
      // Mock successful rejection
      setTimeout(() => {
        // In a real app, this would update the application status in the database
        // with the rejection reason
        setPendingApplications(pendingApplications.filter(app => app.id !== selectedApplication.id))
        
        setNotification({
          open: true,
          message: 'Application rejected successfully',
          type: 'success'
        })
        
        handleCloseRejectModal()
        setRejectionReason('')
        setIsLoading(false)
      }, 1000)
    } catch (error) {
      console.error('Error rejecting application:', error)
      setNotification({
        open: true,
        message: 'Failed to reject application',
        type: 'error'
      })
      setIsLoading(false)
    }
  }

  /**
   * Handle notification close
   */
  const handleNotificationClose = () => {
    setNotification({ ...notification, open: false })
  }

  return (
    <div className="main">
      <Sidebar />
      <div style={{ padding: '20px' }}>
        <h1 className="title">Franchise Management</h1>
        
        {/* Search bar and Add button */}
        <div className="search-bar">
          <TextField
            placeholder="Search Franchisee"
            variant="outlined"
            fullWidth
            value={searchTerm}
            onChange={handleSearch}
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
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} aria-label="pending franchises table">
              <TableHead>
                <TableRow className="table-header-row">
                  <TableCell>Record No.</TableCell>
                  <TableCell>Franchisee Name</TableCell>
                  <TableCell>Franchise Number</TableCell>
                  <TableCell>Make</TableCell>
                  <TableCell>Plate Number</TableCell>
                  <TableCell>Application Type</TableCell>
                  <TableCell>Address</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredApplications.length > 0 ? (
                  filteredApplications.map((application) => (
                    <TableRow 
                      key={application.id} 
                      onClick={() => handleOpenViewModal(application)}
                      className="clickable-row"
                    >
                      <TableCell>{application.id}</TableCell>
                      <TableCell>{application.name}</TableCell>
                      <TableCell>{application.franchiseNumber}</TableCell>
                      <TableCell>{application.make}</TableCell>
                      <TableCell>{application.plateNumber}</TableCell>
                      <TableCell>{application.applicationType}</TableCell>
                      <TableCell>{application.address}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center">No pending applications found</TableCell>
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
              sx={{ mb: 2 }}
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
            
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
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
                variant="contained"
                color="primary"
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Submit Application'}
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
                variant="contained"
                color="error"
                onClick={handleOpenRejectModal}
                disabled={isLoading}
              >
                Disapprove
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleApproveApplication}
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Approve'}
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
                <Typography variant="body1" sx={{ mt: 2 }}>
                  This file type cannot be previewed. Download to view.
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  href={previewFile.path}
                  download={previewFile.name}
                  sx={{ mt: 2 }}
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
          
          <Typography variant="body1" sx={{ mb: 2 }}>
            Please provide a reason for rejecting this franchise application:
          </Typography>
          
          <TextField
            label="Reason for Rejection"
            multiline
            rows={4}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            fullWidth
            required
            sx={{ mb: 3 }}
          />
          
          <div className="action-buttons">
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmitRejection}
              disabled={!rejectionReason.trim() || isLoading}
            >
              {isLoading ? <CircularProgress size={24} /> : 'Submit'}
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
        <Alert onClose={handleNotificationClose} severity={notification.type} sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </div>
  )
}

export default FranchiseMgmt
