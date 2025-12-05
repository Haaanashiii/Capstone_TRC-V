const DEBUG = process.env.DEBUG === 'true';

class CacheManager {
  constructor() {
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  set(key, value, ttlSeconds = 600) {
    this.cache.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null,
      createdAt: Date.now()
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt && item.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }
}

const cacheManager = new CacheManager();

setInterval(() => cacheManager.cleanup(), 5 * 60 * 1000);

const getPaginationParams = (page = 1, limit = 20) => {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const skip = (pageNum - 1) * limitNum;
  return { page: pageNum, limit: limitNum, skip };
};

module.exports = cacheManager;
module.exports.getPaginationParams = getPaginationParams;
