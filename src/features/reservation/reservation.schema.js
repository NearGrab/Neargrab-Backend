const { z } = require("zod");

const createReservationBody = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("cart"),
    shopId: z.string().optional(),
    customerNote: z.string().max(500).optional(),
  }),
  z.object({
    source: z.literal("direct"),
    productId: z.string().nonempty({ message: "Product ID is required" }),
    quantity: z
      .number({ invalid_type_error: "Quantity must be a number" })
      .int()
      .min(1, { message: "Quantity must be at least 1" })
      .max(99, { message: "Quantity cannot exceed 99" }),
    customerNote: z.string().max(500).optional(),
  }),
]);

const queryReservations = z.object({
  status: z
    .enum([
      "DRAFT",
      "REQUESTED",
      "ACCEPTED",
      "REJECTED",
      "CANCELLED",
      "EXPIRED",
      "COMPLETED",
    ])
    .optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val > 0, { message: "Page must be greater than 0" }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => val > 0 && val <= 100, {
      message: "Limit must be between 1 and 100",
    }),
  sort: z.enum(["newest", "oldest"]).optional().default("newest"),
});

const cancelReservationBody = z.object({
  reason: z.string().max(500).optional(),
});

const reservationIdParam = z.object({
  reservationId: z.string().nonempty({ message: "Reservation ID is required" }),
});

module.exports = {
  createReservationBody,
  queryReservations,
  cancelReservationBody,
  reservationIdParam,
};
