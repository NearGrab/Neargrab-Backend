const express = require("express");
const validate = require("../../middleware/validate.middleware");
const { optionalAuth } = require("../../middleware/auth.middleware");
const exploreController = require("./explore.controller");
const exploreSchema = require("./explore.schema");

const router = express.Router();

router.get(
  "/categories",
  validate({ query: exploreSchema.categoriesQuery }),
  exploreController.listCategories
);

router.get(
  "/brands",
  validate({ query: exploreSchema.brandsQuery }),
  exploreController.listBrands
);

router.get(
  "/explore",
  optionalAuth,
  validate({ query: exploreSchema.exploreQuery }),
  exploreController.getExploreFeed
);

module.exports = router;
