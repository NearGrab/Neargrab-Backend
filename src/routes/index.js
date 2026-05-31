const express = require("express");
const { sendSuccess } = require("../lib/response");

const router = express.Router();

router.get("/health", (_req, res) =>
  sendSuccess(res, {
    status: "ok",
    service: "backend",
    timestamp: new Date().toISOString(),
  }),
);

module.exports = router;
