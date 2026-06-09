const { z } = require("zod");

const phoneRegex = /^\d{10}$/;

const signupBody = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    email: z
      .string()
      .trim()
      .email("Invalid email format")
      .toLowerCase()
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, "Phone must be a 10-digit number")
      .optional()
      .or(z.literal("")),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(100),
    city: z.string().trim().optional(),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters long")
      .max(30, "Username must not exceed 30 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain alphanumeric characters and underscores")
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => (data.email && data.email !== "") || (data.phone && data.phone !== ""), {
    message: "Either email or phone is required",
    path: ["email"],
  });

const loginBody = z.object({
  email: z.string().trim().email("Invalid email format").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

const refreshBody = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

const otpPurposeEnum = z.enum([
  "LOGIN",
  "SIGNUP",
  "PASSWORD_RESET",
  "PHONE_VERIFY",
  "EMAIL_VERIFY",
]);

const otpRequestBody = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Identifier is required")
    .refine(
      (val) => z.string().email().safeParse(val).success || phoneRegex.test(val),
      { message: "Identifier must be a valid email or 10-digit phone number" }
    ),
  purpose: otpPurposeEnum,
});

const otpVerifyBody = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Identifier is required")
    .refine(
      (val) => z.string().email().safeParse(val).success || phoneRegex.test(val),
      { message: "Identifier must be a valid email or 10-digit phone number" }
    ),
  purpose: otpPurposeEnum,
  code: z.string().length(6, "OTP code must be exactly 6 digits").regex(/^\d+$/, "OTP code must be numeric"),
});

const forgotPasswordBody = z.object({
  email: z.string().trim().email("Invalid email format").toLowerCase(),
});

const resetPasswordBody = z.object({
  email: z.string().trim().email("Invalid email format").toLowerCase(),
  code: z.string().length(6, "OTP code must be exactly 6 digits").regex(/^\d+$/, "OTP code must be numeric"),
  password: z.string().min(8, "Password must be at least 8 characters long").max(100),
});

const googleBody = z.object({
  idToken: z.string().min(1, "idToken is required"),
  email: z.string().trim().email("Invalid email format").toLowerCase(),
  name: z.string().trim().min(1, "Name is required"),
  providerUserId: z.string().min(1, "providerUserId is required"),
});

module.exports = {
  signupBody,
  loginBody,
  refreshBody,
  otpRequestBody,
  otpVerifyBody,
  forgotPasswordBody,
  resetPasswordBody,
  googleBody,
};
