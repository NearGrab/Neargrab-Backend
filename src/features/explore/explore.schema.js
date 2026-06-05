const { z } = require("zod");

// Helper to coerce string "true"/"false" to boolean
const booleanCoerce = z
  .preprocess((val) => {
    if (val === "true") return true;
    if (val === "false") return false;
    return val;
  }, z.boolean())
  .optional();

const categoriesQuery = z.object({
  includeCounts: booleanCoerce.default(false),
  parentId: z.string().nullable().optional(),
  status: z.string().default("active"),
});

const brandsQuery = z.object({
  includeCounts: booleanCoerce.default(false),
  q: z.string().optional(),
  status: z.string().default("active"),
});

const exploreQuery = z.object({
  city: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(100).optional(),
  device: z.enum(["WEB", "IOS", "ANDROID", "ALL"]).optional(),
});

module.exports = {
  categoriesQuery,
  brandsQuery,
  exploreQuery,
};
