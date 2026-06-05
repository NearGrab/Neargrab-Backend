const { sendSuccess } = require("../../lib/response");
const exploreService = require("./explore.service");

/**
 * GET /categories list handler.
 */
async function listCategories(req, res, next) {
  try {
    const result = await exploreService.listCategories(req.query);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /brands list handler.
 */
async function listBrands(req, res, next) {
  try {
    const result = await exploreService.listBrands(req.query);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /explore feed handler.
 */
async function getExploreFeed(req, res, next) {
  try {
    const result = await exploreService.getExploreFeed(req.query);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listCategories,
  listBrands,
  getExploreFeed,
};
