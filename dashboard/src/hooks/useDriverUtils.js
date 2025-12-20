import { useState, useEffect, useCallback, useMemo } from 'react';
import { logger } from '../utils/logger';

/**
 * Custom hook to decode and retrieve user info from JWT token
 * Memoized to prevent unnecessary recalculations
 */
export const useTokenUser = () => {
  return useMemo(() => {
    try {
      const token = sessionStorage.getItem('accessToken');
      if (!token) return null;
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch (error) {
      logger.error('[useTokenUser] Error decoding token:', error);
      return null;
    }
  }, []); // Only recalculate when component mounts (token changes handled by parent)
};

/**
 * Custom hook to check franchise status from sessionStorage
 * Returns both status and a function to refresh it
 */
export const useFranchiseStatus = () => {
  const [franchiseStatus, setFranchiseStatus] = useState(null);

  const checkFranchiseStatus = useCallback(() => {
    const franchiseData = sessionStorage.getItem('userFranchiseInfo');
    if (franchiseData) {
      try {
        const parsedData = JSON.parse(franchiseData);
        setFranchiseStatus(parsedData.status || 'ACTIVE');
      } catch (error) {
        logger.error('[useFranchiseStatus] Error parsing franchise data:', error);
        setFranchiseStatus(null);
      }
    } else {
      setFranchiseStatus(null);
    }
  }, []);

  // Check on mount
  useEffect(() => {
    checkFranchiseStatus();
  }, [checkFranchiseStatus]);

  return { franchiseStatus, checkFranchiseStatus, setFranchiseStatus };
};

/**
 * Custom hook to resolve server URLs consistently
 * Handles GridFS URLs and relative paths
 */
export const useServerUrl = () => {
  return useCallback((raw) => {
    if (!raw) return null;
    try {
      // Keep public assets as-is for Vite
      if (raw.startsWith('/public/')) return raw;
      
      const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5170').replace(/\/$/, '');
      
      // Handle GridFS URLs: gridfs://fileId -> /api/files/fileId
      if (raw.startsWith('gridfs://')) {
        const fileId = raw.substring(9);
        return `${base}/api/files/${fileId}`;
      }
      
      // Handle full HTTP URLs
      if (/^https?:\/\//i.test(raw)) return raw;
      
      // Handle absolute paths
      if (raw.startsWith('/')) return `${base}${raw}`;
      return `${base}/${raw}`;
    } catch {
      return raw;
    }
  }, []);
};

/**
 * Custom hook to fetch and manage blob URLs for images/PDFs
 * Automatically handles cleanup to prevent memory leaks
 */
export const useBlobUrl = (rawPath, dependencies = []) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [isPdf, setIsPdf] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const resolveServerUrl = useServerUrl();

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    const fetchBlob = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const path = resolveServerUrl(rawPath);
        if (!path) {
          setBlobUrl(null);
          setIsLoading(false);
          return;
        }

        const isImage = /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(path);
        const isPdfFile = /\.pdf$/i.test(path);

        if (!isImage && !isPdfFile) {
          setBlobUrl(null);
          setIsLoading(false);
          return;
        }

        const response = await fetch(path, { mode: 'cors' });
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        
        const blob = await response.blob();
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setIsPdf(blob.type.includes('pdf') || isPdfFile);
      } catch (err) {
        if (!cancelled) {
          logger.warn('[useBlobUrl] Failed to fetch blob:', err);
          setError(err.message);
          setBlobUrl(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchBlob();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setBlobUrl(null);
    };
  }, [rawPath, resolveServerUrl, ...dependencies]);

  return { blobUrl, isPdf, isLoading, error };
};

/**
 * Custom hook to parse dates consistently
 * Returns dayjs object or null
 */
export const useParsedDate = (rawDate) => {
  return useMemo(() => {
    if (!rawDate && rawDate !== 0) return null;

    try {
      const dayjs = require('dayjs');
      
      // Try parsing as dayjs directly
      const asDay = dayjs(rawDate);
      if (asDay && asDay.isValid && asDay.isValid()) return asDay;

      // Try as numeric timestamp
      if (!isNaN(Number(rawDate))) {
        const asNum = dayjs(Number(rawDate));
        if (asNum && asNum.isValid && asNum.isValid()) return asNum;
      }

      // Try as Date
      const d = new Date(String(rawDate));
      if (!isNaN(d.getTime())) return dayjs(d);
    } catch (error) {
      logger.warn('[useParsedDate] Failed to parse date:', rawDate, error);
    }

    return null;
  }, [rawDate]);
};

/**
 * Translation hook with memoization
 * Prevents re-creating translation objects on every render
 */
export const useDriverTranslations = (language) => {
  return useMemo(() => {
    const translations = {
      en: {
        activeFranchise: "ACTIVE FRANCHISE",
        expiredFranchise: "EXPIRED FRANCHISE",
        noFranchise: "NO FRANCHISE",
        addressNotProvided: "Address not provided",
        singleNoCoOwner: "SINGLE | NO CO-OWNER",
        toggleLanguage: "Tagalog"
      },
      tl: {
        activeFranchise: "AKTIBONG PRANGKISA",
        expiredFranchise: "NATAPOS NA ANG PRANGKISA",
        noFranchise: "WALANG PRANGKISA",
        addressNotProvided: "Walang nakalagay na address",
        singleNoCoOwner: "NAG-IISA | WALANG KASAMA",
        toggleLanguage: "English"
      }
    };
    return translations[language] || translations.en;
  }, [language]);
};

/**
 * Memoized SweetAlert style configurations
 * Prevents re-creating objects on every render
 */
export const useAlertStyles = () => {
  return useMemo(() => ({
    successAlert: {
      icon: 'success',
      iconColor: '#10b981',
      confirmButtonColor: '#174D7A',
      customClass: {
        container: 'swal-container',
        popup: 'swal-popup',
        title: 'swal-title',
        htmlContainer: 'swal-text',
        confirmButton: 'swal-confirm-btn'
      },
      showConfirmButton: true,
      confirmButtonText: 'OK',
      didOpen: (modal) => {
        modal.style.borderRadius = '12px';
        modal.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.15)';
        modal.style.zIndex = '9999';
      }
    },
    errorAlert: {
      icon: 'error',
      iconColor: '#ef4444',
      confirmButtonColor: '#174D7A',
      customClass: {
        container: 'swal-container',
        popup: 'swal-popup',
        title: 'swal-title',
        htmlContainer: 'swal-text',
        confirmButton: 'swal-confirm-btn'
      },
      showConfirmButton: true,
      confirmButtonText: 'OK',
      didOpen: (modal) => {
        modal.style.borderRadius = '12px';
        modal.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.15)';
        modal.style.zIndex = '9999';
      }
    },
    warningAlert: {
      icon: 'warning',
      iconColor: '#f59e0b',
      confirmButtonColor: '#174D7A',
      customClass: {
        container: 'swal-container',
        popup: 'swal-popup',
        title: 'swal-title',
        htmlContainer: 'swal-text',
        confirmButton: 'swal-confirm-btn'
      },
      showConfirmButton: true,
      confirmButtonText: 'OK',
      didOpen: (modal) => {
        modal.style.borderRadius = '12px';
        modal.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.15)';
        modal.style.zIndex = '9999';
      }
    }
  }), []);
};
