const { AppError, ERROR_CODES } = require("../lib/errors");
const { sendError } = require("../lib/response");
const env = require("../config/env");
const logger = require("../config/logger");

/**
 * Global error handling middleware.
 * Standardizes errors from Zod, JWT, Multer, JSON SyntaxErrors, and custom AppErrors.
 */
function errorMiddleware(err, req, res, next) {
  let appError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err.name === "ZodError") {
    appError = new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Validation failed",
      details: err.flatten().fieldErrors,
    });
  } else if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    appError = new AppError({
      statusCode: 401,
      code: ERROR_CODES.UNAUTHENTICATED,
      message: err.name === "TokenExpiredError" ? "Token has expired" : "Invalid token",
    });
  } else if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    appError = new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Invalid JSON payload format",
    });
  } else if (err.name === "MulterError") {
    appError = new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: err.message,
    });
  } else {
    // Log unexpected exceptions
    const logContext = { requestId: req.id || null, err };
    if (req.log) {
      req.log.error(logContext, "Unhandled application error");
    } else {
      logger.error(logContext, "Unhandled application error");
    }

    appError = new AppError({
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: env.NODE_ENV === "production" ? "Something went wrong" : err.message || "Something went wrong",
    });
  }

  return sendError(res, {
    statusCode: appError.statusCode,
    code: appError.code,
    message: appError.message,
    details: appError.details,
  });
}

module.exports = errorMiddleware;
