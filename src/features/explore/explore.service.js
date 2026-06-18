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
  const R = 6371; // Earth radius in km
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
      select: {
        products: true,
      },
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
    where.name = {
      contains: q,
      mode: "insensitive",
    };
  }

  const include = {};
  if (includeCounts) {
    include._count = {
      select: {
        products: true,
      },
    };
  }

  const brands = await prisma.brand.findMany({
    where,
    include: Object.keys(include).length > 0 ? include : undefined,
    orderBy: { name: "asc" },
  });

  return brands.map((b) => mapBrand(b, { includeCounts }));
}

/**
 * Get explore feed summary payload.
 */
async function getExploreFeed(params) {
  const prisma = getPrisma();
  
  // Enforce supported city, default to Surat
  let activeCity = params.city;
  if (!activeCity || !["Surat", "Navsari", "Bardoli", "Vyara"].some(c => c.toLowerCase() === activeCity.toLowerCase())) {
    activeCity = "Surat";
  }

  const { device } = params;
  const now = new Date();

  // 1. Fetch categories
  const categories = await prisma.category.findMany({
    where: { parentId: null, status: "active", deletedAt: null },
    take: 12,
    orderBy: { name: "asc" },
  });

  // 2. Fetch banners (filtered by activeCity)
  const bannerWhere = {
    status: "ACTIVE",
    deletedAt: null,
    startAt: { lte: now },
    endAt: { gte: now },
    city: { equals: activeCity, mode: "insensitive" },
  };

  if (device) {
    bannerWhere.devices = { hasSome: [device, "ALL"] };
  }

  const banners = await prisma.banner.findMany({
    where: bannerWhere,
    include: { image: true },
    orderBy: { sortOrder: "asc" },
  });

  // 3. Fetch shops (filtered strictly by Shop.city)
  const shops = await prisma.shop.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      city: { equals: activeCity, mode: "insensitive" },
    },
    include: { address: true },
  });

  // 4. Setup product query (filtered by shop's city)
  const productWhere = {
    status: "ACTIVE",
    deletedAt: null,
    shop: {
      status: "ACTIVE",
      deletedAt: null,
      city: { equals: activeCity, mode: "insensitive" },
    },
  };

  // 5. Fetch products in parallel
  const [pinnedProductsData, topProductsData, newArrivalsData] = await Promise.all([
    prisma.product.findMany({
      where: { ...productWhere, isPinned: true },
      include: {
        images: { include: { media: true } },
        category: true,
        brand: true,
        shop: { include: { address: true } },
      },
      take: 8,
      orderBy: { searchBoost: "desc" },
    }),
    prisma.product.findMany({
      where: productWhere,
      include: {
        images: { include: { media: true } },
        category: true,
        brand: true,
        shop: { include: { address: true } },
      },
      take: 8,
      orderBy: [{ ratingAvg: "desc" }, { reviewCount: "desc" }],
    }),
    prisma.product.findMany({
      where: productWhere,
      include: {
        images: { include: { media: true } },
        category: true,
        brand: true,
        shop: { include: { address: true } },
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const nearbyShops = shops.slice(0, 10);

  const mapProduct = (prod) => mapProductCard(prod);

  return {
    city: activeCity,
    categories: categories.map((c) => mapCategory(c)),
    nearbyShops: nearbyShops.map((s) => mapShopSummary(s)),
    topProducts: topProductsData.map(mapProduct),
    pinnedProducts: pinnedProductsData.map(mapProduct),
    banners: banners.map((b) => mapBanner(b)),
    sections: {
      topPicks: topProductsData.map(mapProduct),
      newArrivals: newArrivalsData.map(mapProduct),
      popularNearby: topProductsData.map(mapProduct),
    },
  };
}

module.exports = {
  listCategories,
  listBrands,
  getExploreFeed,
  calculateDistance,
};
