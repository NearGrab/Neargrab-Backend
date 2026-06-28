const { z } = require("zod");

const usernameRegex = /^[a-z0-9-_]+$/;

const startDraftBody = z.object({
  name: z.string().trim().min(1, "Shop name is required"),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(40, "Username cannot exceed 40 characters")
    .regex(usernameRegex, "Username can only contain lowercase letters, numbers, hyphens, and underscores"),
});

const detailsBody = z.object({
  name: z.string().trim().min(1, "Shop name is required"),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(40, "Username cannot exceed 40 characters")
    .regex(usernameRegex, "Username can only contain lowercase letters, numbers, hyphens, and underscores"),
  category: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  type: z.string().trim().min(1, "Shop type is required"),
  establishedYear: z
    .preprocess(
      (val) => (val === "" || val === undefined ? undefined : Number(val)),
      z.number().int().min(1800).max(new Date().getFullYear() + 1)
    )
    .optional(),
  gstNumber: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .optional()
    .or(z.literal("")),
  description: z.string().trim().min(1, "Description is required").max(300, "Description cannot exceed 300 characters"),
  logoMediaId: z.string().trim().optional().or(z.literal("")),
}).refine((data) => data.category || data.categoryId, {
  message: "Either category name or categoryId must be provided",
  path: ["category"],
});

const addressBody = z.object({
  street: z.string().trim().min(1, "Street is required"),
  landmark: z.string().trim().min(1, "Landmark is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  pincode: z.string().trim().length(6, "Pincode must be exactly 6 digits").regex(/^\d+$/, "Pincode must contain only numbers"),
  coordinates: z.object({
    lat: z.number({ required_error: "Latitude is required" }).min(-90).max(90),
    lng: z.number({ required_error: "Longitude is required" }).min(-180).max(180),
  }),
  radius: z.string().trim().optional(),
  serviceRadiusKm: z.number().min(0.5).max(25).optional(),
  googleMapsUrl: z.string().trim().optional().or(z.literal("")),
});

const contactBody = z.object({
  phone: z.string().trim().length(10, "Phone number must be exactly 10 digits").regex(/^\d+$/, "Phone must contain only numbers"),
  whatsapp: z.string().trim().length(10, "WhatsApp number must be exactly 10 digits").regex(/^\d+$/, "WhatsApp must contain only numbers"),
  alternatePhone: z
    .string()
    .trim()
    .length(10, "Alternate phone must be exactly 10 digits")
    .regex(/^\d+$/, "Alternate phone must contain only numbers")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("Invalid email address").optional().or(z.literal("")),
  openingTime: z.string().trim().min(1, "Opening time is required"),
  closingTime: z.string().trim().min(1, "Closing time is required"),
  weekdays: z.array(z.string()).min(1, "At least one weekday must be selected"),
  preferences: z
    .object({
      acceptCalls: z.boolean().default(true),
      enableStockRequests: z.boolean().default(true),
      receiveNotifications: z.boolean().default(true),
    })
    .default({}),
});

const businessBody = z.object({
  gstNumber: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .optional()
    .or(z.literal("")),
  panNumber: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .optional()
    .or(z.literal("")),
  registrationDocMediaId: z.string().trim().optional().or(z.literal("")),
  languages: z.array(z.string()).min(1, "At least one language must be selected"),
  priceRange: z.string().trim().optional(),
  tags: z.array(z.string()).max(5, "You can select a maximum of 5 tags").default([]),
  homeDelivery: z.boolean().default(false),
  digitalPayments: z.boolean().default(false),
  upiId: z.string().trim().optional().or(z.literal("")),
}).refine((data) => !data.digitalPayments || (data.upiId && data.upiId.trim().length > 0), {
  message: "UPI ID is required if digital payments are enabled",
  path: ["upiId"],
});

const photosBody = z.object({
  logoMediaId: z.string().trim().optional().or(z.literal("")),
  coverMediaId: z.string().trim().optional().or(z.literal("")),
  photos: z
    .array(
      z.object({
        mediaId: z.string().trim().min(1, "mediaId is required"),
        kind: z.enum(["front", "inside", "logo", "cover", "additional", "registration_doc"]),
        sortOrder: z.number().int().default(0),
      })
    )
    .default([]),
});

module.exports = {
  startDraftBody,
  detailsBody,
  addressBody,
  contactBody,
  businessBody,
  photosBody,
};
