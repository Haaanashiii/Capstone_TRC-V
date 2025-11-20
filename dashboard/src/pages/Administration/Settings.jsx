import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './Sidebar';
import '../../Styles/Administrator_Css/Settings.css';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Switch,
  Tabs,
  Tab,
  Alert,
  Snackbar,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import LocalTaxiIcon from '@mui/icons-material/LocalTaxi';
import SecurityIcon from '@mui/icons-material/Security';

const StyledTab = styled(Tab)(({ theme }) => ({
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '16px',
  color: '#64748b',
  '&.Mui-selected': {
    color: '#0A356B',
  },
}));

// Permission Matrix Configuration
const PERMISSION_CATEGORIES = {
  franchiseManagement: {
    label: 'Franchise Management',
    permissions: [
      { key: 'view_franchises', label: 'View Franchises', description: 'Access franchise records' },
      { key: 'create_franchise', label: 'Create Franchise', description: 'Add new franchises' },
      { key: 'edit_franchise', label: 'Edit Franchise', description: 'Modify franchise details' },
      { key: 'delete_franchise', label: 'Delete Franchise', description: 'Remove franchise records' },
      { key: 'approve_franchise', label: 'Approve Applications', description: 'Approve franchise applications' },
    ],
  },
  userManagement: {
    label: 'User Management',
    permissions: [
      { key: 'view_users', label: 'View Users', description: 'Access user accounts' },
      { key: 'create_user', label: 'Create User', description: 'Add new admin users' },
      { key: 'edit_user', label: 'Edit User', description: 'Modify user accounts' },
      { key: 'delete_user', label: 'Delete User', description: 'Remove user accounts' },
    ],
  },
  analytics: {
    label: 'Analytics & Reports',
    permissions: [
      { key: 'view_analytics', label: 'View Analytics', description: 'Access analytics dashboard' },
      { key: 'export_reports', label: 'Export Reports', description: 'Download reports' },
      { key: 'view_audit_logs', label: 'View Audit Logs', description: 'Access system logs' },
    ],
  },
  settings: {
    label: 'System Settings',
    permissions: [
      { key: 'manage_fare', label: 'Manage Fare Matrix', description: 'Update fare rates' },
      { key: 'manage_permissions', label: 'Manage Permissions', description: 'Configure role permissions' },
      { key: 'system_config', label: 'System Configuration', description: 'Advanced settings' },
    ],
  },
};

const ROLES = [
  { value: 'super-admin', label: 'Super Admin', color: '#dc2626' },
  { value: 'sb-admin', label: 'Sangguniang Bayan', color: '#0A356B' },
  { value: 'bplo-admin', label: 'BPLO', color: '#059669' },
];

function Settings() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', type: 'success' });
  
  // Fare Matrix State (Photo Upload)
  const [fareMatrixImage, setFareMatrixImage] = useState(null);
  const [fareMatrixPreview, setFareMatrixPreview] = useState(null);
  const [uploadDate, setUploadDate] = useState(null);

  // Permissions State
  const [permissions, setPermissions] = useState({
    'super-admin': {
      franchiseManagement: ['view_franchises', 'create_franchise', 'edit_franchise', 'delete_franchise', 'approve_franchise'],
      userManagement: ['view_users', 'create_user', 'edit_user', 'delete_user'],
      analytics: ['view_analytics', 'export_reports', 'view_audit_logs'],
      settings: ['manage_fare', 'manage_permissions', 'system_config'],
    },
    'sb-admin': {
      franchiseManagement: ['view_franchises', 'edit_franchise', 'approve_franchise'],
      userManagement: ['view_users'],
      analytics: ['view_analytics', 'export_reports'],
      settings: [],
    },
    'bplo-admin': {
      franchiseManagement: ['view_franchises', 'create_franchise', 'edit_franchise'],
      userManagement: ['view_users'],
      analytics: ['view_analytics'],
      settings: [],
    },
  });
  const [selectedRole, setSelectedRole] = useState('super-admin');
  const [hasPermissionChanges, setHasPermissionChanges] = useState(false);

  // Tab Change Handler
  const handleTabChange = useCallback((event, newValue) => {
    if (hasPermissionChanges) {
      if (window.confirm('You have unsaved permission changes. Are you sure you want to switch tabs?')) {
        setActiveTab(newValue);
        setHasPermissionChanges(false);
      }
    } else {
      setActiveTab(newValue);
    }
  }, [hasPermissionChanges]);

  // Notification Handler
  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ open: true, message, type });
  }, []);

  const closeNotification = useCallback(() => {
    setNotification({ ...notification, open: false });
  }, [notification]);

  // ==================== Fare Matrix Handlers ====================
  
  const handleFareImageChange = useCallback((event) => {
    const file = event.target.files?.[0];
    
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      showNotification('Please upload a valid image file (JPG, PNG, or GIF)', 'error');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      showNotification('Image size must be less than 5MB', 'error');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFareMatrixPreview(reader.result);
    };
    reader.readAsDataURL(file);

    setFareMatrixImage(file);
  }, [showNotification]);

  const handleUploadFareMatrix = useCallback(async () => {
    if (!fareMatrixImage) {
      showNotification('Please select an image first', 'error');
      return;
    }

    setLoading(true);

    try {
      // TODO: API call to upload fare matrix image
      // const formData = new FormData();
      // formData.append('fareMatrix', fareMatrixImage);
      // await fareAPI.uploadMatrix(formData);

      // Simulate upload delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setUploadDate(new Date().toLocaleString());
      showNotification('Fare matrix updated successfully');
    } catch (error) {
      showNotification('Failed to upload fare matrix', 'error');
    } finally {
      setLoading(false);
    }
  }, [fareMatrixImage, showNotification]);

  const handleRemoveFareImage = useCallback(() => {
    setFareMatrixImage(null);
    setFareMatrixPreview(null);
  }, []);

  const handleDeleteFareMatrix = useCallback(() => {
    if (window.confirm('Are you sure you want to delete the current fare matrix?')) {
      // TODO: API call to delete fare matrix
      // await fareAPI.deleteMatrix();
      
      setFareMatrixImage(null);
      setFareMatrixPreview(null);
      setUploadDate(null);
      showNotification('Fare matrix deleted successfully');
    }
  }, [showNotification]);

  // ==================== Permission Handlers ====================
  
  const handlePermissionToggle = useCallback((category, permissionKey) => {
    setPermissions((prev) => {
      const rolePerms = prev[selectedRole][category] || [];
      const hasPermission = rolePerms.includes(permissionKey);
      
      return {
        ...prev,
        [selectedRole]: {
          ...prev[selectedRole],
          [category]: hasPermission
            ? rolePerms.filter((p) => p !== permissionKey)
            : [...rolePerms, permissionKey],
        },
      };
    });
    setHasPermissionChanges(true);
  }, [selectedRole]);

  const handleSavePermissions = useCallback(async () => {
    setLoading(true);
    
    try {
      // TODO: API call to save permissions
      // await permissionsAPI.update(selectedRole, permissions[selectedRole]);
      
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      showNotification('Permissions saved successfully');
      setHasPermissionChanges(false);
    } catch (error) {
      showNotification('Failed to save permissions', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedRole, permissions, showNotification]);

  const handleResetPermissions = useCallback(() => {
    if (window.confirm('Reset permissions to default for this role?')) {
      // TODO: Load default permissions from API
      showNotification('Permissions reset to default');
      setHasPermissionChanges(false);
    }
  }, [showNotification]);

  const hasPermission = useCallback((category, permissionKey) => {
    return permissions[selectedRole]?.[category]?.includes(permissionKey) || false;
  }, [permissions, selectedRole]);

  // Load existing fare matrix on mount
  useEffect(() => {
    // TODO: Fetch existing fare matrix image from backend
    // const loadFareMatrix = async () => {
    //   try {
    //     const response = await fareAPI.getMatrix();
    //     if (response.data.imageUrl) {
    //       setFareMatrixPreview(response.data.imageUrl);
    //       setUploadDate(response.data.uploadDate);
    //     }
    //   } catch (error) {
    //     console.error('Failed to load fare matrix:', error);
    //   }
    // };
    // loadFareMatrix();
  }, []);

  const permissionStats = useMemo(() => {
    const rolePerms = permissions[selectedRole];
    const total = Object.values(rolePerms).flat().length;
    const allPossible = Object.values(PERMISSION_CATEGORIES).reduce(
      (sum, cat) => sum + cat.permissions.length,
      0
    );
    
    return { granted: total, total: allPossible };
  }, [permissions, selectedRole]);

  return (
    <div className="settings-container">
      <Sidebar />
      
      <main className="settings-content">
        {/* Header */}
        <header className="settings-header">
          <Typography variant="h4" className="page-title">
            System Settings
          </Typography>

        </header>

        {/* Tabs */}
        <Paper className="settings-tabs-container" elevation={0}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <StyledTab
              icon={<LocalTaxiIcon />}
              iconPosition="start"
              label="Fare Matrix"
            />
            <StyledTab
              icon={<SecurityIcon />}
              iconPosition="start"
              label="Permission Control"
            />
          </Tabs>
        </Paper>

        {/* Tab Content */}
        <Box className="tab-content">
          {/* ==================== Fare Matrix Tab ==================== */}
          {activeTab === 0 && (
            <div className="fare-matrix-tab">
              <Paper className="fare-upload-container" elevation={0}>
                <Box className="upload-header">
                  <Typography variant="h6" className="upload-title">
                    Fare Matrix Image
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Upload an image of the official fare matrix (JPG, PNG, or GIF - Max 5MB)
                  </Typography>
                </Box>

                {/* Preview Area */}
                <Box className="preview-area">
                  {fareMatrixPreview ? (
                    <Box className="image-preview-container">
                      <img
                        src={fareMatrixPreview}
                        alt="Fare Matrix"
                        className="fare-matrix-image"
                      />
                      <Box className="image-overlay">
                        <Tooltip title="Remove Image">
                          <IconButton
                            className="remove-image-btn"
                            onClick={handleRemoveFareImage}
                            size="small"
                          >
                            <CancelIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      {uploadDate && (
                        <Typography variant="caption" className="upload-date">
                          Last updated: {uploadDate}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Box className="upload-placeholder">
                      <LocalTaxiIcon className="placeholder-icon" />
                      <Typography variant="h6" className="placeholder-text">
                        No Fare Matrix Uploaded
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Upload an image to display the fare matrix
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Upload Controls */}
                <Box className="upload-controls">
                  <input
                    accept="image/jpeg,image/jpg,image/png,image/gif"
                    style={{ display: 'none' }}
                    id="fare-matrix-upload"
                    type="file"
                    onChange={handleFareImageChange}
                  />
                  <label htmlFor="fare-matrix-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<AddIcon />}
                      className="select-file-btn"
                    >
                      Select Image
                    </Button>
                  </label>

                  {fareMatrixImage && (
                    <Typography variant="body2" className="selected-file">
                      Selected: {fareMatrixImage.name}
                    </Typography>
                  )}

                  <Box className="action-buttons">
                    <Button
                      variant="contained"
                      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                      onClick={handleUploadFareMatrix}
                      disabled={!fareMatrixImage || loading}
                      className="upload-btn"
                    >
                      {loading ? 'Uploading...' : 'Upload & Save'}
                    </Button>

                    {fareMatrixPreview && !fareMatrixImage && (
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={handleDeleteFareMatrix}
                        className="delete-btn"
                      >
                        Delete Current
                      </Button>
                    )}
                  </Box>
                </Box>
              </Paper>

              {/* Info Alert */}
              <Alert severity="info" icon={<InfoIcon />} className="info-alert">
                The fare matrix image will be displayed to drivers and users for reference. Ensure the image is clear and readable.
              </Alert>
            </div>
          )}

          {/* ==================== Permission Control Tab ==================== */}
          {activeTab === 1 && (
            <div className="permission-control-tab">
              {/* Role Selector */}
              <Paper className="role-selector-container" elevation={0}>
                <Typography variant="h6" className="section-title">
                  Select Role
                </Typography>
                <Box className="role-chips">
                  {ROLES.map((role) => (
                    <Chip
                      key={role.value}
                      label={role.label}
                      onClick={() => setSelectedRole(role.value)}
                      color={selectedRole === role.value ? 'primary' : 'default'}
                      variant={selectedRole === role.value ? 'filled' : 'outlined'}
                      className={`role-chip ${selectedRole === role.value ? 'active' : ''}`}
                      sx={{
                        borderColor: role.color,
                        color: selectedRole === role.value ? '#fff' : role.color,
                        backgroundColor: selectedRole === role.value ? role.color : 'transparent',
                        fontWeight: 600,
                        fontSize: '14px',
                        '&:hover': {
                          backgroundColor: selectedRole === role.value ? role.color : `${role.color}15`,
                        },
                      }}
                    />
                  ))}
                </Box>

                {/* Permission Stats */}
                <Box className="permission-stats">
                  <Typography variant="body2" color="textSecondary">
                    Permissions Granted: <strong>{permissionStats.granted}</strong> / {permissionStats.total}
                  </Typography>
                </Box>
              </Paper>

              {/* Permission Categories */}
              <div className="permission-categories">
                {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => (
                  <Paper key={categoryKey} className="permission-category" elevation={0}>
                    <Typography variant="h6" className="category-title">
                      {category.label}
                    </Typography>
                    
                    <div className="permission-list">
                      {category.permissions.map((permission) => {
                        const isEnabled = hasPermission(categoryKey, permission.key);
                        
                        return (
                          <Box key={permission.key} className="permission-item">
                            <Box className="permission-info">
                              <Typography variant="body1" className="permission-label">
                                {permission.label}
                              </Typography>
                              <Typography variant="body2" className="permission-description">
                                {permission.description}
                              </Typography>
                            </Box>
                            <Switch
                              checked={isEnabled}
                              onChange={() => handlePermissionToggle(categoryKey, permission.key)}
                              color="primary"
                              disabled={selectedRole === 'super-admin'}
                            />
                          </Box>
                        );
                      })}
                    </div>
                  </Paper>
                ))}
              </div>

              {/* Action Buttons */}
              <Box className="permission-actions">
                <Button
                  variant="outlined"
                  onClick={handleResetPermissions}
                  disabled={loading || !hasPermissionChanges}
                  className="reset-btn"
                >
                  Reset to Default
                </Button>
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  onClick={handleSavePermissions}
                  disabled={loading || !hasPermissionChanges}
                  className="save-permissions-btn"
                >
                  {loading ? 'Saving...' : 'Save Permissions'}
                </Button>
              </Box>

              {/* Info Alert */}
              {selectedRole === 'super-admin' && (
                <Alert severity="warning" className="info-alert">
                  Super Admin role has all permissions enabled by default and cannot be modified.
                </Alert>
              )}
            </div>
          )}
        </Box>
      </main>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={closeNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={closeNotification} severity={notification.type} sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default Settings;