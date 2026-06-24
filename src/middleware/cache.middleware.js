const cache = require("../lib/cache");
const logger = require("../config/logger");

/**
 * Express middleware for caching GET responses in-memory.
 * 
 * @param {Object} options
 * @param {number} options.ttlSeconds - Time-To-Live in seconds (default: 60)
 * @param {string[]|Function} options.tags - Cache tags for invalidation (default: [])
 */
function cacheMiddleware({ ttlSeconds = 60, tags = [] } = {}) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Generate unique cache key. If authenticated, append userId to prevent data leakage.
    const userId = req.user?.id || req.user?.sub || "";
    const cacheKey = userId ? `user:${userId}:${req.originalUrl}` : `guest:${req.originalUrl}`;

    const cachedBody = cache.get(cacheKey);

    if (cachedBody) {
      if (req.log) {
        req.log.debug({ cacheKey }, "Cache HIT");
      }
      // Send cached response
      return res.json(cachedBody);
    }

    if (req.log) {
      req.log.debug({ cacheKey }, "Cache MISS");
    }

    // Capture the JSON response to cache it
    const originalJson = res.json;
    res.json = function (body) {
      // Restore res.json
      res.json = originalJson;

      // Only cache successful status codes (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Resolve tags (handles array or function returning array)
        const resolvedTags = typeof tags === "function" ? tags(req) : tags;
        const finalTags = Array.isArray(resolvedTags) ? [...resolvedTags] : [resolvedTags];

        // Auto-extract dynamic parameters as tags for easier invalidation
        if (req.query.city) {
          finalTags.push(`city:${req.query.city.toLowerCase()}`);
        }
        if (req.params.productId) {
          finalTags.push(`product:${req.params.productId}`);
        }
        if (req.params.shopId) {
          finalTags.push(`shop:${req.params.shopId}`);
        }

        cache.set(cacheKey, body, ttlSeconds, finalTags);
      }

      return originalJson.call(this, body);
    };

    next();
  };
}

module.exports = cacheMiddleware;
