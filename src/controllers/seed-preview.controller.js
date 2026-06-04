const { sendSuccess } = require("../lib/response");
const seedPreviewService = require("../services/seed-preview.service");

async function getSeedPreview(_req, res, next) {
  try {
    const preview = await seedPreviewService.getSeedPreview();
    return sendSuccess(res, preview);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getSeedPreview,
};
