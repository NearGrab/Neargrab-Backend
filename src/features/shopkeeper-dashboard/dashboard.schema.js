const { z } = require("zod");

const productIdParam = z.object({
  productId: z.string().min(1, "Product ID is required"),
});

const imageIdParam = z.object({
  productId: z.string().min(1, "Product ID is required"),
  imageId: z.string().min(1, "Image ID is required"),
});

const reservationIdParam = z.object({
  reservationId: z.string().min(1, "Reservation ID is required"),
});

const weekdayTiming = z.object({
  weekday: z.number().int().min(0).max(6),
  opensAt: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format must be HH:MM"),
  closesAt: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format must be HH:MM"),
  isClosed: z.boolean().default(false),
});

const attachProductImageBody = z.object({
  mediaId: z.string().min(1, "mediaId is required"),
  alt: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

const replaceTimingsBody = z.array(weekdayTiming).length(7, "Must provide timings for exactly 7 days");

const updateProfileBody = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  logoMediaId: z.string().trim().optional().nullable(),
  coverMediaId: z.string().trim().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  address: z.object({
    street: z.string().trim().min(1).optional(),
    landmark: z.string().trim().optional().nullable(),
    city: z.string().trim().min(1).optional(),
    state: z.string().trim().min(1).optional(),
    pincode: z.string().trim().length(6).regex(/^\d+$/).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    serviceRadiusKm: z.number().min(0.5).max(25).optional(),
  }).optional(),
  contact: z.object({
    phone: z.string().trim().length(10).regex(/^\d+$/).optional(),
    whatsapp: z.string().trim().length(10).regex(/^\d+$/).optional().nullable(),
    alternatePhone: z.string().trim().length(10).regex(/^\d+$/).optional().nullable(),
    email: z.string().trim().email().optional().nullable(),
    acceptCalls: z.boolean().optional(),
    enableStockRequests: z.boolean().optional(),
    receiveNotifications: z.boolean().optional(),
  }).optional(),
  paymentMethods: z.array(z.object({
    method: z.enum(["CASH", "UPI", "CARD", "WALLET"]),
    upiId: z.string().trim().optional().nullable(),
    enabled: z.boolean().default(true),
  })).optional(),
  languages: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

const createProductBody = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  sku: z.string().trim().optional(),
  categoryId: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  size: z.string().trim().optional().nullable(),
  unit: z.string().trim().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  pricePaise: z.number().int().nonnegative("Price cannot be negative"),
  mrpPaise: z.number().int().nonnegative("MRP cannot be negative").optional().nullable(),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).default("IN_STOCK"),
  stockAvailable: z.boolean().default(true),
  stockCount: z.number().int().nonnegative().optional().nullable(),
  attributes: z.array(z.object({
    key: z.string().trim().min(1),
    value: z.string().trim().min(1),
  })).optional().default([]),
  imageMediaIds: z.array(z.string()).optional().default([]),
});

const updateProductBody = createProductBody.partial();

const toggleStockBody = z.object({
  stockAvailable: z.boolean().optional(),
  stockCount: z.number().int().nonnegative().optional().nullable(),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional(),
});

const bulkProductsBody = z.object({
  productIds: z.array(z.string()).min(1, "At least one product ID must be provided"),
  action: z.enum(["delete", "update_status", "toggle_stock"]),
  status: z.enum(["ACTIVE", "INACTIVE", "DRAFT"]).optional(),
  stockAvailable: z.boolean().optional(),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional(),
});

const updateReservationStatusBody = z.object({
  status: z.enum(["ACCEPTED", "REJECTED", "COMPLETED"]),
  shopkeeperNote: z.string().trim().max(300).optional(),
});

const listProductsQuery = z.object({
  q: z.string().optional(),
  categoryId: z.string().optional(),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const listReservationsQuery = z.object({
  status: z.enum(["DRAFT", "REQUESTED", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED", "COMPLETED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const listReviewsQuery = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const listLeadsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = {
  productIdParam,
  imageIdParam,
  reservationIdParam,
  replaceTimingsBody,
  attachProductImageBody,
  updateProfileBody,
  createProductBody,
  updateProductBody,
  toggleStockBody,
  bulkProductsBody,
  updateReservationStatusBody,
  listProductsQuery,
  listReservationsQuery,
  listReviewsQuery,
  listLeadsQuery,
};
