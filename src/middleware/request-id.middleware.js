const crypto = require("crypto");

/**
 * Middleware to extract or generate a unique request ID.
 * It reads the ID from x-request-id header or generates a random UUID,
 * attaches it to req.id, and sets the x-request-id response header.
 */
function requestIdMiddleware(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

module.exports = requestIdMiddleware;
