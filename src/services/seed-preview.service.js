const { getPrisma } = require("../config/prisma");

async function getSeedPreview() {
  const prisma = getPrisma();

  const [
    userCount,
    shopCount,
    productCount,
    categoryCount,
    brandCount,
    activeBannerCount,
    recentProducts,
    sampleShops,
    sampleBanners,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.shop.count(),
    prisma.product.count(),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.banner.count({ where: { status: "ACTIVE" } }),
    prisma.product.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        pricePaise: true,
        stockStatus: true,
        status: true,
        shop: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.shop.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        verificationStatus: true,
        address: { select: { city: true, state: true, pincode: true } },
      },
    }),
    prisma.banner.findMany({
      take: 3,
      where: { status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        city: true,
        section: true,
        status: true,
        startAt: true,
        endAt: true,
      },
    }),
  ]);

  return {
    userCount,
    shopCount,
    productCount,
    categoryCount,
    brandCount,
    activeBannerCount,
    recentProducts,
    sampleShops,
    sampleBanners,
  };
}

module.exports = {
  getSeedPreview,
};
