const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const { buildPaginationMeta } = require("../../lib/pagination");
const { mapProductCard } = require("../catalog/product-card.mapper");
const { calculateDistance } = require("../explore/explore.service");

/**
 * Perform a multi-filter product search.
 */
async function searchProducts(params) {
  const prisma = getPrisma();
  const {
    q,
    city,
    latitude,
    longitude,
    radiusKm,
    categoryId,
    categorySlug,
    brandId,
    brandSlug,
    stockStatus,
    inStock,
    minPricePaise,
    maxPricePaise,
    sort,
    page,
    limit,
  } = params;

  // Base filters: product is ACTIVE, not deleted, and shop is ACTIVE, not deleted
  const where = {
    status: "ACTIVE",
    deletedAt: null,
    shop: {
      status: "ACTIVE",
      deletedAt: null,
    },
  };

  // Text search query matching multiple fields
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { tags: { has: q } },
      { category: { name: { contains: q, mode: "insensitive" } } },
      { brand: { name: { contains: q, mode: "insensitive" } } },
      { shop: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  // City filter
  if (city) {
    where.shop = {
      ...where.shop,
      address: {
        city: { equals: city, mode: "insensitive" },
      },
    };
  }

  // Category filters
  if (categoryId) {
    where.categoryId = categoryId;
  } else if (categorySlug) {
    where.category = { slug: categorySlug };
  }

  // Brand filters
  if (brandId) {
    where.brandId = brandId;
  } else if (brandSlug) {
    where.brand = { slug: brandSlug };
  }

  // Stock status filters
  if (stockStatus) {
    where.stockStatus = stockStatus;
  }
  if (inStock !== undefined) {
    where.stockAvailable = inStock;
  }

  // Price range filters
  if (minPricePaise !== undefined || maxPricePaise !== undefined) {
    where.pricePaise = {};
    if (minPricePaise !== undefined) where.pricePaise.gte = minPricePaise;
    if (maxPricePaise !== undefined) where.pricePaise.lte = maxPricePaise;
  }

  const hasLocation = latitude !== undefined && longitude !== undefined;

  // Coordinate Radius Filter: Add bounding box to where condition for DB optimization
  if (hasLocation && radiusKm !== undefined) {
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));
    where.shop = {
      ...where.shop,
      address: {
        ...where.shop.address,
        latitude: { gte: latitude - latDelta, lte: latitude + latDelta },
        longitude: { gte: longitude - lonDelta, lte: longitude + lonDelta },
      },
    };
  }

  // Case A: Geolocation radius filter or distance sorting requires in-memory calculation
  if (hasLocation) {
    const allMatching = await prisma.product.findMany({
      where,
      include: {
        images: { include: { media: true } },
        category: true,
        brand: true,
        shop: { include: { address: true } },
      },
    });

    let results = allMatching.map((product) => {
      let dist = null;
      if (product.shop?.address) {
        dist = calculateDistance(
          latitude,
          longitude,
          Number(product.shop.address.latitude),
          Number(product.shop.address.longitude)
        );
      }
      return { ...product, distanceKm: dist };
    });

    // Enforce strict radius filter
    if (radiusKm !== undefined) {
      results = results.filter((p) => p.distanceKm !== null && p.distanceKm <= radiusKm);
    }

    // Sort results in JS memory
    if (sort === "distance") {
      results.sort((a, b) => {
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    } else if (sort === "price_asc") {
      results.sort((a, b) => a.pricePaise - b.pricePaise);
    } else if (sort === "price_desc") {
      results.sort((a, b) => b.pricePaise - a.pricePaise);
    } else if (sort === "rating") {
      results.sort((a, b) => toNum(b.ratingAvg) - toNum(a.ratingAvg));
    } else if (sort === "newest") {
      results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === "popular") {
      results.sort((a, b) => b.viewCount - a.viewCount);
    } else {
      // relevance: isPinned, searchBoost, ratingAvg, createdAt
      results.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        if (b.searchBoost !== a.searchBoost) return b.searchBoost - a.searchBoost;
        if (toNum(b.ratingAvg) !== toNum(a.ratingAvg)) return toNum(b.ratingAvg) - toNum(a.ratingAvg);
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    const total = results.length;
    const skip = (page - 1) * limit;
    const paginated = results.slice(skip, skip + limit);

    const mapped = paginated.map((p) => mapProductCard(p));
    const meta = buildPaginationMeta({ page, limit, total });

    return {
      data: mapped,
      meta: {
        ...meta,
        filters: { q: q || null, city: city || null },
        sort,
      },
    };
  }

  // Case B: No coordinate filters. Paginate directly in the DB
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
    // relevance
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

  const mapped = products.map((p) => mapProductCard(p));
  const meta = buildPaginationMeta({ page, limit, total });

  return {
    data: mapped,
    meta: {
      ...meta,
      filters: { q: q || null, city: city || null },
      sort,
    },
  };
}

/**
 * Autocomplete suggestions for query q.
 */
async function getSuggestions({ q, city, limit }) {
  const prisma = getPrisma();
  const searchVal = q || "";

  // 1. Match products
  const productMatches = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      name: { contains: searchVal, mode: "insensitive" },
      ...(city ? { shop: { address: { city: { equals: city, mode: "insensitive" } } } } : {}),
    },
    select: { name: true },
    distinct: ["name"],
    take: limit,
  });

  // 2. Match categories
  const categoryMatches = await prisma.category.findMany({
    where: {
      status: "active",
      deletedAt: null,
      name: { contains: searchVal, mode: "insensitive" },
    },
    select: { name: true },
    distinct: ["name"],
    take: limit,
  });

  // 3. Match brands
  const brandMatches = await prisma.brand.findMany({
    where: {
      status: "active",
      deletedAt: null,
      name: { contains: searchVal, mode: "insensitive" },
    },
    select: { name: true },
    distinct: ["name"],
    take: limit,
  });

  // 4. Match popular search events
  const popularQueries = await prisma.searchEvent.groupBy({
    by: ["query"],
    where: {
      query: { contains: searchVal, mode: "insensitive" },
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
    },
    _count: {
      query: true,
    },
    orderBy: {
      _count: {
        query: "desc",
      },
    },
    take: limit,
  });

  return {
    products: productMatches.map((p) => ({ label: p.name, value: p.name, type: "product" })),
    categories: categoryMatches.map((c) => ({ label: c.name, value: c.name, type: "category" })),
    brands: brandMatches.map((b) => ({ label: b.name, value: b.name, type: "brand" })),
    popular: popularQueries.map((e) => ({ label: e.query, value: e.query, type: "popular" })),
  };
}

/**
 * Log a search event.
 */
async function trackSearchEvent(input, userId) {
  const prisma = getPrisma();
  const event = await prisma.searchEvent.create({
    data: {
      userId: userId || null,
      query: input.query,
      city: input.city || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      radiusKm: input.radiusKm || null,
      filters: input.filters || {},
      resultCount: input.resultCount,
    },
  });
  return { id: event.id };
}

/**
 * Create a custom user request for missing items.
 */
async function createProductRequest(input, userId) {
  const prisma = getPrisma();
  const { query, categoryId, productId, city, latitude, longitude, radiusKm } = input;

  if (categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.NOT_FOUND,
        message: "Category not found",
      });
    }
  }

  if (productId) {
    const prod = await prisma.product.findUnique({ where: { id: productId } });
    if (!prod) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.NOT_FOUND,
        message: "Product not found",
      });
    }
  }

  const request = await prisma.productRequest.create({
    data: {
      userId: userId || null,
      query,
      categoryId: categoryId || null,
      productId: productId || null,
      city: city || null,
      latitude: latitude || null,
      longitude: longitude || null,
      radiusKm: radiusKm || null,
      status: "open",
    },
  });

  return request;
}

function toNum(val) {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

module.exports = {
  searchProducts,
  getSuggestions,
  trackSearchEvent,
  createProductRequest,
};
