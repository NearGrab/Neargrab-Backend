const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const { buildPaginationMeta } = require("../../lib/pagination");
const { runInTransaction } = require("../../lib/transaction");
const { mapProductCard } = require("../catalog/product-card.mapper");
const { mapReview } = require("../product/product.mapper");
const { mapShopDetail, mapShopUpdate } = require("./shop.mapper");

/**
 * Helper to fetch shop by ID or slug and throw if inactive/missing.
 */
async function getActiveShop(shopIdOrSlug) {
  const prisma = getPrisma();
  const shop = await prisma.shop.findFirst({
    where: {
      OR: [
        { id: shopIdOrSlug },
        { slug: shopIdOrSlug },
      ],
      status: "ACTIVE",
      deletedAt: null,
    },
  });

  if (!shop) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.SHOP_NOT_FOUND,
      message: "Shop not found or inactive",
    });
  }

  return shop;
}

/**
 * Returns public shop profile detail.
 */
async function getPublicShop(shopIdOrSlug) {
  const prisma = getPrisma();

  const shop = await prisma.shop.findFirst({
    where: {
      OR: [
        { id: shopIdOrSlug },
        { slug: shopIdOrSlug },
      ],
      status: "ACTIVE",
      deletedAt: null,
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

  if (!shop) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.SHOP_NOT_FOUND,
      message: "Shop not found or inactive",
    });
  }

  const [productCount, reviewCount] = await Promise.all([
    prisma.product.count({
      where: { shopId: shop.id, status: "ACTIVE", deletedAt: null },
    }),
    prisma.review.count({
      where: { shopId: shop.id, status: "PUBLISHED" },
    }),
  ]);

  return mapShopDetail(shop, { productCount, reviewCount });
}

/**
 * Lists public products for a specific shop with filters, search and sorting.
 */
async function listShopProducts(shopIdOrSlug, filters) {
  const prisma = getPrisma();
  const shop = await getActiveShop(shopIdOrSlug);

  const {
    q,
    categoryId,
    brandId,
    stockStatus,
    inStock,
    minPricePaise,
    maxPricePaise,
    sort = "relevance",
    page = 1,
    limit = 20,
  } = filters;

  const where = {
    shopId: shop.id,
    status: "ACTIVE",
    deletedAt: null,
  };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { tags: { has: q } },
    ];
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (brandId) {
    where.brandId = brandId;
  }
  if (stockStatus) {
    where.stockStatus = stockStatus;
  }
  if (inStock !== undefined) {
    where.stockAvailable = inStock;
  }

  if (minPricePaise !== undefined || maxPricePaise !== undefined) {
    where.pricePaise = {};
    if (minPricePaise !== undefined) where.pricePaise.gte = minPricePaise;
    if (maxPricePaise !== undefined) where.pricePaise.lte = maxPricePaise;
  }

  const orderBy = [];
  if (sort === "price_asc") {
    orderBy.push({ pricePaise: "asc" });
  } else if (sort === "price_desc") {
    orderBy.push({ pricePaise: "desc" });
  } else if (sort === "rating") {
    orderBy.push({ ratingAvg: "desc" });
  } else if (sort === "newest") {
    orderBy.push({ createdAt: "desc" });
  } else if (sort === "popular") {
    orderBy.push({ viewCount: "desc" });
  } else {
    // Relevance sort
    orderBy.push({ isPinned: "desc" });
    orderBy.push({ searchBoost: "desc" });
    orderBy.push({ ratingAvg: "desc" });
    orderBy.push({ createdAt: "desc" });
  }

  const skip = (page - 1) * limit;

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        images: { include: { media: true } },
        category: true,
        brand: true,
        shop: { include: { address: true } },
      },
    }),
  ]);

  const data = products.map((p) => mapProductCard(p));
  const meta = buildPaginationMeta({ page, limit, total });

  return { data, meta };
}

/**
 * Lists published shop reviews.
 */
async function listShopReviews(shopIdOrSlug, filters) {
  const prisma = getPrisma();
  const shop = await getActiveShop(shopIdOrSlug);

  const { page = 1, limit = 20, sort = "newest" } = filters;

  const where = {
    shopId: shop.id,
    status: "PUBLISHED",
  };

  let orderBy = { createdAt: "desc" };
  if (sort === "oldest") {
    orderBy = { createdAt: "asc" };
  } else if (sort === "rating_high") {
    orderBy = { rating: "desc" };
  } else if (sort === "rating_low") {
    orderBy = { rating: "asc" };
  }

  const skip = (page - 1) * limit;

  const [total, reviews] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        user: {
          include: {
            avatar: true,
          },
        },
        media: {
          include: {
            media: true,
          },
        },
      },
    }),
  ]);

  const data = reviews.map(mapReview);
  const meta = buildPaginationMeta({ page, limit, total });

  return { data, meta };
}

/**
 * Creates a shop review and updates shop aggregates.
 */
async function createShopReview(shopIdOrSlug, input, user) {
  const prisma = getPrisma();
  const shop = await getActiveShop(shopIdOrSlug);

  // Prevent duplicate reviews
  const existingReview = await prisma.review.findFirst({
    where: {
      userId: user.id,
      shopId: shop.id,
      status: { not: "DELETED" },
    },
  });

  if (existingReview) {
    throw new AppError({
      statusCode: 409,
      code: ERROR_CODES.REVIEW_ALREADY_EXISTS,
      message: "You have already reviewed this shop",
    });
  }

  const { rating, comment, reservationId, mediaIds = [] } = input;
  let verifiedPurchase = false;

  if (reservationId) {
    const reservation = await prisma.reservation.findFirst({
      where: {
        id: reservationId,
        userId: user.id,
        shopId: shop.id,
      },
    });

    if (!reservation) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.INVALID_REVIEW_TARGET,
        message: "Invalid reservation specified for shop review",
      });
    }

    verifiedPurchase = true;
  } else {
    // Check if user has any accepted/completed reservations with this shop
    const pastReservation = await prisma.reservation.findFirst({
      where: {
        userId: user.id,
        shopId: shop.id,
        status: { in: ["COMPLETED", "ACCEPTED"] },
      },
    });
    if (pastReservation) {
      verifiedPurchase = true;
    }
  }

  const newReview = await runInTransaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        userId: user.id,
        shopId: shop.id,
        reservationId: reservationId || null,
        rating,
        comment,
        status: "PUBLISHED",
        verifiedPurchase,
      },
    });

    if (mediaIds.length > 0) {
      const mediaData = mediaIds.map((mId, index) => ({
        reviewId: review.id,
        mediaId: mId,
        sortOrder: index,
      }));
      await tx.reviewMedia.createMany({
        data: mediaData,
      });
    }

    // Recompute shop aggregates
    const agg = await tx.review.aggregate({
      where: {
        shopId: shop.id,
        status: "PUBLISHED",
      },
      _count: { _all: true },
      _avg: { rating: true },
    });

    const ratingCount = agg._count._all;
    const ratingAvg = agg._avg.rating || 0;

    await tx.shop.update({
      where: { id: shop.id },
      data: {
        ratingAvg,
        ratingCount,
      },
    });

    return review;
  });

  const createdReview = await prisma.review.findUnique({
    where: { id: newReview.id },
    include: {
      user: { include: { avatar: true } },
      media: { include: { media: true } },
    },
  });

  return mapReview(createdReview);
}

/**
 * Lists published updates.
 */
async function listShopUpdates(shopIdOrSlug, filters) {
  const prisma = getPrisma();
  const shop = await getActiveShop(shopIdOrSlug);

  const { page = 1, limit = 20 } = filters;
  const now = new Date();

  const where = {
    shopId: shop.id,
    publishedAt: { lte: now },
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ],
  };

  const skip = (page - 1) * limit;

  const [total, updates] = await Promise.all([
    prisma.shopUpdate.count({ where }),
    prisma.shopUpdate.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
      include: {
        media: true,
      },
    }),
  ]);

  const data = updates.map((u) => mapShopUpdate(u));
  const meta = buildPaginationMeta({ page, limit, total });

  return { data, meta };
}

/**
 * Tracks shop leads.
 */
async function trackShopLead(shopIdOrSlug, input, user) {
  const prisma = getPrisma();
  const shop = await getActiveShop(shopIdOrSlug);

  const { source, productId, action, metadata = {} } = input;

  if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product || product.shopId !== shop.id) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "productId does not belong to this shop",
      });
    }
  }

  await runInTransaction(async (tx) => {
    await tx.shopLead.create({
      data: {
        shopId: shop.id,
        productId: productId || null,
        userId: user?.id || null,
        source: source,
        metadata: {
          action,
          ...metadata,
        },
      },
    });

    await tx.shop.update({
      where: { id: shop.id },
      data: {
        leadCount: { increment: 1 },
      },
    });
  });

  return { success: true };
}

module.exports = {
  getPublicShop,
  listShopProducts,
  listShopReviews,
  createShopReview,
  listShopUpdates,
  trackShopLead,
};
