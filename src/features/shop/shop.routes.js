const express = require("express");
const { authenticate, optionalAuth } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const shopController = require("./shop.controller");
const shopSchema = require("./shop.schema");

const router = express.Router();

router.get(
  "/:shopId",
  optionalAuth,
  validate({ params: shopSchema.shopIdParam }),
  shopController.getPublicShop
);

router.get(
  "/:shopId/products",
  optionalAuth,
  validate({
    params: shopSchema.shopIdParam,
    query: shopSchema.shopProductsQuery,
  }),
  shopController.listShopProducts
);

router.get(
  "/:shopId/reviews",
  optionalAuth,
  validate({
    params: shopSchema.shopIdParam,
    query: shopSchema.shopReviewsQuery,
  }),
  shopController.listShopReviews
);

router.post(
  "/:shopId/reviews",
  authenticate,
  validate({
    params: shopSchema.shopIdParam,
    body: shopSchema.createShopReviewBody,
  }),
  shopController.createShopReview
);

router.get(
  "/:shopId/updates",
  optionalAuth,
  validate({
    params: shopSchema.shopIdParam,
    query: shopSchema.updatesQuery,
  }),
  shopController.listShopUpdates
);

router.post(
  "/:shopId/lead",
  optionalAuth,
  validate({
    params: shopSchema.shopIdParam,
    body: shopSchema.trackLeadBody,
  }),
  shopController.trackShopLead
);

module.exports = router;
