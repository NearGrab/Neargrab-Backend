const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const https = require("https");
const env = require("../config/env");
const { AppError, ERROR_CODES } = require("../lib/errors");
const { getPrisma } = require("../config/prisma");
const logger = require("../config/logger");

// Cache for public keys: kid -> KeyObject
const pubKeyCache = new Map();

// Fallback hardcoded JWK if network fails and ref matches
const fallbackJwk = {
  alg: "ES256",
  crv: "P-256",
  ext: true,
  key_ops: ["verify"],
  kid: "51a05226-da50-4877-99cf-f0edc01792c0",
  kty: "EC",
  use: "sig",
  x: "dLeaAZKJ0q8QxeIwjdN8PeSJvNj3nOSmDa_vDCtx4Ec",
  y: "fXJGSGJSJmqhrc0eVhmjRN6_FoMZvGLEffWfdMHpIRI"
};

function fetchJwks(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

async function getPublicKeyForToken(decoded) {
  const kid = decoded?.header?.kid;
  const iss = decoded?.payload?.iss;

  if (!kid) return null;

  if (pubKeyCache.has(kid)) {
    return pubKeyCache.get(kid);
  }

  // If issuer is present, fetch JWKS dynamically from issuer URL
  if (iss && iss.startsWith("https://") && iss.includes(".supabase.co")) {
    try {
      const jwksUrl = `${iss}/.well-known/jwks.json`;
      logger.info(`verifyToken: Fetching JWKS from issuer: ${jwksUrl}`);
      const jwks = await fetchJwks(jwksUrl);
      if (jwks && Array.isArray(jwks.keys)) {
        for (const key of jwks.keys) {
          if (key.kid && key.kty) {
            const pubKey = crypto.createPublicKey({
              key,
              format: "jwk"
            });
            pubKeyCache.set(key.kid, pubKey);
          }
        }
        if (pubKeyCache.has(kid)) {
          return pubKeyCache.get(kid);
        }
      }
    } catch (err) {
      logger.error(`verifyToken: Dynamic JWKS retrieval failed: ${err.message}`);
    }
  }

  // Fallback to hardcoded JWK if kid matches
  if (kid === fallbackJwk.kid) {
    logger.info("verifyToken: Using hardcoded fallback JWK for ES256");
    try {
      const pubKey = crypto.createPublicKey({
        key: fallbackJwk,
        format: "jwk"
      });
      pubKeyCache.set(fallbackJwk.kid, pubKey);
      return pubKey;
    } catch (err) {
      logger.error(`verifyToken: Failed to create fallback key: ${err.message}`);
    }
  }

  return null;
}

/**
 * Creates default notification preferences matrix for a user.
 */
function getDefaultNotificationPrefs() {
  const channels = ["IN_APP", "EMAIL", "SMS", "WHATSAPP", "PUSH"];
  const types = [
    "SYSTEM",
    "PROMO",
    "PRODUCT",
    "SHOP",
    "REVIEW",
    "STOCK",
    "RESERVATION",
    "SECURITY",
  ];
  const prefs = [];
  for (const channel of channels) {
    for (const type of types) {
      prefs.push({
        channel,
        type,
        enabled: true,
      });
    }
  }
  return prefs;
}

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

  // 1. First, decode token without verification to read alg, iss, kid
  let decoded = null;
  const decodedWithoutVerification = jwt.decode(token, { complete: true });
  const alg = decodedWithoutVerification?.header?.alg;

  if (alg === "ES256") {
    try {
      logger.info("verifyToken: Attempting ES256 verification using JWKS public key");
      const publicKey = await getPublicKeyForToken(decodedWithoutVerification);
      if (!publicKey) {
        throw new Error("No public key matching the token kid could be found");
      }
      decoded = jwt.verify(token, publicKey, { algorithms: ["ES256"] });
      logger.info(`verifyToken: Supabase ES256 verification success. Decoded sub: ${decoded?.sub} email: ${decoded?.email}`);
    } catch (err) {
      logger.error(`verifyToken: Supabase ES256 verification failed with error: ${err.message}`);
    }
  } else {
    // Fallback/legacy HS256 verification
    const supabaseSecret = env.SUPABASE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
    if (supabaseSecret) {
      try {
        logger.info("verifyToken: Attempting HS256 verification with configured secret");
        decoded = jwt.verify(token, supabaseSecret, { algorithms: ["HS256"] });
        logger.info(`verifyToken: Supabase HS256 verification success. Decoded sub: ${decoded?.sub} email: ${decoded?.email}`);
      } catch (err) {
        logger.error(`verifyToken: Supabase HS256 verification failed with error: ${err.message}`);
      }
    }
  }

  if (decoded && decoded.sub) {
    const prisma = getPrisma();
    let user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, role: true, status: true },
    });

    // Fallback: search by email to map seeded users
    if (!user && decoded.email) {
      logger.info(`verifyToken: User not found by ID, searching by email: ${decoded.email}`);
      user = await prisma.user.findUnique({
        where: { email: decoded.email },
        select: { id: true, role: true, status: true },
      });
    }

    // Lazy sync: create database record for new Supabase authenticated users
    if (!user && decoded.email) {
      const email = decoded.email;
      const metadata = decoded.user_metadata || {};
      const name = metadata.full_name || metadata.name || email.split("@")[0];
      const username = metadata.username || email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
      
      let finalUsername = username;
      const existingUser = await prisma.user.findUnique({ where: { username: finalUsername } });
      if (existingUser) {
        finalUsername = `${username}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      logger.info({ email, name, username: finalUsername }, "verifyToken: User not found in DB. Creating lazy sync user record");
      user = await prisma.user.create({
        data: {
          id: decoded.sub,
          email,
          name,
          username: finalUsername,
          role: "CUSTOMER",
          status: "ACTIVE",
          profile: {
            create: {
              privacyJson: {},
              preferencesJson: {},
            },
          },
          notificationPreferences: {
            create: getDefaultNotificationPrefs(),
          },
        },
        select: { id: true, role: true, status: true },
      });
    }

    if (user && user.status === "ACTIVE") {
      return {
        id: user.id,
        role: user.role,
        sessionId: null, // Managed client-side by Supabase
      };
    }
  }

  // 2. Fallback to standard token verification (local JWT)
  const secret = env.JWT_ACCESS_SECRET;
  if (!secret) {
    return null;
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
