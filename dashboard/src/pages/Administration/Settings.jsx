import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Sidebar from './Sidebar';
import '../../Styles/Administrator_Css/Settings.css';
import { toast } from 'react-toastify';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useIsMounted } from '../../hooks/useIsMounted';
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
  Chip,
  Tooltip,
  CircularProgress,
  LinearProgress,
  Divider,
  Card,
  CardContent,
  Fade,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Radio,
} from '@mui/material';
import PageLoader from '../../components/PageLoader';
import AnimatedPage, { AnimatedSection } from '../../components/AnimatedPage';
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
import VerifiedIcon from '@mui/icons-material/Verified';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RefreshIcon from '@mui/icons-material/Refresh';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import SettingsIcon from '@mui/icons-material/Settings';

// Import backup service
import * as backupService from '../../services/backupService';
import { logger } from '../../utils/logger';
import { getToken, rolePageAccessAPI, fareMatrixAPI } from '../Services/api';

// API Base URL for image path construction - must have a proper URL for cross-origin image loading
// In Docker: VITE_API_BASE_URL is typically 'http://localhost' (nginx on port 80)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

const StyledTab = styled(Tab)(() => ({
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
        key: 'franchise-linking', 
        label: 'Franchise Linking', 
        path: '/franchise-linking',
        description: 'Review and approve franchise linking requests',
        icon: '🔗'
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
        key: 'admin-management', 
        label: 'Admin Management', 
        path: '/admin-management',
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

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Helper function to format date
const formatBackupDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Helper function to get backup type display label
const getBackupTypeLabel = (type) => {
  const typeLabels = {
    'automatic': 'Scheduled',
    'manual': 'Manual',
    'emergency': 'Emergency',
    'pre-update': 'Pre-Update',
    'archive': 'Archive'
  };
  return typeLabels[type] || type;
};

// Helper function to get backup type color
const getBackupTypeColor = (type) => {
  const typeColors = {
    'automatic': { bg: '#dcfce7', text: '#16a34a' },
    'manual': { bg: '#dbeafe', text: '#1d4ed8' },
    'emergency': { bg: '#fef3c7', text: '#d97706' },
    'pre-update': { bg: '#e0e7ff', text: '#4338ca' },
    'archive': { bg: '#f3e8ff', text: '#7c3aed' }
  };
  return typeColors[type] || { bg: '#f1f5f9', text: '#64748b' };
};

function Settings() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Fare Matrix State (Photo Upload)
  const [fareMatrixImage, setFareMatrixImage] = useState(null);
  const [fareMatrixPreview, setFareMatrixPreview] = useState(null);
  const [, setFareMatrixId] = useState(null); // ID stored for future reference
  const [uploadDate, setUploadDate] = useState(null);
  const [currentFileName, setCurrentFileName] = useState('');

  // Page Access State - Which pages each role can access
  const [pageAccess, setPageAccess] = useState({});
  const [selectedRole, setSelectedRole] = useState('super-admin');
  const [hasPermissionChanges, setHasPermissionChanges] = useState(false);
  const [loadingPageAccess, setLoadingPageAccess] = useState(true);

  // Backup & Recovery State
  const [backupHistory, setBackupHistory] = useState([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [selectedBackupFile, setSelectedBackupFile] = useState(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [lastBackupTime, setLastBackupTime] = useState(null);
  const [backupStats, setBackupStats] = useState({ totalBackups: 0, totalSize: 0 });
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isExportingFull, setIsExportingFull] = useState(false);
  const [isResettingConfig, setIsResettingConfig] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [selectedDownloadBackup, setSelectedDownloadBackup] = useState(null);
  const fileInputRef = useRef(null);
  
  // Prevent state updates on unmounted component
  const isMountedRef = useIsMounted();

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    details: '',
    onConfirm: null,
    severity: 'warning',
    confirmText: 'Confirm',
  });

  // Tab Change Handler
  const handleTabChange = useCallback((event, newValue) => {
    if (hasPermissionChanges) {
      setConfirmDialog({
        open: true,
        title: 'Unsaved Changes',
        message: 'You have unsaved permission changes. Are you sure you want to switch tabs?',
        details: 'Any unsaved changes will be lost.',
        severity: 'warning',
        confirmText: 'Switch Tab',
        onConfirm: () => {
          setActiveTab(newValue);
          setHasPermissionChanges(false);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        },
      });
    } else {
      setActiveTab(newValue);
    }
  }, [hasPermissionChanges]);

  // Get auth token from centralized secure token manager
  const getAuthToken = useCallback(() => {
    return getToken();
  }, []);

  // Fetch all page access configurations from backend
  const fetchAllPageAccess = useCallback(async () => {
    setLoadingPageAccess(true);
    try {
      const response = await rolePageAccessAPI.getAll();

      if (response.data?.success && Array.isArray(response.data?.data)) {
        // Transform array to object format and filter invalid page keys
        const accessMap = {};
        response.data.data.forEach(item => {
          if (item.role && item.allowedPages) {
            // Filter to only include valid page keys
            accessMap[item.role] = item.allowedPages.filter(
              pageKey => ALL_PAGE_KEYS.includes(pageKey)
            );
          }
        });
        
        setPageAccess(accessMap);
      } else {
        logger.warn('[Settings] Invalid data structure:', response.data);
      }
    } catch (error) {
      logger.error('[Settings] Error fetching page access:', error?.message || 'Unknown error');
    } finally {
      setLoadingPageAccess(false);
    }
  }, []);

  // Fetch existing fare matrix from backend
  const fetchFareMatrix = useCallback(async () => {
    try {
      const response = await fareMatrixAPI.get();
      const result = response.data;

      if (result?.success && result?.fareMatrix) {
        // Prepend API_BASE_URL to imageUrl if it's a relative path
        let imageUrl = result.fareMatrix.imageUrl;
        if (imageUrl && imageUrl.startsWith('/api/files/')) {
          imageUrl = `${API_BASE_URL}${imageUrl}`;
        }
        // Add cache-busting to prevent browser from showing cached old image
        const cacheBuster = `?t=${Date.now()}`;
        setFareMatrixPreview(imageUrl + cacheBuster);
        setFareMatrixId(result.fareMatrix.fareMatrixId);
        setCurrentFileName(result.fareMatrix.fileName);
        setUploadDate(new Date(result.fareMatrix.createdAt).toLocaleString());
      }
    } catch (error) {
      logger.error('Error fetching fare matrix:', error?.message || 'Unknown error');
    }
  }, []);

  // Fare Matrix Handlers
  const handleFareImageChange = useCallback((event) => {
    const file = event.target.files?.[0];
    
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, or GIF)');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFareMatrixPreview(reader.result);
    };
    reader.readAsDataURL(file);

    setFareMatrixImage(file);
  }, []);

  const handleUploadFareMatrix = useCallback(async () => {
    if (!fareMatrixImage) {
      toast.error('Please select an image first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = getAuthToken();
      
      if (!token) {
        toast.error('Authentication required. Please log in.');
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('fareMatrixImage', fareMatrixImage);

      const response = await fareMatrixAPI.upload(formData);
      const result = response.data;

      if (result?.success && result?.fareMatrix) {
        // Clear the local file first
        setFareMatrixImage(null);
        
        // Refetch the fare matrix to ensure we have the latest data with proper URLs
        await fetchFareMatrix();
        
        toast.success('Fare matrix uploaded successfully');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      const errorMsg = error?.response?.data?.error || error?.message || 'Failed to upload fare matrix';
      if (error?.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
      } else if (error?.response?.status === 403) {
        toast.error('You do not have permission to upload fare matrix.');
      } else {
        logger.error('Upload error:', errorMsg);
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [fareMatrixImage, fetchFareMatrix]);

  const handleRemoveFareImage = useCallback(() => {
    setFareMatrixImage(null);
    setFareMatrixPreview(null);
  }, []);

  const handleDeleteFareMatrix = useCallback(async () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Fare Matrix',
      message: 'Are you sure you want to delete the current fare matrix?',
      details: 'This action cannot be undone.',
      severity: 'error',
      confirmText: 'Delete',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setLoading(true);
        setError('');

    try {
      const response = await fareMatrixAPI.delete();
      const result = response.data;

      if (result?.success) {
        setFareMatrixImage(null);
        setFareMatrixPreview(null);
        setFareMatrixId(null);
        setCurrentFileName('');
        setUploadDate(null);
        toast.success('Fare matrix deleted successfully');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      const errorMsg = error?.response?.data?.error || error?.message || 'Failed to delete fare matrix';
      if (error?.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
      } else if (error?.response?.status === 403) {
        toast.error('You do not have permission to delete fare matrix.');
      } else if (error?.response?.status === 404) {
        toast.error('No active fare matrix to delete.');
      } else {
        logger.error('Delete error:', errorMsg);
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
      },
    });
  }, []);

  // Permission Handlers
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
      // Filter to only include valid page keys to prevent validation errors
      const validAllowedPages = (pageAccess[selectedRole] || []).filter(
        pageKey => ALL_PAGE_KEYS.includes(pageKey)
      );

      const response = await rolePageAccessAPI.update(selectedRole, validAllowedPages);
      const result = response.data;

      if (result?.success) {
        toast.success('Page access permissions saved successfully');
        setHasPermissionChanges(false);
        
        // Clear the Sidebar's cached pages for this role so it fetches fresh data
        try {
          sessionStorage.removeItem(`allowedPages_${selectedRole}`);
        } catch {
          logger.warn('[Settings] Failed to clear cached pages');
        }
        
        await fetchAllPageAccess();
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      const errorMsg = error?.response?.data?.error || error?.message || 'Failed to save permissions';
      if (error?.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
      } else if (error?.response?.status === 403) {
        toast.error('You do not have permission to modify page access.');
      } else {
        logger.error('Save error:', errorMsg);
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedRole, pageAccess, fetchAllPageAccess]);

  const handleResetPermissions = useCallback(async () => {
    setConfirmDialog({
      open: true,
      title: 'Reset Permissions',
      message: 'Reset page access to default for this role?',
      details: 'This will restore the default page access settings for the selected role.',
      severity: 'warning',
      confirmText: 'Reset',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setLoading(true);

        try {
          const response = await rolePageAccessAPI.reset(selectedRole);
          const result = response.data;

          if (result?.success && result?.data) {
            setPageAccess((prev) => ({
              ...prev,
              [selectedRole]: result.data.allowedPages,
            }));
            
            // Clear the Sidebar's cached pages for this role so it fetches fresh data
            try {
              sessionStorage.removeItem(`allowedPages_${selectedRole}`);
            } catch {
              logger.warn('[Settings] Failed to clear cached pages');
            }
            
            toast.success('Page access reset to default');
            setHasPermissionChanges(false);
          } else {
            throw new Error('Invalid response from server');
          }
        } catch (error) {
          const errorMsg = error?.response?.data?.error || error?.message || 'Failed to reset page access';
          if (error?.response?.status === 401) {
            toast.error('Session expired. Please log in again.');
          } else if (error?.response?.status === 403) {
            toast.error('You do not have permission to reset page access.');
          } else {
            logger.error('Reset error:', errorMsg);
            toast.error(errorMsg);
          }
        } finally {
          setLoading(false);
        }
      },
    });
  }, [selectedRole]);

  const hasPageAccess = useCallback((pageKey) => {
    // Super admin always has access to all pages
    if (selectedRole === 'super-admin') {
      return true;
    }
    const rolePages = pageAccess[selectedRole];
    return Array.isArray(rolePages) && rolePages.includes(pageKey);
  }, [pageAccess, selectedRole]);

  // Backup & Recovery Handlers
  /** Find a backup by ID from the backup history */
  const findBackupById = useCallback((backupId) => {
    return backupHistory.find((b) => b.backupId === backupId) || null;
  }, [backupHistory]);

  /**
   * Fetch backup history from the backend
   * Filters to show only completed backups, sorted by date (newest first)
   */
  const fetchBackupHistory = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const response = await backupService.getBackupHistory({ limit: 50, page: 1 });
      if (response.success && response.data) {
        // Handle both paginated and non-paginated response formats
        const backups = response.data.backups || response.data;
        const backupList = Array.isArray(backups) ? backups : [];
        
        // Filter only completed backups and sort by date (newest first)
        // Map retention.isProtected to top-level isProtected for frontend compatibility
        const completedBackups = backupList
          .filter(b => b.status === 'completed')
          .map(b => ({
            ...b,
            isProtected: b.retention?.isProtected || b.isProtected || false
          }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        setBackupHistory(completedBackups);
        
        // Calculate total size from completed backups
        const totalSize = completedBackups.reduce((acc, b) => acc + (b.fileSize || 0), 0);
        setBackupStats({ 
          totalBackups: completedBackups.length, 
          totalSize 
        });
      } else {
        setBackupHistory([]);
        setBackupStats({ totalBackups: 0, totalSize: 0 });
      }
    } catch (error) {
      logger.error('[Settings] Error fetching backup history:', error);
      toast.error('Failed to load backup history');
      setBackupHistory([]);
      setBackupStats({ totalBackups: 0, totalSize: 0 });
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  /**
   * Fetch information about the last successful backup
   * Used for the "Last Backup" status display
   */
  const fetchLastBackupInfo = useCallback(async () => {
    try {
      const response = await backupService.getLastBackupInfo();
      if (response.success && response.data) {
        const lastBackup = response.data;
        if (lastBackup.createdAt) {
          setLastBackupTime(formatBackupDate(lastBackup.createdAt));
        } else {
          setLastBackupTime(null);
        }
      } else {
        setLastBackupTime(null);
      }
    } catch (error) {
      logger.error('[Settings] Error fetching last backup info:', error);
      setLastBackupTime(null);
    }
  }, []);

  /**
   * Fetch backup configuration settings
   * Includes auto backup status
   */
  const fetchBackupConfig = useCallback(async () => {
    try {
      const response = await backupService.getBackupConfig();
      if (response.success && response.data) {
        setAutoBackupEnabled(response.data.autoBackupEnabled !== false);
      }
    } catch (error) {
      logger.error('[Settings] Error fetching backup config:', error);
      setAutoBackupEnabled(true);
    }
  }, []);

  /**
   * Create a new manual backup
   * Shows progress indicator and refreshes backup list on completion
   */
  const handleCreateBackup = useCallback(async () => {
    // Prevent creating backup while another operation is in progress
    if (isCreatingBackup || isRestoring || isExportingFull) {
      toast.warning('Another backup operation is in progress. Please wait.');
      return;
    }

    setIsCreatingBackup(true);
    setBackupProgress(0);

    // Simulate progress while waiting for API
    const progressInterval = setInterval(() => {
      if (isMountedRef.current) {
        setBackupProgress((prev) => {
          if (prev >= 90) {
            return 90; // Cap at 90% until API responds
          }
          return prev + Math.random() * 10;
        });
      }
    }, 500);

    try {
      toast.info('Creating backup...');
      const response = await backupService.createManualBackup('Manual backup from Settings page');
      
      clearInterval(progressInterval);
      if (isMountedRef.current) {
        setBackupProgress(100);
      }
      
      if (response.success) {
        toast.success('Backup created successfully!');
        // Refresh backup history and last backup info
        await Promise.all([fetchBackupHistory(), fetchLastBackupInfo()]);
      } else {
        throw new Error(response.message || 'Failed to create backup');
      }
    } catch (error) {
      clearInterval(progressInterval);
      logger.error('[Settings] Create backup error:', error);
      const errorMessage = error.message || 'Failed to create backup';
      toast.success(
        errorMessage.includes('in progress') ?
          'A backup is already in progress. Please wait for it to complete.' :
        errorMessage.includes('permission') || errorMessage.includes('authorized') ?
          'You do not have permission to create backups.' :
          errorMessage,
        'error'
      );
    } finally {
      setTimeout(() => {
        if (isMountedRef.current) {
          setIsCreatingBackup(false);
          setBackupProgress(0);
        }
      }, 500);
    }
  }, [isCreatingBackup, isRestoring, isExportingFull, fetchBackupHistory, fetchLastBackupInfo]);

  /**
   * Restore system from an existing backup
   * @param {string} backupId - The ID of the backup to restore from
   */
  const handleRestoreBackup = useCallback(async (backupId) => {
    if (!backupId) {
      toast.error('Invalid backup selected');
      return;
    }

    // Prevent restore while another operation is in progress
    if (isRestoring || isCreatingBackup || isExportingFull) {
      toast.warning('Another operation is in progress. Please wait.');
      return;
    }

    const backup = findBackupById(backupId);
    if (!backup) {
      toast.error('Backup not found');
      return;
    }

    const fileName = backup.filePath?.split(/[/\\]/).pop() || backup.backupId;
    const backupDate = backup.createdAt ? formatBackupDate(backup.createdAt) : 'Unknown date';
    const totalDocs = backup.metadata?.totalDocuments || 'N/A';
    
    setConfirmDialog({
      open: true,
      title: '⚠️ Restore Backup',
      message: `Are you sure you want to restore from "${fileName}"?`,
      details: `This will replace current data with the backup data.\n\nCreated: ${backupDate}\nDocuments: ${totalDocs}\n\nThis action cannot be undone!\n\nIt is HIGHLY RECOMMENDED to create a backup of current data before proceeding.`,
      severity: 'error',
      confirmText: 'Restore',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setIsRestoring(true);
        setRestoreProgress(0);

        // Simulate progress while waiting for API
        const progressInterval = setInterval(() => {
          if (isMountedRef.current) {
            setRestoreProgress((prev) => {
              if (prev >= 90) {
                return 90;
              }
              return prev + Math.random() * 8;
            });
          }
        }, 600);

        try {
          toast.info('Restoring from backup... Please wait.');
          
          console.log('[Settings] Calling restoreBackup with:', backupId);
          const response = await backupService.restoreBackup(backupId, {
            dropExisting: false,
            dryRun: false
          });
          
          console.log('[Settings] Restore response:', response);
          clearInterval(progressInterval);
          if (isMountedRef.current) {
            setRestoreProgress(100);
          }
          
          if (response && response.success) {
            const restoredDocs = response.data?.totalRestored || response.data?.totalDocuments || 0;
            toast.success(
              `System restored successfully! ${restoredDocs.toLocaleString()} documents restored.`
            );
            // Refresh data after restore
            await Promise.all([fetchBackupHistory(), fetchLastBackupInfo()]);
            
            // Suggest page reload to see restored data
            setTimeout(() => {
              setConfirmDialog({
                open: true,
                title: 'Restore Completed',
                message: 'Restore completed successfully. Would you like to refresh the page to see the restored data?',
                severity: 'info',
                confirmText: 'Refresh Page',
                onConfirm: () => {
                  window.location.reload();
                },
              });
            }, 2000);
          } else {
            throw new Error(response?.message || 'Failed to restore backup');
          }
        } catch (error) {
          clearInterval(progressInterval);
          logger.error('[Settings] Restore backup error:', error);
          const errorMessage = error.message || 'Failed to restore from backup';
          toast.error(
            errorMessage.includes('permission') || errorMessage.includes('authorized') ?
              'You do not have permission to restore backups.' :
            errorMessage.includes('not found') ?
              'Backup file not found or has been deleted.' :
            errorMessage.includes('corrupted') || errorMessage.includes('invalid') ?
              'Backup file is corrupted or invalid. Please try another backup.' :
              errorMessage
          );
        } finally {
          setTimeout(() => {
            setIsRestoring(false);
            setRestoreProgress(0);
          }, 500);
        }
      },
    });
  }, [isRestoring, isCreatingBackup, isExportingFull, findBackupById, fetchBackupHistory, fetchLastBackupInfo]);

  /**
   * Delete a backup file
   * Protected backups cannot be deleted
   * @param {string} backupId - The ID of the backup to delete
   */
  const handleDeleteBackup = useCallback(async (backupId) => {
    const backup = findBackupById(backupId);
    if (!backup) {
      toast.error('Backup not found');
      return;
    }

    // Check if backup is protected
    if (backup.isProtected) {
      toast.error('Cannot delete a protected backup. Remove protection first.');
      return;
    }

    const fileName = backup.filePath?.split(/[/\\]/).pop() || backup.backupId;
    
    setConfirmDialog({
      open: true,
      title: 'Delete Backup',
      message: `Are you sure you want to delete "${fileName}"?`,
      details: 'This action cannot be undone.',
      severity: 'error',
      confirmText: 'Delete',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          const response = await backupService.deleteBackup(backupId);
          
          if (response.success) {
            toast.success('Backup deleted successfully');
            await fetchBackupHistory();
          } else {
            throw new Error(response.message || 'Failed to delete backup');
          }
        } catch (error) {
          logger.error('[Settings] Delete backup error:', error);
          toast.error(error.message || 'Failed to delete backup');
        }
      },
    });
  }, [findBackupById, fetchBackupHistory]);

  /**
   * Download a backup file to local machine
   * @param {string} backupId - The ID of the backup to download
   */
  const handleDownloadBackup = useCallback(async (backupId) => {
    if (!backupId) {
      toast.error('Invalid backup selected');
      return;
    }

    try {
      toast.info('Preparing download...');
      const result = await backupService.downloadBackup(backupId);
      if (result && result.success) {
        toast.success(`Backup "${result.filename}" downloaded successfully!`);
      } else {
        toast.success('Backup download completed');
      }
    } catch (error) {
      logger.error('[Settings] Download backup error:', error);
      const errorMessage = error.message || 'Failed to download backup';
      toast.error(errorMessage);
    }
  }, []);

  /**
   * Toggle backup protection status
   * Protected backups are excluded from auto-deletion
   * @param {string} backupId - The ID of the backup
   * @param {boolean} currentlyProtected - Current protection status
   */
  const handleToggleProtection = useCallback(async (backupId, currentlyProtected) => {
    try {
      const response = await backupService.toggleBackupProtection(backupId, !currentlyProtected);
      
      if (response.success) {
        toast.success(
          currentlyProtected ? 'Backup protection removed' : 'Backup is now protected',
          'success'
        );
        await fetchBackupHistory();
      } else {
        throw new Error(response.message || 'Failed to toggle protection');
      }
    } catch (error) {
      logger.error('[Settings] Toggle protection error:', error);
      toast.error(error.message || 'Failed to toggle protection');
    }
  }, [fetchBackupHistory]);

  /**
   * Verify backup file integrity via checksum validation
   * @param {string} backupId - The ID of the backup to verify
   */
  const handleVerifyBackup = useCallback(async (backupId) => {
    if (!backupId) {
      toast.error('Invalid backup selected');
      return;
    }

    try {
      toast.info('Verifying backup integrity...');
      const response = await backupService.verifyBackup(backupId);
      
      if (response.success) {
        const verifyData = response.data;
        // Handle different response structures from backend
        const isValid = verifyData?.valid ?? verifyData?.isValid ?? true;
        const checksumMatch = verifyData?.checksumMatch ?? true;
        
        if (isValid && checksumMatch) {
          toast.success('✓ Backup verified successfully - integrity confirmed!');
        } else {
          const errorMsg = verifyData?.error || verifyData?.message || 'Checksum mismatch';
          toast.warning(`⚠ Backup verification failed: ${errorMsg}`);
        }
        // Refresh backup history to update verification status
        await fetchBackupHistory();
      } else {
        throw new Error(response.message || 'Verification failed');
      }
    } catch (error) {
      logger.error('[Settings] Verify backup error:', error);
      const errorMessage = error.message || 'Failed to verify backup';
      toast.success(
        errorMessage.includes('not found') ?
          'Backup file not found or has been deleted.' :
        errorMessage.includes('permission') || errorMessage.includes('authorized') ?
          'You do not have permission to verify backups.' :
          errorMessage,
        'error'
      );
    }
  }, [fetchBackupHistory]);

  /**
   * Handle file selection for backup import
   * Validates file type and size before accepting
   * @param {Event} event - The file input change event
   */
  const handleUploadBackup = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - accept .gz, .json.gz, .json files
    const validExtensions = ['.gz', '.json'];
    const isValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValid) {
      toast.error('Please upload a valid backup file (.json.gz or .gz)');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Backup file must be less than 500MB');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setSelectedBackupFile(file);
    toast.info(`Selected: ${file.name} (${formatFileSize(file.size)})`);
  }, []);

  /**
   * Import and restore from an uploaded backup file
   * Uses the backupService.importFromFile method
   */
  const handleImportBackup = useCallback(async () => {
    if (!selectedBackupFile) {
      toast.error('Please select a backup file first');
      return;
    }

    // Validate file size
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (selectedBackupFile.size > maxSize) {
      toast.error('File too large. Maximum size is 500MB');
      return;
    }

    setConfirmDialog({
      open: true,
      title: '⚠️ Restore Uploaded Backup',
      message: 'Are you sure you want to restore from this uploaded backup?',
      details: `File: ${selectedBackupFile.name}\nSize: ${formatFileSize(selectedBackupFile.size)}\n\nThis will import data from the backup file.\nExisting data will be merged with the backup data.\n\nThis operation may take several minutes for large backups.\n\nPROCEED WITH CAUTION!`,
      severity: 'error',
      confirmText: 'Restore',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setIsRestoring(true);
        setRestoreProgress(0);

        // Simulate progress while waiting for API
        const progressInterval = setInterval(() => {
          if (isMountedRef.current) {
            setRestoreProgress((prev) => {
              if (prev >= 90) return 90;
              return prev + Math.random() * 5;
            });
          }
        }, 800);

        try {
          toast.info('Importing backup file... This may take a while.');
          
          const response = await backupService.importFromFile(selectedBackupFile, {
            dropExisting: false
          });
          
          clearInterval(progressInterval);
          if (isMountedRef.current) {
            setRestoreProgress(100);
          }

          if (response.success) {
            const totalDocs = response.data?.totalDocuments || 0;
            const collectionsCount = response.data?.collectionsRestored?.length || 0;
            toast.success(
              `Import completed! ${totalDocs.toLocaleString()} documents restored across ${collectionsCount} collections.`
            );
            // Clear selected file and reset input
            setSelectedBackupFile(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            // Refresh backup history and last backup info
            await Promise.all([fetchBackupHistory(), fetchLastBackupInfo()]);
            
            // Suggest page refresh to see updated data
            setTimeout(() => {
              setConfirmDialog({
                open: true,
                title: 'Import Completed',
                message: 'Data has been imported successfully. Would you like to refresh the page to see the latest data?',
                severity: 'info',
                confirmText: 'Refresh Page',
                onConfirm: () => {
                  window.location.reload();
                },
              });
            }, 2000);
          } else {
            throw new Error(response.message || 'Import failed');
          }
        } catch (error) {
          clearInterval(progressInterval);
          logger.error('[Settings] Import backup error:', error);
          const errorMessage = error.message || 'Failed to import backup';
          toast.error(
            errorMessage.includes('permission') || errorMessage.includes('authorized') ?
              'You do not have permission to perform this action.' :
            errorMessage.includes('file') || errorMessage.includes('parse') ?
              'Invalid backup file format. Please ensure the file is a valid backup.' :
              errorMessage
          );
        } finally {
          setTimeout(() => {
            if (isMountedRef.current) {
              setIsRestoring(false);
              setRestoreProgress(0);
            }
          }, 500);
        }
      },
    });
  }, [selectedBackupFile, fetchBackupHistory, fetchLastBackupInfo]);

  /**
   * Toggle automatic backup scheduling
   * @param {boolean} enabled - Whether to enable or disable auto backups
   */
  const handleToggleAutoBackup = useCallback(async (enabled) => {
    try {
      const response = await backupService.updateBackupConfig({
        autoBackupEnabled: enabled
      });
      
      if (response.success) {
        setAutoBackupEnabled(enabled);
        toast.success(
          enabled ? 'Automatic backups enabled' : 'Automatic backups disabled',
          'success'
        );
      } else {
        throw new Error(response.message || 'Failed to update settings');
      }
    } catch (error) {
      logger.error('[Settings] Toggle auto backup error:', error);
      toast.error(error.message || 'Failed to update backup settings');
      setAutoBackupEnabled(!enabled);
    }
  }, []);

  /**
   * Reset backup configuration to defaults
   */
  const handleResetBackupConfig = useCallback(async () => {
    setConfirmDialog({
      open: true,
      title: 'Reset Backup Configuration',
      message: 'Are you sure you want to reset the backup configuration?',
      details: 'This will:\n• Reset backup settings to defaults\n• Enable auto backup (daily at 2:00 AM)\n• Set retention to 30 days\n\nExisting backup files will NOT be deleted.',
      severity: 'warning',
      confirmText: 'Reset',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setIsResettingConfig(true);
    try {
      const response = await backupService.updateBackupConfig({
        autoBackupEnabled: true,
        frequency: 'daily',
        retentionDays: 30,
        maxBackups: 50
      });

      if (response.success) {
        setAutoBackupEnabled(true);
        await Promise.all([fetchBackupHistory(), fetchLastBackupInfo(), fetchBackupConfig()]);
        toast.success('Backup configuration reset successfully');
      } else {
        throw new Error(response.message || 'Failed to reset configuration');
      }
    } catch (error) {
      logger.error('[Settings] Reset backup config error:', error);
      toast.error(error.message || 'Failed to reset backup configuration');
    } finally {
      setIsResettingConfig(false);
    }
      },
    });
  }, [fetchBackupHistory, fetchLastBackupInfo, fetchBackupConfig]);

  /**
   * Cleanup old backups based on retention policy
   */
  const handleCleanupBackups = useCallback(async () => {
    setConfirmDialog({
      open: true,
      title: '🧹 Cleanup Old Backups',
      message: 'Are you sure you want to cleanup old backups?',
      details: 'This will remove:\n• Backups older than retention period\n• Failed/corrupted backup files\n\nProtected backups will NOT be deleted.',
      severity: 'warning',
      confirmText: 'Cleanup',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setIsCleaningUp(true);
        try {
          toast.info('Cleaning up old backups...');
          const response = await backupService.triggerCleanup();
          
          if (response.success) {
            const deletedCount = response.data?.deletedCount || 0;
            const freedSpace = response.data?.freedSpace || 0;
            
            if (deletedCount === 0) {
              toast.info('No old backups found to clean up.');
            } else {
              toast.success(
                `Cleanup complete! Removed ${deletedCount} backup(s), freed ${formatFileSize(freedSpace)}`
              );
            }
            await fetchBackupHistory();
          } else {
            throw new Error(response.message || 'Cleanup failed');
          }
        } catch (error) {
          logger.error('[Settings] Cleanup backups error:', error);
          const errorMessage = error.message || 'Failed to cleanup backups';
          toast.error(
            errorMessage.includes('permission') || errorMessage.includes('authorized') ?
              'You do not have permission to perform this action.' :
              errorMessage
          );
        } finally {
          setIsCleaningUp(false);
        }
      },
    });
  }, [fetchBackupHistory]);

  /**
   * Create a full database export for local/external storage (HDD)
   */
  const handleExportFullBackup = useCallback(async () => {
    setConfirmDialog({
      open: true,
      title: '💾 Create Full Database Export',
      message: 'Are you sure you want to create a full database export?',
      details: 'This will create a complete backup including:\n• All database collections\n• All uploaded files (photos, documents)\n\nThe file will be downloaded for external storage (USB/HDD).\nThis process may take several minutes for large databases.',
      severity: 'info',
      confirmText: 'Export',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setIsExportingFull(true);
        setBackupProgress(0);

        const progressInterval = setInterval(() => {
          if (isMountedRef.current) {
            setBackupProgress((prev) => (prev >= 90 ? 90 : prev + Math.random() * 8));
          }
        }, 600);

        try {
          toast.info('Creating full database export...');
          
          const response = await backupService.exportFullDatabase({
            includeGridFSFiles: true,
            notes: 'Full export for external storage'
          });
          
          clearInterval(progressInterval);
          if (isMountedRef.current) {
            setBackupProgress(100);
          }

          if (response.success && response.data?.exportId) {
            toast.info('Export created! Starting download...');
            
            try {
              await backupService.downloadFullExport(response.data.exportId);
              const size = response.data.formattedSize || response.data.fileSize ? 
                `${(response.data.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'N/A';
              toast.success(`Full backup exported and downloaded successfully! (${size})`);
              await fetchBackupHistory();
            } catch (downloadError) {
              logger.error('[Settings] Download error:', downloadError);
              toast.warning('Export created but download failed. Please try downloading from backup history.');
            }
          } else {
            throw new Error(response.message || 'Export failed');
          }
        } catch (error) {
          clearInterval(progressInterval);
          logger.error('[Settings] Full export error:', error);
          const errorMessage = error.message || 'Failed to create full export';
          toast.error(
            errorMessage.includes('permission') || errorMessage.includes('authorized') ?
              'You do not have permission to perform this action.' :
              errorMessage
          );
        } finally {
          setTimeout(() => {
            if (isMountedRef.current) {
              setIsExportingFull(false);
              setBackupProgress(0);
            }
          }, 500);
        }
      },
    });
  }, [fetchBackupHistory]);

  /**
   * Open download selection dialog
   */
  const handleOpenDownloadDialog = useCallback(() => {
    if (backupHistory.length === 0) {
      toast.warning('No backups available to download');
      return;
    }
    setSelectedDownloadBackup(backupHistory[0]?.backupId || null);
    setDownloadDialogOpen(true);
  }, [backupHistory]);

  /**
   * Handle download from dialog selection
   */
  const handleConfirmDownload = useCallback(async () => {
    if (!selectedDownloadBackup) {
      toast.error('Please select a backup to download');
      return;
    }
    
    setDownloadDialogOpen(false);
    try {
      toast.info('Preparing download...');
      const result = await backupService.downloadBackup(selectedDownloadBackup);
      if (result.success) {
        toast.success(`Backup "${result.filename}" downloaded successfully!`);
      }
    } catch (error) {
      logger.error('[Settings] Download backup error:', error);
      toast.error(error.message || 'Failed to download backup');
    }
  }, [selectedDownloadBackup]);

  // Load existing fare matrix on mount
  useEffect(() => {
    fetchFareMatrix();
  }, [fetchFareMatrix]);

  // Load page access configuration on mount
  useEffect(() => {
    fetchAllPageAccess();
  }, [fetchAllPageAccess]);

  // Load backup data when backup tab is active
  useEffect(() => {
    if (activeTab === 2) {
      fetchBackupHistory();
      fetchLastBackupInfo();
      fetchBackupConfig();
    }
  }, [activeTab, fetchBackupHistory, fetchLastBackupInfo, fetchBackupConfig]);

  const permissionStats = useMemo(() => {
    const totalPages = PAGE_ACCESS_CONFIG.reduce((sum, cat) => sum + cat.pages.length, 0);
    
    // Super admin always has all pages
    if (selectedRole === 'super-admin') {
      return { granted: totalPages, total: totalPages };
    }
    
    const rolePages = pageAccess[selectedRole] || [];
    
    return { granted: rolePages.length, total: totalPages };
  }, [pageAccess, selectedRole]);

  return (
    <div className="settings-container">
      <Sidebar />
      
      <AnimatedPage component="main" className="settings-content">
        <AnimatedSection index={0}>
          <header className="settings-header">
            <Typography variant="h4" className="page-title">
              System Settings
            </Typography>
          </header>
        </AnimatedSection>

        {error && (
          <Alert severity="error" className="error-alert" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <AnimatedSection index={1}>
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
        </AnimatedSection>

        <AnimatedSection index={2}>
          <Box className="tab-content">
          {/* Fare Matrix Tab */}
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

          {/* Permission Control Tab */}
          {activeTab === 1 && (
            <div className="permission-control-tab">
              {loadingPageAccess ? (
                <PageLoader 
                  loading={loadingPageAccess} 
                  message="Loading permissions..."
                  minHeight={400}
                />
              ) : (
                <Fade in={!loadingPageAccess} timeout={400}>
                <Box>
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
                </Box>
                </Fade>
              )}
            </div>
          )}

          {/* Backup & Recovery Tab */}
          {activeTab === 2 && (
            <div className="backup-recovery-tab">
              {/* Progress Overlay */}
              {(isCreatingBackup || isRestoring || isExportingFull) && (
                <Box className="backup-progress-overlay">
                  <Paper className="progress-modal" elevation={3}>
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                      {isExportingFull ? (
                        <SaveAltIcon sx={{ fontSize: 60, color: '#7c3aed', mb: 2 }} />
                      ) : isCreatingBackup ? (
                        <BackupIcon sx={{ fontSize: 60, color: '#0A356B', mb: 2 }} />
                      ) : (
                        <RestoreIcon sx={{ fontSize: 60, color: '#059669', mb: 2 }} />
                      )}
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                        {isExportingFull ? 'Exporting Full Backup...' : isCreatingBackup ? 'Creating Backup...' : 'Restoring System...'}
                      </Typography>
                      <Box sx={{ width: '100%', mb: 2 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={isCreatingBackup || isExportingFull ? backupProgress : restoreProgress} 
                          sx={{ 
                            height: 10, 
                            borderRadius: 5,
                            backgroundColor: '#e2e8f0',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: isExportingFull ? '#7c3aed' : isCreatingBackup ? '#0A356B' : '#059669',
                            }
                          }}
                        />
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        {Math.round(isCreatingBackup || isExportingFull ? backupProgress : restoreProgress)}% Complete
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
                          {lastBackupTime || 'No backups yet'}
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
                          {loadingBackups ? (
                            <CircularProgress size={20} />
                          ) : (
                            `${backupStats.totalBackups} Files (${formatFileSize(backupStats.totalSize)})`
                          )}
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
                        onChange={(e) => handleToggleAutoBackup(e.target.checked)}
                        color="primary"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </div>

              {/* Action Cards */}
              <div className="backup-action-grid">
                {/* Create Backup Card */}
                <Paper className="backup-action-card create-backup" elevation={0}>
                  <Box className="action-card-header">
                    <Box className="action-icon-bg primary">
                      <BackupIcon sx={{ fontSize: 28, color: '#0A356B' }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#0A356B', lineHeight: 1.2 }}>
                        Create Backup
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Server-side backup
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                    Create a complete backup of the database including all records, user accounts, and system configurations.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={isCreatingBackup ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                    onClick={handleCreateBackup}
                    disabled={isCreatingBackup || isRestoring || isExportingFull}
                    fullWidth
                    className="backup-action-btn primary"
                  >
                    {isCreatingBackup ? 'Creating Backup...' : 'Create Backup Now'}
                  </Button>
                </Paper>

                {/* Local Backup (Full Export) Card */}
                <Paper className="backup-action-card local-backup" elevation={0}>
                  <Box className="action-card-header">
                    <Box className="action-icon-bg purple">
                      <SaveAltIcon sx={{ fontSize: 28, color: '#7c3aed' }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#7c3aed', lineHeight: 1.2 }}>
                        Local Backup
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Export to external storage
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                    Export complete database with all files for external storage (USB drive, hard disk, or cloud storage).
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={isExportingFull ? <CircularProgress size={20} color="inherit" /> : <SaveAltIcon />}
                    onClick={handleExportFullBackup}
                    disabled={isCreatingBackup || isRestoring || isExportingFull}
                    fullWidth
                    className="backup-action-btn purple"
                  >
                    {isExportingFull ? 'Exporting...' : 'Export to Device'}
                  </Button>
                </Paper>

                {/* Upload Backup Card */}
                <Paper className="backup-action-card restore-backup" elevation={0}>
                  <Box className="action-card-header">
                    <Box className="action-icon-bg success">
                      <RestoreIcon sx={{ fontSize: 28, color: '#059669' }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>
                        Restore from File
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Import external backup
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                    Upload and restore from an external backup file (.json.gz, .gz format).
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <input
                      ref={fileInputRef}
                      accept=".gz,.json"
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
                        sx={{ mb: 1, borderStyle: 'dashed', py: 1.5 }}
                        className="backup-select-btn"
                      >
                        Select Backup File
                      </Button>
                    </label>
                    {selectedBackupFile && (
                      <Box className="selected-backup-file" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon sx={{ fontSize: 16, color: '#16a34a' }} />
                        <Typography variant="body2" sx={{ color: '#166534', fontWeight: 500 }}>
                          {selectedBackupFile.name} ({formatFileSize(selectedBackupFile.size)})
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  
                  <Button
                    variant="contained"
                    startIcon={isRestoring ? <CircularProgress size={20} color="inherit" /> : <CloudDownloadIcon />}
                    onClick={handleImportBackup}
                    disabled={!selectedBackupFile || isRestoring || isCreatingBackup}
                    fullWidth
                    className="backup-action-btn success"
                  >
                    {isRestoring ? 'Restoring...' : 'Restore from Upload'}
                  </Button>
                </Paper>
              </div>

              {/* Quick Actions Bar */}
              <Paper className="backup-quick-actions" elevation={0} sx={{ position: 'relative' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 'auto' }}>
                  <SettingsIcon sx={{ fontSize: 18, color: '#64748b' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569' }}>
                    Quick Actions
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CloudDownloadIcon />}
                  onClick={handleOpenDownloadDialog}
                  disabled={backupHistory.length === 0 || isRestoring || isCreatingBackup}
                  className="quick-action-btn download"
                  sx={{ fontWeight: 600, textTransform: 'none' }}
                >
                  Download Backup
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={isCleaningUp ? <CircularProgress size={16} /> : <CleaningServicesIcon />}
                  onClick={handleCleanupBackups}
                  disabled={isCleaningUp || isRestoring || isCreatingBackup}
                  className="quick-action-btn cleanup"
                  sx={{ fontWeight: 600, textTransform: 'none' }}
                >
                  {isCleaningUp ? 'Cleaning...' : 'Cleanup Old'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={isResettingConfig ? <CircularProgress size={16} /> : <RefreshIcon />}
                  onClick={handleResetBackupConfig}
                  disabled={isResettingConfig || isRestoring || isCreatingBackup}
                  className="quick-action-btn reset"
                  sx={{ fontWeight: 600, textTransform: 'none' }}
                >
                  {isResettingConfig ? 'Resetting...' : 'Reset Config'}
                </Button>
              </Paper>

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

                {loadingBackups ? (
                  <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                    <CircularProgress />
                  </Box>
                ) : backupHistory.length === 0 ? (
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
                    {backupHistory.map((backup) => {
                      const fileName = backup.filePath?.split(/[/\\]/).pop() || backup.backupId;
                      const typeColor = getBackupTypeColor(backup.backupType);
                      const createdByName = backup.initiatedBy?.adminName || 
                        (backup.backupType === 'automatic' ? 'System (Scheduled)' : 'Unknown');
                      
                      return (
                        <Box key={backup.backupId || backup._id} className="backup-history-item">
                          <Box className="backup-item-info">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box className={`backup-type-icon ${backup.backupType}`}>
                                {backup.backupType === 'automatic' ? <ScheduleIcon /> : 
                                 backup.backupType === 'emergency' ? <WarningIcon /> :
                                 backup.backupType === 'pre-update' ? <CloudUploadIcon /> :
                                 <BackupIcon />}
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                    {fileName}
                                  </Typography>
                                  {backup.isProtected && (
                                    <Tooltip title="Protected from auto-deletion">
                                      <LockIcon sx={{ fontSize: 16, color: '#d97706' }} />
                                    </Tooltip>
                                  )}
                                  {backup.status === 'completed' && (
                                    <Tooltip title="Backup completed successfully">
                                      <CheckCircleIcon sx={{ fontSize: 16, color: '#16a34a' }} />
                                    </Tooltip>
                                  )}
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
                                  <Typography variant="caption" color="textSecondary">
                                    {formatBackupDate(backup.createdAt)}
                                  </Typography>
                                  <Chip 
                                    label={formatFileSize(backup.fileSize)} 
                                    size="small" 
                                    sx={{ 
                                      height: 20, 
                                      fontSize: '11px',
                                      backgroundColor: '#f1f5f9',
                                      color: '#64748b'
                                    }} 
                                  />
                                  <Chip 
                                    label={getBackupTypeLabel(backup.backupType)} 
                                    size="small" 
                                    sx={{ 
                                      height: 20, 
                                      fontSize: '11px',
                                      backgroundColor: typeColor.bg,
                                      color: typeColor.text
                                    }} 
                                  />
                                  {backup.metadata?.totalDocuments && (
                                    <Chip 
                                      label={`${backup.metadata.totalDocuments.toLocaleString()} docs`} 
                                      size="small" 
                                      sx={{ 
                                        height: 20, 
                                        fontSize: '11px',
                                        backgroundColor: '#f0fdf4',
                                        color: '#15803d'
                                      }} 
                                    />
                                  )}
                                </Box>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                                  Created by: {createdByName}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                          <Box className="backup-item-actions">
                            <Tooltip title="Verify Backup Integrity">
                              <IconButton 
                                onClick={() => handleVerifyBackup(backup.backupId)}
                                className="backup-item-btn verify"
                                disabled={isRestoring || isCreatingBackup}
                                size="small"
                              >
                                <VerifiedIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={backup.isProtected ? 'Remove Protection' : 'Protect Backup'}>
                              <IconButton 
                                onClick={() => handleToggleProtection(backup.backupId, backup.isProtected)}
                                className="backup-item-btn protect"
                                disabled={isRestoring || isCreatingBackup}
                                size="small"
                              >
                                {backup.isProtected ? <LockOpenIcon /> : <LockIcon />}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Download Backup">
                              <IconButton 
                                onClick={() => handleDownloadBackup(backup.backupId)}
                                className="backup-item-btn download"
                                disabled={isRestoring || isCreatingBackup}
                                size="small"
                              >
                                <CloudDownloadIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Restore from this Backup">
                              <IconButton 
                                onClick={() => handleRestoreBackup(backup.backupId)}
                                className="backup-item-btn restore"
                                disabled={isRestoring || isCreatingBackup}
                                size="small"
                              >
                                <RestoreIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={backup.isProtected ? 'Cannot delete protected backup' : 'Delete Backup'}>
                              <span>
                                <IconButton 
                                  onClick={() => handleDeleteBackup(backup.backupId)}
                                  className="backup-item-btn delete"
                                  disabled={isRestoring || isCreatingBackup || backup.isProtected}
                                  size="small"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        </Box>
                      );
                    })}
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
        </AnimatedSection>
      </AnimatedPage>

      {/* Download Backup Selection Dialog */}
      <Dialog 
        open={downloadDialogOpen} 
        onClose={() => setDownloadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, overflow: 'hidden' }
        }}
      >
        <DialogTitle 
          sx={{ 
            background: 'linear-gradient(135deg, #0A356B 0%, #1e4b8e 100%)',
            color: 'white',
            display: 'flex', 
            alignItems: 'center', 
            gap: 1.5,
            py: 2.5
          }}
        >
          <Box sx={{ 
            backgroundColor: 'rgba(255,255,255,0.15)', 
            borderRadius: 2, 
            p: 1, 
            display: 'flex' 
          }}>
            <CloudDownloadIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Download Backup
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              Select a backup file to download
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {backupHistory.map((backup) => {
              const fileName = backup.filePath?.split(/[/\\]/).pop() || backup.backupId;
              const typeColor = getBackupTypeColor(backup.backupType);
              const isSelected = selectedDownloadBackup === backup.backupId;
              return (
                <ListItem key={backup.backupId} disablePadding divider>
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => setSelectedDownloadBackup(backup.backupId)}
                    sx={{ 
                      py: 2,
                      borderLeft: isSelected ? '4px solid #0A356B' : '4px solid transparent',
                      backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                      '&:hover': {
                        backgroundColor: isSelected ? '#eff6ff' : '#f8fafc'
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 44 }}>
                      <Radio
                        checked={isSelected}
                        value={backup.backupId}
                        size="small"
                        sx={{ 
                          color: '#0A356B',
                          '&.Mui-checked': { color: '#0A356B' }
                        }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                            {fileName}
                          </Typography>
                          {backup.isProtected && (
                            <Tooltip title="Protected backup">
                              <LockIcon sx={{ fontSize: 14, color: '#d97706' }} />
                            </Tooltip>
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant="caption" color="textSecondary">
                            {formatBackupDate(backup.createdAt)}
                          </Typography>
                          <Chip 
                            label={formatFileSize(backup.fileSize)} 
                            size="small" 
                            sx={{ 
                              height: 20, 
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: '#f1f5f9',
                              color: '#475569'
                            }} 
                          />
                          <Chip 
                            label={getBackupTypeLabel(backup.backupType)} 
                            size="small" 
                            sx={{ 
                              height: 20, 
                              fontSize: '11px', 
                              fontWeight: 600,
                              backgroundColor: typeColor.bg, 
                              color: typeColor.text 
                            }} 
                          />
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <Button 
            onClick={() => setDownloadDialogOpen(false)} 
            sx={{ color: '#64748b', fontWeight: 600, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleConfirmDownload}
            disabled={!selectedDownloadBackup}
            startIcon={<CloudDownloadIcon />}
            sx={{ 
              backgroundColor: '#0A356B',
              fontWeight: 600,
              textTransform: 'none',
              px: 3,
              '&:hover': { backgroundColor: '#083057' }
            }}
          >
            Download Selected
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        details={confirmDialog.details}
        severity={confirmDialog.severity}
        confirmText={confirmDialog.confirmText}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}

export default Settings;

