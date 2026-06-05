const { AppError, ERROR_CODES } = require("../lib/errors");

/**
 * Reusable middleware to validate request payload parts (body, query, params)
 * using Zod schemas. On success, it replaces req.body/req.query/req.params with parsed/coerced values.
 * On failure, it forwards a formatted 400 VALIDATION_ERROR AppError.
 */
function validate({ body, query, params }) {
  return (req, res, next) => {
    try {
      if (body) {
        req.body = body.parse(req.body);
      }
      if (query) {
        req.query = query.parse(req.query);
      }
      if (params) {
        req.params = params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err.name === "ZodError") {
        const details = err.flatten().fieldErrors;
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: "Validation failed",
            details,
          })
        );
      }
      next(err);
    }
  };
}

module.exports = validate;
