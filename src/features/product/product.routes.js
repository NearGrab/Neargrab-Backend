const express = require("express");
const { authenticate, optionalAuth } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const productController = require("./product.controller");
const productSchema = require("./product.schema");

const router = express.Router();

router.get(
  "/:productId",
  optionalAuth,
  validate({ params: productSchema.productIdParam }),
  productController.getProductDetail
);

router.get(
  "/:productId/stores",
  optionalAuth,
  validate({
    params: productSchema.productIdParam,
    query: productSchema.storesQuery,
  }),
  productController.getAvailableStores
);

router.get(
  "/:productId/similar",
  optionalAuth,
  validate({
    params: productSchema.productIdParam,
    query: productSchema.similarQuery,
  }),
  productController.getSimilarProducts
);

router.get(
  "/:productId/reviews",
  optionalAuth,
  validate({
    params: productSchema.productIdParam,
    query: productSchema.reviewsQuery,
  }),
  productController.listProductReviews
);

router.post(
  "/:productId/reviews",
  authenticate,
  validate({
    params: productSchema.productIdParam,
    body: productSchema.createReviewBody,
  }),
  productController.createProductReview
);

router.post(
  "/:productId/view",
  optionalAuth,
  validate({
    params: productSchema.productIdParam,
    body: productSchema.trackViewBody,
  }),
  productController.trackProductView
);

router.post(
  "/:productId/save",
  authenticate,
  validate({ params: productSchema.productIdParam }),
  productController.saveProduct
);

router.delete(
  "/:productId/save",
  authenticate,
  validate({ params: productSchema.productIdParam }),
  productController.unsaveProduct
);

router.post(
  "/:productId/feedback",
  optionalAuth,
  validate({
    params: productSchema.productIdParam,
    body: productSchema.feedbackBody,
  }),
  productController.createProductFeedback
);

module.exports = router;
