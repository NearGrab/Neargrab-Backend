const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../../config/env");
const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");

const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Signs a short-lived access JWT token.
 */
function generateAccessToken(user, session) {
  const secret = env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is required but not configured");
  }
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      sessionId: session.id,
    },
    secret,
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );
}

/**
 * Creates a database session and returns the session details along with the raw refresh token.
 */
async function createSession(userId, userAgent = null, ipAddress = null) {
  const prisma = getPrisma();
  const rawRefreshToken = crypto.randomBytes(40).toString("hex");
  const refreshTokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  const session = await prisma.session.create({
    data: {
      userId,
      refreshTokenHash,
      userAgent,
      ipAddress,
      expiresAt,
    },
  });

  return { session, rawRefreshToken };
}

/**
 * Rotates refresh tokens by validating the old refresh token hash, updating the db entry,
 * and returning a fresh access token / refresh token pair.
 */
async function rotateTokens(oldRawRefreshToken, userAgent = null, ipAddress = null) {
  const prisma = getPrisma();
  const oldHash = hashToken(oldRawRefreshToken);

  const session = await prisma.session.findFirst({
    where: {
      refreshTokenHash: oldHash,
    },
    include: {
      user: true,
    },
  });

  if (!session || session.revokedAt || new Date() > new Date(session.expiresAt)) {
    throw new AppError({
      statusCode: 401,
      code: ERROR_CODES.UNAUTHENTICATED,
      message: "Session is invalid, expired, or revoked",
    });
  }

  const newRawRefreshToken = crypto.randomBytes(40).toString("hex");
  const newHash = hashToken(newRawRefreshToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  const updatedSession = await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newHash,
      expiresAt: newExpiresAt,
      userAgent: userAgent || session.userAgent,
      ipAddress: ipAddress || session.ipAddress,
    },
  });

  const accessToken = generateAccessToken(session.user, updatedSession);

  return {
    accessToken,
    refreshToken: newRawRefreshToken,
    session: updatedSession,
  };
}

/**
 * Revokes a specific session.
 */
async function revokeSession(sessionId) {
  const prisma = getPrisma();
  await prisma.session.updateMany({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revokes all active sessions for a user.
 */
async function revokeAllUserSessions(userId) {
  const prisma = getPrisma();
  await prisma.session.updateMany({
    where: { userId },
    data: { revokedAt: new Date() },
  });
}

module.exports = {
  generateAccessToken,
  createSession,
  rotateTokens,
  revokeSession,
  revokeAllUserSessions,
  hashToken,
};
