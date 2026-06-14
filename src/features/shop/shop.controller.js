const { sendSuccess } = require("../../lib/response");
const shopService = require("./shop.service");

async function getPublicShop(req, res, next) {
  try {
    const data = await shopService.getPublicShop(req.params.shopId, req.user);
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function listShopProducts(req, res, next) {
  try {
    const result = await shopService.listShopProducts(
      req.params.shopId,
      req.query
    );
    return sendSuccess(res, result.data, result.meta);
  } catch (error) {
    return next(error);
  }
}

async function listShopReviews(req, res, next) {
  try {
    const result = await shopService.listShopReviews(
      req.params.shopId,
      req.query
    );
    return sendSuccess(res, result.data, result.meta);
  } catch (error) {
    return next(error);
  }
}

async function createShopReview(req, res, next) {
  try {
    const data = await shopService.createShopReview(
      req.params.shopId,
      req.body,
      req.user
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function listShopUpdates(req, res, next) {
  try {
    const result = await shopService.listShopUpdates(
      req.params.shopId,
      req.query
    );
    return sendSuccess(res, result.data, result.meta);
  } catch (error) {
    return next(error);
  }
}

async function trackShopLead(req, res, next) {
  try {
    const data = await shopService.trackShopLead(
      req.params.shopId,
      req.body,
      req.user
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getPublicShop,
  listShopProducts,
  listShopReviews,
  createShopReview,
  listShopUpdates,
  trackShopLead,
};
