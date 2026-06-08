const express = require("express");
const { authenticate } = require("../../middleware/auth.middleware");
const { uploadSingle, uploadMany } = require("../../middleware/upload.middleware");
const validate = require("../../middleware/validate.middleware");
const mediaController = require("./media.controller");
const mediaSchema = require("./media.schema");

const router = express.Router();

// All media endpoints require authentication
router.use(authenticate);

// POST /api/v1/media/upload
router.post("/upload", uploadSingle("file"), mediaController.uploadSingle);

// POST /api/v1/media/upload/bulk
router.post("/upload/bulk", uploadMany("files", 10), mediaController.uploadBulk);

// DELETE /api/v1/media/:mediaId
router.delete("/:mediaId", validate({ params: mediaSchema.deleteMediaParams }), mediaController.deleteMedia);

module.exports = router;
