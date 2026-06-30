const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const { buildPaginationMeta } = require("../../lib/pagination");
const { mapProductCard } = require("../catalog/product-card.mapper");

/**
 * Perform a multi-filter product search.
 *
 * NOTE: geolocation/radius search (distance sort, bounding-box filter) was
 * previously gated behind a hardcoded `hasLocation = false` flag and could
 * never execute — that branch (unbounded findMany + full in-memory sort)
 * has been removed. If/when geo search is reintroduced, it should use a
 * DB-side bounding box + LIMIT (or PostGIS), not an unbounded fetch into
 * Node — pulling every matching row across a city to sort by distance in
 * memory does not scale.
 */
async function searchProducts(params) {
  const prisma = getPrisma();
  const {
    q,
    city,
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

  // Text search query matching multiple fields.
  // PERF: this is an ILIKE '%term%' across 7 fields, 3 of them joined
  // relations (category.name, brand.name, shop.name). Leading-wildcard
  // ILIKE cannot use a plain B-tree index. Add pg_trgm GIN indexes on
  // these columns (CREATE EXTENSION pg_trgm; ... USING gin (col gin_trgm_ops))
  // at minimum, or move search to a dedicated search engine
  // (Meilisearch/Typesense/Postgres full-text) for real scale.
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
  const activeCity = city || "Surat";
  where.shop = {
    ...where.shop,
    city: { equals: activeCity, mode: "insensitive" },
  };

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

  // Paginate directly in the DB
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

  // All four lookups are independent — run them in parallel instead of
  // four sequential round-trips.
  const [productMatches, categoryMatches, brandMatches, popularQueries] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        name: { contains: searchVal, mode: "insensitive" },
        ...(city ? { shop: { city: { equals: city, mode: "insensitive" } } } : {}),
      },
      select: { name: true },
      distinct: ["name"],
      take: limit,
    }),
    prisma.category.findMany({
      where: {
        status: "active",
        deletedAt: null,
        name: { contains: searchVal, mode: "insensitive" },
      },
      select: { name: true },
      distinct: ["name"],
      take: limit,
    }),
    prisma.brand.findMany({
      where: {
        status: "active",
        deletedAt: null,
        name: { contains: searchVal, mode: "insensitive" },
      },
      select: { name: true },
      distinct: ["name"],
      take: limit,
    }),
    prisma.searchEvent.groupBy({
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
    }),
  ]);

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

  // Independent existence checks — run in parallel, and only select `id`
  // since that's all that's needed to validate existence.
  const [cat, prod] = await Promise.all([
    categoryId
      ? prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } })
      : Promise.resolve(null),
    productId
      ? prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  if (categoryId && !cat) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.NOT_FOUND,
      message: "Category not found",
    });
  }

  if (productId && !prod) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.NOT_FOUND,
      message: "Product not found",
    });
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

module.exports = {
  searchProducts,
  getSuggestions,
  trackSearchEvent,
  createProductRequest,
};