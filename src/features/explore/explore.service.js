const { getPrisma } = require("../../config/prisma");
const {
  mapCategory,
  mapBrand,
  mapShopSummary,
  mapBanner,
  mapProductCard,
} = require("../catalog/product-card.mapper");

/**
 * Calculate distance between two coordinates in Kilometers.
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get category list.
 */
async function listCategories({ includeCounts, parentId, status }) {
  const prisma = getPrisma();

  const where = {
    status,
    deletedAt: null,
  };

  if (parentId !== undefined) {
    where.parentId = parentId === "null" || parentId === null ? null : parentId;
  }

  const include = {};
  if (includeCounts) {
    include._count = {
      select: { products: true },
    };
  }

  const categories = await prisma.category.findMany({
    where,
    include: Object.keys(include).length > 0 ? include : undefined,
    orderBy: { name: "asc" },
  });

  return categories.map((cat) => mapCategory(cat, { includeCounts }));
}

/**
 * Get brand list.
 */
async function listBrands({ includeCounts, q, status }) {
  const prisma = getPrisma();

  const where = {
    status,
    deletedAt: null,
  };

  if (q) {
    where.name = { contains: q, mode: "insensitive" };
  }

  const include = {};
  if (includeCounts) {
    include._count = {
      select: { products: true },
    };
  }

  const brands = await prisma.brand.findMany({
    where,
    include: Object.keys(include).length > 0 ? include : undefined,
    orderBy: { name: "asc" },
  });

  return brands.map((b) => mapBrand(b, { includeCounts }));
}

function formatDateRelative(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

const SUPPORTED_CITIES = ["Surat", "Navsari", "Bardoli", "Vyara"];

/**
 * Get explore feed summary payload.
 * Optimizations applied:
 *  - All queries run in a single Promise.all (one parallel round-trip)
 *  - Product pool fetched once (24 rows), split in JS — saves 2 DB round-trips
 *  - shops take:10 pushed to DB instead of JS slice
 *  - Review fallback only fires when city has <5 qualifying reviews
 *  - productInclude/productWhere defined once, reused
 *  - mappedTop computed once, referenced in 3 places
 */
async function getExploreFeed(params) {
  const prisma = getPrisma();

  // Normalize city — default to Surat if unsupported
  let activeCity = params.city;
  if (
    !activeCity ||
    !SUPPORTED_CITIES.some(
      (c) => c.toLowerCase() === activeCity.toLowerCase()
    )
  ) {
    activeCity = "Surat";
  }

  const { device } = params;
  const now = new Date();

  const cityFilter = { equals: activeCity, mode: "insensitive" };

  const productWhere = {
    status: "ACTIVE",
    deletedAt: null,
    isPinned: true,
    shop: { status: "ACTIVE", deletedAt: null, city: cityFilter },
  };

  // Only select fields that mapProductCard actually needs
  const productInclude = {
    images: { include: { media: true } },
    category: true,
    brand: true,
    shop: { include: { address: true } },
  };

  const bannerWhere = {
    status: "ACTIVE",
    deletedAt: null,
    startAt: { lte: now },
    endAt: { gte: now },
    city: cityFilter,
    ...(device ? { devices: { hasSome: [device, "ALL"] } } : {}),
  };

  // Single parallel round-trip — 7 queries fire concurrently
  const [
    categories,
    banners,
    shops,
    productPool,
    cityReviews,
  ] = await Promise.all([
    // Categories (changes rarely — good Redis candidate, TTL 1h)
    prisma.category.findMany({
      where: { parentId: null, status: "active", deletedAt: null },
      take: 12,
      orderBy: { name: "asc" },
    }),

    // Banners (TTL 10min)
    prisma.banner.findMany({
      where: bannerWhere,
      include: { image: true },
      orderBy: { sortOrder: "asc" },
    }),

    // Top 10 shops only — let DB do the limit, not JS
    prisma.shop.findMany({
      where: { status: "ACTIVE", deletedAt: null, city: cityFilter },
      include: { address: true },
      take: 10,
    }),

    // Single product pool (24 rows) — split in JS instead of 3 separate queries
    // Ordered by rating so topProducts slice is already correct
    prisma.product.findMany({
      where: productWhere,
      include: productInclude,
      take: 24,
      orderBy: [{ ratingAvg: "desc" }, { reviewCount: "desc" }],
    }),

    // City-filtered reviews (rating >= 4, latest 5)
    prisma.review.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        rating: { gte: 4 },
        shop: { city: cityFilter, status: "ACTIVE", deletedAt: null },
      },
      include: { user: { include: { avatar: true } }, shop: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Split product pool in JS — zero extra DB round-trips
  const pinnedProductsData = productPool
    .filter((p) => p.isPinned)
    .slice(0, 8);

  const topProductsData = productPool.slice(0, 8);

  const newArrivalsData = [...productPool]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  // Review fallback — only fires if city has fewer than 5 qualifying reviews
  let allReviews = cityReviews;
  if (cityReviews.length < 5) {
    const cityIds = new Set(cityReviews.map((r) => r.id));
    const fallback = await prisma.review.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        rating: { gte: 4 },
        id: { notIn: [...cityIds] },
      },
      include: { user: { include: { avatar: true } }, shop: true },
      orderBy: { createdAt: "desc" },
      take: 5 - cityReviews.length,
    });
    allReviews = [...cityReviews, ...fallback];
  }

  const realReviews = allReviews.map((r) => ({
    id: r.id,
    user: r.user?.name || "Anonymous",
    avatar: r.user?.avatar?.url || null,
    time: formatDateRelative(r.createdAt),
    rating: r.rating,
    comment: r.comment,
    storeName: r.shop?.name || "Local Store",
    shopId: r.shopId,
    shopSlug: r.shop?.slug || null,
  }));

  // Map once, reference in 3 places
  const mappedTop = topProductsData.map(mapProductCard);

  return {
    city: activeCity,
    categories: categories.map((c) => mapCategory(c)),
    nearbyShops: shops.map((s) => mapShopSummary(s)),
    topProducts: mappedTop,
    pinnedProducts: pinnedProductsData.map(mapProductCard),
    banners: banners.map((b) => mapBanner(b)),
    realReviews,
    sections: {
      topPicks: mappedTop,
      newArrivals: newArrivalsData.map(mapProductCard),
      popularNearby: mappedTop,
    },
  };
}

module.exports = {
  listCategories,
  listBrands,
  getExploreFeed,
  calculateDistance,
};