const express = require("express");
const validate = require("../../middleware/validate.middleware");
const { optionalAuth } = require("../../middleware/auth.middleware");
const cacheMiddleware = require("../../middleware/cache.middleware");
const searchController = require("./search.controller");
const searchSchema = require("./search.schema");

const router = express.Router();

router.get(
  "/search/products",
  optionalAuth,
  validate({ query: searchSchema.searchQuery }),
  cacheMiddleware({ ttlSeconds: 30, tags: ["search"] }),
  searchController.searchProducts
);

router.get(
  "/search/suggestions",
  validate({ query: searchSchema.suggestionsQuery }),
  cacheMiddleware({ ttlSeconds: 30, tags: ["search"] }),
  searchController.getSuggestions
);

router.post(
  "/search/events",
  optionalAuth,
  validate({ body: searchSchema.searchEventBody }),
  searchController.trackSearchEvent
);

router.post(
  "/product-requests",
  optionalAuth,
  validate({ body: searchSchema.productRequestBody }),
  searchController.createProductRequest
);

module.exports = router;
