const { getPrisma } = require("../config/prisma");

const enumValues = {
  userRoles: ["CUSTOMER", "SHOPKEEPER", "ADMIN", "SUPER_ADMIN", "SUPPORT_ADMIN", "CONTENT_ADMIN"],
  userStatuses: ["ACTIVE", "PENDING", "SUSPENDED", "DEACTIVATED"],
  shopStatuses: ["DRAFT", "PENDING_REVIEW", "ACTIVE", "REJECTED", "SUSPENDED", "CLOSED"],
  verificationStatuses: ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"],
  productStatuses: ["DRAFT", "PENDING_APPROVAL", "ACTIVE", "FLAGGED", "INACTIVE", "DELETED"],
  stockStatuses: ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"],
  bannerStatuses: ["DRAFT", "SCHEDULED", "ACTIVE", "PINNED", "EXPIRED", "INACTIVE"],
  bannerSections: ["TOP_HERO", "TOP_CAROUSEL", "MIDDLE_BANNER", "BOTTOM_BANNER"],
  deviceTargets: ["MOBILE", "DESKTOP"],
  reviewStatuses: ["PUBLISHED", "PENDING", "FLAGGED", "HIDDEN", "DELETED"],
  notificationTypes: ["SYSTEM", "PROMO", "PRODUCT", "SHOP", "REVIEW", "STOCK", "RESERVATION", "SECURITY"],
  notificationChannels: ["IN_APP", "EMAIL", "SMS", "WHATSAPP", "PUSH"],
  leadSources: ["SEARCH", "MAP_VIEW", "SHOP_PROFILE", "CATEGORY_BROWSE", "PRODUCT_PAGE", "BANNER", "OTHER"],
  reservationStatuses: ["DRAFT", "REQUESTED", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED", "COMPLETED"],
  paymentMethods: ["CASH", "UPI", "CARD", "WALLET"],
};

async function getMeta() {
  const prisma = getPrisma();

  const [addresses, categories, brands] = await Promise.all([
    prisma.shopAddress.findMany({
      distinct: ["city"],
      orderBy: { city: "asc" },
      select: { city: true, state: true },
    }),
    prisma.category.findMany({
      where: { status: "active", deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, icon: true },
    }),
    prisma.brand.findMany({
      where: { status: "active", deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return {
    cities: addresses.map((address) => ({
      name: address.city,
      state: address.state,
    })),
    categories,
    brands,
    enums: enumValues,
  };
}

module.exports = {
  getMeta,
  enumValues,
};
