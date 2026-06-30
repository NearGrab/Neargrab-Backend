const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const { buildPaginationMeta } = require("../../lib/pagination");
const { runInTransaction } = require("../../lib/transaction");
const { calculateDistance } = require("../explore/explore.service");
const { mapProductCard } = require("../catalog/product-card.mapper");
const {
  mapProductDetail,
  mapAvailableStore,
  mapReview,
} = require("./product.mapper");

const PRODUCT_REF_WHERE = (productIdOrSlug) => ({
  OR: [{ id: productIdOrSlug }, { slug: productIdOrSlug }],
  status: "ACTIVE",
  deletedAt: null,
  shop: {
    status: "ACTIVE",
    deletedAt: null,
  },
});

/**
 * Shared lightweight product lookup. Callers pass only the fields they
 * actually need via `select`, instead of every call site pulling the
 * full product row (which most mutation/analytics endpoints never use).
 */
async function getActiveProductRef(productIdOrSlug, select = { id: true, shopId: true }) {
  const prisma = getPrisma();
  const product = await prisma.product.findFirst({
    where: PRODUCT_REF_WHERE(productIdOrSlug),
    select,
  });

  if (!product) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.PRODUCT_NOT_FOUND,
      message: "Product not found or inactive",
    });
  }

  return product;
}

/**
 * Cap on how many raw candidate rows we'll pull for in-memory scoring in
 * getAvailableStores / getSimilarProducts. Without a cap, these queries
 * fetch every matching product (with heavy joins) across the whole
 * city/category, which is the single biggest cost on this page as the
 * catalog grows. We bias the DB-side query toward the most likely-relevant
 * rows (highest rated) before truncating, trading a small amount of
 * theoretical recall for a big, predictable latency ceiling.
 */
const CANDIDATE_FETCH_CAP = 200;

/**
 * Fetch product detail with images, specs, badges, and review counts.
 */
async function getProductDetail(productIdOrSlug, user, query = {}) {
  const prisma = getPrisma();

  const product = await prisma.product.findFirst({
    where: PRODUCT_REF_WHERE(productIdOrSlug),
    include: {
      images: { include: { media: true } },
      attributes: true,
      category: true,
      brand: true,
      shop: {
        include: {
          address: true,
        },
      },
    },
  });

  if (!product) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.PRODUCT_NOT_FOUND,
      message: "Product not found or inactive",
    });
  }

  // Calculate distance if coordinates are passed
  let distanceKm = null;
  if (query.latitude && query.longitude && product.shop?.address?.latitude && product.shop?.address?.longitude) {
    distanceKm = calculateDistance(
      Number(query.latitude),
      Number(query.longitude),
      Number(product.shop.address.latitude),
      Number(product.shop.address.longitude)
    );
  }

  // isSaved check and review breakdown are independent of each other —
  // run them in parallel instead of sequentially.
  const [savedRecord, ratingGroups] = await Promise.all([
    user
      ? prisma.savedProduct.findUnique({
          where: {
            userId_productId: {
              userId: user.id,
              productId: product.id,
            },
          },
          select: { userId: true },
        })
      : Promise.resolve(null),
    // DB-side aggregation instead of pulling every review row into Node
    // just to count by rating bucket.
    prisma.review.groupBy({
      by: ["rating"],
      where: {
        productId: product.id,
        status: "PUBLISHED",
      },
      _count: { _all: true },
    }),
  ]);

  const isSaved = !!savedRecord;

  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  ratingGroups.forEach((g) => {
    if (breakdown[g.rating] !== undefined) {
      breakdown[g.rating] = g._count._all;
    }
  });

  return mapProductDetail(product, {
    isSaved,
    reviewBreakdown: breakdown,
    distanceKm,
  });
}

/**
 * Returns other active stores selling the same/similar product.
 */
async function getAvailableStores(productIdOrSlug, filters) {
  const prisma = getPrisma();

  const refProduct = await getActiveProductRef(productIdOrSlug, {
    id: true,
    shopId: true,
    brandId: true,
    categoryId: true,
    name: true,
  });

  const { city, latitude, longitude, radiusKm, page, limit } = filters;
  const hasLocation = false; // Bypass GPS coordinates in MVP

  const shopWhere = {
    status: "ACTIVE",
    deletedAt: null,
    id: { not: refProduct.shopId }, // Exclude current shop
    city: { equals: city || "Surat", mode: "insensitive" },
  };

  if (hasLocation && radiusKm) {
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));
    shopWhere.address = {
      ...shopWhere.address,
      latitude: { gte: latitude - latDelta, lte: latitude + latDelta },
      longitude: { gte: longitude - lonDelta, lte: longitude + lonDelta },
    };
  }

  // Find active similar products in other shops
  const productWhere = {
    status: "ACTIVE",
    deletedAt: null,
    shop: shopWhere,
    OR: [
      ...(refProduct.brandId ? [{ brandId: refProduct.brandId }] : []),
      ...(refProduct.categoryId ? [{ categoryId: refProduct.categoryId }] : []),
    ],
  };

  // Capped + pre-sorted at the DB level instead of pulling every matching
  // row unbounded. We bias toward higher-rated / more-recent products
  // since those are most likely to end up in the final paginated result.
  const candidates = await prisma.product.findMany({
    where: productWhere,
    orderBy: [{ ratingAvg: "desc" }, { createdAt: "desc" }],
    take: CANDIDATE_FETCH_CAP,
    include: {
      shop: {
        include: {
          address: true,
        },
      },
      images: { include: { media: true } },
      category: true,
      brand: true,
    },
  });

  const nameWords = refProduct.name.toLowerCase().split(/\s+/).filter(Boolean);

  let scoredCandidates = candidates.map((prod) => {
    let score = 0;
    // same brand match
    if (refProduct.brandId && prod.brandId === refProduct.brandId) {
      score += 2;
      const prodNameLower = prod.name.toLowerCase();
      const matchesWord = nameWords.some((word) => prodNameLower.includes(word));
      if (matchesWord) {
        score += 2; // brand + similar name
      }
    }
    // same category match
    if (refProduct.categoryId && prod.categoryId === refProduct.categoryId) {
      score += 1;
    }

    let dist = null;
    if (hasLocation && prod.shop?.address) {
      dist = calculateDistance(
        latitude,
        longitude,
        Number(prod.shop.address.latitude),
        Number(prod.shop.address.longitude)
      );
    }

    return {
      product: prod,
      score,
      distanceKm: dist,
    };
  });

  // Filter by radius in-memory
  if (hasLocation && radiusKm) {
    scoredCandidates = scoredCandidates.filter(
      (c) => c.distanceKm !== null && c.distanceKm <= radiusKm
    );
  }

  // Sort: score desc, distance asc, price asc
  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (hasLocation) {
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      if (a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
    }
    return a.product.pricePaise - b.product.pricePaise;
  });

  const total = scoredCandidates.length;
  const skip = (page - 1) * limit;
  const paginated = scoredCandidates.slice(skip, skip + limit);

  const data = paginated.map((c) =>
    mapAvailableStore(c.product, c.product.shop, c.distanceKm)
  );

  const meta = buildPaginationMeta({ page, limit, total });

  return { data, meta };
}

/**
 * Returns similar active products in same category/brand.
 */
async function getSimilarProducts(productIdOrSlug, filters) {
  const refProduct = await getActiveProductRef(productIdOrSlug, {
    id: true,
    brandId: true,
    categoryId: true,
  });

  const prisma = getPrisma();
  const { city, limit = 10 } = filters;

  const where = {
    id: { not: refProduct.id },
    status: "ACTIVE",
    deletedAt: null,
    shop: {
      status: "ACTIVE",
      deletedAt: null,
      city: { equals: city || "Surat", mode: "insensitive" },
    },
    OR: [
      ...(refProduct.brandId ? [{ brandId: refProduct.brandId }] : []),
      ...(refProduct.categoryId ? [{ categoryId: refProduct.categoryId }] : []),
    ],
  };

  // Capped + pre-sorted by rating at the DB level — we only ever return
  // `limit` (default 10) items, so there's no reason to pull an unbounded
  // candidate set into memory just to re-sort it in JS.
  const candidates = await prisma.product.findMany({
    where,
    orderBy: { ratingAvg: "desc" },
    take: CANDIDATE_FETCH_CAP,
    include: {
      images: { include: { media: true } },
      category: true,
      brand: true,
      shop: { include: { address: true } },
    },
  });

  const scored = candidates.map((prod) => {
    let score = 0;
    if (refProduct.categoryId && prod.categoryId === refProduct.categoryId) {
      score += 2;
    }
    if (refProduct.brandId && prod.brandId === refProduct.brandId) {
      score += 1;
    }
    return { product: prod, score };
  });

  scored.sort((a, b) => b.score - a.score || b.product.ratingAvg - a.product.ratingAvg);

  return scored.slice(0, limit).map((s) => mapProductCard(s.product));
}

/**
 * Lists published product reviews.
 */
async function listProductReviews(productIdOrSlug, filters) {
  const prisma = getPrisma();
  const product = await getActiveProductRef(productIdOrSlug);

  const { page = 1, limit = 20, rating, sort = "newest" } = filters;

  const where = {
    productId: product.id,
    status: "PUBLISHED",
  };

  if (rating) {
    where.rating = rating;
  }

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
 * Creates a product review.
 */
async function createProductReview(productIdOrSlug, input, user) {
  const prisma = getPrisma();
  const product = await getActiveProductRef(productIdOrSlug, { id: true, shopId: true });

  // Prevent duplicate reviews
  const existingReview = await prisma.review.findFirst({
    where: {
      userId: user.id,
      productId: product.id,
      status: { not: "DELETED" },
    },
    select: { id: true },
  });

  if (existingReview) {
    throw new AppError({
      statusCode: 409,
      code: ERROR_CODES.REVIEW_ALREADY_EXISTS,
      message: "You have already reviewed this product",
    });
  }

  const { rating, comment, reservationId, mediaIds = [] } = input;

  // Media ownership validation and purchase verification are independent
  // of each other — run them in parallel.
  const [, verifiedPurchase] = await Promise.all([
    (async () => {
      if (!mediaIds || mediaIds.length === 0) return;
      const assets = await prisma.mediaAsset.findMany({
        where: { id: { in: mediaIds } },
        select: { id: true, ownerId: true },
      });
      if (assets.length !== mediaIds.length) {
        throw new AppError({
          statusCode: 404,
          code: ERROR_CODES.MEDIA_NOT_FOUND,
          message: "Some media assets were not found",
        });
      }
      for (const asset of assets) {
        if (asset.ownerId && asset.ownerId !== user.id) {
          throw new AppError({
            statusCode: 403,
            code: ERROR_CODES.MEDIA_FORBIDDEN,
            message: "You do not own this media asset",
          });
        }
      }
    })(),
    (async () => {
      if (reservationId) {
        const reservation = await prisma.reservation.findFirst({
          where: {
            id: reservationId,
            userId: user.id,
            items: {
              some: {
                productId: product.id,
              },
            },
          },
          select: { id: true },
        });

        if (!reservation) {
          throw new AppError({
            statusCode: 400,
            code: ERROR_CODES.INVALID_REVIEW_TARGET,
            message: "Invalid reservation specified for product review",
          });
        }

        return true;
      }

      const pastReservation = await prisma.reservation.findFirst({
        where: {
          userId: user.id,
          status: { in: ["COMPLETED", "ACCEPTED"] },
          items: {
            some: {
              productId: product.id,
            },
          },
        },
        select: { id: true },
      });

      return !!pastReservation;
    })(),
  ]);

  const newReview = await runInTransaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        userId: user.id,
        productId: product.id,
        shopId: product.shopId,
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

    // Recalculate aggregates
    const agg = await tx.review.aggregate({
      where: {
        productId: product.id,
        status: "PUBLISHED",
      },
      _count: { _all: true },
      _avg: { rating: true },
    });

    const reviewCount = agg._count._all;
    const ratingAvg = agg._avg.rating || 0;

    await tx.product.update({
      where: { id: product.id },
      data: {
        ratingAvg,
        reviewCount,
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
 * Saves a product for the user.
 */
async function saveProduct(productIdOrSlug, user) {
  const prisma = getPrisma();
  const product = await getActiveProductRef(productIdOrSlug);

  await prisma.savedProduct.upsert({
    where: {
      userId_productId: {
        userId: user.id,
        productId: product.id,
      },
    },
    create: {
      userId: user.id,
      productId: product.id,
    },
    update: {},
  });

  return { saved: true };
}

/**
 * Unsaves a product for the user.
 */
async function unsaveProduct(productIdOrSlug, user) {
  const prisma = getPrisma();
  const product = await getActiveProductRef(productIdOrSlug);

  try {
    await prisma.savedProduct.delete({
      where: {
        userId_productId: {
          userId: user.id,
          productId: product.id,
        },
      },
    });
  } catch (error) {
    if (error.code !== "P2025") {
      throw error;
    }
  }

  return { saved: false };
}

/**
 * Tracks a product view analytics entry.
 */
async function trackProductView(productIdOrSlug, input, user) {
  const prisma = getPrisma();
  const product = await getActiveProductRef(productIdOrSlug, { id: true, shopId: true });

  const { source, shopId } = input;

  if (shopId && shopId !== product.shopId) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "shopId does not match product shopId",
    });
  }

  await runInTransaction(async (tx) => {
    await tx.productView.create({
      data: {
        productId: product.id,
        shopId: product.shopId,
        userId: user?.id || null,
        source: source || null,
      },
    });

    await tx.product.update({
      where: { id: product.id },
      data: {
        viewCount: { increment: 1 },
      },
    });
  });

  return { success: true };
}

/**
 * Creates a feedback report entry.
 */
async function createProductFeedback(productIdOrSlug, input, user) {
  const prisma = getPrisma();
  const product = await getActiveProductRef(productIdOrSlug);

  const { type, subject, message, metadata = {} } = input;
  const mergedMetadata = {
    ...metadata,
    productId: product.id,
  };

  const feedback = await prisma.feedback.create({
    data: {
      userId: user?.id || null,
      type,
      subject: subject || null,
      message,
      metadata: mergedMetadata,
      status: "open",
    },
  });

  return { id: feedback.id };
}

// In-memory click deduplication cache: key -> timestamp
const clickCache = new Map();
const CLICK_DEDUPLICATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Clean up cache periodically (every 1 hour)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of clickCache.entries()) {
    if (now - timestamp > CLICK_DEDUPLICATION_WINDOW_MS) {
      clickCache.delete(key);
    }
  }
}, 60 * 60 * 1000);
if (cleanupInterval && typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

/**
 * Tracks a product click event with a 1-hour deduplication window per user/IP.
 */
async function trackProductClick(productIdOrSlug, ipAddress, userId) {
  const prisma = getPrisma();
  const product = await getActiveProductRef(productIdOrSlug);

  const userKey = userId || ipAddress || "anonymous";
  const cacheKey = `${userKey}:${product.id}`;
  const now = Date.now();
  const lastClick = clickCache.get(cacheKey);

  if (lastClick && now - lastClick < CLICK_DEDUPLICATION_WINDOW_MS) {
    return { success: true, duplicated: true };
  }

  clickCache.set(cacheKey, now);

  await prisma.productAnalytics.upsert({
    where: { productId: product.id },
    create: {
      productId: product.id,
      totalClicks: 1,
    },
    update: {
      totalClicks: { increment: 1 },
    },
  });

  return { success: true, duplicated: false };
}

module.exports = {
  getProductDetail,
  getAvailableStores,
  getSimilarProducts,
  listProductReviews,
  createProductReview,
  saveProduct,
  unsaveProduct,
  trackProductView,
  createProductFeedback,
  trackProductClick,
};