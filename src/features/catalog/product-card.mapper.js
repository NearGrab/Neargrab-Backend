/**
 * Safe conversion of Prisma Decimal to standard JS Number.
 */
function toNum(val) {
  if (val === null || val === undefined) return null;
  return Number(val);
}

/**
 * Maps a Category database model to response format.
 */
function mapCategory(category, options = {}) {
  if (!category) return null;

  const result = {
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon || null,
    parentId: category.parentId || null,
  };

  if (options.includeCounts) {
    result.productCount = category._count?.products ?? 0;
  }

  return result;
}

/**
 * Maps a Brand database model to response format.
 */
function mapBrand(brand, options = {}) {
  if (!brand) return null;

  const result = {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
  };

  if (options.includeCounts) {
    result.productCount = brand._count?.products ?? 0;
  }

  return result;
}

/**
 * Maps a Shop database model (with address/metadata) to summary format.
 */
function mapShopSummary(shop, options = {}) {
  if (!shop) return null;

  const address = shop.address || {};
  const distanceKm = shop.distanceKm !== undefined ? shop.distanceKm : options.distanceKm;

  return {
    id: shop.id,
    name: shop.name,
    slug: shop.slug,
    status: shop.status,
    verificationStatus: shop.verificationStatus,
    city: address.city || null,
    pincode: address.pincode || null,
    distanceKm: distanceKm !== undefined && distanceKm !== null ? Number(Number(distanceKm).toFixed(2)) : null,
    ratingAvg: toNum(shop.ratingAvg) || 0,
    reviewCount: shop.ratingCount || 0,
  };
}

/**
 * Maps a Banner database model to response format.
 */
function mapBanner(banner) {
  if (!banner) return null;

  return {
    id: banner.id,
    title: banner.title,
    shopId: banner.shopId || null,
    productId: banner.productId || null,
    city: banner.city || null,
    section: banner.section,
    status: banner.status,
    devices: banner.devices || [],
    image: banner.image
      ? {
          id: banner.image.id,
          url: banner.image.url,
          alt: banner.image.altText || banner.title,
        }
      : null,
  };
}

/**
 * Maps a Product database model to the standardized Product Card format.
 */
function mapProductCard(product, options = {}) {
  if (!product) return null;

  // Extract primary image sorted by sortOrder asc
  let primaryImage = null;
  if (product.images && product.images.length > 0) {
    const sortedImages = [...product.images].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const firstImg = sortedImages[0];
    primaryImage = {
      id: firstImg.media?.id || firstImg.mediaId,
      url: firstImg.media?.url || "",
      alt: firstImg.alt || product.name,
    };
  }

  // Determine computed distance
  const distanceKm = product.distanceKm !== undefined ? product.distanceKm : (product.shop?.distanceKm ?? null);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku || null,
    pricePaise: product.pricePaise,
    mrpPaise: product.mrpPaise || null,
    currency: product.currency,
    size: product.size || null,
    unit: product.unit || null,
    stockStatus: product.stockStatus,
    stockAvailable: product.stockAvailable,
    ratingAvg: toNum(product.ratingAvg) || 0,
    reviewCount: product.reviewCount || 0,
    viewCount: product.viewCount || 0,
    isPinned: product.isPinned,
    image: primaryImage,
    category: mapCategory(product.category),
    brand: mapBrand(product.brand),
    shop: product.shop
      ? {
          id: product.shop.id,
          name: product.shop.name,
          slug: product.shop.slug,
          city: product.shop.address?.city || null,
          pincode: product.shop.address?.pincode || null,
          verificationStatus: product.shop.verificationStatus,
        }
      : null,
    distanceKm: distanceKm !== null && distanceKm !== undefined ? Number(Number(distanceKm).toFixed(2)) : null,
  };
}

module.exports = {
  mapCategory,
  mapBrand,
  mapShopSummary,
  mapBanner,
  mapProductCard,
};
