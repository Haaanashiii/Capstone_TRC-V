/**
 * Offline Storage Service for PWA
 * Uses localStorage with fallback for offline data persistence
 * 
 * This service caches important data so users can view it even when offline:
 * - Announcements
 * - User's franchise list (operators)
 * - Fare matrix
 */

const STORAGE_KEYS = {
  ANNOUNCEMENTS: 'pwa_announcements',
  USER_DATA: 'pwa_user_data',
  MY_FRANCHISES: 'pwa_my_franchises',
  FARE_MATRIX: 'pwa_fare_matrix',
  LAST_SYNC: 'pwa_last_sync'
};

const MAX_AGE = {
  ANNOUNCEMENTS: 7 * 24 * 60 * 60 * 1000, // 7 days
  USER_DATA: 24 * 60 * 60 * 1000, // 1 day
  MY_FRANCHISES: 24 * 60 * 60 * 1000, // 1 day
  FARE_MATRIX: 7 * 24 * 60 * 60 * 1000 // 7 days
};

class OfflineStorageService {
  constructor() {
    this.isAvailable = this._checkAvailability();
  }

  _checkAvailability() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save data with timestamp
   */
  _save(key, data) {
    if (!this.isAvailable) return false;
    try {
      const wrapper = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(wrapper));
      return true;
    } catch (error) {
      console.warn('[OfflineStorage] Failed to save:', error.message);
      // Try to clear old data if storage is full
      this._cleanup();
      return false;
    }
  }

  /**
   * Load data with age check
   */
  _load(key, maxAge) {
    if (!this.isAvailable) return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const wrapper = JSON.parse(raw);
      const age = Date.now() - wrapper.timestamp;

      // Return null if data is too old
      if (maxAge && age > maxAge) {
        localStorage.removeItem(key);
        return null;
      }

      return {
        data: wrapper.data,
        timestamp: wrapper.timestamp,
        age,
        isStale: maxAge ? age > maxAge / 2 : false // Consider stale if over half max age
      };
    } catch {
      return null;
    }
  }

  /**
   * Clean up old data to free space
   */
  _cleanup() {
    if (!this.isAvailable) return;
    try {
      // Remove any data older than 30 days
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      Object.values(STORAGE_KEYS).forEach(key => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const wrapper = JSON.parse(raw);
            if (wrapper.timestamp < thirtyDaysAgo) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          // If parse fails, remove the corrupted data
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('[OfflineStorage] Cleanup failed:', error);
    }
  }

  // ============================================
  // ANNOUNCEMENTS
  // ============================================

  saveAnnouncements(announcements) {
    return this._save(STORAGE_KEYS.ANNOUNCEMENTS, announcements);
  }

  getAnnouncements() {
    return this._load(STORAGE_KEYS.ANNOUNCEMENTS, MAX_AGE.ANNOUNCEMENTS);
  }

  // ============================================
  // USER DATA
  // ============================================

  saveUserData(userData) {
    return this._save(STORAGE_KEYS.USER_DATA, userData);
  }

  getUserData() {
    return this._load(STORAGE_KEYS.USER_DATA, MAX_AGE.USER_DATA);
  }

  clearUserData() {
    if (!this.isAvailable) return;
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    localStorage.removeItem(STORAGE_KEYS.MY_FRANCHISES);
  }

  // ============================================
  // FRANCHISES (for operators)
  // ============================================

  saveMyFranchises(franchises) {
    return this._save(STORAGE_KEYS.MY_FRANCHISES, franchises);
  }

  getMyFranchises() {
    return this._load(STORAGE_KEYS.MY_FRANCHISES, MAX_AGE.MY_FRANCHISES);
  }

  // ============================================
  // FARE MATRIX
  // ============================================

  saveFareMatrix(fareMatrix) {
    return this._save(STORAGE_KEYS.FARE_MATRIX, fareMatrix);
  }

  getFareMatrix() {
    return this._load(STORAGE_KEYS.FARE_MATRIX, MAX_AGE.FARE_MATRIX);
  }

  // ============================================
  // UTILITY
  // ============================================

  /**
   * Check if we're online
   */
  isOnline() {
    return navigator.onLine;
  }

  /**
   * Get last sync timestamp for a specific key
   */
  getLastSync(key) {
    const data = this._load(key);
    return data?.timestamp || null;
  }

  /**
   * Clear all offline storage
   */
  clearAll() {
    if (!this.isAvailable) return;
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  /**
   * Get storage usage info
   */
  getStorageInfo() {
    if (!this.isAvailable) return null;
    
    let totalSize = 0;
    const details = {};
    
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      const item = localStorage.getItem(key);
      if (item) {
        const size = new Blob([item]).size;
        totalSize += size;
        details[name] = {
          size: size,
          sizeFormatted: this._formatBytes(size)
        };
      }
    });

    return {
      totalSize,
      totalFormatted: this._formatBytes(totalSize),
      details
    };
  }

  _formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Singleton instance
const offlineStorage = new OfflineStorageService();

export default offlineStorage;
export { STORAGE_KEYS, MAX_AGE };
