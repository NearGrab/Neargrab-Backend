const {
  mapCategory,
  mapBrand,
  mapShopSummary,
} = require("../catalog/product-card.mapper");

function toNum(val) {
  if (val === null || val === undefined) return null;
  return Number(val);
}

function mapProductImage(image) {
  if (!image) return null;
  return {
    id: image.media?.id || image.mediaId || null,
    url: image.media?.url || "",
    alt: image.alt || null,
  };
}

function mapProductAttribute(attr) {
  if (!attr) return null;
  return {
    key: attr.key,
    value: attr.value,
  };
}

function mapReview(review) {
  if (!review) return null;
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    verifiedPurchase: review.verifiedPurchase,
    createdAt: review.createdAt.toISOString(),
    user: review.user
      ? {
          id: review.user.id,
          name: review.user.name,
          avatar: review.user.avatar?.url || null,
        }
      : null,
    media: review.media
      ? review.media.map((m) => ({
          id: m.media?.id || m.mediaId,
          url: m.media?.url || "",
        }))
      : [],
  };
}

function mapReviewSummary(ratingAvg, reviewCount, breakdown) {
  return {
    average: Number(Number(ratingAvg || 0).toFixed(2)) || 0,
    count: reviewCount || 0,
    breakdown: {
      5: breakdown["5"] || 0,
      4: breakdown["4"] || 0,
      3: breakdown["3"] || 0,
      2: breakdown["2"] || 0,
      1: breakdown["1"] || 0,
    },
  };
}

function mapProductDetail(product, options = {}) {
  if (!product) return null;

  const sortedImages = product.images
    ? [...product.images].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    : [];

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku || null,
    description: product.description || null,
    size: product.size || null,
    unit: product.unit || null,
    tags: product.tags || [],
    pricePaise: product.pricePaise,
    mrpPaise: product.mrpPaise || null,
    currency: product.currency,
    status: product.status,
    stockStatus: product.stockStatus,
    stockAvailable: product.stockAvailable,
    stockCount: product.stockCount ?? null,
    ratingAvg: toNum(product.ratingAvg) || 0,
    reviewCount: product.reviewCount || 0,
    viewCount: product.viewCount || 0,
    isSaved: options.isSaved || false,
    images: sortedImages.map(mapProductImage).filter(Boolean),
    attributes: product.attributes ? product.attributes.map(mapProductAttribute).filter(Boolean) : [],
    category: mapCategory(product.category),
    brand: mapBrand(product.brand),
    shop: mapShopSummary(product.shop, { distanceKm: options.distanceKm }),
    reviewSummary: mapReviewSummary(
      product.ratingAvg,
      product.reviewCount,
      options.reviewBreakdown || {}
    ),
  };
}

function mapAvailableStore(product, shop, distanceKm) {
  return {
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      pricePaise: product.pricePaise,
      stockStatus: product.stockStatus,
    },
    shop: mapShopSummary(shop, { distanceKm }),
    distanceKm: distanceKm !== null && distanceKm !== undefined ? Number(Number(distanceKm).toFixed(2)) : null,
    pricePaise: product.pricePaise,
    stockStatus: product.stockStatus,
  };
}

module.exports = {
  mapProductDetail,
  mapProductImage,
  mapProductAttribute,
  mapReview,
  mapReviewSummary,
  mapAvailableStore,
};
