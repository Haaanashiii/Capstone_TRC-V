// Backup Service API
// Provides backup and recovery operations for the TRC-V system

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';

/**
 * Get authorization headers with access token
 * Uses sessionStorage for security (XSS protection)
 * @returns {Object} Headers object with Content-Type and Authorization
 */
const getAuthHeaders = () => {
  // Check sessionStorage first (preferred), fallback to localStorage for legacy support
  const token = sessionStorage.getItem('accessToken') || 
                localStorage.getItem('accessToken') || 
                localStorage.getItem('token');
  
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

/**
 * Handle API response with consistent error handling
 * @param {Response} response - Fetch API response
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} If response is not ok
 */
const handleResponse = async (response) => {
  const data = await response.json();
  
  if (!response.ok) {
    // Handle specific error cases
    if (response.status === 401) {
      throw new Error('Session expired. Please log in again.');
    }
    if (response.status === 403) {
      throw new Error('You do not have permission to perform this action.');
    }
    if (response.status === 404) {
      throw new Error(data.message || 'Resource not found.');
    }
    throw new Error(data.message || data.error || 'An error occurred');
  }
  
  return data;
};

/**
 * Get backup system status
 */
export const getBackupStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/api/backup/status`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse(response);
};

/**
 * Get last backup info
 */
export const getLastBackupInfo = async () => {
  const response = await fetch(`${API_BASE_URL}/api/backup/last`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse(response);
};

/**
 * Get backup history
 */
export const getBackupHistory = async (options = {}) => {
  const { type, status, limit = 50, page = 1 } = options;
  const params = new URLSearchParams();
  if (type) params.append('type', type);
  if (status) params.append('status', status);
  params.append('limit', limit.toString());
  params.append('page', page.toString());
  
  const response = await fetch(`${API_BASE_URL}/api/backup/history?${params}`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse(response);
};

/**
 * Create manual backup
 */
export const createManualBackup = async (notes = '') => {
  const response = await fetch(`${API_BASE_URL}/api/backup/create`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ notes })
  });
  return handleResponse(response);
};

/**
 * Create emergency backup
 */
export const createEmergencyBackup = async (notes = '') => {
  const response = await fetch(`${API_BASE_URL}/api/backup/emergency`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ notes })
  });
  return handleResponse(response);
};

/**
 * Create pre-update backup
 */
export const createPreUpdateBackup = async (updateDescription = '') => {
  const response = await fetch(`${API_BASE_URL}/api/backup/pre-update`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ updateDescription })
  });
  return handleResponse(response);
};

/**
 * Get backup details
 */
export const getBackupDetails = async (backupId) => {
  const response = await fetch(`${API_BASE_URL}/api/backup/${backupId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse(response);
};

/**
 * Verify backup integrity
 */
export const verifyBackup = async (backupId) => {
  const response = await fetch(`${API_BASE_URL}/api/backup/${backupId}/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse(response);
};

/**
 * Restore from backup
 */
export const restoreBackup = async (backupId, options = {}) => {
  const { collections, dropExisting = false, dryRun = false } = options;
  const response = await fetch(`${API_BASE_URL}/api/backup/${backupId}/restore`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ collections, dropExisting, dryRun })
  });
  return handleResponse(response);
};

/**
 * Toggle backup protection
 */
export const toggleBackupProtection = async (backupId, isProtected) => {
  const response = await fetch(`${API_BASE_URL}/api/backup/${backupId}/protection`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ isProtected })
  });
  return handleResponse(response);
};

/**
 * Delete backup
 */
export const deleteBackup = async (backupId) => {
  const response = await fetch(`${API_BASE_URL}/api/backup/${backupId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse(response);
};

/**
 * Download backup file
 */
export const downloadBackup = async (backupId) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/backup/${backupId}/download`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Download failed');
  }
  
  // Get filename from Content-Disposition header or use default
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = `backup-${backupId}.json.gz`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?(.+)"?/);
    if (match) filename = match[1];
  }
  
  // Create blob and download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
  
  return { success: true, filename };
};

/**
 * Get backup configuration
 */
export const getBackupConfig = async () => {
  const response = await fetch(`${API_BASE_URL}/api/backup/config`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse(response);
};

/**
 * Update backup configuration
 */
export const updateBackupConfig = async (config) => {
  const response = await fetch(`${API_BASE_URL}/api/backup/config`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(config)
  });
  return handleResponse(response);
};

/**
 * Trigger backup cleanup
 */
export const triggerCleanup = async (type = null) => {
  const response = await fetch(`${API_BASE_URL}/api/backup/cleanup`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ type })
  });
  return handleResponse(response);
};

// ==========================================
// DATABASE STATS & HEALTH MONITORING
// ==========================================

/**
 * Get database storage statistics
 */
export const getDatabaseStats = async () => {
  const response = await fetch(`${API_BASE_URL}/api/backup/stats`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse(response);
};

/**
 * Get database health status
 */
export const getHealthStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/api/backup/health`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse(response);
};

/**
 * Run manual health check
 */
export const runHealthCheck = async () => {
  const response = await fetch(`${API_BASE_URL}/api/backup/health/check`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse(response);
};

/**
 * Trigger manual recovery from last good backup
 */
export const triggerRecovery = async (backupId = null) => {
  const response = await fetch(`${API_BASE_URL}/api/backup/recover`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ backupId })
  });
  return handleResponse(response);
};

// ==========================================
// DATA ARCHIVAL FUNCTIONS
// ==========================================

/**
 * Preview what data would be archived (dry run)
 * @param {Object} options - Archive options
 * @param {number} options.olderThanYears - Archive data older than this many years
 * @param {Array} options.collections - Specific collections to check
 * @param {string} options.dateField - Date field to use for filtering
 */
export const previewArchive = async (options = {}) => {
  const { olderThanYears = 10, collections, dateField = 'createdAt' } = options;
  const response = await fetch(`${API_BASE_URL}/api/backup/archive/preview`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ olderThanYears, collections, dateField })
  });
  return handleResponse(response);
};

/**
 * Archive old data and optionally delete from database
 * @param {Object} options - Archive options
 * @param {number} options.olderThanYears - Archive data older than this many years
 * @param {boolean} options.deleteAfterArchive - Remove data from DB after archiving
 * @param {Array} options.collections - Specific collections to archive
 * @param {string} options.dateField - Date field to use for filtering
 * @param {string} options.notes - Notes about the archive
 */
export const archiveOldData = async (options = {}) => {
  const { 
    olderThanYears = 10, 
    deleteAfterArchive = false, 
    collections, 
    dateField = 'createdAt',
    notes 
  } = options;
  const response = await fetch(`${API_BASE_URL}/api/backup/archive`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ olderThanYears, deleteAfterArchive, collections, dateField, notes })
  });
  return handleResponse(response);
};

/**
 * Get archive history
 */
export const getArchiveHistory = async (options = {}) => {
  const { limit = 20, page = 1 } = options;
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('page', page.toString());
  
  const response = await fetch(`${API_BASE_URL}/api/backup/archive/history?${params}`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  return handleResponse(response);
};

/**
 * Restore data from an archive back to the database
 * @param {string} archiveId - The archive ID to restore from
 * @param {Object} options - Restore options
 * @param {Array} options.collections - Specific collections to restore
 * @param {boolean} options.skipExisting - Skip documents that already exist
 */
export const restoreFromArchive = async (archiveId, options = {}) => {
  const { collections, skipExisting = true } = options;
  const response = await fetch(`${API_BASE_URL}/api/backup/archive/${archiveId}/restore`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ collections, skipExisting })
  });
  return handleResponse(response);
};

// ==========================================
// FULL EXPORT/IMPORT FOR EXTERNAL STORAGE (HDD)
// ==========================================

/**
 * Create a full database export for saving to external storage (Hard Disk)
 * This includes ALL data and uploaded files (photos, documents via GridFS)
 * 
 * @param {Object} options - Export options
 * @param {boolean} options.includeGridFSFiles - Include uploaded files (default: true)
 * @param {string} options.notes - Notes about the export
 */
export const exportFullDatabase = async (options = {}) => {
  const { includeGridFSFiles = true, notes = '' } = options;
  const response = await fetch(`${API_BASE_URL}/api/backup/export-full`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ includeGridFSFiles, notes })
  });
  return handleResponse(response);
};

/**
 * Download the full export file to save to Hard Disk
 * @param {string} exportId - The export ID to download
 */
export const downloadFullExport = async (exportId) => {
  const token = sessionStorage.getItem('accessToken') || 
                localStorage.getItem('accessToken') || 
                localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE_URL}/api/backup/export/${exportId}/download`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Download failed');
  }
  
  // Get filename from Content-Disposition header or use default
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = `full-export-${exportId}.json.gz`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?(.+)"?/);
    if (match) filename = match[1];
  }
  
  // Create blob and download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
  
  return { success: true, filename };
};

/**
 * Import database from an external backup file (from Hard Disk)
 * Uses FormData for file upload
 * @param {File} file - The backup file to import
 * @param {Object} options - Import options
 * @param {boolean} options.dropExisting - Whether to clear existing data before import
 * @param {Array} options.collections - Specific collections to import
 */
export const importFromFile = async (file, options = {}) => {
  const { dropExisting = false, collections } = options;
  const token = sessionStorage.getItem('accessToken') || 
                localStorage.getItem('accessToken') || 
                localStorage.getItem('token');
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('dropExisting', dropExisting.toString());
  if (collections && collections.length > 0) {
    formData.append('collections', JSON.stringify(collections));
  }
  
  const response = await fetch(`${API_BASE_URL}/api/backup/import`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    credentials: 'include',
    body: formData
  });
  
  return handleResponse(response);
};

export default {
  // Status & Info
  getBackupStatus,
  getLastBackupInfo,
  getBackupHistory,
  getBackupConfig,
  updateBackupConfig,
  getBackupDetails,
  
  // Backup Creation
  createManualBackup,
  createEmergencyBackup,
  createPreUpdateBackup,
  
  // Backup Operations
  verifyBackup,
  restoreBackup,
  toggleBackupProtection,
  deleteBackup,
  downloadBackup,
  triggerCleanup,
  
  // Database Stats & Health
  getDatabaseStats,
  getHealthStatus,
  runHealthCheck,
  triggerRecovery,
  
  // Archive Functions
  previewArchive,
  archiveOldData,
  getArchiveHistory,
  restoreFromArchive,
  
  // Full Export/Import
  exportFullDatabase,
  downloadFullExport,
  importFromFile
};
