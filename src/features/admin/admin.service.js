const bcrypt = require("bcrypt");
const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const tokenService = require("../auth/token.service");
const { createAuditLog } = require("../../lib/audit");
const { parsePagination, buildPaginationMeta } = require("../../lib/pagination");
const { createNotification } = require("../notification/notification.service");

// Relative time helper for dashboard recentActivity
function formatRelativeTime(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function calculateTrend(current, previous) {
  if (previous === 0) {
    return current > 0 ? 100.0 : 0.0;
  }
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}

const NON_ADMIN_ROLES = { notIn: ["ADMIN", "SUPER_ADMIN", "SUPPORT_ADMIN", "CONTENT_ADMIN"] };

// 1. Admin Authentication & Profile
async function adminLogin({ email, password, userAgent = null, ipAddress = null }) {
  const prisma = getPrisma();
  const normalizedEmail = email ? email.trim().toLowerCase() : "";

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

  // Verify role is an admin role
  const adminRoles = ["ADMIN", "SUPER_ADMIN", "SUPPORT_ADMIN", "CONTENT_ADMIN"];
  if (!adminRoles.includes(user.role)) {
    throw new AppError({
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
      message: "Access denied: unauthorized role",
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

  // lastLoginAt update and session creation are independent writes — run in parallel.
  const [, { session, rawRefreshToken }] = await Promise.all([
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
    tokenService.createSession(user.id, userAgent, ipAddress),
  ]);

  const accessToken = tokenService.generateAccessToken(user, session);

  const { passwordHash: _, ...safeUser } = user;

  return {
    user: safeUser,
    accessToken,
    refreshToken: rawRefreshToken,
  };
}

async function getAdminProfile(adminId) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: adminId },
    include: { profile: true },
  });

  if (!user) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.ADMIN_NOT_FOUND,
      message: "Admin not found",
    });
  }

  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

// 2. Admin Dashboard Summary
async function getDashboardSummary() {
  const prisma = getPrisma();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const sourceMetadata = {
    SEARCH: { label: "In-App Search", color: "#1F6E43" },
    MAP_VIEW: { label: "Map View", color: "#28B463" },
    SHOP_PROFILE: { label: "Shop Profile", color: "#F1C40F" },
    CATEGORY_BROWSE: { label: "Category Browse", color: "#A9DFBF" },
    PRODUCT_PAGE: { label: "Product Page", color: "#F59E0B" },
    BANNER: { label: "Banner", color: "#3498DB" },
    OTHER: { label: "Others", color: "#E5E8E8" },
  };

  // Every query below is independent — this used to run as 5 sequential
  // stages (system summary block, totals block, an unbounded city fetch,
  // an unbounded source fetch, then audit logs). It's now a single
  // parallel batch.
  const [
    activeUsers,
    activeShops,
    inStockProducts,
    outOfStockProducts,
    pendingReviews,
    openTickets,
    flaggedProducts,
    flaggedReviews,
    totalUsersCount,
    totalProductsCount,
    totalShopsCount,
    totalReviewsCount,
    totalLeadsCount,
    shopsLast7,
    shopsPrev7,
    reviewsLast7,
    reviewsPrev7,
    leadsLast7,
    leadsPrev7,
    newUsersLast7,
    newUsersPrev7,
    newShopsLast7,
    newShopsPrev7,
    productsLast7,
    productsPrev7,
    leadsBySourceGroups,
    topCitiesRaw,
    logs,
  ] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE", role: NON_ADMIN_ROLES } }),
    prisma.shop.count({ where: { status: "ACTIVE" } }),
    prisma.product.count({ where: { status: "ACTIVE", stockStatus: "IN_STOCK" } }),
    prisma.product.count({ where: { status: "ACTIVE", stockStatus: "OUT_OF_STOCK" } }),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.feedback.count({ where: { status: "open" } }),
    prisma.product.count({ where: { OR: [{ status: "FLAGGED" }, { isFlagged: true }] } }),
    prisma.review.count({ where: { status: "FLAGGED" } }),

    prisma.user.count({ where: { deletedAt: null, role: NON_ADMIN_ROLES } }),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.shop.count({ where: { deletedAt: null } }),
    prisma.review.count({ where: { deletedAt: null } }),
    prisma.shopLead.count(),

    prisma.shop.count({ where: { createdAt: { gte: sevenDaysAgo }, deletedAt: null } }),
    prisma.shop.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }, deletedAt: null } }),

    prisma.review.count({ where: { createdAt: { gte: sevenDaysAgo }, deletedAt: null } }),
    prisma.review.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }, deletedAt: null } }),

    prisma.shopLead.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.shopLead.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),

    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo }, role: NON_ADMIN_ROLES } }),
    prisma.user.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }, role: NON_ADMIN_ROLES } }),

    prisma.shop.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.shop.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),

    prisma.product.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.product.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),

    // `source` is a direct scalar column on ShopLead — native groupBy works,
    // no raw SQL needed. Replaces an unbounded findMany of every lead's
    // source field.
    prisma.shopLead.groupBy({
      by: ["source"],
      _count: { _all: true },
    }),

    // City lives on the related ShopAddress, which Prisma's groupBy can't
    // join across — this needs a raw aggregate instead of pulling every
    // lead row (with a nested shop->address join) into Node to count in JS.
    // NOTE: assumes default Prisma table/column mapping (PascalCase model
    // names, camelCase columns, no @@map/@@field overrides). Verify against
    // your schema.prisma and adjust identifiers if it differs.
    prisma.$queryRaw`
      SELECT sa.city AS city, COUNT(*)::int AS count
      FROM "ShopLead" sl
      JOIN "Shop" s ON s.id = sl."shopId"
      JOIN "ShopAddress" sa ON sa."shopId" = s.id
      WHERE sa.city IS NOT NULL
      GROUP BY sa.city
      ORDER BY count DESC
    `,

    prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { actor: true },
    }),
  ]);

  const flaggedContent = flaggedProducts + flaggedReviews;

  const totalShopsTrend = calculateTrend(shopsLast7, shopsPrev7);
  const totalReviewsTrend = calculateTrend(reviewsLast7, reviewsPrev7);
  const totalLeadsTrend = calculateTrend(leadsLast7, leadsPrev7);
  const newUsersTrend = calculateTrend(newUsersLast7, newUsersPrev7);
  const newShopsTrend = calculateTrend(newShopsLast7, newShopsPrev7);
  const productsAddedTrend = calculateTrend(productsLast7, productsPrev7);

  // Top cities, from the raw aggregate (already grouped + sorted by the DB).
  const maxLeads = topCitiesRaw[0]?.count || 1;
  const topCities = topCitiesRaw.map((row) => ({
    city: row.city,
    leads: row.count,
    percent: parseFloat(((row.count / maxLeads) * 100).toFixed(1)),
  }));

  // Leads by source, from the groupBy result.
  const sourceCounts = {};
  leadsBySourceGroups.forEach((g) => {
    sourceCounts[g.source] = g._count._all;
  });
  const leadsBySource = Object.keys(sourceMetadata).map((key) => {
    const count = sourceCounts[key] || 0;
    const percent = totalLeadsCount > 0 ? parseFloat(((count / totalLeadsCount) * 100).toFixed(1)) : 0.0;
    return {
      source: sourceMetadata[key].label,
      percent,
      color: sourceMetadata[key].color,
    };
  });

  // Recent Activity from AuditLog
  const recentActivity = logs.map((log) => {
    let type = "other";
    let title = "Action performed";
    let desc = log.action;

    if (log.action.includes("register") || log.action.includes("signup")) {
      type = "user_registered";
      title = "New user registered";
      desc = `User signed up`;
    } else if (log.action.includes("shop.verify") || log.action.includes("shop.register")) {
      type = "shop_registered";
      title = "New shop registered";
      desc = `Shop was registered or verified`;
    } else if (log.action.includes("product.create") || log.action.includes("product.add")) {
      type = "product_added";
      title = "Product added";
      desc = `A new catalog item was added`;
    } else if (log.action.includes("review")) {
      type = "review_submitted";
      title = "New review submitted";
      desc = `Review moderated or submitted`;
    }

    return {
      id: log.id,
      type,
      title,
      desc,
      time: formatRelativeTime(log.createdAt),
      icon: type === "shop_registered" ? "store" : type === "user_registered" ? "user" : type === "product_added" ? "box" : "activity",
    };
  });

  return {
    systemSummary: {
      activeUsers,
      activeShops,
      inStockProducts,
      outOfStockProducts,
      pendingReviews,
      openTickets,
      flaggedContent,
    },
    totals: {
      totalUsers: totalUsersCount,
      totalUsersTrend: newUsersTrend,
      totalProducts: totalProductsCount,
      totalProductsTrend: productsAddedTrend,
      totalShops: totalShopsCount,
      totalShopsTrend,
      totalReviews: totalReviewsCount,
      totalReviewsTrend,
      totalLeads: totalLeadsCount,
      totalLeadsTrend,
      newUsers: newUsersLast7,
      newUsersTrend,
      newShops: newShopsLast7,
      newShopsTrend,
      productsAdded: productsLast7,
      productsAddedTrend,
    },
    topCities,
    leadsBySource,
    recentActivity,
  };
}

// 3. User Management
async function listUsers(filters) {
  const prisma = getPrisma();
  const { page, limit, skip, take } = parsePagination(filters);
  const { search, role, status, city } = filters;

  const where = { deletedAt: null };

  if (search) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  if (role && role !== "all") {
    where.role = role.toUpperCase();
  }

  if (status && status !== "all") {
    where.status = status.toUpperCase();
  }

  if (city && city !== "all") {
    where.city = city;
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        avatar: true,
        profile: true,
      },
    }),
  ]);

  const meta = buildPaginationMeta({ page, limit, total });
  return { users, meta };
}

async function getUserDetail(userId) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    include: {
      avatar: true,
      profile: true,
    },
  });

  if (!user) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.USER_NOT_FOUND,
      message: "User not found",
    });
  }

  return user;
}

async function updateUser(userId, data, actorContext) {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
  });

  if (!user) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.USER_NOT_FOUND,
      message: "User not found",
    });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        role: data.role !== undefined ? data.role : undefined,
        status: data.status !== undefined ? data.status : undefined,
      },
      include: {
        avatar: true,
        profile: true,
      },
    });

    // Revoke sessions if suspended or deactivated
    if (data.status === "SUSPENDED" || data.status === "DEACTIVATED") {
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "user.update",
      entityType: "USER",
      entityId: userId,
      before: user,
      after: updated,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return updated;
  });
}

async function deleteUser(userId, actorContext) {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
  });

  if (!user) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.USER_NOT_FOUND,
      message: "User not found",
    });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        status: "DEACTIVATED",
      },
    });

    // Revoke sessions
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "user.delete",
      entityType: "USER",
      entityId: userId,
      before: user,
      after: updated,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return { success: true };
  });
}

// 4. Shop Verification
async function listShops(filters) {
  const prisma = getPrisma();
  const { page, limit, skip, take } = parsePagination(filters);
  const { search, status, verificationStatus, city } = filters;

  const where = { deletedAt: null };

  if (search) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
      { owner: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (status && status !== "all") {
    where.status = status.toUpperCase();
  }

  if (verificationStatus && verificationStatus !== "all") {
    where.verificationStatus = verificationStatus.toUpperCase();
  }

  if (city && city !== "all") {
    where.address = { city };
  }

  const [total, shops] = await Promise.all([
    prisma.shop.count({ where }),
    prisma.shop.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        owner: true,
        category: true,
        logo: true,
        cover: true,
        address: true,
        contact: true,
        timings: true,
        photos: { include: { media: true } },
        paymentMethods: true,
        languages: true,
        tags: true,
      },
    }),
  ]);

  const meta = buildPaginationMeta({ page, limit, total });
  return { shops, meta };
}

async function getShopDetail(shopId) {
  const prisma = getPrisma();
  const shop = await prisma.shop.findUnique({
    where: { id: shopId, deletedAt: null },
    include: {
      owner: true,
      category: true,
      logo: true,
      cover: true,
      address: true,
      contact: true,
      timings: true,
      photos: { include: { media: true } },
      paymentMethods: true,
      languages: true,
      tags: true,
    },
  });

  if (!shop) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.SHOP_NOT_FOUND,
      message: "Shop not found",
    });
  }

  return shop;
}

async function verifyShop(shopId, data, actorContext) {
  const prisma = getPrisma();

  const shop = await prisma.shop.findUnique({
    where: { id: shopId, deletedAt: null },
  });

  if (!shop) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.SHOP_NOT_FOUND,
      message: "Shop not found",
    });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.shop.update({
      where: { id: shopId },
      data: {
        status: data.status,
        verificationStatus: data.verificationStatus,
      },
      include: {
        owner: true,
        category: true,
        logo: true,
        cover: true,
        address: true,
        contact: true,
        timings: true,
        photos: { include: { media: true } },
        paymentMethods: true,
        languages: true,
        tags: true,
      },
    });

    // Trigger Notification for Shopkeeper Owner
    try {
      await createNotification({
        userId: shop.ownerId,
        type: "SHOP",
        title: "Shop verification update",
        message: `Your shop verification status has been updated to ${data.verificationStatus}. Reason: ${data.reason || "None specified"}.`,
        actionUrl: "/shopkeeper/profile",
        tx,
      });
    } catch (err) {
      console.error("Failed to send verification notification:", err);
    }

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "shop.verify",
      entityType: "SHOP",
      entityId: shopId,
      before: shop,
      after: { ...updated, verificationReason: data.reason },
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return updated;
  });
}

// 5. Product Moderation & Pinned Products
async function listProducts(filters) {
  const prisma = getPrisma();
  const { page, limit, skip, take } = parsePagination(filters);
  const { search, category, status, stockStatus, city, isPinned } = filters;

  const where = { deletedAt: null };

  if (search) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { shop: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (category && category !== "all") {
    where.category = { name: { equals: category, mode: "insensitive" } };
  }

  if (status && status !== "all") {
    where.status = status.toUpperCase();
  }

  if (stockStatus && stockStatus !== "all") {
    where.stockStatus = stockStatus.toUpperCase();
  }

  if (city && city !== "all") {
    where.shop = { address: { city } };
  }

  if (isPinned !== undefined) {
    where.isPinned = isPinned;
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        category: true,
        brand: true,
        shop: { include: { address: true } },
        images: { include: { media: true } },
      },
    }),
  ]);

  const meta = buildPaginationMeta({ page, limit, total });
  return { products, meta };
}

async function updateProduct(productId, data, actorContext) {
  const prisma = getPrisma();

  const product = await prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
  });

  if (!product) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.PRODUCT_NOT_FOUND,
      message: "Product not found",
    });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        status: data.status !== undefined ? data.status : undefined,
        isFlagged: data.isFlagged !== undefined ? data.isFlagged : undefined,
      },
      include: {
        category: true,
        brand: true,
        shop: { include: { address: true } },
        images: { include: { media: true } },
      },
    });

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "product.update",
      entityType: "PRODUCT",
      entityId: productId,
      before: product,
      after: updated,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return updated;
  });
}

async function bulkUpdateProducts(data, actorContext) {
  const prisma = getPrisma();
  const { productIds, status, isFlagged } = data;

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, deletedAt: null },
  });

  return prisma.$transaction(async (tx) => {
    await tx.product.updateMany({
      where: { id: { in: productIds } },
      data: {
        status: status !== undefined ? status : undefined,
        isFlagged: isFlagged !== undefined ? isFlagged : undefined,
      },
    });

    const updatedProducts = await tx.product.findMany({
      where: { id: { in: productIds } },
    });

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "product.bulkUpdate",
      entityType: "PRODUCT",
      entityId: productIds.join(","),
      before: products,
      after: updatedProducts,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return { success: true };
  });
}

async function getPinRules() {
  const prisma = getPrisma();
  const rules = await prisma.pinRule.findMany();
  return rules;
}

async function pinProduct(productId, actorContext) {
  const prisma = getPrisma();

  const product = await prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
    include: { shop: { include: { address: true } } },
  });

  if (!product) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.PRODUCT_NOT_FOUND,
      message: "Product not found",
    });
  }

  if (product.isPinned) {
    return product;
  }

  const city = product.shop?.address?.city;
  if (!city) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Cannot pin a product from a shop with no city specified",
    });
  }

  return prisma.$transaction(async (tx) => {
    // Check pin rules
    const rule = await tx.pinRule.findUnique({
      where: {
        city_targetType: {
          city,
          targetType: "PRODUCT",
        },
      },
    });

    const limit = rule ? rule.pinLimit : 10;

    // Count pinned products in this city
    const pinnedCount = await tx.product.count({
      where: {
        isPinned: true,
        shop: {
          address: { city },
        },
      },
    });

    if (pinnedCount >= limit) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.PIN_LIMIT_EXCEEDED,
        message: `Pin limit of ${limit} reached for city ${city}`,
      });
    }

    const updated = await tx.product.update({
      where: { id: productId },
      data: { isPinned: true },
      include: {
        category: true,
        brand: true,
        shop: { include: { address: true } },
        images: { include: { media: true } },
      },
    });

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "product.pin",
      entityType: "PRODUCT",
      entityId: productId,
      before: product,
      after: updated,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return updated;
  });
}

async function unpinProduct(productId, actorContext) {
  const prisma = getPrisma();

  const product = await prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
  });

  if (!product) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.PRODUCT_NOT_FOUND,
      message: "Product not found",
    });
  }

  if (!product.isPinned) {
    return product;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: { isPinned: false },
      include: {
        category: true,
        brand: true,
        shop: { include: { address: true } },
        images: { include: { media: true } },
      },
    });

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "product.unpin",
      entityType: "PRODUCT",
      entityId: productId,
      before: product,
      after: updated,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return updated;
  });
}

// 6. Banner Management & Performance
async function listBanners(filters) {
  const prisma = getPrisma();
  const { page, limit, skip, take } = parsePagination(filters);
  const { search, city, section, status, device } = filters;

  const where = { deletedAt: null };

  if (search) {
    const q = search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { shop: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (city && city !== "all") {
    where.city = city;
  }

  if (section && section !== "all") {
    where.section = section.toUpperCase();
  }

  if (status && status !== "all") {
    where.status = status.toUpperCase();
  }

  if (device && device !== "all") {
    where.devices = { has: device.toUpperCase() };
  }

  const [total, banners] = await Promise.all([
    prisma.banner.count({ where }),
    prisma.banner.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take,
      include: {
        shop: true,
        product: true,
        image: true,
      },
    }),
  ]);

  const meta = buildPaginationMeta({ page, limit, total });
  return { banners, meta };
}

async function createBanner(data, actorContext) {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const banner = await tx.banner.create({
      data: {
        title: data.title,
        shopId: data.shopId,
        productId: data.productId,
        city: data.city,
        section: data.section,
        devices: data.devices,
        plan: data.plan,
        imageId: data.imageId,
        startAt: data.startAt,
        endAt: data.endAt,
        sortOrder: data.sortOrder,
        status: "DRAFT",
      },
      include: {
        shop: true,
        product: true,
        image: true,
      },
    });

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "banner.create",
      entityType: "BANNER",
      entityId: banner.id,
      before: null,
      after: banner,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return banner;
  });
}

async function getBannerDetail(bannerId) {
  const prisma = getPrisma();
  const banner = await prisma.banner.findUnique({
    where: { id: bannerId, deletedAt: null },
    include: {
      shop: true,
      product: true,
      image: true,
    },
  });

  if (!banner) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.BANNER_NOT_FOUND,
      message: "Banner not found",
    });
  }

  return banner;
}

async function updateBanner(bannerId, data, actorContext) {
  const prisma = getPrisma();

  const banner = await prisma.banner.findUnique({
    where: { id: bannerId, deletedAt: null },
  });

  if (!banner) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.BANNER_NOT_FOUND,
      message: "Banner not found",
    });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.banner.update({
      where: { id: bannerId },
      data: {
        title: data.title !== undefined ? data.title : undefined,
        city: data.city !== undefined ? data.city : undefined,
        section: data.section !== undefined ? data.section : undefined,
        status: data.status !== undefined ? data.status : undefined,
        devices: data.devices !== undefined ? data.devices : undefined,
        plan: data.plan !== undefined ? data.plan : undefined,
        imageId: data.imageId !== undefined ? data.imageId : undefined,
        startAt: data.startAt !== undefined ? data.startAt : undefined,
        endAt: data.endAt !== undefined ? data.endAt : undefined,
        sortOrder: data.sortOrder !== undefined ? data.sortOrder : undefined,
      },
      include: {
        shop: true,
        product: true,
        image: true,
      },
    });

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "banner.update",
      entityType: "BANNER",
      entityId: bannerId,
      before: banner,
      after: updated,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return updated;
  });
}

async function deleteBanner(bannerId, actorContext) {
  const prisma = getPrisma();

  const banner = await prisma.banner.findUnique({
    where: { id: bannerId, deletedAt: null },
  });

  if (!banner) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.BANNER_NOT_FOUND,
      message: "Banner not found",
    });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.banner.update({
      where: { id: bannerId },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "banner.delete",
      entityType: "BANNER",
      entityId: bannerId,
      before: banner,
      after: updated,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return { success: true };
  });
}

async function getBannerMetrics() {
  const prisma = getPrisma();

  const [
    totalBanners,
    activeBanners,
    pinnedBanners,
    scheduled,
    drafts,
    expired,
    inactive,
    aggregates,
  ] = await Promise.all([
    prisma.banner.count({ where: { deletedAt: null } }),
    prisma.banner.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.banner.count({ where: { status: "PINNED", deletedAt: null } }),
    prisma.banner.count({ where: { status: "SCHEDULED", deletedAt: null } }),
    prisma.banner.count({ where: { status: "DRAFT", deletedAt: null } }),
    prisma.banner.count({ where: { status: "EXPIRED", deletedAt: null } }),
    prisma.banner.count({ where: { status: "INACTIVE", deletedAt: null } }),
    prisma.banner.aggregate({
      where: { deletedAt: null },
      _sum: {
        views: true,
        clicks: true,
        revenuePaise: true,
      },
    }),
  ]);

  const totalViews = aggregates._sum.views || 0;
  const totalClicks = aggregates._sum.clicks || 0;
  const totalRevenue = aggregates._sum.revenuePaise || 0;

  // Since trends are mock in this dashboard requirement context (as trends are not fully specified with 14-days windows for banner metrics), we can provide 0 or standard comparison logic if wanted. Let's return standard trends.
  return {
    totalBanners,
    totalBannersTrend: 0,
    activeBanners,
    activeBannersTrend: 0,
    pinnedBanners,
    totalViews,
    totalViewsTrend: 0,
    totalClicks,
    totalClicksTrend: 0,
    totalRevenue,
    totalRevenueTrend: 0,
    scheduled,
    drafts,
    expired,
    inactive,
  };
}

async function getBannerPerformance() {
  const prisma = getPrisma();

  const sections = ["TOP_HERO", "TOP_CAROUSEL", "MIDDLE_BANNER", "BOTTOM_BANNER"];

  // These 4 aggregates are independent — previously a sequential
  // for-loop (4 round-trips), now a single parallel batch.
  const aggregates = await Promise.all(
    sections.map((sec) =>
      prisma.banner.aggregate({
        where: { section: sec, deletedAt: null },
        _sum: {
          views: true,
          clicks: true,
        },
      })
    )
  );

  const performance = {};
  sections.forEach((sec, i) => {
    const agg = aggregates[i];
    performance[sec.toLowerCase()] = {
      views: agg._sum.views || 0,
      clicks: agg._sum.clicks || 0,
    };
  });

  return performance;
}

async function pinBanner(bannerId, actorContext) {
  const prisma = getPrisma();

  const banner = await prisma.banner.findUnique({
    where: { id: bannerId, deletedAt: null },
  });

  if (!banner) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.BANNER_NOT_FOUND,
      message: "Banner not found",
    });
  }

  if (banner.status === "PINNED") {
    return banner;
  }

  const city = banner.city;
  if (!city) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Cannot pin a banner with no city specified",
    });
  }

  return prisma.$transaction(async (tx) => {
    // Check pin rules
    const rule = await tx.pinRule.findUnique({
      where: {
        city_targetType: {
          city,
          targetType: "BANNER",
        },
      },
    });

    const limit = rule ? rule.pinLimit : 10;

    // Count pinned banners in this city
    const pinnedCount = await tx.banner.count({
      where: {
        status: "PINNED",
        city,
        deletedAt: null,
      },
    });

    if (pinnedCount >= limit) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.PIN_LIMIT_EXCEEDED,
        message: `Pin limit of ${limit} reached for city ${city}`,
      });
    }

    const updated = await tx.banner.update({
      where: { id: bannerId },
      data: { status: "PINNED" },
      include: {
        shop: true,
        product: true,
        image: true,
      },
    });

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "banner.pin",
      entityType: "BANNER",
      entityId: bannerId,
      before: banner,
      after: updated,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return updated;
  });
}

async function unpinBanner(bannerId, actorContext) {
  const prisma = getPrisma();

  const banner = await prisma.banner.findUnique({
    where: { id: bannerId, deletedAt: null },
  });

  if (!banner) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.BANNER_NOT_FOUND,
      message: "Banner not found",
    });
  }

  if (banner.status !== "PINNED") {
    return banner;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.banner.update({
      where: { id: bannerId },
      data: { status: "ACTIVE" },
      include: {
        shop: true,
        product: true,
        image: true,
      },
    });

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "banner.unpin",
      entityType: "BANNER",
      entityId: bannerId,
      before: banner,
      after: updated,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return updated;
  });
}

// 7. Content Pages
async function getAppContent() {
  const prisma = getPrisma();
  const pages = await prisma.contentPage.findMany();
  return pages;
}

async function updateContentPage(key, data, actorContext) {
  const prisma = getPrisma();

  const page = await prisma.contentPage.findUnique({
    where: { key },
  });

  if (!page) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.CONTENT_PAGE_NOT_FOUND,
      message: "Content page not found",
    });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.contentPage.update({
      where: { key },
      data: {
        title: data.title,
        body: data.body,
        status: data.status || "published",
        publishedAt: data.status === "published" ? new Date() : page.publishedAt,
      },
    });

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "content.update",
      entityType: "CONTENT_PAGE",
      entityId: key,
      before: page,
      after: updated,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return updated;
  });
}

// 8. Moderation (Reviews & Feedbacks)
async function listReviews(filters) {
  const prisma = getPrisma();
  const { page, limit, skip, take } = parsePagination(filters);
  const { status } = filters;

  const where = { deletedAt: null };

  if (status && status !== "all") {
    where.status = status;
  }

  const [total, reviews] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        user: { include: { avatar: true } },
        shop: true,
        product: true,
      },
    }),
  ]);

  const meta = buildPaginationMeta({ page, limit, total });
  return { reviews, meta };
}

async function updateReview(reviewId, data, actorContext) {
  const prisma = getPrisma();

  const review = await prisma.review.findUnique({
    where: { id: reviewId, deletedAt: null },
  });

  if (!review) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.REVIEW_NOT_FOUND,
      message: "Review not found",
    });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id: reviewId },
      data: { status: data.status },
      include: {
        user: { include: { avatar: true } },
        shop: true,
        product: true,
      },
    });

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "review.moderate",
      entityType: "REVIEW",
      entityId: reviewId,
      before: review,
      after: updated,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return updated;
  });
}

async function listFeedback(filters) {
  const prisma = getPrisma();
  const { page, limit, skip, take } = parsePagination(filters);
  const { type, status } = filters;

  const where = {};

  if (type && type !== "all") {
    where.type = type;
  }

  if (status && status !== "all") {
    where.status = status;
  }

  const [total, feedbacks] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        user: true,
      },
    }),
  ]);

  const meta = buildPaginationMeta({ page, limit, total });
  return { feedbacks, meta };
}

async function updateFeedback(feedbackId, data, actorContext) {
  const prisma = getPrisma();

  const fb = await prisma.feedback.findUnique({
    where: { id: feedbackId },
  });

  if (!fb) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.FEEDBACK_NOT_FOUND,
      message: "Feedback not found",
    });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.feedback.update({
      where: { id: feedbackId },
      data: { status: data.status },
      include: {
        user: true,
      },
    });

    await createAuditLog({
      actorId: actorContext.actorId,
      action: "feedback.update",
      entityType: "FEEDBACK",
      entityId: feedbackId,
      before: fb,
      after: updated,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      tx,
    });

    return updated;
  });
}

// 9. Audit Logs
async function listAuditLogs(filters) {
  const prisma = getPrisma();
  const { page, limit, skip, take } = parsePagination(filters);

  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        actor: true,
      },
    }),
  ]);

  const meta = buildPaginationMeta({ page, limit, total });
  return { logs, meta };
}

module.exports = {
  adminLogin,
  getAdminProfile,
  getDashboardSummary,
  listUsers,
  getUserDetail,
  updateUser,
  deleteUser,
  listShops,
  getShopDetail,
  verifyShop,
  listProducts,
  updateProduct,
  bulkUpdateProducts,
  getPinRules,
  pinProduct,
  unpinProduct,
  listBanners,
  createBanner,
  getBannerDetail,
  updateBanner,
  deleteBanner,
  getBannerMetrics,
  getBannerPerformance,
  pinBanner,
  unpinBanner,
  getAppContent,
  updateContentPage,
  listReviews,
  updateReview,
  listFeedback,
  updateFeedback,
  listAuditLogs,
};