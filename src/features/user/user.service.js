const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const tokenService = require("../auth/token.service");

/**
 * Get current user with profile and shop details.
 */
async function getMe(userId) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      shop: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: "User not found",
    });
  }

  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

/**
 * Update basic user details. Checks for username uniqueness.
 */
async function updateMe(userId, fields) {
  const prisma = getPrisma();

  if (fields.username) {
    const existing = await prisma.user.findFirst({
      where: {
        username: fields.username,
        id: { not: userId },
      },
    });

    if (existing) {
      throw new AppError({
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
        message: "Username is already taken",
      });
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: fields,
    include: {
      profile: true,
      shop: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
  });

  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

/**
 * Get user profile details.
 */
async function getProfile(userId) {
  const prisma = getPrisma();
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: "Profile not found",
    });
  }

  return profile;
}

/**
 * Update user profile details.
 */
async function updateProfile(userId, profileData) {
  const prisma = getPrisma();
  const data = { ...profileData };

  if (data.dateOfBirth) {
    data.dateOfBirth = new Date(data.dateOfBirth);
  }

  const profile = await prisma.userProfile.update({
    where: { userId },
    data,
  });

  return profile;
}

/**
 * Get settings details, including profile privacy/preferences JSON and notification preferences matrix.
 */
async function getSettings(userId) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      profile: {
        select: {
          privacyJson: true,
          preferencesJson: true,
        },
      },
      notificationPreferences: {
        select: {
          channel: true,
          type: true,
          enabled: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: "User not found",
    });
  }

  return {
    privacyJson: user.profile?.privacyJson || {},
    preferencesJson: user.profile?.preferencesJson || {},
    notificationPreferences: user.notificationPreferences || [],
  };
}

/**
 * Update user settings (privacy JSON, preferences JSON, or notification preferences).
 */
async function updateSettings(userId, { privacyJson, preferencesJson, notificationPreferences }) {
  const prisma = getPrisma();

  // Update profile JSON fields if provided
  if (privacyJson !== undefined || preferencesJson !== undefined) {
    const profileData = {};
    if (privacyJson !== undefined) profileData.privacyJson = privacyJson;
    if (preferencesJson !== undefined) profileData.preferencesJson = preferencesJson;

    await prisma.userProfile.update({
      where: { userId },
      data: profileData,
    });
  }

  // Update individual notification preferences via upsert
  if (notificationPreferences && Array.isArray(notificationPreferences)) {
    for (const pref of notificationPreferences) {
      await prisma.notificationPreference.upsert({
        where: {
          userId_channel_type: {
            userId,
            channel: pref.channel,
            type: pref.type,
          },
        },
        update: {
          enabled: pref.enabled,
        },
        create: {
          userId,
          channel: pref.channel,
          type: pref.type,
          enabled: pref.enabled,
        },
      });
    }
  }

  return getSettings(userId);
}

/**
 * Deactivate user account (soft-delete). Revokes all active sessions.
 */
async function deactivateMe(userId) {
  const prisma = getPrisma();

  try {
    const notificationService = require("../notification/notification.service");
    await notificationService.createNotification({
      userId,
      type: "SECURITY",
      title: "Security update",
      message: "Your account has been deactivated successfully.",
      actionUrl: "/settings",
    });
  } catch (err) {
    console.error("Failed to create deactivation security notification:", err);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "DEACTIVATED",
      deletedAt: new Date(),
    },
  });

  await tokenService.revokeAllUserSessions(userId);

  return { success: true };
}

module.exports = {
  getMe,
  updateMe,
  getProfile,
  updateProfile,
  getSettings,
  updateSettings,
  deactivateMe,
};
