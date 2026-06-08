const { z } = require("zod");

// Auth
const loginBody = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Users
const listUsersQuery = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  city: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const updateUserBody = z.object({
  role: z.enum(["CUSTOMER", "SHOPKEEPER", "ADMIN", "SUPER_ADMIN", "SUPPORT_ADMIN", "CONTENT_ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "PENDING", "SUSPENDED", "DEACTIVATED"]).optional(),
});

// Shops
const listShopsQuery = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  verificationStatus: z.string().optional(),
  city: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const verifyShopBody = z.object({
  status: z.enum(["DRAFT", "PENDING_REVIEW", "ACTIVE", "REJECTED", "SUSPENDED", "CLOSED"]),
  verificationStatus: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]),
  reason: z.string().trim().optional().nullable(),
});

// Products
const listProductsQuery = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  stockStatus: z.string().optional(),
  city: z.string().optional(),
  isPinned: z.preprocess((val) => {
    if (val === "true") return true;
    if (val === "false") return false;
    return undefined;
  }, z.boolean().optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const updateProductBody = z.object({
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "ACTIVE", "FLAGGED", "INACTIVE", "DELETED"]).optional(),
  isFlagged: z.boolean().optional(),
});

const bulkProductsBody = z.object({
  productIds: z.array(z.string()).min(1, "At least one product ID must be provided"),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "ACTIVE", "FLAGGED", "INACTIVE", "DELETED"]).optional(),
  isFlagged: z.boolean().optional(),
});

// Banners
const listBannersQuery = z.object({
  search: z.string().optional(),
  city: z.string().optional(),
  section: z.string().optional(),
  status: z.string().optional(),
  device: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const createBannerBody = z.object({
  title: z.string().trim().min(1, "Title is required"),
  shopId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  city: z.string().trim().min(1, "City is required"),
  section: z.enum(["TOP_HERO", "TOP_CAROUSEL", "MIDDLE_BANNER", "BOTTOM_BANNER"]),
  devices: z.array(z.enum(["MOBILE", "DESKTOP"])).min(1, "At least one device target is required"),
  plan: z.string().optional().nullable(),
  imageId: z.string().optional().nullable(),
  startAt: z.preprocess((val) => new Date(val), z.date()),
  endAt: z.preprocess((val) => new Date(val), z.date()),
  sortOrder: z.number().int().default(0),
});

const updateBannerBody = createBannerBody.partial().extend({
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PINNED", "EXPIRED", "INACTIVE"]).optional(),
});

// Content Pages
const updateContentBody = z.object({
  title: z.string().trim().min(1, "Title is required"),
  body: z.any(), // Can be JSON or string, handled by ContentPage model
  status: z.string().optional(),
});

// Moderation
const listReviewsQuery = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const updateReviewBody = z.object({
  status: z.enum(["PUBLISHED", "PENDING", "FLAGGED", "HIDDEN", "DELETED"]),
});

const listFeedbackQuery = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const updateFeedbackBody = z.object({
  status: z.string().min(1, "Status is required"),
});

// Audit Logs
const listAuditLogsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

module.exports = {
  loginBody,
  listUsersQuery,
  updateUserBody,
  listShopsQuery,
  verifyShopBody,
  listProductsQuery,
  updateProductBody,
  bulkProductsBody,
  listBannersQuery,
  createBannerBody,
  updateBannerBody,
  updateContentBody,
  listReviewsQuery,
  updateReviewBody,
  listFeedbackQuery,
  updateFeedbackBody,
  listAuditLogsQuery,
};
