// Stores frequently used data in memory to avoid checking database repeatedly

class CacheManager {
  constructor() {
    this.cache = new Map();
  }

  // Returns saved data if available and not expired, otherwise returns nothing
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // If data expired, throw it away and return nothing
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.cache.delete(key);
      console.log(`[CACHE] Expired: ${key}`);
      return null;
    }

    console.log(`[CACHE] HIT: ${key}`);
    return item.value;
  }

  // Save data to memory with an expiration time (default: 10 minutes)
  set(key, value, ttlSeconds = 600) {
    const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now()
    });

    console.log(`[CACHE] SET: ${key} (TTL: ${ttlSeconds}s)`);
  }

  // Remove a specific saved data from memory
  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      console.log(`[CACHE] DELETED: ${key}`);
    }
  }

  // Delete all saved data from memory
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[CACHE] CLEARED: ${size} entries`);
  }

  // Show how much data is currently in memory and what data is there
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }

  // Remove expired data to free up memory
  cleanup() {
    let cleaned = 0;
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt && item.expiresAt < Date.now()) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[CACHE] Cleaned up ${cleaned} expired entries`);
    }
  }
}

// Create single cache system for the entire application
const cacheManager = new CacheManager();

// Check and remove expired data every 5 minutes
setInterval(() => {
  cacheManager.cleanup();
}, 5 * 60 * 1000);

module.exports = cacheManager;
