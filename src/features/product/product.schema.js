const { z } = require("zod");

// Parameter for product identification (accepts either ID or slug)
const productIdParam = z.object({
  productId: z.string().min(1, "Product ID or slug is required"),
});

// GET /products/:productId/stores query validation
const storesQuery = z.object({
  city: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /products/:productId/similar query validation
const similarQuery = z.object({
  city: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// GET /products/:productId/reviews query validation
const reviewsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(["newest", "oldest", "rating_high", "rating_low"]).default("newest"),
});

// POST /products/:productId/reviews body validation
const createReviewBody = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().min(1, "Comment is required"),
  reservationId: z.string().optional(),
  mediaIds: z.array(z.string()).optional(),
});

// POST /products/:productId/view body validation
const trackViewBody = z.object({
  source: z.enum([
    "SEARCH",
    "MAP_VIEW",
    "SHOP_PROFILE",
    "CATEGORY_BROWSE",
    "PRODUCT_PAGE",
    "BANNER",
    "OTHER",
  ]),
  shopId: z.string().optional(),
});

// POST /products/:productId/feedback body validation
const feedbackBody = z.object({
  type: z.string().min(1, "Feedback type is required"),
  subject: z.string().optional(),
  message: z.string().min(1, "Message is required"),
  metadata: z.record(z.any()).optional(),
});

// GET /products/:productId query validation
const productQuery = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

module.exports = {
  productIdParam,
  storesQuery,
  similarQuery,
  reviewsQuery,
  createReviewBody,
  trackViewBody,
  feedbackBody,
  productQuery,
};
