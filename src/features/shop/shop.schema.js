const { z } = require("zod");

// Helper to coerce string "true"/"false" to boolean
const booleanCoerce = z
  .preprocess((val) => {
    if (val === "true") return true;
    if (val === "false") return false;
    return val;
  }, z.boolean())
  .optional();

const shopIdParam = z.object({
  shopId: z.string().min(1, "Shop ID or slug is required"),
});

const shopProductsQuery = z.object({
  q: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional(),
  inStock: booleanCoerce,
  minPricePaise: z.coerce.number().int().nonnegative().optional(),
  maxPricePaise: z.coerce.number().int().nonnegative().optional(),
  sort: z
    .enum(["relevance", "rating", "price_asc", "price_desc", "newest", "popular"])
    .default("relevance"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const shopReviewsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["newest", "oldest", "rating_high", "rating_low"]).default("newest"),
});

const createShopReviewBody = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().min(1, "Comment is required"),
  reservationId: z.string().optional(),
  mediaIds: z.array(z.string()).optional(),
});

const updatesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const trackLeadBody = z.object({
  source: z.enum([
    "SEARCH",
    "MAP_VIEW",
    "SHOP_PROFILE",
    "CATEGORY_BROWSE",
    "PRODUCT_PAGE",
    "BANNER",
    "OTHER",
  ]),
  productId: z.string().optional(),
  action: z.enum([
    "ADDRESS_REVEAL",
    "MAP_OPEN",
    "CALL_CLICK",
    "WHATSAPP_CLICK",
    "PRODUCT_PAGE_CLICK",
    "SHOP_PROFILE_VIEW",
  ]),
  metadata: z.record(z.any()).optional(),
});

module.exports = {
  shopIdParam,
  shopProductsQuery,
  shopReviewsQuery,
  createShopReviewBody,
  updatesQuery,
  trackLeadBody,
};
