const { sendSuccess } = require("../../lib/response");
const productService = require("./product.service");

async function getProductDetail(req, res, next) {
  try {
    const data = await productService.getProductDetail(
      req.params.productId,
      req.user
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function getAvailableStores(req, res, next) {
  try {
    const result = await productService.getAvailableStores(
      req.params.productId,
      req.query
    );
    return sendSuccess(res, result.data, result.meta);
  } catch (error) {
    return next(error);
  }
}

async function getSimilarProducts(req, res, next) {
  try {
    const data = await productService.getSimilarProducts(
      req.params.productId,
      req.query
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function listProductReviews(req, res, next) {
  try {
    const result = await productService.listProductReviews(
      req.params.productId,
      req.query
    );
    return sendSuccess(res, result.data, result.meta);
  } catch (error) {
    return next(error);
  }
}

async function createProductReview(req, res, next) {
  try {
    const data = await productService.createProductReview(
      req.params.productId,
      req.body,
      req.user
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function saveProduct(req, res, next) {
  try {
    const data = await productService.saveProduct(
      req.params.productId,
      req.user
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function unsaveProduct(req, res, next) {
  try {
    const data = await productService.unsaveProduct(
      req.params.productId,
      req.user
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function trackProductView(req, res, next) {
  try {
    const data = await productService.trackProductView(
      req.params.productId,
      req.body,
      req.user
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function createProductFeedback(req, res, next) {
  try {
    const data = await productService.createProductFeedback(
      req.params.productId,
      req.body,
      req.user
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getProductDetail,
  getAvailableStores,
  getSimilarProducts,
  listProductReviews,
  createProductReview,
  saveProduct,
  unsaveProduct,
  trackProductView,
  createProductFeedback,
};
