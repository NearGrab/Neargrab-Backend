const { AppError, ERROR_CODES } = require("../lib/errors");

/**
 * Middleware to handle unmatched routes (404 Not Found).
 */
function notFoundMiddleware(req, res, next) {
  next(
    new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: `Route ${req.method} ${req.originalUrl} not found`,
    })
  );
}

module.exports = notFoundMiddleware;
