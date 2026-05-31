const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  OTP_INVALID: "OTP_INVALID",
  OTP_EXPIRED: "OTP_EXPIRED",
  SHOP_NOT_ACTIVE: "SHOP_NOT_ACTIVE",
  PRODUCT_NOT_ACTIVE: "PRODUCT_NOT_ACTIVE",
  PIN_LIMIT_EXCEEDED: "PIN_LIMIT_EXCEEDED",
  UPLOAD_INVALID_TYPE: "UPLOAD_INVALID_TYPE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});

class AppError extends Error {
  constructor({
    statusCode = 500,
    code = ERROR_CODES.INTERNAL_ERROR,
    message = "Something went wrong",
    details = {},
  } = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  AppError,
  ERROR_CODES,
};
