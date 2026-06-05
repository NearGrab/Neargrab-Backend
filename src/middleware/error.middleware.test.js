const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const notFoundMiddleware = require("./not-found.middleware");
const errorMiddleware = require("./error.middleware");
const { AppError } = require("../lib/errors");

describe("Error and NotFound Middlewares", () => {
  let app;

  beforeAll(() => {
    app = express();
    // Middleware to parser JSON to test JSON SyntaxErrors
    app.use(express.json());

    // Some test routes
    app.get("/trigger-app-error", (req, res, next) => {
      next(
        new AppError({
          statusCode: 400,
          code: "CUSTOM_ERROR",
          message: "This is a custom error",
          details: { field: "invalid" },
        })
      );
    });

    app.get("/trigger-jwt-error", (req, res, next) => {
      next(new jwt.JsonWebTokenError("invalid signature"));
    });

    app.post("/trigger-json-syntax-error", (req, res) => {
      res.status(200).json({ ok: true });
    });

    // Mount 404 handler
    app.use(notFoundMiddleware);
    // Mount global error handler
    app.use(errorMiddleware);
  });

  it("should return 404 NOT_FOUND for unknown routes", async () => {
    const response = await request(app).get("/unknown-route").expect(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route GET /unknown-route not found",
        details: {},
      },
    });
  });

  it("should return correct status and code for a thrown AppError", async () => {
    const response = await request(app).get("/trigger-app-error").expect(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "CUSTOM_ERROR",
        message: "This is a custom error",
        details: { field: "invalid" },
      },
    });
  });

  it("should convert JWT errors to 401 UNAUTHENTICATED", async () => {
    const response = await request(app).get("/trigger-jwt-error").expect(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Invalid token",
        details: {},
      },
    });
  });

  it("should return 400 VALIDATION_ERROR for invalid JSON syntax", async () => {
    const response = await request(app)
      .post("/trigger-json-syntax-error")
      .set("Content-Type", "application/json")
      .send("{invalid-json}")
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid JSON payload format",
        details: {},
      },
    });
  });
});
