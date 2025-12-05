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
  LinearProgress,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import LocalTaxiIcon from '@mui/icons-material/LocalTaxi';
import SecurityIcon from '@mui/icons-material/Security';
import BackupIcon from '@mui/icons-material/Backup';
import RestoreIcon from '@mui/icons-material/Restore';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ScheduleIcon from '@mui/icons-material/Schedule';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import HistoryIcon from '@mui/icons-material/History';
import FolderIcon from '@mui/icons-material/Folder';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';

const StyledTab = styled(Tab)(({ theme }) => ({
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '16px',
  color: '#64748b',
  '&.Mui-selected': {
    color: '#0A356B',
  },
}));

// Page Access Configuration - Based on actual routes in your application
const PAGE_ACCESS_CONFIG = [
  {
    category: 'Core Pages',
    pages: [
      { 
        key: 'dashboard', 
        label: 'Dashboard', 
        path: '/dashboard',
        description: 'View system statistics and KPIs',
        icon: '📊'
      },
      { 
        key: 'franchisee-list', 
        label: 'Franchisee List', 
        path: '/franchisee-list',
        description: 'View all franchise records',
        icon: '📋'
      },
      { 
        key: 'franchise-management', 
        label: 'Franchise Management', 
        path: '/franchise-management',
        description: 'Manage franchise applications and approvals',
        icon: '🏢'
      },
      { 
        key: 'certificate', 
        label: 'Certificate', 
        path: '/certificate',
        description: 'Generate and manage franchise certificates',
        icon: '📜'
      },
      { 
        key: 'incident-reports', 
        label: 'Incident Reporting', 
        path: '/incident-reports',
        description: 'View and manage tricycle incident reports',
        icon: '📝'
      },
    ],
  },
  {
    category: 'Advanced Features',
    pages: [
      { 
        key: 'analytics', 
        label: 'Analytics', 
        path: '/analytics',
        description: 'Advanced analytics and insights',
        icon: '📈'
      },
      { 
        key: 'announcements', 
        label: 'Announcements', 
        path: '/announcements',
        description: 'Create and manage system announcements',
        icon: '📢'
      },
      { 
        key: 'audit-trail', 
        label: 'Audit Trail', 
        path: '/audit-trail',
        description: 'View system audit logs and activity',
        icon: '🕒'
      },
      { 
        key: 'user-management', 
        label: 'User Management', 
        path: '/user-management',
        description: 'Manage admin users and accounts',
        icon: '👥'
      },
      { 
        key: 'settings', 
        label: 'Settings', 
        path: '/settings',
        description: 'System configuration and permissions',
        icon: '⚙️'
      },
    ],
  },
];

const ROLES = [
  { value: 'super-admin', label: 'Super Admin', color: '#dc2626' },
  { value: 'sb-admin', label: 'Sangguniang Bayan', color: '#0A356B' },
  { value: 'bplo-admin', label: 'BPLO', color: '#059669' },
];

// Get all page keys for super admin access
const ALL_PAGE_KEYS = PAGE_ACCESS_CONFIG.flatMap(category => 
  category.pages.map(page => page.key)
);

// Mock backup history data (Frontend only - will be replaced with API calls)
const MOCK_BACKUP_HISTORY = [
  {
    id: 1,
    fileName: 'backup_2024_12_04_143022.sql',
    createdAt: '2024-12-04T14:30:22Z',
    size: '24.5 MB',
    type: 'full',
    status: 'completed',
    createdBy: 'System (Automated)',
  },
  {
    id: 2,
    fileName: 'backup_2024_12_03_020000.sql',
    createdAt: '2024-12-03T02:00:00Z',
    size: '23.8 MB',
    type: 'full',
    status: 'completed',
    createdBy: 'System (Scheduled)',
  },
  {
    id: 3,
    fileName: 'backup_2024_12_01_143500.sql',
    createdAt: '2024-12-01T14:35:00Z',
    size: '22.1 MB',
    type: 'manual',
    status: 'completed',
    createdBy: 'Admin User',
  },
];

function Settings() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState({ open: false, message: '', type: 'success' });
  
  // Fare Matrix State (Photo Upload)
  const [fareMatrixImage, setFareMatrixImage] = useState(null);
  const [fareMatrixPreview, setFareMatrixPreview] = useState(null);
  const [fareMatrixId, setFareMatrixId] = useState(null);
  const [uploadDate, setUploadDate] = useState(null);
  const [currentFileName, setCurrentFileName] = useState('');

  // Page Access State - Which pages each role can access
  const [pageAccess, setPageAccess] = useState({});
  const [selectedRole, setSelectedRole] = useState('super-admin');
  const [hasPermissionChanges, setHasPermissionChanges] = useState(false);
  const [loadingPageAccess, setLoadingPageAccess] = useState(true);

  // Backup & Recovery State
  const [backupHistory, setBackupHistory] = useState(MOCK_BACKUP_HISTORY);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [selectedBackupFile, setSelectedBackupFile] = useState(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [backupFrequency, setBackupFrequency] = useState('daily');
  const [lastBackupTime, setLastBackupTime] = useState('2024-12-04 14:30:22');

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

  // Get auth token from storage
  const getAuthToken = useCallback(() => {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
  }, []);

  // Notification Handler
  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ open: true, message, type });
  }, []);

  const closeNotification = useCallback(() => {
    setNotification({ ...notification, open: false });
  }, [notification]);

  // Fetch all page access configurations from backend
  const fetchAllPageAccess = useCallback(async () => {
    setLoadingPageAccess(true);
    try {
      const token = getAuthToken();
      if (!token) {
        console.warn('[Settings] No auth token available');
        setLoadingPageAccess(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/role-page-access`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Settings] Fetched page access:', result);
        
        if (result.success && result.data && Array.isArray(result.data)) {
          // Transform array to object format
          const accessMap = {};
          result.data.forEach(item => {
            if (item.role && item.allowedPages) {
              accessMap[item.role] = item.allowedPages;
            }
          });
          
          console.log('[Settings] Transformed page access:', accessMap);
          setPageAccess(accessMap);
        } else {
          console.warn('[Settings] Invalid data structure:', result);
        }
      } else {
        console.error('[Settings] Failed to fetch page access, status:', response.status);
      }
    } catch (error) {
      console.error('[Settings] Error fetching page access:', error);
    } finally {
      setLoadingPageAccess(false);
    }
  }, [getAuthToken]);

  // Fetch existing fare matrix from backend
  const fetchFareMatrix = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fare-matrix`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.fareMatrix) {
          setFareMatrixPreview(result.fareMatrix.imageUrl);
          setFareMatrixId(result.fareMatrix.fareMatrixId);
          setCurrentFileName(result.fareMatrix.fileName);
          setUploadDate(new Date(result.fareMatrix.createdAt).toLocaleString());
        }
      }
    } catch (error) {
      console.error('Error fetching fare matrix:', error);
    }
  }, []);

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
    setError('');

    try {
      const token = getAuthToken();
      
      if (!token) {
        showNotification('Authentication required. Please log in.', 'error');
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('fareMatrixImage', fareMatrixImage);

      const response = await fetch(`${API_BASE_URL}/api/fare-matrix/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please log in again.');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to upload fare matrix.');
        }
        throw new Error(result.error || 'Failed to upload fare matrix');
      }

      if (result.success && result.fareMatrix) {
        setFareMatrixPreview(result.fareMatrix.imageUrl);
        setFareMatrixId(result.fareMatrix.fareMatrixId);
        setCurrentFileName(result.fareMatrix.fileName);
        setUploadDate(new Date(result.fareMatrix.createdAt).toLocaleString());
        setFareMatrixImage(null); // Clear the selected file
        showNotification('Fare matrix uploaded successfully');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showNotification(error.message || 'Failed to upload fare matrix', 'error');
    } finally {
      setLoading(false);
    }
  }, [fareMatrixImage, showNotification, getAuthToken]);

  const handleRemoveFareImage = useCallback(() => {
    setFareMatrixImage(null);
    setFareMatrixPreview(null);
  }, []);

  const handleDeleteFareMatrix = useCallback(async () => {
    if (!window.confirm('Are you sure you want to delete the current fare matrix? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = getAuthToken();
      
      if (!token) {
        showNotification('Authentication required. Please log in.', 'error');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/fare-matrix`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please log in again.');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to delete fare matrix.');
        }
        if (response.status === 404) {
          throw new Error('No active fare matrix to delete.');
        }
        throw new Error(result.error || 'Failed to delete fare matrix');
      }

      if (result.success) {
        setFareMatrixImage(null);
        setFareMatrixPreview(null);
        setFareMatrixId(null);
        setCurrentFileName('');
        setUploadDate(null);
        showNotification('Fare matrix deleted successfully');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showNotification(error.message || 'Failed to delete fare matrix', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification, getAuthToken]);

  // ==================== Permission Handlers ====================
  
  const handlePageAccessToggle = useCallback((pageKey) => {
    setPageAccess((prev) => {
      const rolePages = prev[selectedRole] || [];
      const hasAccess = rolePages.includes(pageKey);
      
      return {
        ...prev,
        [selectedRole]: hasAccess
          ? rolePages.filter((p) => p !== pageKey)
          : [...rolePages, pageKey],
      };
    });
    setHasPermissionChanges(true);
  }, [selectedRole]);

  const handleSavePermissions = useCallback(async () => {
    setLoading(true);
    
    try {
      const token = getAuthToken();
      
      if (!token) {
        showNotification('Authentication required. Please log in.', 'error');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/role-page-access/${selectedRole}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allowedPages: pageAccess[selectedRole],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please log in again.');
        }
        if (response.status === 403) {
          throw new Error(result.error || 'You do not have permission to modify page access.');
        }
        throw new Error(result.error || 'Failed to save page access');
      }

      if (result.success) {
        showNotification('Page access permissions saved successfully');
        setHasPermissionChanges(false);
        // Refresh the data
        await fetchAllPageAccess();
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Save error:', error);
      showNotification(error.message || 'Failed to save permissions', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedRole, pageAccess, showNotification, getAuthToken, fetchAllPageAccess]);

  const handleResetPermissions = useCallback(async () => {
    if (!window.confirm('Reset page access to default for this role?')) {
      return;
    }

    setLoading(true);

    try {
      const token = getAuthToken();
      
      if (!token) {
        showNotification('Authentication required. Please log in.', 'error');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/role-page-access/${selectedRole}/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please log in again.');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to reset page access.');
        }
        throw new Error(result.error || 'Failed to reset page access');
      }

      if (result.success && result.data) {
        setPageAccess((prev) => ({
          ...prev,
          [selectedRole]: result.data.allowedPages,
        }));
        
        showNotification('Page access reset to default');
        setHasPermissionChanges(false);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Reset error:', error);
      showNotification(error.message || 'Failed to reset page access', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedRole, showNotification, getAuthToken]);

  const hasPageAccess = useCallback((pageKey) => {
    // Super admin always has access to all pages
    if (selectedRole === 'super-admin') {
      return true;
    }
    const rolePages = pageAccess[selectedRole];
    return Array.isArray(rolePages) && rolePages.includes(pageKey);
  }, [pageAccess, selectedRole]);

  // ==================== Backup & Recovery Handlers ====================

  const handleCreateBackup = useCallback(async () => {
    setIsCreatingBackup(true);
    setBackupProgress(0);

    // Simulate backup progress (Frontend only - no backend yet)
    const progressInterval = setInterval(() => {
      setBackupProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 300);

    // Simulate backup completion
    setTimeout(() => {
      clearInterval(progressInterval);
      setBackupProgress(100);
      
      const newBackup = {
        id: Date.now(),
        fileName: `backup_${new Date().toISOString().replace(/[-:T]/g, '_').slice(0, 19)}.sql`,
        createdAt: new Date().toISOString(),
        size: `${(20 + Math.random() * 10).toFixed(1)} MB`,
        type: 'manual',
        status: 'completed',
        createdBy: 'Current User',
      };
      
      setBackupHistory((prev) => [newBackup, ...prev]);
      setLastBackupTime(new Date().toLocaleString());
      
      setTimeout(() => {
        setIsCreatingBackup(false);
        setBackupProgress(0);
        showNotification('Backup created successfully!', 'success');
      }, 500);
    }, 3000);
  }, [showNotification]);

  const handleRestoreBackup = useCallback(async (backupId) => {
    const backup = backupHistory.find((b) => b.id === backupId);
    if (!backup) return;

    if (!window.confirm(`Are you sure you want to restore from "${backup.fileName}"? This will replace current data.`)) {
      return;
    }

    setIsRestoring(true);
    setRestoreProgress(0);

    // Simulate restore progress
    const progressInterval = setInterval(() => {
      setRestoreProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 12;
      });
    }, 400);

    setTimeout(() => {
      clearInterval(progressInterval);
      setRestoreProgress(100);
      
      setTimeout(() => {
        setIsRestoring(false);
        setRestoreProgress(0);
        showNotification('System restored successfully from backup!', 'success');
      }, 500);
    }, 4000);
  }, [backupHistory, showNotification]);

  const handleDeleteBackup = useCallback((backupId) => {
    const backup = backupHistory.find((b) => b.id === backupId);
    if (!backup) return;

    if (!window.confirm(`Are you sure you want to delete "${backup.fileName}"? This action cannot be undone.`)) {
      return;
    }

    setBackupHistory((prev) => prev.filter((b) => b.id !== backupId));
    showNotification('Backup deleted successfully', 'success');
  }, [backupHistory, showNotification]);

  const handleDownloadBackup = useCallback((backupId) => {
    const backup = backupHistory.find((b) => b.id === backupId);
    if (!backup) return;

    // Simulate download (Frontend only)
    showNotification(`Downloading ${backup.fileName}...`, 'info');
    
    setTimeout(() => {
      showNotification('Backup file downloaded successfully!', 'success');
    }, 1500);
  }, [backupHistory, showNotification]);

  const handleUploadBackup = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.sql') && !file.name.endsWith('.zip')) {
      showNotification('Please upload a valid backup file (.sql or .zip)', 'error');
      return;
    }

    setSelectedBackupFile(file);
    showNotification(`Selected backup file: ${file.name}`, 'info');
  }, [showNotification]);

  const handleImportBackup = useCallback(() => {
    if (!selectedBackupFile) {
      showNotification('Please select a backup file first', 'error');
      return;
    }

    if (!window.confirm('Are you sure you want to restore from this uploaded backup? This will replace current data.')) {
      return;
    }

    setIsRestoring(true);
    setRestoreProgress(0);

    const progressInterval = setInterval(() => {
      setRestoreProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 10;
      });
    }, 400);

    setTimeout(() => {
      clearInterval(progressInterval);
      setRestoreProgress(100);
      
      setTimeout(() => {
        setIsRestoring(false);
        setRestoreProgress(0);
        setSelectedBackupFile(null);
        showNotification('System restored successfully from uploaded backup!', 'success');
      }, 500);
    }, 5000);
  }, [selectedBackupFile, showNotification]);

  const formatBackupDate = useCallback((dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Load existing fare matrix on mount
  useEffect(() => {
    fetchFareMatrix();
  }, [fetchFareMatrix]);

  // Load page access configuration on mount
  useEffect(() => {
    fetchAllPageAccess();
  }, [fetchAllPageAccess]);

  const permissionStats = useMemo(() => {
    const totalPages = PAGE_ACCESS_CONFIG.reduce((sum, cat) => sum + cat.pages.length, 0);
    
    // Super admin always has all pages
    if (selectedRole === 'super-admin') {
      return { granted: totalPages, total: totalPages };
    }
    
    const rolePages = pageAccess[selectedRole] || [];
    
    console.log(`[Settings] Stats for ${selectedRole}:`, {
      rolePages,
      count: rolePages.length,
      totalPages,
      allPageAccess: pageAccess
    });
    
    return { granted: rolePages.length, total: totalPages };
  }, [pageAccess, selectedRole]);

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

        {error && (
          <Alert severity="error" className="error-alert" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

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
            <StyledTab
              icon={<BackupIcon />}
              iconPosition="start"
              label="Backup & Recovery"
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
                        <Box className="image-info">
                          <Typography variant="caption" className="upload-date">
                            Last updated: {uploadDate}
                          </Typography>
                          {currentFileName && (
                            <Typography variant="caption" className="file-name">
                              File: {currentFileName}
                            </Typography>
                          )}
                        </Box>
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
              {loadingPageAccess ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                  <CircularProgress />
                </Box>
              ) : (
                <>
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
                        Pages Accessible: <strong>{permissionStats.granted}</strong> / {permissionStats.total}
                      </Typography>
                    </Box>
                  </Paper>

              {/* Page Access Categories */}
              <div className="permission-categories">
                {PAGE_ACCESS_CONFIG.map((category) => (
                  <Paper key={category.category} className="permission-category" elevation={0}>
                    <Typography variant="h6" className="category-title">
                      {category.category}
                    </Typography>
                    
                    <div className="permission-list">
                      {category.pages.map((page) => {
                        const hasAccess = hasPageAccess(page.key);
                        
                        return (
                          <Box key={page.key} className="permission-item">
                            <Box className="permission-info">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span style={{ fontSize: '20px' }}>{page.icon}</span>
                                <Typography variant="body1" className="permission-label">
                                  {page.label}
                                </Typography>
                              </Box>
                              <Typography variant="body2" className="permission-description">
                                {page.description}
                              </Typography>
                              <Typography variant="caption" color="textSecondary" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                                Route: {page.path}
                              </Typography>
                            </Box>
                            <Switch
                              checked={hasAccess}
                              onChange={() => handlePageAccessToggle(page.key)}
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

              {/* Info Alerts */}
              {selectedRole === 'super-admin' && (
                <Alert severity="warning" className="info-alert">
                  Super Admin role has access to all pages by default and cannot be modified.
                </Alert>
              )}
              
              <Alert severity="info" icon={<InfoIcon />} className="info-alert" sx={{ mt: 2 }}>
                Page access control determines which routes and pages each admin role can view and use. Changes will affect all users with the selected role.
              </Alert>
                </>
              )}
            </div>
          )}

          {/* ==================== Backup & Recovery Tab ==================== */}
          {activeTab === 2 && (
            <div className="backup-recovery-tab">
              {/* Progress Overlay */}
              {(isCreatingBackup || isRestoring) && (
                <Box className="backup-progress-overlay">
                  <Paper className="progress-modal" elevation={3}>
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                      {isCreatingBackup ? (
                        <BackupIcon sx={{ fontSize: 60, color: '#0A356B', mb: 2 }} />
                      ) : (
                        <RestoreIcon sx={{ fontSize: 60, color: '#059669', mb: 2 }} />
                      )}
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                        {isCreatingBackup ? 'Creating Backup...' : 'Restoring System...'}
                      </Typography>
                      <Box sx={{ width: '100%', mb: 2 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={isCreatingBackup ? backupProgress : restoreProgress} 
                          sx={{ 
                            height: 10, 
                            borderRadius: 5,
                            backgroundColor: '#e2e8f0',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: isCreatingBackup ? '#0A356B' : '#059669',
                            }
                          }}
                        />
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        {Math.round(isCreatingBackup ? backupProgress : restoreProgress)}% Complete
                      </Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>
                        Please do not close this page...
                      </Typography>
                    </Box>
                  </Paper>
                </Box>
              )}

              {/* Status Cards */}
              <div className="backup-status-grid">
                <Card className="backup-status-card" elevation={0}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box className="status-icon-wrapper success">
                        <CheckCircleIcon />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Last Backup
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {lastBackupTime}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                <Card className="backup-status-card" elevation={0}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box className="status-icon-wrapper info">
                        <StorageIcon />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Total Backups
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {backupHistory.length} Files
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                <Card className="backup-status-card" elevation={0}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box className={`status-icon-wrapper ${autoBackupEnabled ? 'success' : 'warning'}`}>
                        <ScheduleIcon />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="textSecondary">
                          Auto Backup
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {autoBackupEnabled ? 'Enabled' : 'Disabled'}
                        </Typography>
                      </Box>
                      <Switch
                        checked={autoBackupEnabled}
                        onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                        color="primary"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </div>

              {/* Action Cards */}
              <div className="backup-action-grid">
                {/* Create Backup Card */}
                <Paper className="backup-action-card" elevation={0}>
                  <Box className="action-card-header">
                    <BackupIcon sx={{ fontSize: 32, color: '#0A356B' }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#0A356B' }}>
                      Create Backup
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                    Create a complete backup of the database including all franchise records, user accounts, and system configurations.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<CloudUploadIcon />}
                    onClick={handleCreateBackup}
                    disabled={isCreatingBackup || isRestoring}
                    fullWidth
                    className="backup-action-btn primary"
                  >
                    Create Backup Now
                  </Button>
                </Paper>

                {/* Upload Backup Card */}
                <Paper className="backup-action-card" elevation={0}>
                  <Box className="action-card-header">
                    <RestoreIcon sx={{ fontSize: 32, color: '#059669' }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669' }}>
                      Restore from File
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Upload and restore from an external backup file. Supported formats: .sql, .zip
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <input
                      accept=".sql,.zip"
                      style={{ display: 'none' }}
                      id="backup-file-upload"
                      type="file"
                      onChange={handleUploadBackup}
                    />
                    <label htmlFor="backup-file-upload" style={{ width: '100%' }}>
                      <Button
                        variant="outlined"
                        component="span"
                        startIcon={<FolderIcon />}
                        fullWidth
                        sx={{ mb: 1 }}
                        className="backup-select-btn"
                      >
                        Select Backup File
                      </Button>
                    </label>
                    {selectedBackupFile && (
                      <Typography variant="body2" className="selected-backup-file">
                        📁 {selectedBackupFile.name}
                      </Typography>
                    )}
                  </Box>
                  
                  <Button
                    variant="contained"
                    startIcon={<CloudDownloadIcon />}
                    onClick={handleImportBackup}
                    disabled={!selectedBackupFile || isRestoring || isCreatingBackup}
                    fullWidth
                    className="backup-action-btn success"
                  >
                    Restore from Upload
                  </Button>
                </Paper>
              </div>

              {/* Backup History */}
              <Paper className="backup-history-container" elevation={0}>
                <Box className="history-header">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HistoryIcon sx={{ color: '#0A356B' }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#0A356B' }}>
                      Backup History
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary">
                    {backupHistory.length} backup(s) available
                  </Typography>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {backupHistory.length === 0 ? (
                  <Box className="no-backups-placeholder">
                    <StorageIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
                    <Typography variant="h6" color="textSecondary">
                      No Backups Found
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Create your first backup to protect your data
                    </Typography>
                  </Box>
                ) : (
                  <div className="backup-history-list">
                    {backupHistory.map((backup) => (
                      <Box key={backup.id} className="backup-history-item">
                        <Box className="backup-item-info">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box className={`backup-type-icon ${backup.type}`}>
                              {backup.type === 'manual' ? <BackupIcon /> : <ScheduleIcon />}
                            </Box>
                            <Box>
                              <Typography variant="body1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                {backup.fileName}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                                <Typography variant="caption" color="textSecondary">
                                  {formatBackupDate(backup.createdAt)}
                                </Typography>
                                <Chip 
                                  label={backup.size} 
                                  size="small" 
                                  sx={{ 
                                    height: 20, 
                                    fontSize: '11px',
                                    backgroundColor: '#f1f5f9',
                                    color: '#64748b'
                                  }} 
                                />
                                <Chip 
                                  label={backup.type === 'manual' ? 'Manual' : 'Scheduled'} 
                                  size="small" 
                                  sx={{ 
                                    height: 20, 
                                    fontSize: '11px',
                                    backgroundColor: backup.type === 'manual' ? '#dbeafe' : '#dcfce7',
                                    color: backup.type === 'manual' ? '#1d4ed8' : '#16a34a'
                                  }} 
                                />
                              </Box>
                              <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                                Created by: {backup.createdBy}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                        <Box className="backup-item-actions">
                          <Tooltip title="Download Backup">
                            <IconButton 
                              onClick={() => handleDownloadBackup(backup.id)}
                              className="backup-item-btn download"
                              disabled={isRestoring || isCreatingBackup}
                            >
                              <CloudDownloadIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Restore from this Backup">
                            <IconButton 
                              onClick={() => handleRestoreBackup(backup.id)}
                              className="backup-item-btn restore"
                              disabled={isRestoring || isCreatingBackup}
                            >
                              <RestoreIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Backup">
                            <IconButton 
                              onClick={() => handleDeleteBackup(backup.id)}
                              className="backup-item-btn delete"
                              disabled={isRestoring || isCreatingBackup}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    ))}
                  </div>
                )}
              </Paper>

              {/* Info Alerts */}
              <Alert severity="warning" icon={<WarningIcon />} className="info-alert" sx={{ mt: 2 }}>
                <strong>Important:</strong> Restoring from a backup will replace all current data. Make sure to create a backup of current data before restoring.
              </Alert>
              
              <Alert severity="info" icon={<InfoIcon />} className="info-alert" sx={{ mt: 2 }}>
                Automated backups are scheduled to run daily at 2:00 AM. Manual backups can be created at any time. All backups are stored securely and encrypted.
              </Alert>
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