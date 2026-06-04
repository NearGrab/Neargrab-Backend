const express = require("express");
const seedPreviewController = require("../controllers/seed-preview.controller");

const router = express.Router();

router.get("/", seedPreviewController.getSeedPreview);

module.exports = router;
