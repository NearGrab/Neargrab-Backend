const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const { buildPaginationMeta } = require("../../lib/pagination");
const { mapNotification } = require("./notification.mapper");

const CHANNELS = ["IN_APP", "EMAIL", "SMS", "WHATSAPP", "PUSH"];
const TYPES = [
  "SYSTEM",
  "PROMO",
  "PRODUCT",
  "SHOP",
  "REVIEW",
  "STOCK",
  "RESERVATION",
  "SECURITY",
];

const ALERT_TYPES = [
  "SYSTEM",
  "PROMO",
  "PRODUCT",
  "SHOP",
  "STOCK",
  "RESERVATION",
  "SECURITY",
];

/**
 * Service function to create an in-app notification.
 * Respects IN_APP notification preferences.
 */
async function createNotification({
  userId,
  type,
  title,
  message,
  data = null,
  actionUrl = null,
  tx = null,
}) {
  const client = tx || getPrisma();

  if (!client.notificationPreference || typeof client.notificationPreference.findUnique !== "function") {
    if (client.notification) {
      return client.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          data: data || undefined,
          actionUrl,
        },
      });
    }
    return null;
  }

  // Look up preference for IN_APP channel of this type
  const pref = await client.notificationPreference.findUnique({
    where: {
      userId_channel_type: {
        userId,
        channel: "IN_APP",
        type,
      },
    },
  });

  if (pref && !pref.enabled) {
    return null; // Disabled by user preference
  }

  return client.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data || undefined,
      actionUrl,
    },
  });
}

/**
 * Lists paginated notifications.
 */
async function listNotifications(userId, filters) {
  const prisma = getPrisma();
  const { type, read, page = 1, limit = 20 } = filters;

  const where = { userId };
  if (type) {
    where.type = type;
  }
  if (read !== undefined) {
    where.readAt = read ? { not: null } : null;
  }

  const skip = (page - 1) * limit;

  const [total, unreadCount, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  const now = new Date();
  const data = notifications.map((n) => mapNotification(n, now));
  const meta = buildPaginationMeta({ page, limit, total });
  meta.unreadCount = unreadCount;

  return { data, meta };
}

/**
 * Marks one notification as read.
 */
async function markAsRead(userId, notificationId) {
  const prisma = getPrisma();

  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOTIFICATION_NOT_FOUND,
      message: "Notification not found",
    });
  }

  let updated = notification;
  if (!notification.readAt) {
    updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  return mapNotification(updated);
}

/**
 * Marks all notifications as read.
 */
async function markAllAsRead(userId) {
  const prisma = getPrisma();

  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  return { updatedCount: count };
}

/**
 * Deletes a notification.
 */
async function deleteNotification(userId, notificationId) {
  const prisma = getPrisma();

  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOTIFICATION_NOT_FOUND,
      message: "Notification not found",
    });
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  return { deleted: true };
}

/**
 * Gets normalized notification preferences.
 */
async function getPreferences(userId) {
  const prisma = getPrisma();

  const dbPrefs = await prisma.notificationPreference.findMany({
    where: { userId },
  });

  const preferences = [];
  for (const channel of CHANNELS) {
    for (const type of TYPES) {
      const found = dbPrefs.find(
        (p) => p.channel === channel && p.type === type
      );
      preferences.push({
        channel,
        type,
        enabled: found ? found.enabled : true,
      });
    }
  }

  // Build simple UI flags based on preference values
  const push = preferences
    .filter((p) => p.channel === "PUSH")
    .every((p) => p.enabled);
  const email = preferences
    .filter((p) => p.channel === "EMAIL")
    .every((p) => p.enabled);
  const alerts = preferences
    .filter((p) => p.channel === "IN_APP" && ALERT_TYPES.includes(p.type))
    .every((p) => p.enabled);
  const likes =
    preferences.find((p) => p.channel === "IN_APP" && p.type === "REVIEW")
      ?.enabled ?? true;
  const follows =
    preferences.find((p) => p.channel === "IN_APP" && p.type === "SHOP")
      ?.enabled ?? true;

  return {
    preferences,
    ui: {
      push,
      email,
      alerts,
      likes,
      follows,
    },
  };
}

/**
 * Updates preferences (handles bulk array or simple toggles).
 */
async function updatePreferences(userId, update) {
  const prisma = getPrisma();
  const { preferences, key, enabled } = update;

  if (preferences && Array.isArray(preferences)) {
    for (const pref of preferences) {
      await prisma.notificationPreference.upsert({
        where: {
          userId_channel_type: {
            userId,
            channel: pref.channel,
            type: pref.type,
          },
        },
        update: { enabled: pref.enabled },
        create: {
          userId,
          channel: pref.channel,
          type: pref.type,
          enabled: pref.enabled,
        },
      });
    }
  } else if (key && enabled !== undefined) {
    if (key === "push") {
      for (const type of TYPES) {
        await prisma.notificationPreference.upsert({
          where: {
            userId_channel_type: { userId, channel: "PUSH", type },
          },
          update: { enabled },
          create: { userId, channel: "PUSH", type, enabled },
        });
      }
    } else if (key === "email") {
      for (const type of TYPES) {
        await prisma.notificationPreference.upsert({
          where: {
            userId_channel_type: { userId, channel: "EMAIL", type },
          },
          update: { enabled },
          create: { userId, channel: "EMAIL", type, enabled },
        });
      }
    } else if (key === "alerts") {
      for (const type of ALERT_TYPES) {
        await prisma.notificationPreference.upsert({
          where: {
            userId_channel_type: { userId, channel: "IN_APP", type },
          },
          update: { enabled },
          create: { userId, channel: "IN_APP", type, enabled },
        });
      }
    } else if (key === "likes") {
      await prisma.notificationPreference.upsert({
        where: {
          userId_channel_type: { userId, channel: "IN_APP", type: "REVIEW" },
        },
        update: { enabled },
        create: { userId, channel: "IN_APP", type: "REVIEW", enabled },
      });
    } else if (key === "follows") {
      await prisma.notificationPreference.upsert({
        where: {
          userId_channel_type: { userId, channel: "IN_APP", type: "SHOP" },
        },
        update: { enabled },
        create: { userId, channel: "IN_APP", type: "SHOP", enabled },
      });
    }
  }

  return getPreferences(userId);
}

module.exports = {
  createNotification,
  listNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
};
