const { z } = require("zod");

const queryNotifications = z.object({
  type: z
    .enum([
      "SYSTEM",
      "PROMO",
      "PRODUCT",
      "SHOP",
      "REVIEW",
      "STOCK",
      "RESERVATION",
      "SECURITY",
    ])
    .optional(),
  read: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
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
});

const notificationIdParam = z.object({
  notificationId: z
    .string()
    .nonempty({ message: "Notification ID is required" }),
});

const updatePreferencesBody = z.object({
  preferences: z
    .array(
      z.object({
        channel: z.enum(["IN_APP", "EMAIL", "SMS", "WHATSAPP", "PUSH"]),
        type: z.enum([
          "SYSTEM",
          "PROMO",
          "PRODUCT",
          "SHOP",
          "REVIEW",
          "STOCK",
          "RESERVATION",
          "SECURITY",
        ]),
        enabled: z.boolean(),
      })
    )
    .optional(),
  key: z.enum(["push", "email", "alerts", "likes", "follows"]).optional(),
  enabled: z.boolean().optional(),
});

module.exports = {
  queryNotifications,
  notificationIdParam,
  updatePreferencesBody,
};
