const { sendSuccess } = require("../../lib/response");
const mediaService = require("./media.service");
const { deleteMediaParams } = require("./media.schema");

/**
 * Handle single file upload.
 */
async function uploadSingle(req, res, next) {
  try {
    const ownerId = req.user.id;
    const result = await mediaService.uploadSingleMedia(req.file, ownerId);
    sendSuccess(res, result, null, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Handle bulk file uploads.
 */
async function uploadBulk(req, res, next) {
  try {
    const ownerId = req.user.id;
    const result = await mediaService.uploadBulkMedia(req.files, ownerId);
    sendSuccess(res, result, null, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Handle media asset deletion.
 */
async function deleteMedia(req, res, next) {
  try {
    // Validate request params
    const params = deleteMediaParams.parse(req.params);
    const actorId = req.user.id;
    const actorRole = req.user.role;

    const result = await mediaService.deleteMedia(params.mediaId, actorId, actorRole);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadSingle,
  uploadBulk,
  deleteMedia,
};
