const { mapCategory } = require("../catalog/product-card.mapper");

function toNum(val) {
  if (val === null || val === undefined) return null;
  return Number(val);
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

function mapDashboardProduct(product) {
  if (!product) return null;

  const firstImage = product.images?.[0]?.media?.url || null;

  return {
    id: product.id,
    name: product.name,
    sku: product.sku || null,
    categoryId: product.categoryId || null,
    brandId: product.brandId || null,
    categoryName: product.category?.name || null,
    brandName: product.brand?.name || null,
    description: product.description || null,
    size: product.size || null,
    unit: product.unit || null,
    tags: product.tags || [],
    pricePaise: product.pricePaise,
    mrpPaise: product.mrpPaise || null,
    status: product.status,
    stockStatus: product.stockStatus,
    stockAvailable: product.stockAvailable,
    stockCount: product.stockCount !== null ? product.stockCount : null,
    ratingAvg: toNum(product.ratingAvg) || 0,
    reviewCount: product.reviewCount || 0,
    viewCount: product.viewCount || 0,
    views: product.viewCount || 0,
    clicks: product.analytics?.totalClicks || 0,
    images: product.images
      ? product.images.map((img) => ({
          id: img.id,
          mediaId: img.mediaId,
          url: img.media?.url || "",
          alt: img.alt || product.name,
          sortOrder: img.sortOrder,
        }))
      : [],
    attributes: product.attributes
      ? product.attributes.map((attr) => ({
          id: attr.id,
          key: attr.key,
          value: attr.value,
        }))
      : [],
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    dateRelative: formatDateRelative(product.updatedAt),
  };
}

function mapDashboardReservation(resv) {
  if (!resv) return null;

  return {
    id: resv.id,
    userId: resv.userId,
    userName: resv.user?.name || "Customer",
    status: resv.status,
    totalPaise: resv.totalPaise,
    currency: resv.currency,
    customerNote: resv.customerNote || null,
    shopkeeperNote: resv.shopkeeperNote || null,
    createdAt: resv.createdAt.toISOString(),
    updatedAt: resv.updatedAt.toISOString(),
    dateRelative: formatDateRelative(resv.createdAt),
    items: resv.items
      ? resv.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.productNameSnapshot || item.product?.name || "Product",
          sku: item.productSkuSnapshot || item.product?.sku || null,
          quantity: item.quantity,
          pricePaise: item.pricePaiseSnapshot,
          image: item.product?.images?.[0]?.media?.url || null,
        }))
      : [],
  };
}

function mapDashboardReview(rev) {
  if (!rev) return null;

  return {
    id: rev.id,
    authorName: rev.user?.name || "Anonymous",
    authorAvatar: rev.user?.avatar?.url || null,
    rating: rev.rating,
    comment: rev.comment,
    verifiedPurchase: rev.verifiedPurchase,
    productId: rev.productId || null,
    productName: rev.product?.name || null,
    createdAt: rev.createdAt.toISOString(),
    dateRelative: formatDateRelative(rev.createdAt),
  };
}

function mapDashboardLead(lead) {
  if (!lead) return null;

  return {
    id: lead.id,
    userId: lead.userId,
    userName: lead.user?.name || "Guest",
    productId: lead.productId || null,
    productName: lead.product?.name || null,
    source: lead.source,
    action: lead.metadata?.action || null,
    metadata: lead.metadata || {},
    createdAt: lead.createdAt.toISOString(),
    dateRelative: formatDateRelative(lead.createdAt),
  };
}

function formatGrowth(growth) {
  if (growth === 0) return "0%";
  return growth > 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;
}

function mapDashboardStats(shop, stats) {
  const viewsTrend = stats.views.trend;
  const clicksTrend = stats.clicks.trend;
  const inquiriesTrend = stats.inquiries.trend;
  const followersTrend = stats.followers.trend;

  const dates = stats.dates; // 7 formatted day strings e.g. ["30 May", "31 May", ...]

  const performanceData = dates.map((date, index) => ({
    date,
    "Profile Views": viewsTrend[index],
    "Direction Clicks": clicksTrend[index],
    Inquiries: inquiriesTrend[index],
    Followers: followersTrend[index],
  }));

  const recentReviewsMapped = stats.recentReviews.map(mapDashboardReview);
  const lowStockProductsMapped = stats.lowStockProducts.map((p) => ({
    id: p.id,
    name: p.name,
    stockLeft: p.stockCount || 0,
    status: p.stockCount === 0 || !p.stockAvailable ? "Out of Stock" : "Low",
    image: p.images?.[0]?.media?.url || null,
  }));

  return {
    shopProfile: {
      id: shop.id,
      name: shop.name,
      username: shop.username,
      slug: shop.slug,
      logo: shop.logo?.url || null,
      coverImage: shop.cover?.url || null,
      rating: toNum(shop.ratingAvg) || 0,
      reviewCount: shop.ratingCount || 0,
      isVerified: shop.verificationStatus === "VERIFIED",
      distance: null, // Distance is computed relative to searcher location
      openingHours: shop.timings?.length > 0 ? "Configured" : "Not configured",
      description: shop.description || null,
    },
    stats: [
      {
        id: "views",
        label: "Profile Views",
        value: stats.views.total.toLocaleString(),
        growth: formatGrowth(stats.views.growth),
        isPositive: stats.views.growth >= 0,
        timeframe: "vs last 7 days",
        trendData: viewsTrend,
      },
      {
        id: "clicks",
        label: "Direction Clicks",
        value: stats.clicks.total.toLocaleString(),
        growth: formatGrowth(stats.clicks.growth),
        isPositive: stats.clicks.growth >= 0,
        timeframe: "vs last 7 days",
        trendData: clicksTrend,
      },
      {
        id: "inquiries",
        label: "Inquiries",
        value: stats.inquiries.total.toLocaleString(),
        growth: formatGrowth(stats.inquiries.growth),
        isPositive: stats.inquiries.growth >= 0,
        timeframe: "vs last 7 days",
        trendData: inquiriesTrend,
      },
      {
        id: "followers",
        label: "Followers",
        value: stats.followers.total.toLocaleString(),
        growth: formatGrowth(stats.followers.growth),
        isPositive: stats.followers.growth >= 0,
        timeframe: "vs last 7 days",
        trendData: followersTrend,
      },
      {
        id: "rating",
        label: "Avg. Rating",
        value: (toNum(shop.ratingAvg) || 0).toFixed(1),
        stars: 5,
        timeframe: `From ${shop.ratingCount || 0} reviews`,
        trendData: null,
      },
    ],
    performanceData,
    topActions: [
      { label: "Product Views", value: stats.productViewsTotal.toLocaleString(), growth: formatGrowth(stats.productViewsGrowth), isPositive: stats.productViewsGrowth >= 0 },
      { label: "Product Clicks", value: stats.productClicksTotal.toLocaleString(), growth: formatGrowth(stats.productClicksGrowth), isPositive: stats.productClicksGrowth >= 0 },
      { label: "Saved by Users", value: stats.savedProductsTotal.toLocaleString(), growth: formatGrowth(stats.savedProductsGrowth), isPositive: stats.savedProductsGrowth >= 0 },
    ],
    reviews: recentReviewsMapped,
    lowStockProducts: lowStockProductsMapped,
    growthTips: [
      { id: "tip_1", title: "Add more products", desc: "Shops with more products get more views." },
      { id: "tip_2", title: "Keep stock updated", desc: "Updated stock builds trust and gets more inquiries." },
      { id: "tip_3", title: "Promote your shop", desc: "Share your QR Code with customers to get direct leads." },
    ],
    qrPayload: `neargrab://shops/${shop.slug}`,
  };
}

module.exports = {
  mapDashboardProduct,
  mapDashboardReservation,
  mapDashboardReview,
  mapDashboardLead,
  mapDashboardStats,
};
