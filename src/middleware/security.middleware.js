const helmet = require("helmet");
const cors = require("cors");
const express = require("express");
const rateLimit = require("express-rate-limit");
const env = require("../config/env");
const { AppError, ERROR_CODES } = require("../lib/errors");

// CORS Configuration
const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || env.CORS_ORIGINS.includes(origin) || env.CORS_ORIGINS.includes("*")) {
      callback(null, true);
      return;
    }

    callback(
      new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: "Origin is not allowed by CORS",
      }),
    );
  },
  credentials: true,
});

// JSON Body Parser with 1MB limit
const jsonMiddleware = express.json({ limit: "1mb" });

// URL Encoded Body Parser
const urlEncodedMiddleware = express.urlencoded({ extended: true, limit: "1mb" });

// Rate Limiter Factory
function createRateLimiter({
  windowMs = env.RATE_LIMIT_WINDOW_MS,
  max = env.RATE_LIMIT_MAX,
  message = "Too many requests from this IP, please try again later.",
} = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.NODE_ENV === "test",
    handler: (req, res, next) => {
      next(
        new AppError({
          statusCode: 429,
          code: ERROR_CODES.RATE_LIMITED,
          message,
        })
      );
    },
  });
}

// Instantiate specific limiters
const generalLimiter = createRateLimiter();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: "Too many authentication requests, please try again after 15 minutes.",
});

const otpLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: "Too many OTP requests, please try again after 5 minutes.",
});

module.exports = {
  helmetMiddleware: helmet(),
  corsMiddleware,
  jsonMiddleware,
  urlEncodedMiddleware,
  createRateLimiter,
  generalLimiter,
  authLimiter,
  otpLimiter,
};
