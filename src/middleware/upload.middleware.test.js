const express = require("express");
const request = require("supertest");
const fs = require("fs");
const path = require("path");

// Mock env variables before requiring the middleware
jest.mock("../config/env", () => ({
  UPLOAD_DIR: "test_uploads",
  UPLOAD_MAX_FILE_SIZE_BYTES: 100, // Very small limit to easily test file size limits
  NODE_ENV: "test",
}));

const { uploadSingle, uploadMany } = require("./upload.middleware");

describe("Upload Middleware", () => {
  let app;
  const testUploadsDir = path.join(__dirname, "../../test_uploads");

  beforeAll(() => {
    app = express();
    app.post("/test-single", uploadSingle("avatar"), (req, res) => {
      res.status(200).json({ success: true, file: req.file });
    });
    app.post("/test-many", uploadMany("photos", 2), (req, res) => {
      res.status(200).json({ success: true, files: req.files });
    });

    // Centralized error handler
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
    });
  });

  afterAll(() => {
    // Clean up test_uploads directory
    if (fs.existsSync(testUploadsDir)) {
      const files = fs.readdirSync(testUploadsDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testUploadsDir, file));
      }
      fs.rmdirSync(testUploadsDir);
    }
  });

  it("should accept valid file types (e.g. image/png)", async () => {
    const pngBuffer = Buffer.from("fake-png-data");
    const response = await request(app)
      .post("/test-single")
      .attach("avatar", pngBuffer, "avatar.png")
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.file).toBeDefined();
    expect(response.body.file.mimetype).toBe("image/png");
  });

  it("should reject invalid file types with UPLOAD_INVALID_TYPE", async () => {
    const txtBuffer = Buffer.from("fake-text-data");
    const response = await request(app)
      .post("/test-single")
      .attach("avatar", txtBuffer, "document.txt")
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UPLOAD_INVALID_TYPE");
  });

  it("should reject files exceeding the maximum file size limit", async () => {
    // limit is 100 bytes, so send a buffer larger than 100 bytes
    const largeBuffer = Buffer.alloc(200);
    const response = await request(app)
      .post("/test-single")
      .attach("avatar", largeBuffer, "large_avatar.png")
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("File too large");
    expect(response.body.error.details.avatar).toContain("File size exceeds the limit");
  });
});
