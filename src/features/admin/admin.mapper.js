function toNum(val) {
  if (val === null || val === undefined) return null;
  return Number(val);
}

function safeIsoString(date) {
  if (!date) return null;
  if (date instanceof Date) return date.toISOString();
  if (typeof date === "string") return date;
  try {
    const d = new Date(date);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch (err) {}
  return null;
}

function mapAdminUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    avatar: user.avatar ? { id: user.avatar.id, url: user.avatar.url } : null,
    city: user.city,
    createdAt: safeIsoString(user.createdAt),
    profile: user.profile
      ? {
          bio: user.profile.bio,
          language: user.profile.language,
          dateOfBirth: safeIsoString(user.profile.dateOfBirth),
        }
      : null,
  };
}

function mapAdminShop(shop) {
  if (!shop) return null;
  return {
    id: shop.id,
    name: shop.name,
    username: shop.username,
    slug: shop.slug,
    owner: shop.owner
      ? {
          id: shop.owner.id,
          name: shop.owner.name,
          email: shop.owner.email,
          phone: shop.owner.phone,
        }
      : null,
    category: shop.category
      ? {
          id: shop.category.id,
          name: shop.category.name,
          slug: shop.category.slug,
        }
      : null,
    status: shop.status,
    verificationStatus: shop.verificationStatus,
    ratingAvg: toNum(shop.ratingAvg) || 0,
    ratingCount: shop.ratingCount || 0,
    viewCount: shop.viewCount || 0,
    leadCount: shop.leadCount || 0,
    establishedYear: shop.establishedYear,
    description: shop.description,
    gstNumber: shop.gstNumber,
    panNumber: shop.panNumber,
    address: shop.address
      ? {
          street: shop.address.street,
          landmark: shop.address.landmark,
          city: shop.address.city,
          state: shop.address.state,
          pincode: shop.address.pincode,
          latitude: toNum(shop.address.latitude),
          longitude: toNum(shop.address.longitude),
          serviceRadiusKm: toNum(shop.address.serviceRadiusKm),
        }
      : null,
    contact: shop.contact
      ? {
          phone: shop.contact.phone,
          whatsapp: shop.contact.whatsapp,
          alternatePhone: shop.contact.alternatePhone,
          email: shop.contact.email,
          acceptCalls: shop.contact.acceptCalls,
          enableStockRequests: shop.contact.enableStockRequests,
          receiveNotifications: shop.contact.receiveNotifications,
        }
      : null,
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
          upiId: pm.upiId,
          enabled: pm.enabled,
        }))
      : [],
    languages: shop.languages ? shop.languages.map((l) => l.language) : [],
    tags: shop.tags ? shop.tags.map((t) => t.tag) : [],
    createdAt: safeIsoString(shop.createdAt),
  };
}

function mapAdminProduct(product) {
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    size: product.size,
    unit: product.unit,
    tags: product.tags,
    pricePaise: product.pricePaise,
    mrpPaise: product.mrpPaise,
    currency: product.currency,
    status: product.status,
    stockStatus: product.stockStatus,
    stockAvailable: product.stockAvailable,
    stockCount: product.stockCount,
    isPinned: product.isPinned,
    isFlagged: product.isFlagged,
    ratingAvg: toNum(product.ratingAvg) || 0,
    reviewCount: product.reviewCount || 0,
    viewCount: product.viewCount || 0,
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
        }
      : null,
    brand: product.brand
      ? {
          id: product.brand.id,
          name: product.brand.name,
        }
      : null,
    shop: product.shop
      ? {
          id: product.shop.id,
          name: product.shop.name,
          city: product.shop.address?.city || null,
        }
      : null,
    images: product.images
      ? product.images.map((img) => ({
          id: img.media?.id || img.mediaId,
          url: img.media?.url || "",
          alt: img.alt || null,
        }))
      : [],
    createdAt: safeIsoString(product.createdAt),
  };
}

function mapAdminBanner(banner) {
  if (!banner) return null;
  return {
    id: banner.id,
    title: banner.title,
    city: banner.city,
    section: banner.section,
    status: banner.status,
    devices: banner.devices,
    plan: banner.plan,
    startAt: safeIsoString(banner.startAt),
    endAt: safeIsoString(banner.endAt),
    sortOrder: banner.sortOrder,
    views: banner.views,
    clicks: banner.clicks,
    revenuePaise: banner.revenuePaise,
    currency: banner.currency,
    shop: banner.shop
      ? {
          id: banner.shop.id,
          name: banner.shop.name,
        }
      : null,
    product: banner.product
      ? {
          id: banner.product.id,
          name: banner.product.name,
        }
      : null,
    image: banner.image
      ? {
          id: banner.image.id,
          url: banner.image.url,
        }
      : null,
    createdAt: safeIsoString(banner.createdAt),
  };
}

function mapAdminReview(review) {
  if (!review) return null;
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    status: review.status,
    verifiedPurchase: review.verifiedPurchase,
    createdAt: safeIsoString(review.createdAt),
    user: review.user
      ? {
          id: review.user.id,
          name: review.user.name,
          avatarUrl: review.user.avatar?.url || null,
        }
      : null,
    shop: review.shop
      ? {
          id: review.shop.id,
          name: review.shop.name,
        }
      : null,
    product: review.product
      ? {
          id: review.product.id,
          name: review.product.name,
        }
      : null,
  };
}

function mapAdminFeedback(fb) {
  if (!fb) return null;
  return {
    id: fb.id,
    type: fb.type,
    subject: fb.subject,
    message: fb.message,
    status: fb.status,
    metadata: fb.metadata,
    createdAt: safeIsoString(fb.createdAt),
    user: fb.user
      ? {
          id: fb.user.id,
          name: fb.user.name,
          email: fb.user.email,
        }
      : null,
  };
}

function mapAdminAuditLog(log) {
  if (!log) return null;
  return {
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    before: log.before,
    after: log.after,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: safeIsoString(log.createdAt),
    actor: log.actor
      ? {
          id: log.actor.id,
          name: log.actor.name,
          role: log.actor.role,
        }
      : null,
  };
}

module.exports = {
  mapAdminUser,
  mapAdminShop,
  mapAdminProduct,
  mapAdminBanner,
  mapAdminReview,
  mapAdminFeedback,
  mapAdminAuditLog,
};
