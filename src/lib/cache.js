const logger = require("../config/logger");

class MemoryCache {
  constructor() {
    this.store = new Map();
    
    // Clean up expired items every 5 minutes to prevent memory leak
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
    
    if (this.cleanupInterval && typeof this.cleanupInterval.unref === "function") {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Set a key in the cache with optional TTL (seconds) and tags.
   */
  set(key, value, ttlSeconds = 60, tags = []) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, {
      value,
      expiresAt,
      tags: Array.isArray(tags) ? tags : [tags],
    });
  }

  /**
   * Get a key from the cache. Returns null if missing or expired.
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Invalidate cache entries by matching any of the specified tags.
   */
  invalidate(tags = []) {
    if (!tags || tags.length === 0) return;
    const tagList = Array.isArray(tags) ? tags : [tags];
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        continue;
      }

      const match = entry.tags.some((t) => tagList.includes(t));
      if (match) {
        this.store.delete(key);
        count++;
      }
    }

    if (count > 0) {
      logger.info({ tags: tagList, invalidatedCount: count }, "Cache invalidated for tags");
    }
  }

  /**
   * Run manual/automatic cleanup of all expired keys.
   */
  cleanup() {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        count++;
      }
    }
    if (count > 0) {
      logger.debug({ cleanedCount: count }, "Cache cleanup completed");
    }
  }

  /**
   * Clear all items in the cache.
   */
  clear() {
    this.store.clear();
    logger.info("Cache cleared completely");
  }
}

// Export a singleton instance
module.exports = new MemoryCache();
