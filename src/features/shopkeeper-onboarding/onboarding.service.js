const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const { runInTransaction } = require("../../lib/transaction");
const { createNotification } = require("../notification/notification.service");
const { mapOnboardingState } = require("./onboarding.mapper");

/**
 * Username Normalizer
 */
function normalizeUsername(input) {
  if (!input) return "";
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

/**
 * Slug generator helper
 */
function slugify(input) {
  return normalizeUsername(input);
}

/**
 * Parses radius strings like "1 km" or "1.5 km" into decimals
 */
function parseRadiusKm(input) {
  if (!input) return 1.0;
  const num = parseFloat(input.replace(/[^\d.]/g, ""));
  return isNaN(num) ? 1.0 : num;
}

/**
 * Maps weekday names to numbers
 */
const DAY_MAP = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6
};

/**
 * Safe MediaAsset resolution helper.
 * If media input is already a cuid/uuid, we return it.
 * If it is a base64 or URL (e.g. Cloudinary), we dynamically create/return a MediaAsset.
 */
async function resolveMediaAsset(input, ownerId, tx = null) {
  if (!input) return null;
  const client = tx || getPrisma();

  try {
    const existing = await client.mediaAsset.findUnique({
      where: { id: input },
    });
    if (existing) {
      if (existing.ownerId && existing.ownerId !== ownerId) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.MEDIA_FORBIDDEN,
          message: "You do not own this media asset",
        });
      }
      return existing.id;
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Ignore any db constraints/errors and proceed
  }

  // Check if a MediaAsset with this URL/base64 already exists for the owner
  const existingAsset = await client.mediaAsset.findFirst({
    where: { url: input },
  });
  if (existingAsset) {
    return existingAsset.id;
  }

  // Create a new MediaAsset record (e.g. uploaded via Cloudinary/frontend preset)
  const isBase64 = input.startsWith("data:");
  const media = await client.mediaAsset.create({
    data: {
      url: input,
      key: `onboarding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      bucket: input.includes("cloudinary") ? "cloudinary" : "local",
      mimeType: isBase64 ? input.split(";")[0].split(":")[1] : "image/jpeg",
      sizeBytes: input.length,
      ownerId,
    },
  });

  return media.id;
}

/**
 * Standard fetch shop helper with status validation
 */
async function getShopForUser(userId, tx = null) {
  const client = tx || getPrisma();
  return client.shop.findFirst({
    where: { ownerId: userId, deletedAt: null },
    include: {
      category: true,
      logo: true,
      cover: true,
      address: true,
      contact: true,
      timings: true,
      photos: {
        include: {
          media: true,
        },
      },
      paymentMethods: true,
      languages: true,
      tags: true,
    },
  });
}

/**
 * Asserts shop is not locked for editing
 */
function assertNotLocked(shop) {
  if (shop.status !== "DRAFT" && shop.status !== "REJECTED") {
    throw new AppError({
      statusCode: 403,
      code: ERROR_CODES.SHOP_ONBOARDING_LOCKED,
      message: "Shop onboarding profile is locked and cannot be edited",
    });
  }
}

/**
 * GET current onboarding state
 */
async function getOnboardingState(userId) {
  const shop = await getShopForUser(userId);
  return mapOnboardingState(shop);
}

/**
 * POST start draft shop
 */
async function startDraft(userId, input) {
  const prisma = getPrisma();

  // Validate user status
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });
  if (!user || user.status !== "ACTIVE") {
    throw new AppError({
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
      message: "User status must be ACTIVE to start onboarding",
    });
  }

  // Return existing shop state if already registered
  const existingShop = await getShopForUser(userId);
  if (existingShop) {
    return mapOnboardingState(existingShop);
  }

  const normalized = normalizeUsername(input.username);

  // Check unique username & slug
  const taken = await prisma.shop.findFirst({
    where: {
      OR: [
        { username: normalized },
        { slug: normalized },
      ],
      deletedAt: null,
    },
  });
  if (taken) {
    throw new AppError({
      statusCode: 409,
      code: ERROR_CODES.SHOP_USERNAME_TAKEN,
      message: "Shop username is already taken",
    });
  }

  const shop = await prisma.shop.create({
    data: {
      ownerId: userId,
      name: input.name,
      username: normalized,
      slug: normalized,
      status: "DRAFT",
      verificationStatus: "UNVERIFIED",
    },
    include: {
      category: true,
      logo: true,
      cover: true,
      address: true,
      contact: true,
      timings: true,
      photos: {
        include: {
          media: true,
        },
      },
      paymentMethods: true,
      languages: true,
      tags: true,
    },
  });

  return mapOnboardingState(shop);
}

/**
 * PATCH Details Step
 */
async function updateDetails(userId, data) {
  const prisma = getPrisma();

  let shop = await getShopForUser(userId);
  if (!shop) {
    if (data.name && data.username) {
      await startDraft(userId, { name: data.name, username: data.username });
      shop = await getShopForUser(userId);
    } else {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.SHOP_ONBOARDING_NOT_FOUND,
        message: "Shop onboarding draft not found",
      });
    }
  }

  assertNotLocked(shop);

  const normalized = normalizeUsername(data.username);

  // Verify username uniqueness
  const taken = await prisma.shop.findFirst({
    where: {
      OR: [
        { username: normalized },
        { slug: normalized },
      ],
      id: { not: shop.id },
      deletedAt: null,
    },
  });
  if (taken) {
    throw new AppError({
      statusCode: 409,
      code: ERROR_CODES.SHOP_USERNAME_TAKEN,
      message: "Shop username is already taken",
    });
  }

  // Handle Category mapping
  let resolvedCategoryId = data.categoryId || null;
  if (!resolvedCategoryId && data.category) {
    const matched = await prisma.category.findFirst({
      where: {
        OR: [
          { name: { equals: data.category, mode: "insensitive" } },
          { slug: { equals: data.category.toLowerCase().replace(/[^a-z0-9-_]/g, "-"), mode: "insensitive" } },
        ],
      },
    });
    if (matched) {
      resolvedCategoryId = matched.id;
    }
  }

  // Ensure category is valid if categoryId is supplied
  if (resolvedCategoryId) {
    const cat = await prisma.category.findUnique({
      where: { id: resolvedCategoryId },
    });
    if (!cat) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Invalid categoryId provided",
      });
    }
  }

  // Update in transaction
  const updated = await runInTransaction(async (tx) => {
    let logoId = shop.logoId;
    if (data.logoMediaId) {
      logoId = await resolveMediaAsset(data.logoMediaId, userId, tx);
    }

    return tx.shop.update({
      where: { id: shop.id },
      data: {
        name: data.name,
        username: normalized,
        slug: normalized,
        categoryId: resolvedCategoryId,
        type: data.type,
        establishedYear: data.establishedYear || null,
        gstNumber: data.gstNumber || null,
        description: data.description,
        logoId,
      },
    });
  });

  return getOnboardingState(userId);
}

/**
 * PATCH Address Step
 */
async function updateAddress(userId, data) {
  const shop = await getShopForUser(userId);
  if (!shop) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.SHOP_ONBOARDING_NOT_FOUND,
      message: "Shop onboarding draft not found",
    });
  }

  assertNotLocked(shop);

  const radiusKm = data.serviceRadiusKm || parseRadiusKm(data.radius);

  await runInTransaction(async (tx) => {
    await tx.shopAddress.upsert({
      where: { shopId: shop.id },
      update: {
        street: data.street,
        landmark: data.landmark || null,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        latitude: data.coordinates.lat,
        longitude: data.coordinates.lng,
        serviceRadiusKm: radiusKm,
      },
      create: {
        shopId: shop.id,
        street: data.street,
        landmark: data.landmark || null,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        latitude: data.coordinates.lat,
        longitude: data.coordinates.lng,
        serviceRadiusKm: radiusKm,
      },
    });
  });

  return getOnboardingState(userId);
}

/**
 * PATCH Contact & Timings Step
 */
async function updateContact(userId, data) {
  const shop = await getShopForUser(userId);
  if (!shop) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.SHOP_ONBOARDING_NOT_FOUND,
      message: "Shop onboarding draft not found",
    });
  }

  assertNotLocked(shop);

  const acceptCalls = data.preferences?.acceptCalls ?? true;
  const enableStockRequests = data.preferences?.enableStockRequests ?? true;
  const receiveNotifications = data.preferences?.receiveNotifications ?? true;

  await runInTransaction(async (tx) => {
    // 1. Upsert Contact
    await tx.shopContact.upsert({
      where: { shopId: shop.id },
      update: {
        phone: data.phone,
        whatsapp: data.whatsapp,
        alternatePhone: data.alternatePhone || null,
        email: data.email || null,
        acceptCalls,
        enableStockRequests,
        receiveNotifications,
      },
      create: {
        shopId: shop.id,
        phone: data.phone,
        whatsapp: data.whatsapp,
        alternatePhone: data.alternatePhone || null,
        email: data.email || null,
        acceptCalls,
        enableStockRequests,
        receiveNotifications,
      },
    });

    // 2. Recreate Weekday Timings
    await tx.shopTiming.deleteMany({
      where: { shopId: shop.id },
    });

    const openWeekdays = new Set(
      data.weekdays
        .map((dayStr) => DAY_MAP[dayStr.toLowerCase()])
        .filter((d) => d !== undefined)
    );

    const timings = [0, 1, 2, 3, 4, 5, 6].map((dayNum) => {
      const isOpen = openWeekdays.has(dayNum);
      return {
        shopId: shop.id,
        weekday: dayNum,
        opensAt: isOpen ? data.openingTime : "08:00 AM",
        closesAt: isOpen ? data.closingTime : "10:00 PM",
        isClosed: !isOpen,
      };
    });

    await tx.shopTiming.createMany({
      data: timings,
    });
  });

  return getOnboardingState(userId);
}

/**
 * PATCH Business Info, Languages, Tags & Payment Methods
 */
async function updateBusiness(userId, data) {
  const shop = await getShopForUser(userId);
  if (!shop) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.SHOP_ONBOARDING_NOT_FOUND,
      message: "Shop onboarding draft not found",
    });
  }

  assertNotLocked(shop);

  await runInTransaction(async (tx) => {
    // 1. Update GST & PAN
    await tx.shop.update({
      where: { id: shop.id },
      data: {
        gstNumber: data.gstNumber || null,
        panNumber: data.panNumber || null,
      },
    });

    // 2. Languages
    await tx.shopLanguage.deleteMany({ where: { shopId: shop.id } });
    if (data.languages && data.languages.length > 0) {
      await tx.shopLanguage.createMany({
        data: data.languages.map((lang) => ({
          shopId: shop.id,
          language: lang,
        })),
      });
    }

    // 3. Tags (includes user tags + system Price/HomeDelivery tags)
    const finalTags = [...(data.tags || [])];
    if (data.priceRange) {
      finalTags.push(`Price: ${data.priceRange}`);
    }
    if (data.homeDelivery) {
      finalTags.push("Home Delivery");
    }

    await tx.shopTag.deleteMany({ where: { shopId: shop.id } });
    const uniqueTags = [...new Set(finalTags)];
    if (uniqueTags.length > 0) {
      await tx.shopTag.createMany({
        data: uniqueTags.map((tag) => ({
          shopId: shop.id,
          tag,
        })),
      });
    }

    // 4. Payment Methods
    await tx.shopPaymentMethod.deleteMany({ where: { shopId: shop.id } });
    const paymentMethods = [
      { shopId: shop.id, method: "CASH", enabled: true, upiId: null },
    ];
    if (data.digitalPayments) {
      paymentMethods.push({
        shopId: shop.id,
        method: "UPI",
        enabled: true,
        upiId: data.upiId || null,
      });
    }
    await tx.shopPaymentMethod.createMany({
      data: paymentMethods,
    });

    // 5. Registration Document
    if (data.registrationDocMediaId) {
      const mediaId = await resolveMediaAsset(data.registrationDocMediaId, userId, tx);
      await tx.shopPhoto.deleteMany({
        where: { shopId: shop.id, kind: "registration_doc" },
      });
      await tx.shopPhoto.create({
        data: {
          shopId: shop.id,
          mediaId,
          kind: "registration_doc",
          sortOrder: 0,
        },
      });
    }
  });

  return getOnboardingState(userId);
}

/**
 * PATCH Photos & Logos
 */
async function updatePhotos(userId, data) {
  const shop = await getShopForUser(userId);
  if (!shop) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.SHOP_ONBOARDING_NOT_FOUND,
      message: "Shop onboarding draft not found",
    });
  }

  assertNotLocked(shop);

  await runInTransaction(async (tx) => {
    // 1. Update logo & cover media IDs
    let logoId = shop.logoId;
    if (data.logoMediaId) {
      logoId = await resolveMediaAsset(data.logoMediaId, userId, tx);
    }
    let coverId = shop.coverId;
    if (data.coverMediaId) {
      coverId = await resolveMediaAsset(data.coverMediaId, userId, tx);
    }

    await tx.shop.update({
      where: { id: shop.id },
      data: { logoId, coverId },
    });

    // 2. Replace Front, Inside, Additional Photos (preserving registration_doc)
    await tx.shopPhoto.deleteMany({
      where: {
        shopId: shop.id,
        kind: { in: ["front", "inside", "additional"] },
      },
    });

    const photoRecords = [];
    if (data.photos && Array.isArray(data.photos)) {
      for (const p of data.photos) {
        const mediaId = await resolveMediaAsset(p.mediaId, userId, tx);
        photoRecords.push({
          shopId: shop.id,
          mediaId,
          kind: p.kind,
          sortOrder: p.sortOrder || 0,
        });
      }
    }

    if (photoRecords.length > 0) {
      await tx.shopPhoto.createMany({
        data: photoRecords,
      });
    }
  });

  return getOnboardingState(userId);
}

/**
 * POST Submit Profile for Verification
 */
async function submitOnboarding(userId) {
  const prisma = getPrisma();

  const shop = await getShopForUser(userId);
  if (!shop) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.SHOP_ONBOARDING_NOT_FOUND,
      message: "Shop onboarding draft not found",
    });
  }

  assertNotLocked(shop);

  // Validate submittability
  const state = mapOnboardingState(shop);
  if (!state.completion.submittable) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.SHOP_ONBOARDING_INCOMPLETE,
      message: "Please complete all required fields before submitting",
      details: { missing: state.completion.missing },
    });
  }

  // Update in a single transaction
  await runInTransaction(async (tx) => {
    // 1. Update shop status
    await tx.shop.update({
      where: { id: shop.id },
      data: {
        status: "PENDING_REVIEW",
        verificationStatus: "PENDING",
      },
    });

    // 2. Upgrade user role
    await tx.user.update({
      where: { id: userId },
      data: {
        role: "SHOPKEEPER",
      },
    });

    // 3. Send Notification to Owner
    await createNotification({
      userId,
      type: "SHOP",
      title: "Shop submitted for review",
      message: `Your shop ${shop.name} has been submitted for verification.`,
      actionUrl: "/shopkeeper/dashboard",
      data: { shopId: shop.id },
      tx,
    });

    // 4. Send Notifications to Admins
    const admins = await tx.user.findMany({
      where: {
        role: { in: ["ADMIN", "SUPER_ADMIN", "SUPPORT_ADMIN"] },
        status: "ACTIVE",
      },
    });

    const city = shop.address?.city || "Navsari";
    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: "SHOP",
        title: "New shop pending review",
        message: `${shop.name} in ${city} is waiting for verification.`,
        actionUrl: `/admin/shops/${shop.id}`,
        data: { shopId: shop.id },
        tx,
      });
    }
  });

  return getOnboardingState(userId);
}

module.exports = {
  getOnboardingState,
  startDraft,
  updateDetails,
  updateAddress,
  updateContact,
  updateBusiness,
  updatePhotos,
  submitOnboarding,
};
