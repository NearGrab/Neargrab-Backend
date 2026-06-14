const { mapCategory } = require("../catalog/product-card.mapper");

function toNum(val) {
  if (val === null || val === undefined) return null;
  return Number(val);
}

function mapShopDetail(shop, options = {}) {
  if (!shop) return null;

  const address = shop.address || {};
  const contact = shop.contact || {};

  return {
    id: shop.id,
    ownerId: shop.ownerId,
    name: shop.name,
    username: shop.username,
    slug: shop.slug,
    description: shop.description || null,
    status: shop.status,
    verificationStatus: shop.verificationStatus,
    ratingAvg: toNum(shop.ratingAvg) || 0,
    ratingCount: shop.ratingCount || 0,
    viewCount: shop.viewCount || 0,
    leadCount: shop.leadCount || 0,
    category: mapCategory(shop.category),
    logo: shop.logo
      ? {
          id: shop.logo.id,
          url: shop.logo.url,
          alt: shop.logo.altText || shop.name,
        }
      : null,
    cover: shop.cover
      ? {
          id: shop.cover.id,
          url: shop.cover.url,
          alt: shop.cover.altText || shop.name,
        }
      : null,
    address: {
      street: address.street || "",
      landmark: address.landmark || null,
      city: address.city || "",
      state: address.state || "",
      pincode: address.pincode || "",
      latitude: toNum(address.latitude),
      longitude: toNum(address.longitude),
      serviceRadiusKm: toNum(address.serviceRadiusKm) || 1,
    },
    contact: {
      phone: contact.phone || "",
      whatsapp: contact.whatsapp || null,
      email: contact.email || null,
      acceptCalls: contact.acceptCalls ?? true,
    },
    timings: shop.timings
      ? shop.timings.map((t) => ({
          weekday: t.weekday,
          opensAt: t.opensAt,
          closesAt: t.closesAt,
          isClosed: t.isClosed,
        }))
      : [],
    photos: shop.photos
      ? shop.photos.map((p) => ({
          id: p.media?.id || p.mediaId,
          url: p.media?.url || "",
          kind: p.kind,
          sortOrder: p.sortOrder,
        }))
      : [],
    paymentMethods: shop.paymentMethods
      ? shop.paymentMethods.map((pm) => ({
          method: pm.method,
          upiId: pm.upiId || null,
          enabled: pm.enabled,
        }))
      : [],
    languages: shop.languages ? shop.languages.map((l) => l.language) : [],
    tags: shop.tags ? shop.tags.map((t) => t.tag) : [],
    stats: {
      productCount: options.productCount || 0,
      reviewCount: options.reviewCount || 0,
      followersCount: options.followersCount || 0,
      isFollowing: options.isFollowing || false,
    },
  };
}

function mapShopUpdate(update) {
  if (!update) return null;
  return {
    id: update.id,
    shopId: update.shopId,
    title: update.title,
    body: update.body,
    publishedAt: update.publishedAt ? update.publishedAt.toISOString() : null,
    expiresAt: update.expiresAt ? update.expiresAt.toISOString() : null,
    createdAt: update.createdAt.toISOString(),
    media: update.media
      ? {
          id: update.media.id,
          url: update.media.url,
          alt: update.media.altText || update.title,
        }
      : null,
  };
}

module.exports = {
  mapShopDetail,
  mapShopUpdate,
};
