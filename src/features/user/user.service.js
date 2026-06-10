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

  if (fields.avatarId) {
    const media = await prisma.mediaAsset.findUnique({
      where: { id: fields.avatarId },
    });
    if (!media) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.MEDIA_NOT_FOUND,
        message: "Avatar media asset not found",
      });
    }
    if (media.ownerId && media.ownerId !== userId) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.MEDIA_FORBIDDEN,
        message: "You do not own this media asset",
      });
    }
  }

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
async function getProfile(userId, currentUserId = null) {
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

  // Fetch User basic info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      createdAt: true,
      name: true,
      username: true,
      avatarId: true,
      city: true,
      state: true,
      avatar: {
        select: { url: true }
      }
    }
  });

  // Fetch reviews count and average rating
  const reviewsAgg = await prisma.review.aggregate({
    where: { userId, status: "PUBLISHED" },
    _count: { id: true },
    _avg: { rating: true },
  });

  // Fetch helpful votes received by user's reviews
  const helpfulVotesResult = await prisma.reviewVote.aggregate({
    where: {
      review: { userId },
      value: { gt: 0 }
    },
    _sum: { value: true }
  });

  // Fetch unique shops visited
  const reviewedShopIds = await prisma.review.findMany({
    where: { userId, status: "PUBLISHED" },
    select: { shopId: true },
    distinct: ['shopId'],
  });
  const reservedShopIds = await prisma.reservation.findMany({
    where: { userId },
    select: { shopId: true },
    distinct: ['shopId'],
  });
  const uniqueShopIds = new Set([
    ...reviewedShopIds.map(r => r.shopId).filter(Boolean),
    ...reservedShopIds.map(r => r.shopId).filter(Boolean),
  ]);

  // Fetch unique cities explored
  const exploredCities = await prisma.review.findMany({
    where: { userId, status: "PUBLISHED" },
    select: {
      shop: {
        select: {
          address: {
            select: { city: true }
          }
        }
      }
    }
  });
  const uniqueCities = new Set(
    exploredCities.map(e => e.shop?.address?.city).filter(Boolean)
  );

  // Fetch real reviews
  const reviews = await prisma.review.findMany({
    where: { userId, status: "PUBLISHED" },
    include: {
      shop: {
        include: { address: true }
      },
      product: {
        include: {
          images: {
            include: { media: true }
          }
        }
      },
      media: {
        include: { media: true }
      },
      _count: {
        select: { votes: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Fetch saved products count
  const savedProductsCount = await prisma.savedProduct.count({
    where: { userId }
  });

  // Fetch real followers and following counts
  const followersCount = await prisma.userFollow.count({
    where: { followingId: userId }
  });
  const followingCount = await prisma.userFollow.count({
    where: { followerId: userId }
  });

  // Determine if the current viewer follows this user
  let isFollowing = false;
  const viewerId = currentUserId || userId;
  if (currentUserId && currentUserId !== userId) {
    const followRecord = await prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: userId
        }
      }
    });
    isFollowing = !!followRecord;
  }

  // Fetch already following list to exclude from recommendations
  const alreadyFollowing = await prisma.userFollow.findMany({
    where: { followerId: viewerId },
    select: { followingId: true }
  });
  const alreadyFollowingIds = alreadyFollowing.map(f => f.followingId);

  // Fetch who to follow (other active users/customers in the system)
  const otherUsers = await prisma.user.findMany({
    where: {
      id: {
        notIn: [viewerId, ...alreadyFollowingIds]
      },
      role: "CUSTOMER",
      status: "ACTIVE"
    },
    select: {
      id: true,
      name: true,
      username: true,
      avatar: { select: { url: true } }
    },
    take: 3
  });

  return {
    ...profile,
    user,
    isFollowing,
    stats: {
      reviewsCount: reviewsAgg._count.id || 0,
      avgRatingGiven: parseFloat((reviewsAgg._avg.rating || 0).toFixed(1)),
      helpfulVotes: helpfulVotesResult._sum.value || 0,
      shopsVisited: uniqueShopIds.size,
      areasExplored: Math.max(1, uniqueCities.size),
      savedProductsCount,
      followingCount,
      followersCount,
    },
    reviews,
    whoToFollow: otherUsers.map(u => ({
      id: u.id,
      name: u.name,
      username: u.username,
      avatar: u.avatar?.url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
    }))
  };
}

/**
 * Follow a user.
 */
async function followUser(followerId, followingId) {
  if (followerId === followingId) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.BAD_REQUEST,
      message: "You cannot follow yourself",
    });
  }

  const prisma = getPrisma();

  // Check if target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: followingId }
  });
  if (!targetUser) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: "User to follow not found",
    });
  }

  await prisma.userFollow.upsert({
    where: {
      followerId_followingId: {
        followerId,
        followingId
      }
    },
    update: {},
    create: {
      followerId,
      followingId
    }
  });

  return { following: true };
}

/**
 * Unfollow a user.
 */
async function unfollowUser(followerId, followingId) {
  const prisma = getPrisma();

  try {
    await prisma.userFollow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId
        }
      }
    });
  } catch (err) {
    // Ignore if not following
  }

  return { following: false };
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

/**
 * Find user by username.
 */
async function getUserByUsername(username) {
  const prisma = getPrisma();
  return prisma.user.findUnique({
    where: { username },
    select: { id: true }
  });
}

module.exports = {
  getMe,
  updateMe,
  getProfile,
  updateProfile,
  getSettings,
  updateSettings,
  deactivateMe,
  followUser,
  unfollowUser,
  getUserByUsername,
};
