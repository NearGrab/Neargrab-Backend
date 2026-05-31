const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    DATABASE_URL: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().optional(),
    JWT_REFRESH_SECRET: z.string().optional(),
    ACCESS_TOKEN_TTL: z.string().default("15m"),
    REFRESH_TOKEN_TTL: z.string().default("30d"),
    CORS_ORIGINS: z
      .string()
      .default("http://localhost:5173,http://localhost:5174"),
    CLOUDINARY_URLS: z.string().default(""),
    UPLOAD_DRIVER: z.string().default("local"),
    UPLOAD_DIR: z.string().default("uploads"),
    PUBLIC_BASE_URL: z.string().url().default("http://localhost:5000"),
    GOOGLE_CLIENT_ID: z.string().default(""),
    SMS_PROVIDER: z.string().default("mock"),
    EMAIL_PROVIDER: z.string().default("mock"),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production") {
      return;
    }

    ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"].forEach(
      (key) => {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required in production`,
          });
        }
      },
    );
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.flatten().fieldErrors;
  throw new Error(`Invalid environment configuration: ${JSON.stringify(details)}`);
}

const env = {
  ...parsedEnv.data,
  CORS_ORIGINS: parsedEnv.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

module.exports = env;
