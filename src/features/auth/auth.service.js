const bcrypt = require("bcrypt");
const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const tokenService = require("./token.service");
const otpService = require("./otp.service");
const env = require("../../config/env");

/**
 * Normalizes email address.
 */
function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : null;
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
 * Sign up a new user.
 */
async function signup({ name, email, phone, password, city, username, userAgent = null, ipAddress = null }) {
  const prisma = getPrisma();
  const normalizedEmail = normalizeEmail(email);
  const trimmedPhone = phone ? phone.trim() : null;
  const trimmedName = name.trim();
  const trimmedCity = city ? city.trim() : null;

  if (normalizedEmail) {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new AppError({
        statusCode: 409,
        code: ERROR_CODES.EMAIL_ALREADY_EXISTS,
        message: "Email address is already registered",
      });
    }
  }

  if (trimmedPhone) {
    const existingUser = await prisma.user.findUnique({
      where: { phone: trimmedPhone },
    });
    if (existingUser) {
      throw new AppError({
        statusCode: 409,
        code: ERROR_CODES.PHONE_ALREADY_EXISTS,
        message: "Phone number is already registered",
      });
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let finalUsername = username ? username.trim().toLowerCase() : null;
  if (finalUsername) {
    const existingUsername = await prisma.user.findUnique({ where: { username: finalUsername } });
    if (existingUsername) {
      throw new AppError({
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
        message: "Username is already taken",
      });
    }
  } else {
    // Generate username candidate
    const baseUsername = normalizedEmail
      ? normalizedEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "")
      : `user_${Math.floor(100000 + Math.random() * 900000)}`;
    
    let tempUsername = baseUsername;
    const existingUsername = await prisma.user.findUnique({ where: { username: tempUsername } });
    if (existingUsername) {
      tempUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
    }
    finalUsername = tempUsername;
  }

  const user = await prisma.user.create({
    data: {
      name: trimmedName,
      email: normalizedEmail,
      phone: trimmedPhone,
      passwordHash,
      city: trimmedCity,
      username: finalUsername,
      profile: {
        create: {
          privacyJson: {},
          preferencesJson: {},
        },
      },
      authAccounts: {
        create: normalizedEmail
          ? [
              {
                provider: "EMAIL",
                providerUserId: normalizedEmail,
              },
            ]
          : [],
      },
      notificationPreferences: {
        create: getDefaultNotificationPrefs(),
      },
    },
    include: {
      profile: true,
    },
  });

  const { session, rawRefreshToken } = await tokenService.createSession(user.id, userAgent, ipAddress);
  const accessToken = tokenService.generateAccessToken(user, session);

  try {
    const notificationService = require("../notification/notification.service");
    await notificationService.createNotification({
      userId: user.id,
      type: "SECURITY",
      title: "Security update",
      message: "Successful signup. Welcome to Neargrab!",
      actionUrl: "/settings",
    });
  } catch (err) {
    console.error("Failed to create signup security notification:", err);
  }

  // Hide passwordHash in returned object
  const { passwordHash: _, ...safeUser } = user;

  return {
    user: safeUser,
    accessToken,
    refreshToken: rawRefreshToken,
  };
}

/**
 * Login user using email/password.
 */
async function login({ email, password, userAgent = null, ipAddress = null }) {
  const prisma = getPrisma();
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { profile: true },
  });

  if (!user || !user.passwordHash) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.INVALID_CREDENTIALS,
      message: "Invalid email or password",
    });
  }

  if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
    throw new AppError({
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
      message: "Account is suspended or deactivated",
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.INVALID_CREDENTIALS,
      message: "Invalid email or password",
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const { session, rawRefreshToken } = await tokenService.createSession(user.id, userAgent, ipAddress);
  const accessToken = tokenService.generateAccessToken(user, session);

  const { passwordHash: _, ...safeUser } = user;

  return {
    user: safeUser,
    accessToken,
    refreshToken: rawRefreshToken,
  };
}

/**
 * Handle Google Authentication placeholder.
 */
async function googleAuth({ idToken, email, name, providerUserId, userAgent = null, ipAddress = null }) {
  if (env.NODE_ENV === "production") {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Google verification is not configured in production",
    });
  }

  const prisma = getPrisma();
  const normalizedEmail = normalizeEmail(email);

  // Look up user by linked AuthAccount or directly by email
  let authAccount = await prisma.authAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: "GOOGLE",
        providerUserId,
      },
    },
    include: { user: { include: { profile: true } } },
  });

  let user;

  if (authAccount) {
    user = authAccount.user;
  } else {
    // Check if user already exists by email
    user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true },
    });

    if (user) {
      // Link Google Auth account to existing user
      await prisma.authAccount.create({
        data: {
          userId: user.id,
          provider: "GOOGLE",
          providerUserId,
        },
      });
    } else {
      // Create new user
      const baseUsername = normalizedEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
      let username = baseUsername;
      const existingUsername = await prisma.user.findUnique({ where: { username } });
      if (existingUsername) {
        username = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      user = await prisma.user.create({
        data: {
          name,
          email: normalizedEmail,
          username,
          status: "ACTIVE",
          profile: {
            create: {
              privacyJson: {},
              preferencesJson: {},
            },
          },
          authAccounts: {
            create: [
              {
                provider: "GOOGLE",
                providerUserId,
              },
            ],
          },
          notificationPreferences: {
            create: getDefaultNotificationPrefs(),
          },
        },
        include: { profile: true },
      });
    }
  }

  if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
    throw new AppError({
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
      message: "Account is suspended or deactivated",
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const { session, rawRefreshToken } = await tokenService.createSession(user.id, userAgent, ipAddress);
  const accessToken = tokenService.generateAccessToken(user, session);

  const { passwordHash: _, ...safeUser } = user;

  return {
    user: safeUser,
    accessToken,
    refreshToken: rawRefreshToken,
  };
}

/**
 * Request OTP.
 */
async function otpRequest(identifier, purpose) {
  const prisma = getPrisma();
  const isEmail = identifier.includes("@");

  if (purpose === "SIGNUP") {
    const existing = await prisma.user.findUnique({
      where: isEmail ? { email: identifier.toLowerCase() } : { phone: identifier },
    });
    if (existing) {
      throw new AppError({
        statusCode: 409,
        code: isEmail ? ERROR_CODES.EMAIL_ALREADY_EXISTS : ERROR_CODES.PHONE_ALREADY_EXISTS,
        message: `${isEmail ? "Email" : "Phone"} is already registered`,
      });
    }
  }

  if (purpose === "LOGIN" || purpose === "PASSWORD_RESET") {
    const existing = await prisma.user.findUnique({
      where: isEmail ? { email: identifier.toLowerCase() } : { phone: identifier },
    });
    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: "User not found",
      });
    }
  }

  return otpService.generateOtp(identifier, purpose);
}

/**
 * Verify OTP.
 */
async function otpVerify({ identifier, purpose, code, userAgent = null, ipAddress = null }) {
  const prisma = getPrisma();
  await otpService.verifyOtp(identifier, purpose, code);

  const isEmail = identifier.includes("@");
  const user = await prisma.user.findUnique({
    where: isEmail ? { email: identifier.toLowerCase() } : { phone: identifier },
    include: { profile: true },
  });

  // Perform status updates or return tokens on login/signup verification
  if (purpose === "LOGIN" || purpose === "SIGNUP") {
    if (!user) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: "User not found after OTP verification",
      });
    }

    if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: "Account is suspended or deactivated",
      });
    }

    // Mark as verified on successful login/signup verification
    const updateData = {};
    if (isEmail && !user.emailVerifiedAt) {
      updateData.emailVerifiedAt = new Date();
    }
    if (!isEmail && !user.phoneVerifiedAt) {
      updateData.phoneVerifiedAt = new Date();
    }
    updateData.lastLoginAt = new Date();

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      include: { profile: true },
    });

    const { session, rawRefreshToken } = await tokenService.createSession(updatedUser.id, userAgent, ipAddress);
    const accessToken = tokenService.generateAccessToken(updatedUser, session);

    const { passwordHash: _, ...safeUser } = updatedUser;

    return {
      user: safeUser,
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  // Verification step helper: verify phone/email of active logged-in user
  if (user) {
    const updateData = {};
    if (purpose === "PHONE_VERIFY" || purpose === "SIGNUP") {
      updateData.phoneVerifiedAt = new Date();
    } else if (purpose === "EMAIL_VERIFY") {
      updateData.emailVerifiedAt = new Date();
    }
    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });
  }

  return { success: true };
}

/**
 * Start password reset flow.
 */
async function forgotPassword(email) {
  const prisma = getPrisma();
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    // Generic success for security
    return { success: true };
  }

  const otpResult = await otpService.generateOtp(normalizedEmail, "PASSWORD_RESET");
  return {
    success: true,
    ...(env.NODE_ENV !== "production" ? { code: otpResult.code } : {}),
  };
}

/**
 * Complete password reset flow.
 */
async function resetPassword(email, code, newPassword) {
  const prisma = getPrisma();
  const normalizedEmail = normalizeEmail(email);

  await otpService.verifyOtp(normalizedEmail, "PASSWORD_RESET", code);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: "User not found",
    });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  try {
    const notificationService = require("../notification/notification.service");
    await notificationService.createNotification({
      userId: user.id,
      type: "SECURITY",
      title: "Security update",
      message: "Your password was reset successfully.",
      actionUrl: "/settings",
    });
  } catch (err) {
    console.error("Failed to create password reset security notification:", err);
  }

  // Revoke all existing sessions (forces re-login)
  await tokenService.revokeAllUserSessions(user.id);

  return { success: true };
}

/**
 * Logout session.
 */
async function logout(sessionId) {
  await tokenService.revokeSession(sessionId);
  return { success: true };
}

/**
 * Logout all sessions.
 */
async function logoutAll(userId) {
  try {
    const notificationService = require("../notification/notification.service");
    await notificationService.createNotification({
      userId,
      type: "SECURITY",
      title: "Security update",
      message: "Your account was logged out from all active sessions.",
      actionUrl: "/settings",
    });
  } catch (err) {
    console.error("Failed to create logout all security notification:", err);
  }
  await tokenService.revokeAllUserSessions(userId);
  return { success: true };
}

module.exports = {
  signup,
  login,
  googleAuth,
  otpRequest,
  otpVerify,
  forgotPassword,
  resetPassword,
  logout,
  logoutAll,
};
