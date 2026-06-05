const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { AppError, ERROR_CODES } = require("../lib/errors");
const { getPrisma } = require("../config/prisma");

/**
 * Verifies the bearer JWT from headers and checks user/session in DB.
 */
async function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return null;
  }

  const secret = env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is required but not configured");
  }

  try {
    const decoded = jwt.verify(token, secret);
    
    // Look up user using Prisma to ensure they are active and exist
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub || decoded.userId },
      select: { id: true, role: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    // Optional session verification if sessionId is present in token payload
    if (decoded.sessionId) {
      const session = await prisma.session.findUnique({
        where: { id: decoded.sessionId },
        select: { revokedAt: true, expiresAt: true },
      });

      if (!session || session.revokedAt || new Date() > new Date(session.expiresAt)) {
        return null;
      }
    }

    return {
      id: user.id,
      role: user.role,
      sessionId: decoded.sessionId || null,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Strict authentication middleware.
 * Rejects with 401 UNAUTHENTICATED if token is missing, invalid, or expired.
 */
async function authenticate(req, res, next) {
  try {
    const user = await verifyToken(req);
    if (!user) {
      return next(
        new AppError({
          statusCode: 401,
          code: ERROR_CODES.UNAUTHENTICATED,
          message: "Authentication required",
        })
      );
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional authentication middleware.
 * Attaches user to req.user if valid, else attaches null and continues.
 */
async function optionalAuth(req, res, next) {
  try {
    const user = await verifyToken(req);
    req.user = user;
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuth,
};
