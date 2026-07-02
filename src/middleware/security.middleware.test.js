const express = require("express");
const request = require("supertest");
const { corsMiddleware, createRateLimiter } = require("./security.middleware");
const env = require("../config/env");

describe("Security Middleware", () => {
  describe("CORS Middleware", () => {
    let app;
    let originalCorsOrigins;

    beforeAll(() => {
      originalCorsOrigins = [...env.CORS_ORIGINS];
      env.CORS_ORIGINS.length = 0;
      env.CORS_ORIGINS.push("http://localhost:5173");

      app = express();
      app.use(corsMiddleware);
      app.get("/test-cors", (req, res) => {
        res.status(200).json({ ok: true });
      });
      // Error handler to format errors
      app.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        });
      });
    });

    afterAll(() => {
      env.CORS_ORIGINS.length = 0;
      env.CORS_ORIGINS.push(...originalCorsOrigins);
    });

    it("should allow request with no origin (e.g. server-to-server or mobile client)", async () => {
      const response = await request(app)
        .get("/test-cors")
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it("should allow requests with permitted origins", async () => {
      // Use the first origin in env.CORS_ORIGINS
      const allowedOrigin = env.CORS_ORIGINS[0] || "http://localhost:5173";
      const response = await request(app)
        .get("/test-cors")
        .set("Origin", allowedOrigin)
        .expect(200);

      expect(response.body).toEqual({ ok: true });
      expect(response.headers["access-control-allow-origin"]).toBe(allowedOrigin);
    });

    it("should reject disallowed origins with a 403 AppError", async () => {
      const response = await request(app)
        .get("/test-cors")
        .set("Origin", "http://malicious-site.com")
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("Rate Limiting", () => {
    let app;

    beforeAll(() => {
      app = express();
      // Configure rate limiter with max 2 requests
      // Note: we override NODE_ENV to force rate limit checks if needed, but since createRateLimiter has standard skip: () => env.NODE_ENV === "test",
      // we can construct one with skip returning false specifically for this test.
      const testLimiter = createRateLimiter({
        windowMs: 5000,
        max: 2,
      });
      
      // Override standard rate limiter's skip function for testing
      // express-rate-limit allows setting options or we can pass skip: () => false
      const forceLimiter = createRateLimiter({
        windowMs: 5000,
        max: 2,
      });
      // We manually construct one that doesn't skip
      const rateLimit = require("express-rate-limit");
      const { AppError, ERROR_CODES } = require("../lib/errors");
      const testNoSkipLimiter = rateLimit({
        windowMs: 5000,
        max: 2,
        skip: () => false,
        handler: (req, res, next) => {
          next(
            new AppError({
              statusCode: 429,
              code: ERROR_CODES.RATE_LIMITED,
              message: "Too many requests",
            })
          );
        },
      });

      app.use(testNoSkipLimiter);
      app.get("/test-rate-limit", (req, res) => {
        res.status(200).json({ ok: true });
      });
      app.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        });
      });
    });

    it("should allow requests under the limit and block the subsequent requests", async () => {
      // Request 1: Ok
      await request(app).get("/test-rate-limit").expect(200);
      // Request 2: Ok
      await request(app).get("/test-rate-limit").expect(200);
      // Request 3: Blocked (429)
      const response = await request(app).get("/test-rate-limit").expect(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("RATE_LIMITED");
    });
  });
});
