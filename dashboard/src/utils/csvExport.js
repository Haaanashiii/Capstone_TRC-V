/**
 * CSV Export Utilities for CAPSTONE_TRC-V
 * Provides secure CSV generation with formula injection protection
 * 
 * Features:
 * - Prevents CSV formula injection attacks (=, +, -, @, etc.)
 * - Proper CSV escaping for special characters
 * - UTF-8 BOM for Excel compatibility
 * - Date-stamped filenames
 */

/**
 * Sanitize a value for CSV to prevent formula injection
 * Prefixes dangerous characters with a single quote to neutralize formulas
 * @param {any} value - The value to sanitize
 * @returns {string} Sanitized string safe for CSV
 */
export function sanitizeCSVValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // Characters that can trigger formula execution in spreadsheet applications
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r', '\n', '|', '%'];
  
  // If the value starts with a dangerous character, prefix with single quote
  if (dangerousChars.some(char => stringValue.startsWith(char))) {
    return `'${stringValue}`;
  }
  
  return stringValue;
}

/**
 * Escape a CSV field value properly
 * Handles quotes, commas, and newlines
 * @param {any} value - The value to escape
 * @returns {string} Properly escaped CSV field
 */
export function escapeCSVField(value) {
  const sanitized = sanitizeCSVValue(value);
  
  // If the value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n') || sanitized.includes('\r')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  
  return sanitized;
}

/**
 * Convert an array of objects to a secure CSV string
 * @param {Array<Object>} data - Array of objects to convert
 * @param {Array<string>} [headers] - Optional custom headers (uses object keys if not provided)
 * @returns {string} CSV string with UTF-8 BOM
 */
export function arrayToCSV(data, headers = null) {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }
  
  // Use provided headers or extract from first object
  const csvHeaders = headers || Object.keys(data[0]);
  
  // Build CSV rows
  const headerRow = csvHeaders.map(h => escapeCSVField(h)).join(',');
  
  const dataRows = data.map(row => 
    csvHeaders.map(header => escapeCSVField(row[header])).join(',')
  );
  
  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  return BOM + [headerRow, ...dataRows].join('\n');
}

/**
 * Download data as a CSV file
 * @param {Array<Object>} data - Array of objects to export
 * @param {string} filename - Filename without extension
 * @param {Array<string>} [headers] - Optional custom headers
 */
export function downloadCSV(data, filename, headers = null) {
  if (!data || data.length === 0) {
    console.warn('[CSV Export] No data to export');
    return;
  }
  
  const csvContent = arrayToCSV(data, headers);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  // Generate filename with date stamp
  const dateStamp = new Date().toISOString().split('T')[0];
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fullFilename = `${sanitizedFilename}_${dateStamp}.csv`;
  
  // Create and trigger download
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fullFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Cleanup
  URL.revokeObjectURL(url);
}

/**
 * Export audit logs to CSV with security sanitization
 * @param {Array<Object>} logs - Audit log entries
 * @param {string} [filename='audit_trail'] - Base filename
 */
export function exportAuditLogsCSV(logs, filename = 'audit_trail') {
  const exportData = logs.map(log => ({
    'Date/Time': new Date(log.createdAt).toLocaleString(),
    'Username': log.username || log.name || '',
    'Email': log.email || '',
    'Role': log.role || '',
    'Action': log.action || '',
    'Method': log.method || '',
    'Route': log.route || '',
    'Status Code': log.statusCode || '',
    'Success': log.success ? 'Yes' : 'No',
    'Resource Type': log.resourceType || '',
    'IP Address': log.ipAddress || ''
  }));
  
  downloadCSV(exportData, filename);
}

/**
 * Export barangay analytics to CSV with security sanitization
 * @param {Array<Object>} data - Barangay analytics data
 * @param {string} [filename='barangay_franchise_analytics'] - Base filename
 */
export function exportBarangayAnalyticsCSV(data, filename = 'barangay_franchise_analytics') {
  const exportData = data.map(item => ({
    'Barangay': item.barangay,
    'Active Franchises': item.active,
    'Expired Franchises': item.expired,
    'Total Franchises': item.total,
    'Active Percentage (%)': item.total > 0 ? ((item.active / item.total) * 100).toFixed(1) : '0.0'
  }));
  
  downloadCSV(exportData, filename);
}

export default {
  sanitizeCSVValue,
  escapeCSVField,
  arrayToCSV,
  downloadCSV,
  exportAuditLogsCSV,
  exportBarangayAnalyticsCSV
};
