const { z } = require("zod");

// Helper to coerce string "true"/"false" to boolean
const booleanCoerce = z
  .preprocess((val) => {
    if (val === "true") return true;
    if (val === "false") return false;
    return val;
  }, z.boolean())
  .optional();

const searchQuery = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(100).optional(),
  categoryId: z.string().optional(),
  categorySlug: z.string().optional(),
  brandId: z.string().optional(),
  brandSlug: z.string().optional(),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional(),
  inStock: booleanCoerce,
  minPricePaise: z.coerce.number().int().nonnegative().optional(),
  maxPricePaise: z.coerce.number().int().nonnegative().optional(),
  sort: z
    .enum(["relevance", "distance", "rating", "price_asc", "price_desc", "newest", "popular"])
    .default("relevance"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const suggestionsQuery = z.object({
  q: z.string().default(""),
  city: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const searchEventBody = z.object({
  query: z.string().min(1),
  city: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(100).optional(),
  filters: z.record(z.any()).optional(),
  resultCount: z.coerce.number().int().nonnegative(),
});

const productRequestBody = z.object({
  query: z.string().min(1, "Query is required"),
  categoryId: z.string().optional(),
  productId: z.string().optional(),
  city: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(100).optional(),
});

module.exports = {
  searchQuery,
  suggestionsQuery,
  searchEventBody,
  productRequestBody,
};
