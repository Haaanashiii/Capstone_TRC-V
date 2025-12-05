/**
 * TRC-V Cache Manager - Production-Ready LRU Cache
 * ================================================
 * Features:
 * - LRU (Least Recently Used) eviction when memory limit reached
 * - Memory size tracking and limits
 * - TTL (Time-To-Live) expiration
 * - Hit/miss statistics for monitoring
 * - Automatic cleanup of expired entries
 * - Namespace support for organized caching
 * 
 * Designed for government-grade reliability and scalability
 */

const DEBUG = process.env.DEBUG === 'true';

// Configuration - adjust based on server capacity
const CACHE_CONFIG = {
  MAX_ENTRIES: parseInt(process.env.CACHE_MAX_ENTRIES) || 2000,      // Max cached items
  MAX_MEMORY_MB: parseInt(process.env.CACHE_MAX_MEMORY_MB) || 50,    // Max memory in MB
  CLEANUP_INTERVAL_MS: 60 * 1000,                                     // Cleanup every 1 minute
  DEFAULT_TTL_SECONDS: 300,                                           // Default 5 minutes
  STATS_LOG_INTERVAL_MS: 15 * 60 * 1000,                             // Log stats every 15 minutes
};

/**
 * Recommended TTL values for different data types (in seconds)
 * Use these constants for consistency across the application
 */
const TTL = {
  // Real-time data - very short cache
  SOCKET_DATA: 5,              // Socket.io initial data (5 seconds)
  
  // Frequently changing data - short cache
  QUICK_STATS: 60,             // Quick stats widget (1 minute)
  PENDING_APPS: 30,            // Pending applications list (30 seconds)
  QR_VERIFICATION: 120,        // QR code verification (2 minutes)
  
  // Moderately changing data - medium cache
  DASHBOARD_STATS: 180,        // Dashboard statistics (3 minutes)
  FRANCHISE_LIST: 120,         // Franchise listings (2 minutes)
  
  // Slowly changing data - longer cache
  ANALYTICS: 600,              // Analytics/reports (10 minutes)
  FARE_MATRIX: 900,            // Fare matrix data (15 minutes)
  ANNOUNCEMENTS: 300,          // Announcements (5 minutes)
  
  // Static/rarely changing data - long cache
  REFERENCE_DATA: 1800,        // Reference data (30 minutes)
  SYSTEM_CONFIG: 3600,         // System configuration (1 hour)
};

class CacheManager {
  constructor(config = {}) {
    this.config = { ...CACHE_CONFIG, ...config };
    this.cache = new Map();
    
    // LRU tracking - most recently used at end
    this.accessOrder = [];
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expired: 0,
      sets: 0,
      deletes: 0,
      startTime: Date.now()
    };
    
    // Memory tracking (approximate)
    this.estimatedMemoryBytes = 0;
    
    // Start background tasks
    this._startCleanupInterval();
    this._startStatsLogging();
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or null
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this._removeEntry(key);
      this.stats.misses++;
      this.stats.expired++;
      return null;
    }

    // Update LRU order (move to end = most recently used)
    this._updateAccessOrder(key);
    
    this.stats.hits++;
    item.lastAccess = Date.now();
    item.accessCount++;
    
    return item.value;
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttlSeconds - Time-to-live in seconds (0 = no expiry)
   */
  set(key, value, ttlSeconds = this.config.DEFAULT_TTL_SECONDS) {
    // Estimate memory size of the value
    const valueSize = this._estimateSize(value);
    
    // Check if we need to evict entries
    this._ensureCapacity(valueSize);
    
    // If key exists, update memory estimate
    if (this.cache.has(key)) {
      const oldItem = this.cache.get(key);
      this.estimatedMemoryBytes -= oldItem.size;
      this._removeFromAccessOrder(key);
    }
    
    const item = {
      value,
      size: valueSize,
      expiresAt: ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null,
      createdAt: Date.now(),
      lastAccess: Date.now(),
      accessCount: 0
    };
    
    this.cache.set(key, item);
    this.accessOrder.push(key);
    this.estimatedMemoryBytes += valueSize;
    this.stats.sets++;
  }

  /**
   * Delete entry from cache
   * @param {string} key - Cache key
   * @returns {boolean} Whether key existed
   */
  delete(key) {
    return this._removeEntry(key);
  }

  /**
   * Delete all entries matching a pattern
   * @param {string} pattern - Key pattern (supports * wildcard)
   * @returns {number} Number of deleted entries
   */
  deletePattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let deleted = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this._removeEntry(key);
        deleted++;
      }
    }
    
    return deleted;
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this._removeEntry(key);
      return false;
    }
    return true;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.estimatedMemoryBytes = 0;
    if (DEBUG) console.log('[Cache] Cleared all entries');
  }

  /**
   * Get cache statistics for monitoring
   * @returns {Object} Cache statistics
   */
  getStats() {
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - this.stats.startTime) / 1000);
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2)
      : 0;
    
    return {
      entries: this.cache.size,
      maxEntries: this.config.MAX_ENTRIES,
      memoryUsedMB: (this.estimatedMemoryBytes / 1024 / 1024).toFixed(2),
      maxMemoryMB: this.config.MAX_MEMORY_MB,
      memoryUsagePercent: ((this.estimatedMemoryBytes / (this.config.MAX_MEMORY_MB * 1024 * 1024)) * 100).toFixed(1),
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: `${hitRate}%`,
      evictions: this.stats.evictions,
      expired: this.stats.expired,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      uptimeSeconds,
      uptimeFormatted: this._formatUptime(uptimeSeconds)
    };
  }

  /**
   * Get detailed info about cached entries (for debugging)
   * @param {number} limit - Max entries to return
   * @returns {Array} Entry details
   */
  getEntries(limit = 50) {
    const entries = [];
    let count = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (count >= limit) break;
      entries.push({
        key,
        size: `${(item.size / 1024).toFixed(2)} KB`,
        expiresIn: item.expiresAt ? `${Math.max(0, Math.floor((item.expiresAt - Date.now()) / 1000))}s` : 'never',
        accessCount: item.accessCount,
        age: `${Math.floor((Date.now() - item.createdAt) / 1000)}s`
      });
      count++;
    }
    
    return entries;
  }

  /**
   * Manually trigger cleanup of expired entries
   * @returns {number} Number of entries removed
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt && item.expiresAt < now) {
        this._removeEntry(key);
        removed++;
        this.stats.expired++;
      }
    }
    
    if (removed > 0 && DEBUG) {
      console.log(`[Cache] Cleanup: removed ${removed} expired entries`);
    }
    
    return removed;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  _removeEntry(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    this.cache.delete(key);
    this._removeFromAccessOrder(key);
    this.estimatedMemoryBytes -= item.size;
    this.stats.deletes++;
    
    return true;
  }

  _updateAccessOrder(key) {
    this._removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  _removeFromAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  _ensureCapacity(newItemSize) {
    const maxMemoryBytes = this.config.MAX_MEMORY_MB * 1024 * 1024;
    
    // Evict LRU entries if we exceed limits
    while (
      (this.cache.size >= this.config.MAX_ENTRIES || 
       this.estimatedMemoryBytes + newItemSize > maxMemoryBytes) &&
      this.accessOrder.length > 0
    ) {
      const lruKey = this.accessOrder[0]; // Oldest accessed entry
      this._removeEntry(lruKey);
      this.stats.evictions++;
      
      if (DEBUG) {
        console.log(`[Cache] Evicted LRU entry: ${lruKey}`);
      }
    }
  }

  _estimateSize(value) {
    // Rough estimation of object size in bytes
    try {
      const str = JSON.stringify(value);
      // Each character in string is roughly 2 bytes (UTF-16)
      // Add overhead for object structure
      return str.length * 2 + 100;
    } catch {
      // For non-serializable objects, estimate 1KB
      return 1024;
    }
  }

  _formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  _startCleanupInterval() {
    this._cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.CLEANUP_INTERVAL_MS);
    
    // Don't prevent Node from exiting
    if (this._cleanupTimer.unref) {
      this._cleanupTimer.unref();
    }
  }

  _startStatsLogging() {
    this._statsTimer = setInterval(() => {
      const stats = this.getStats();
      console.log(`[Cache Stats] Entries: ${stats.entries}/${stats.maxEntries} | ` +
                  `Memory: ${stats.memoryUsedMB}/${stats.maxMemoryMB}MB (${stats.memoryUsagePercent}%) | ` +
                  `Hit Rate: ${stats.hitRate} | Evictions: ${stats.evictions}`);
    }, this.config.STATS_LOG_INTERVAL_MS);
    
    if (this._statsTimer.unref) {
      this._statsTimer.unref();
    }
  }

  /**
   * Graceful shutdown - clear timers
   */
  shutdown() {
    if (this._cleanupTimer) clearInterval(this._cleanupTimer);
    if (this._statsTimer) clearInterval(this._statsTimer);
    console.log('[Cache] Shutdown complete');
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

// Graceful shutdown on process exit
process.on('SIGTERM', () => cacheManager.shutdown());
process.on('SIGINT', () => cacheManager.shutdown());

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get pagination parameters with validation
 */
const getPaginationParams = (page = 1, limit = 20) => {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const skip = (pageNum - 1) * limitNum;
  return { page: pageNum, limit: limitNum, skip };
};

/**
 * Create a namespaced cache key
 * @param {string} namespace - Cache namespace (e.g., 'qr', 'dashboard')
 * @param  {...string} parts - Key parts
 * @returns {string} Formatted cache key
 */
const cacheKey = (namespace, ...parts) => {
  return `${namespace}:${parts.join(':')}`;
};

// Export
module.exports = cacheManager;
module.exports.getPaginationParams = getPaginationParams;
module.exports.cacheKey = cacheKey;
module.exports.CacheManager = CacheManager;
module.exports.TTL = TTL;
