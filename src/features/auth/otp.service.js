const crypto = require("crypto");
const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const env = require("../../config/env");

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;

function hashOtp(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Generates a 6-digit OTP code, hashes it, stores it, and returns the metadata.
 * In non-production environments, it returns the raw code for testing/development.
 */
async function generateOtp(identifier, purpose) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const prisma = getPrisma();

  // Invalidate any previous unexpired OTPs for the same identifier and purpose
  await prisma.otpCode.updateMany({
    where: {
      identifier,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      expiresAt: new Date(),
    },
  });

  await prisma.otpCode.create({
    data: {
      identifier,
      purpose,
      codeHash,
      expiresAt,
    },
  });

  return {
    code: env.NODE_ENV !== "production" ? code : null,
    expiresAt,
  };
}

/**
 * Verifies the OTP code. Consumes the OTP on success, or increments attempts on failure.
 * Throws AppError on expiration, excessive attempts, or mismatch.
 */
async function verifyOtp(identifier, purpose, code) {
  const codeHash = hashOtp(code);
  const prisma = getPrisma();

  // Find the latest active OTP code
  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      identifier,
      purpose,
      consumedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!otpRecord || new Date() > new Date(otpRecord.expiresAt)) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "No active OTP request found or code has expired",
    });
  }

  if (otpRecord.attempts >= MAX_ATTEMPTS) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Maximum OTP verification attempts exceeded",
    });
  }

  if (otpRecord.codeHash !== codeHash) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });

    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Invalid OTP code",
    });
  }

  // Consume OTP code
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { consumedAt: new Date() },
  });

  return true;
}

module.exports = {
  generateOtp,
  verifyOtp,
};
