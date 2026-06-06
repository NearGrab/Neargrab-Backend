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

/**
 * Fetch product detail with images, specs, badges, and review counts.
 */
async function getProductDetail(productIdOrSlug, user) {
  const prisma = getPrisma();

  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { id: productIdOrSlug },
        { slug: productIdOrSlug },
      ],
      status: "ACTIVE",
      deletedAt: null,
      shop: {
        status: "ACTIVE",
        deletedAt: null,
      },
    },
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

  let isSaved = false;
  if (user) {
    const saved = await prisma.savedProduct.findUnique({
      where: {
        userId_productId: {
          userId: user.id,
          productId: product.id,
        },
      },
    });
    isSaved = !!saved;
  }

  // Calculate review summary breakdown
  const reviews = await prisma.review.findMany({
    where: {
      productId: product.id,
      status: "PUBLISHED",
    },
    select: {
      rating: true,
    },
  });

  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    if (breakdown[r.rating] !== undefined) {
      breakdown[r.rating]++;
    }
  });

  return mapProductDetail(product, {
    isSaved,
    reviewBreakdown: breakdown,
  });
}

/**
 * Returns other active stores selling the same/similar product.
 */
async function getAvailableStores(productIdOrSlug, filters) {
  const prisma = getPrisma();

  const refProduct = await prisma.product.findFirst({
    where: {
      OR: [
        { id: productIdOrSlug },
        { slug: productIdOrSlug },
      ],
      status: "ACTIVE",
      deletedAt: null,
      shop: {
        status: "ACTIVE",
        deletedAt: null,
      },
    },
  });

  if (!refProduct) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.PRODUCT_NOT_FOUND,
      message: "Product not found or inactive",
    });
  }

  const { city, latitude, longitude, radiusKm, page, limit } = filters;
  const hasLocation = latitude !== undefined && longitude !== undefined;

  const shopWhere = {
    status: "ACTIVE",
    deletedAt: null,
    id: { not: refProduct.shopId }, // Exclude current shop
  };

  if (city) {
    shopWhere.address = {
      city: { equals: city, mode: "insensitive" },
    };
  }

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

  const candidates = await prisma.product.findMany({
    where: productWhere,
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
  const prisma = getPrisma();

  const refProduct = await prisma.product.findFirst({
    where: {
      OR: [
        { id: productIdOrSlug },
        { slug: productIdOrSlug },
      ],
      status: "ACTIVE",
      deletedAt: null,
      shop: {
        status: "ACTIVE",
        deletedAt: null,
      },
    },
  });

  if (!refProduct) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.PRODUCT_NOT_FOUND,
      message: "Product not found or inactive",
    });
  }

  const { city, limit = 10 } = filters;

  const where = {
    id: { not: refProduct.id },
    status: "ACTIVE",
    deletedAt: null,
    shop: {
      status: "ACTIVE",
      deletedAt: null,
      ...(city ? { address: { city: { equals: city, mode: "insensitive" } } } : {}),
    },
    OR: [
      ...(refProduct.brandId ? [{ brandId: refProduct.brandId }] : []),
      ...(refProduct.categoryId ? [{ categoryId: refProduct.categoryId }] : []),
    ],
  };

  const candidates = await prisma.product.findMany({
    where,
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

  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { id: productIdOrSlug },
        { slug: productIdOrSlug },
      ],
      status: "ACTIVE",
      deletedAt: null,
      shop: {
        status: "ACTIVE",
        deletedAt: null,
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

  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { id: productIdOrSlug },
        { slug: productIdOrSlug },
      ],
      status: "ACTIVE",
      deletedAt: null,
      shop: {
        status: "ACTIVE",
        deletedAt: null,
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

  // Prevent duplicate reviews
  const existingReview = await prisma.review.findFirst({
    where: {
      userId: user.id,
      productId: product.id,
      status: { not: "DELETED" },
    },
  });

  if (existingReview) {
    throw new AppError({
      statusCode: 409,
      code: ERROR_CODES.REVIEW_ALREADY_EXISTS,
      message: "You have already reviewed this product",
    });
  }

  const { rating, comment, reservationId, mediaIds = [] } = input;
  let verifiedPurchase = false;

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
    });

    if (!reservation) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.INVALID_REVIEW_TARGET,
        message: "Invalid reservation specified for product review",
      });
    }

    verifiedPurchase = true;
  } else {
    // Check if customer had any completed reservation with this product
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
    });
    if (pastReservation) {
      verifiedPurchase = true;
    }
  }

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

  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { id: productIdOrSlug },
        { slug: productIdOrSlug },
      ],
      status: "ACTIVE",
      deletedAt: null,
      shop: {
        status: "ACTIVE",
        deletedAt: null,
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

  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { id: productIdOrSlug },
        { slug: productIdOrSlug },
      ],
      status: "ACTIVE",
      deletedAt: null,
      shop: {
        status: "ACTIVE",
        deletedAt: null,
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

  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { id: productIdOrSlug },
        { slug: productIdOrSlug },
      ],
      status: "ACTIVE",
      deletedAt: null,
      shop: {
        status: "ACTIVE",
        deletedAt: null,
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

  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { id: productIdOrSlug },
        { slug: productIdOrSlug },
      ],
      status: "ACTIVE",
      deletedAt: null,
      shop: {
        status: "ACTIVE",
        deletedAt: null,
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
};
