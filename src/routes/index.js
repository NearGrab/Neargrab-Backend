const express = require("express");
const { sendSuccess } = require("../lib/response");
const metaRoutes = require("./meta.routes");
const seedPreviewRoutes = require("./seed-preview.routes");
const authRoutes = require("../features/auth/auth.routes");
const userRoutes = require("../features/user/user.routes");

const router = express.Router();

router.get("/health", (_req, res) =>
  sendSuccess(res, {
    status: "ok",
    service: "backend",
    timestamp: new Date().toISOString(),
  }),
);

router.use("/api/v1/meta", metaRoutes);
router.use("/api/v1/seed-preview", seedPreviewRoutes);
router.use("/api/v1/auth", authRoutes);
router.use("/api/v1/me", userRoutes);

module.exports = router;
