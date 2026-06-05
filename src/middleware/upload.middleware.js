const fs = require("fs");
const path = require("path");
const multer = require("multer");
const env = require("../config/env");
const { AppError, ERROR_CODES } = require("../lib/errors");

// Ensure upload directory exists
const uploadDir = env.UPLOAD_DIR;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError({
        statusCode: 400,
        code: ERROR_CODES.UPLOAD_INVALID_TYPE,
        message: `Invalid file type: ${file.mimetype}. Allowed types are images (png, jpg, jpeg, webp) and documents (pdf).`,
      }),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.UPLOAD_MAX_FILE_SIZE_BYTES,
  },
});

/**
 * Middleware to handle single file upload.
 * Maps Multer errors to unified AppError formats.
 */
function uploadSingle(fieldName) {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return next(
              new AppError({
                statusCode: 400,
                code: ERROR_CODES.VALIDATION_ERROR,
                message: "File too large",
                details: {
                  [fieldName]: `File size exceeds the limit of ${env.UPLOAD_MAX_FILE_SIZE_BYTES} bytes`,
                },
              })
            );
          }
          return next(
            new AppError({
              statusCode: 400,
              code: ERROR_CODES.VALIDATION_ERROR,
              message: err.message,
            })
          );
        }
        return next(err);
      }
      next();
    });
  };
}

/**
 * Middleware to handle multiple files upload.
 */
function uploadMany(fieldName, maxCount) {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return next(
              new AppError({
                statusCode: 400,
                code: ERROR_CODES.VALIDATION_ERROR,
                message: "One or more files are too large",
                details: {
                  [fieldName]: `File size exceeds the limit of ${env.UPLOAD_MAX_FILE_SIZE_BYTES} bytes`,
                },
              })
            );
          }
          return next(
            new AppError({
              statusCode: 400,
              code: ERROR_CODES.VALIDATION_ERROR,
              message: err.message,
            })
          );
        }
        return next(err);
      }
      next();
    });
  };
}

module.exports = {
  uploadSingle,
  uploadMany,
  upload,
};
