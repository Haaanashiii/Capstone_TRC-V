// Backup Service API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170';

/**
 * Get authorization headers
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

/**
 * Handle API response
 */
const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'An error occurred');
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

export default {
  getBackupStatus,
  getLastBackupInfo,
  getBackupHistory,
  createManualBackup,
  createEmergencyBackup,
  createPreUpdateBackup,
  getBackupDetails,
  verifyBackup,
  restoreBackup,
  toggleBackupProtection,
  deleteBackup,
  downloadBackup,
  getBackupConfig,
  updateBackupConfig,
  triggerCleanup
};
