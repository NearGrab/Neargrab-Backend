const { z } = require("zod");

const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
const pincodeRegex = /^\d{6}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const updateMeBody = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(100).optional(),
  username: z
    .string()
    .trim()
    .regex(
      usernameRegex,
      "Username must be 3-30 characters long and contain only alphanumeric characters and underscores"
    )
    .optional(),
  avatarId: z.string().cuid("Invalid avatar ID format").optional().nullable(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().regex(pincodeRegex, "Pincode must be exactly 6 digits").optional(),
});

const updateProfileBody = z.object({
  bio: z.string().trim().max(500).optional().nullable(),
  language: z.string().trim().max(10).optional().nullable(),
  dateOfBirth: z
    .string()
    .regex(dateRegex, "Date of birth must be in YYYY-MM-DD format")
    .optional()
    .nullable(),
  privacyJson: z.record(z.any()).optional().nullable(),
  preferencesJson: z.record(z.any()).optional().nullable(),
});

const updateSettingsBody = z.object({
  privacyJson: z.record(z.any()).optional().nullable(),
  preferencesJson: z.record(z.any()).optional().nullable(),
  notificationPreferences: z
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
});

module.exports = {
  updateMeBody,
  updateProfileBody,
  updateSettingsBody,
};
