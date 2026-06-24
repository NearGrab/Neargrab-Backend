const express = require("express");
const validate = require("../../middleware/validate.middleware");
const { optionalAuth } = require("../../middleware/auth.middleware");
const cacheMiddleware = require("../../middleware/cache.middleware");
const exploreController = require("./explore.controller");
const exploreSchema = require("./explore.schema");

const router = express.Router();

router.get(
  "/categories",
  validate({ query: exploreSchema.categoriesQuery }),
  cacheMiddleware({ ttlSeconds: 300, tags: ["category"] }),
  exploreController.listCategories
);

router.get(
  "/brands",
  validate({ query: exploreSchema.brandsQuery }),
  cacheMiddleware({ ttlSeconds: 300, tags: ["brand"] }),
  exploreController.listBrands
);

router.get(
  "/explore",
  optionalAuth,
  validate({ query: exploreSchema.exploreQuery }),
  cacheMiddleware({ ttlSeconds: 60, tags: ["explore"] }),
  exploreController.getExploreFeed
);

module.exports = router;
