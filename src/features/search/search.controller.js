const { sendSuccess } = require("../../lib/response");
const searchService = require("./search.service");

/**
 * GET /search/products controller handler.
 */
async function searchProducts(req, res, next) {
  try {
    const result = await searchService.searchProducts(req.query);
    return sendSuccess(res, result.data, result.meta);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /search/suggestions controller handler.
 */
async function getSuggestions(req, res, next) {
  try {
    const result = await searchService.getSuggestions(req.query);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /search/events controller handler.
 */
async function trackSearchEvent(req, res, next) {
  try {
    const userId = req.user ? req.user.id : null;
    const result = await searchService.trackSearchEvent(req.body, userId);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /product-requests controller handler.
 */
async function createProductRequest(req, res, next) {
  try {
    const userId = req.user ? req.user.id : null;
    const result = await searchService.createProductRequest(req.body, userId);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  searchProducts,
  getSuggestions,
  trackSearchEvent,
  createProductRequest,
};
