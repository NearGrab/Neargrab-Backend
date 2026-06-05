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
  const { city, latitude, longitude, radiusKm = 10, device } = params;

  const now = new Date();
  const hasLocation = latitude !== undefined && longitude !== undefined;

  // 1. Fetch categories
  const categories = await prisma.category.findMany({
    where: { parentId: null, status: "active", deletedAt: null },
    take: 12,
    orderBy: { name: "asc" },
  });

  // 2. Fetch banners
  const bannerWhere = {
    status: "ACTIVE",
    deletedAt: null,
    startAt: { lte: now },
    endAt: { gte: now },
  };

  if (city) {
    bannerWhere.city = { equals: city, mode: "insensitive" };
  }

  if (device) {
    bannerWhere.devices = { hasSome: [device, "ALL"] };
  }

  const banners = await prisma.banner.findMany({
    where: bannerWhere,
    include: { image: true },
    orderBy: { sortOrder: "asc" },
  });

  // 3. Setup shop filters
  const shopWhere = {
    status: "ACTIVE",
    deletedAt: null,
  };

  if (city) {
    shopWhere.address = { city: { equals: city, mode: "insensitive" } };
  }

  if (hasLocation) {
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));
    shopWhere.address = {
      ...shopWhere.address,
      latitude: { gte: latitude - latDelta, lte: latitude + latDelta },
      longitude: { gte: longitude - lonDelta, lte: longitude + lonDelta },
    };
  }

  let shops = await prisma.shop.findMany({
    where: shopWhere,
    include: { address: true },
  });

  // Haversine filter and distance attach
  if (hasLocation) {
    shops = shops
      .map((shop) => {
        const dist = calculateDistance(
          latitude,
          longitude,
          Number(shop.address.latitude),
          Number(shop.address.longitude)
        );
        return { ...shop, distanceKm: dist };
      })
      .filter((shop) => shop.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  const nearbyShops = shops.slice(0, 10);
  const shopIds = shops.map((s) => s.id);

  // 4. Setup products query filter
  const productWhere = {
    status: "ACTIVE",
    deletedAt: null,
    shop: { status: "ACTIVE", deletedAt: null },
  };

  if (hasLocation) {
    productWhere.shopId = { in: shopIds };
  } else if (city) {
    productWhere.shop = {
      address: { city: { equals: city, mode: "insensitive" } },
      status: "ACTIVE",
      deletedAt: null,
    };
  }

  // Fetch pinned products
  const pinnedProductsData = await prisma.product.findMany({
    where: { ...productWhere, isPinned: true },
    include: {
      images: { include: { media: true } },
      category: true,
      brand: true,
      shop: { include: { address: true } },
    },
    take: 8,
    orderBy: { searchBoost: "desc" },
  });

  // Fetch top products (highest rated/reviewed)
  const topProductsData = await prisma.product.findMany({
    where: productWhere,
    include: {
      images: { include: { media: true } },
      category: true,
      brand: true,
      shop: { include: { address: true } },
    },
    take: 8,
    orderBy: [{ ratingAvg: "desc" }, { reviewCount: "desc" }],
  });

  // Fetch sections: topPicks, newArrivals, popularNearby
  const newArrivalsData = await prisma.product.findMany({
    where: productWhere,
    include: {
      images: { include: { media: true } },
      category: true,
      brand: true,
      shop: { include: { address: true } },
    },
    take: 8,
    orderBy: { createdAt: "desc" },
  });

  // Map function for products (injecting distance if location exists)
  const attachDistAndMap = (prod) => {
    let distance = null;
    if (hasLocation && prod.shop?.address) {
      const matchShop = shops.find((s) => s.id === prod.shopId);
      distance = matchShop ? matchShop.distanceKm : null;
    }
    return mapProductCard(prod, { distanceKm: distance });
  };

  return {
    city: city || null,
    categories: categories.map((c) => mapCategory(c)),
    nearbyShops: nearbyShops.map((s) => mapShopSummary(s)),
    topProducts: topProductsData.map(attachDistAndMap),
    pinnedProducts: pinnedProductsData.map(attachDistAndMap),
    banners: banners.map((b) => mapBanner(b)),
    sections: {
      topPicks: topProductsData.map(attachDistAndMap),
      newArrivals: newArrivalsData.map(attachDistAndMap),
      popularNearby: topProductsData.map(attachDistAndMap), // fallback or sorted by viewCount if needed
    },
  };
}

module.exports = {
  listCategories,
  listBrands,
  getExploreFeed,
  calculateDistance,
};
