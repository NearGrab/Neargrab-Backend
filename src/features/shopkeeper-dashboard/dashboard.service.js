const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const { buildPaginationMeta } = require("../../lib/pagination");
const { runInTransaction } = require("../../lib/transaction");
const { createNotification } = require("../notification/notification.service");
const crypto = require("crypto");

/**
 * Fetch the shop owned by the user and throw error if not found.
 */
async function getShopkeeperShop(userId) {
  const prisma = getPrisma();
  const shop = await prisma.shop.findUnique({
    where: { ownerId: userId },
    include: {
      address: true,
      contact: true,
      timings: true,
      logo: true,
      cover: true,
      paymentMethods: true,
      languages: true,
      tags: true,
    },
  });

  if (!shop || shop.status === "DRAFT") {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.SHOP_NOT_FOUND,
      message: "Active or pending shop profile not found for this user",
    });
  }

  return shop;
}

/**
 * Generates dates for the last 14 days (previous 7 + last 7)
 */
function get14DaysWindow() {
  const dates = [];
  const now = new Date();
  // We want to create 14 consecutive days ending today
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dates.push(d);
  }
  return dates;
}

/**
 * Calculate dashboard stats and trend arrays.
 */
async function getDashboardStats(userId) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);

  const datesWindow = get14DaysWindow();
  const startOfWindow = new Date(datesWindow[0]);
  startOfWindow.setHours(0, 0, 0, 0);

  // Fetch product views, leads, and saves within 14 days window
  const [productViews, leads, savedProducts, lowStockProducts, recentReviews] = await Promise.all([
    prisma.productView.findMany({
      where: { shopId: shop.id, createdAt: { gte: startOfWindow } },
    }),
    prisma.shopLead.findMany({
      where: { shopId: shop.id, createdAt: { gte: startOfWindow } },
    }),
    prisma.savedProduct.findMany({
      where: {
        product: { shopId: shop.id },
        createdAt: { gte: startOfWindow },
      },
      include: { product: true },
    }),
    prisma.product.findMany({
      where: {
        shopId: shop.id,
        status: { not: "DELETED" },
        deletedAt: null,
        OR: [
          { stockStatus: "OUT_OF_STOCK" },
          { stockAvailable: false },
        ],
      },
      take: 5,
      include: {
        images: { include: { media: true } },
      },
    }),
    prisma.review.findMany({
      where: { shopId: shop.id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: { include: { avatar: true } },
        product: true,
      },
    }),
  ]);

  // Map elements into daily trend buckets
  const viewsTrend14 = Array(14).fill(0);
  const clicksTrend14 = Array(14).fill(0);
  const inquiriesTrend14 = Array(14).fill(0);
  const followersTrend14 = Array(14).fill(0);

  const dayTimestamps = datesWindow.map((d) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  });

  const getDayIndex = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const t = d.getTime();
    return dayTimestamps.indexOf(t);
  };

  productViews.forEach((pv) => {
    const idx = getDayIndex(pv.createdAt);
    if (idx !== -1) {
      viewsTrend14[idx]++;
    }
  });

  leads.forEach((l) => {
    const idx = getDayIndex(l.createdAt);
    if (idx !== -1) {
      const action = l.metadata?.action || "";
      const source = l.source;
      // Click definition
      if (source === "MAP_VIEW" || action === "map" || action === "address" || action === "directions") {
        clicksTrend14[idx]++;
      } else {
        inquiriesTrend14[idx]++;
      }
    }
  });

  savedProducts.forEach((sp) => {
    const idx = getDayIndex(sp.createdAt);
    if (idx !== -1) {
      followersTrend14[idx]++;
    }
  });

  // Calculate totals and growths
  const getPeriodStats = (trendArray) => {
    const period1 = trendArray.slice(0, 7).reduce((a, b) => a + b, 0);
    const period2 = trendArray.slice(7, 14).reduce((a, b) => a + b, 0);
    const growth = period1 === 0 ? (period2 > 0 ? 100 : 0) : ((period2 - period1) / period1) * 100;
    return {
      total: period2,
      growth,
      trend: trendArray.slice(7, 14),
    };
  };

  const viewsStats = getPeriodStats(viewsTrend14);
  const clicksStats = getPeriodStats(clicksTrend14);
  const inquiriesStats = getPeriodStats(inquiriesTrend14);
  const followersStats = getPeriodStats(followersTrend14);

  // Format date strings for the trend chart (last 7 days)
  const datesFormatted = datesWindow.slice(7, 14).map((d) => {
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  });

  // Additional aggregates
  const [totalProductViews, totalSavedProducts] = await Promise.all([
    prisma.productView.count({
      where: { shopId: shop.id },
    }),
    prisma.savedProduct.count({
      where: { product: { shopId: shop.id } },
    }),
  ]);

  const productViewsPeriod1 = viewsTrend14.slice(0, 7).reduce((a, b) => a + b, 0);
  const productViewsPeriod2 = viewsTrend14.slice(7, 14).reduce((a, b) => a + b, 0);
  const productViewsGrowth = productViewsPeriod1 === 0 ? (productViewsPeriod2 > 0 ? 100 : 0) : ((productViewsPeriod2 - productViewsPeriod1) / productViewsPeriod1) * 100;

  const savedPeriod1 = followersTrend14.slice(0, 7).reduce((a, b) => a + b, 0);
  const savedPeriod2 = followersTrend14.slice(7, 14).reduce((a, b) => a + b, 0);
  const savedProductsGrowth = savedPeriod1 === 0 ? (savedPeriod2 > 0 ? 100 : 0) : ((savedPeriod2 - savedPeriod1) / savedPeriod1) * 100;

  return {
    shop,
    stats: {
      views: viewsStats,
      clicks: clicksStats,
      inquiries: inquiriesStats,
      followers: followersStats,
      dates: datesFormatted,
      productViewsTotal: totalProductViews,
      productViewsGrowth,
      savedProductsTotal: totalSavedProducts,
      savedProductsGrowth,
      lowStockProducts,
      recentReviews,
    },
  };
}

/**
 * Retrieve own shop profile detail.
 */
async function getShopProfile(userId) {
  return await getShopkeeperShop(userId);
}

/**
 * Update shop profile details.
 */
async function updateShopProfile(userId, input) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);

  const {
    name,
    description,
    logoMediaId,
    coverMediaId,
    categoryId,
    address,
    contact,
    paymentMethods,
    languages,
    tags,
  } = input;

  return await runInTransaction(async (tx) => {
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (categoryId !== undefined) updateData.categoryId = categoryId;

    if (logoMediaId !== undefined) {
      if (logoMediaId) {
        updateData.logo = { connect: { id: logoMediaId } };
      } else {
        updateData.logo = { disconnect: true };
      }
    }

    if (coverMediaId !== undefined) {
      if (coverMediaId) {
        updateData.cover = { connect: { id: coverMediaId } };
      } else {
        updateData.cover = { disconnect: true };
      }
    }

    // Update main shop details
    await tx.shop.update({
      where: { id: shop.id },
      data: updateData,
    });

    // Address Update
    if (address) {
      const addressData = {};
      if (address.street !== undefined) addressData.street = address.street;
      if (address.landmark !== undefined) addressData.landmark = address.landmark;
      if (address.city !== undefined) addressData.city = address.city;
      if (address.state !== undefined) addressData.state = address.state;
      if (address.pincode !== undefined) addressData.pincode = address.pincode;
      if (address.latitude !== undefined) addressData.latitude = address.latitude;
      if (address.longitude !== undefined) addressData.longitude = address.longitude;
      if (address.serviceRadiusKm !== undefined) addressData.serviceRadiusKm = address.serviceRadiusKm;

      await tx.shopAddress.upsert({
        where: { shopId: shop.id },
        update: addressData,
        create: {
          shopId: shop.id,
          street: address.street || "",
          landmark: address.landmark || "",
          city: address.city || "",
          state: address.state || "",
          pincode: address.pincode || "",
          latitude: address.latitude || 0,
          longitude: address.longitude || 0,
          serviceRadiusKm: address.serviceRadiusKm || 1,
        },
      });
    }

    // Contact Update
    if (contact) {
      const contactData = {};
      if (contact.phone !== undefined) contactData.phone = contact.phone;
      if (contact.whatsapp !== undefined) contactData.whatsapp = contact.whatsapp;
      if (contact.alternatePhone !== undefined) contactData.alternatePhone = contact.alternatePhone;
      if (contact.email !== undefined) contactData.email = contact.email;
      if (contact.acceptCalls !== undefined) contactData.acceptCalls = contact.acceptCalls;
      if (contact.enableStockRequests !== undefined) contactData.enableStockRequests = contact.enableStockRequests;
      if (contact.receiveNotifications !== undefined) contactData.receiveNotifications = contact.receiveNotifications;

      await tx.shopContact.upsert({
        where: { shopId: shop.id },
        update: contactData,
        create: {
          shopId: shop.id,
          phone: contact.phone || "",
          whatsapp: contact.whatsapp || "",
          acceptCalls: contact.acceptCalls ?? true,
          enableStockRequests: contact.enableStockRequests ?? true,
          receiveNotifications: contact.receiveNotifications ?? true,
        },
      });
    }

    // Payment Methods replacement
    if (paymentMethods) {
      await tx.shopPaymentMethod.deleteMany({ where: { shopId: shop.id } });
      if (paymentMethods.length > 0) {
        await tx.shopPaymentMethod.createMany({
          data: paymentMethods.map((pm) => ({
            shopId: shop.id,
            method: pm.method,
            upiId: pm.upiId || null,
            enabled: pm.enabled ?? true,
          })),
        });
      }
    }

    // Languages replacement
    if (languages) {
      await tx.shopLanguage.deleteMany({ where: { shopId: shop.id } });
      if (languages.length > 0) {
        await tx.shopLanguage.createMany({
          data: languages.map((lang) => ({
            shopId: shop.id,
            language: lang,
          })),
        });
      }
    }

    // Tags replacement
    if (tags) {
      await tx.shopTag.deleteMany({ where: { shopId: shop.id } });
      if (tags.length > 0) {
        await tx.shopTag.createMany({
          data: tags.map((t) => ({
            shopId: shop.id,
            tag: t,
          })),
        });
      }
    }

    // Retrieve updated shop profile
    return await tx.shop.findUnique({
      where: { id: shop.id },
      include: {
        address: true,
        contact: true,
        timings: true,
        logo: true,
        cover: true,
        paymentMethods: true,
        languages: true,
        tags: true,
      },
    });
  });
}

/**
 * Retrieve shop timings.
 */
async function getShopTimings(userId) {
  const shop = await getShopkeeperShop(userId);
  return shop.timings || [];
}

/**
 * Replace all shop timings atomically.
 */
async function replaceShopTimings(userId, timingsArray) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);

  return await runInTransaction(async (tx) => {
    // Delete existing timings
    await tx.shopTiming.deleteMany({
      where: { shopId: shop.id },
    });

    // Create new timings
    await tx.shopTiming.createMany({
      data: timingsArray.map((t) => ({
        shopId: shop.id,
        weekday: t.weekday,
        opensAt: t.opensAt,
        closesAt: t.closesAt,
        isClosed: t.isClosed,
      })),
    });

    return await tx.shopTiming.findMany({
      where: { shopId: shop.id },
      orderBy: { weekday: "asc" },
    });
  });
}

/**
 * List reviews left for the shop.
 */
async function listShopkeeperReviews(userId, filters) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);

  const { rating, page, limit } = filters;
  const skip = (page - 1) * limit;

  const where = {
    shopId: shop.id,
    status: "PUBLISHED",
  };
  if (rating) {
    where.rating = rating;
  }

  const [total, reviews] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { include: { avatar: true } },
        product: true,
      },
    }),
  ]);

  return {
    reviews,
    meta: buildPaginationMeta({ page, limit, total }),
  };
}

/**
 * List customer leads/activity history.
 */
async function listShopkeeperLeads(userId, filters) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);

  const { page, limit } = filters;
  const skip = (page - 1) * limit;

  const where = { shopId: shop.id };

  const [total, leads] = await Promise.all([
    prisma.shopLead.count({ where }),
    prisma.shopLead.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        product: true,
      },
    }),
  ]);

  return {
    leads,
    meta: buildPaginationMeta({ page, limit, total }),
  };
}

/**
 * List incoming reservations for the shop.
 */
async function listShopkeeperReservations(userId, filters) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);

  const { status, page, limit } = filters;
  const skip = (page - 1) * limit;

  const where = { shopId: shop.id };
  if (status) {
    where.status = status;
  }

  const [total, reservations] = await Promise.all([
    prisma.reservation.count({ where }),
    prisma.reservation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        items: {
          include: {
            product: {
              include: {
                images: { include: { media: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    reservations,
    meta: buildPaginationMeta({ page, limit, total }),
  };
}

/**
 * Update reservation status (accept/reject/complete) with notification triggers.
 */
async function updateReservationStatus(userId, reservationId, input) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);
  const { status: nextStatus, shopkeeperNote } = input;

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
  });

  if (!reservation || reservation.shopId !== shop.id) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.RESERVATION_NOT_FOUND,
      message: "Reservation not found",
    });
  }

  const currentStatus = reservation.status;

  // Validation rules for status transitions
  let isValid = false;
  if (currentStatus === "REQUESTED") {
    if (nextStatus === "ACCEPTED" || nextStatus === "REJECTED") isValid = true;
  } else if (currentStatus === "ACCEPTED") {
    if (nextStatus === "COMPLETED" || nextStatus === "CANCELLED") isValid = true;
  }

  if (!isValid) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.RESERVATION_STATUS_TRANSITION_INVALID,
      message: `Cannot transition reservation from ${currentStatus} to ${nextStatus}`,
    });
  }

  const updated = await runInTransaction(async (tx) => {
    const updateData = { status: nextStatus };
    if (shopkeeperNote !== undefined) updateData.shopkeeperNote = shopkeeperNote;

    if (nextStatus === "ACCEPTED") updateData.acceptedAt = new Date();
    if (nextStatus === "COMPLETED") updateData.completedAt = new Date();
    if (nextStatus === "CANCELLED") updateData.cancelledAt = new Date();

    const resv = await tx.reservation.update({
      where: { id: reservationId },
      data: updateData,
    });

    // If reservation is completed/rejected, restore or confirm stock
    if (nextStatus === "REJECTED") {
      // Revert items stock reservation holds
      const items = await tx.reservationItem.findMany({
        where: { reservationId },
      });
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockCount: { increment: item.quantity },
            // If it was out of stock, restore status
            stockStatus: "IN_STOCK",
            stockAvailable: true,
          },
        });
      }
    }

    return resv;
  });

  // Trigger Notification to Customer
  let title = "";
  let message = "";
  if (nextStatus === "ACCEPTED") {
    title = "Reservation Accepted";
    message = `Your reservation request at ${shop.name} has been accepted!`;
  } else if (nextStatus === "REJECTED") {
    title = "Reservation Rejected";
    message = `Your reservation request at ${shop.name} was rejected.` + (shopkeeperNote ? ` Reason: ${shopkeeperNote}` : "");
  } else if (nextStatus === "COMPLETED") {
    title = "Reservation Completed";
    message = `Your reservation at ${shop.name} has been successfully completed. Thank you!`;
  }

  if (title) {
    await createNotification({
      userId: reservation.userId,
      type: "RESERVATION",
      title,
      message,
      actionUrl: `/reservations/${reservation.id}`,
    });
  }

  return await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      user: true,
      items: {
        include: {
          product: {
            include: {
              images: { include: { media: true } },
            },
          },
        },
      },
    },
  });
}

/**
 * List shopkeeper's own products.
 */
async function listShopkeeperProducts(userId, filters) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);

  const { q, categoryId, stockStatus, page, limit } = filters;
  const skip = (page - 1) * limit;

  const where = {
    shopId: shop.id,
    status: { not: "DELETED" },
    deletedAt: null,
  };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (stockStatus) {
    where.stockStatus = stockStatus;
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        images: { include: { media: true } },
        category: true,
        brand: true,
        attributes: true,
      },
    }),
  ]);

  return {
    products,
    meta: buildPaginationMeta({ page, limit, total }),
  };
}

/**
 * Create a new product.
 */
async function createShopProduct(userId, input) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);

  if (input.imageMediaIds && input.imageMediaIds.length > 0) {
    const assets = await prisma.mediaAsset.findMany({
      where: { id: { in: input.imageMediaIds } },
    });
    if (assets.length !== input.imageMediaIds.length) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.MEDIA_NOT_FOUND,
        message: "Some media assets were not found",
      });
    }
    for (const asset of assets) {
      if (asset.ownerId && asset.ownerId !== userId) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.MEDIA_FORBIDDEN,
          message: "You do not own this media asset",
        });
      }
    }
  }

  const {
    name,
    sku,
    categoryId,
    brandId,
    description,
    size,
    unit,
    tags,
    pricePaise,
    mrpPaise,
    stockStatus,
    stockAvailable,
    stockCount,
    attributes,
    imageMediaIds,
  } = input;

  // SKU validation
  let finalSku = sku ? sku.trim() : null;
  if (finalSku) {
    const existing = await prisma.product.findFirst({
      where: {
        shopId: shop.id,
        sku: finalSku,
        status: { not: "DELETED" },
      },
    });
    if (existing) {
      throw new AppError({
        statusCode: 409,
        code: ERROR_CODES.PRODUCT_SKU_TAKEN,
        message: `A product with SKU "${finalSku}" already exists in your shop`,
      });
    }
  } else {
    // Generate SKU
    finalSku = `SKU-${shop.id.substring(0, 5).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }

  // Generate slug
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")}-${crypto.randomBytes(2).toString("hex")}`;

  return await runInTransaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        shopId: shop.id,
        name,
        slug,
        sku: finalSku,
        categoryId: categoryId || null,
        brandId: brandId || null,
        description: description || null,
        size: size || null,
        unit: unit || null,
        tags: tags || [],
        pricePaise,
        mrpPaise: mrpPaise || null,
        status: "ACTIVE", // Default to active for merchant listing
        stockStatus,
        stockAvailable,
        stockCount: stockCount !== undefined ? stockCount : null,
      },
    });

    if (attributes && attributes.length > 0) {
      await tx.productAttribute.createMany({
        data: attributes.map((attr) => ({
          productId: product.id,
          key: attr.key,
          value: attr.value,
        })),
      });
    }

    if (imageMediaIds && imageMediaIds.length > 0) {
      await tx.productImage.createMany({
        data: imageMediaIds.map((mId, index) => ({
          productId: product.id,
          mediaId: mId,
          sortOrder: index,
        })),
      });
    }

    return await tx.product.findUnique({
      where: { id: product.id },
      include: {
        images: { include: { media: true } },
        category: true,
        brand: true,
        attributes: true,
      },
    });
  });
}

/**
 * Get product detail.
 */
async function getShopProductDetail(userId, productId) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
      status: { not: "DELETED" },
    },
    include: {
      images: { include: { media: true } },
      category: true,
      brand: true,
      attributes: true,
    },
  });

  if (!product) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.PRODUCT_NOT_FOUND,
      message: "Product not found",
    });
  }

  return product;
}

/**
 * Update an existing product.
 */
async function updateShopProduct(userId, productId, input) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);

  if (input.imageMediaIds && input.imageMediaIds.length > 0) {
    const assets = await prisma.mediaAsset.findMany({
      where: { id: { in: input.imageMediaIds } },
    });
    if (assets.length !== input.imageMediaIds.length) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.MEDIA_NOT_FOUND,
        message: "Some media assets were not found",
      });
    }
    for (const asset of assets) {
      if (asset.ownerId && asset.ownerId !== userId) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.MEDIA_FORBIDDEN,
          message: "You do not own this media asset",
        });
      }
    }
  }

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
      status: { not: "DELETED" },
    },
  });

  if (!product) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.PRODUCT_NOT_FOUND,
      message: "Product not found",
    });
  }

  const {
    name,
    sku,
    categoryId,
    brandId,
    description,
    size,
    unit,
    tags,
    pricePaise,
    mrpPaise,
    stockStatus,
    stockAvailable,
    stockCount,
    attributes,
    imageMediaIds,
  } = input;

  // SKU validation
  let finalSku = sku !== undefined ? (sku ? sku.trim() : null) : undefined;
  if (finalSku && finalSku !== product.sku) {
    const existing = await prisma.product.findFirst({
      where: {
        shopId: shop.id,
        sku: finalSku,
        status: { not: "DELETED" },
      },
    });
    if (existing) {
      throw new AppError({
        statusCode: 409,
        code: ERROR_CODES.PRODUCT_SKU_TAKEN,
        message: `A product with SKU "${finalSku}" already exists in your shop`,
      });
    }
  }

  return await runInTransaction(async (tx) => {
    const updateData = {};
    if (name !== undefined) {
      updateData.name = name;
      updateData.slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")}-${crypto.randomBytes(2).toString("hex")}`;
    }
    if (finalSku !== undefined) updateData.sku = finalSku;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (brandId !== undefined) updateData.brandId = brandId;
    if (description !== undefined) updateData.description = description;
    if (size !== undefined) updateData.size = size;
    if (unit !== undefined) updateData.unit = unit;
    if (tags !== undefined) updateData.tags = tags;
    if (pricePaise !== undefined) updateData.pricePaise = pricePaise;
    if (mrpPaise !== undefined) updateData.mrpPaise = mrpPaise;
    if (stockStatus !== undefined) updateData.stockStatus = stockStatus;
    if (stockAvailable !== undefined) updateData.stockAvailable = stockAvailable;
    if (stockCount !== undefined) updateData.stockCount = stockCount;

    await tx.product.update({
      where: { id: productId },
      data: updateData,
    });

    if (attributes) {
      await tx.productAttribute.deleteMany({ where: { productId } });
      if (attributes.length > 0) {
        await tx.productAttribute.createMany({
          data: attributes.map((attr) => ({
            productId,
            key: attr.key,
            value: attr.value,
          })),
        });
      }
    }

    if (imageMediaIds) {
      await tx.productImage.deleteMany({ where: { productId } });
      if (imageMediaIds.length > 0) {
        await tx.productImage.createMany({
          data: imageMediaIds.map((mId, index) => ({
            productId,
            mediaId: mId,
            sortOrder: index,
          })),
        });
      }
    }

    return await tx.product.findUnique({
      where: { id: productId },
      include: {
        images: { include: { media: true } },
        category: true,
        brand: true,
        attributes: true,
      },
    });
  });
}

/**
 * Soft-delete product.
 */
async function deleteShopProduct(userId, productId) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
      status: { not: "DELETED" },
    },
  });

  if (!product) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.PRODUCT_NOT_FOUND,
      message: "Product not found",
    });
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      status: "DELETED",
      deletedAt: new Date(),
    },
  });

  return { success: true };
}

/**
 * Update stock status or count.
 */
async function toggleShopProductStock(userId, productId, input) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
      status: { not: "DELETED" },
    },
  });

  if (!product) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.PRODUCT_NOT_FOUND,
      message: "Product not found",
    });
  }

  const { stockAvailable, stockCount, stockStatus } = input;
  const updateData = {};
  if (stockAvailable !== undefined) updateData.stockAvailable = stockAvailable;
  if (stockCount !== undefined) updateData.stockCount = stockCount;
  if (stockStatus !== undefined) updateData.stockStatus = stockStatus;

  const updated = await prisma.product.update({
    where: { id: productId },
    data: updateData,
    include: {
      images: { include: { media: true } },
      category: true,
      brand: true,
      attributes: true,
    },
  });

  return updated;
}

/**
 * Attach product image.
 */
async function attachProductImage(userId, productId, input) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
      status: { not: "DELETED" },
    },
  });

  if (!product) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.PRODUCT_NOT_FOUND,
      message: "Product not found",
    });
  }

  const { mediaId, alt, sortOrder } = input;

  // Verify media asset exists
  const mediaAsset = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
  });
  if (!mediaAsset) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.MEDIA_NOT_FOUND,
      message: "Media asset not found",
    });
  }

  if (mediaAsset.ownerId && mediaAsset.ownerId !== userId) {
    throw new AppError({
      statusCode: 403,
      code: ERROR_CODES.MEDIA_FORBIDDEN,
      message: "You do not own this media asset",
    });
  }

  const pImg = await prisma.productImage.create({
    data: {
      productId,
      mediaId,
      alt: alt || null,
      sortOrder: sortOrder || 0,
    },
    include: {
      media: true,
    },
  });

  return pImg;
}

/**
 * Detach product image.
 */
async function detachProductImage(userId, productId, imageId) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
      status: { not: "DELETED" },
    },
  });

  if (!product) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.PRODUCT_NOT_FOUND,
      message: "Product not found",
    });
  }

  const pImg = await prisma.productImage.findFirst({
    where: {
      id: imageId,
      productId,
    },
  });

  if (!pImg) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: "Product image attachment not found",
    });
  }

  await prisma.productImage.delete({
    where: { id: imageId },
  });

  return { success: true };
}

/**
 * Bulk updates on products.
 */
async function bulkUpdateShopProducts(userId, input) {
  const prisma = getPrisma();
  const shop = await getShopkeeperShop(userId);
  const { productIds, action, status, stockAvailable, stockStatus } = input;

  // Verify all products belong to the shop
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      shopId: shop.id,
      status: { not: "DELETED" },
    },
  });

  if (products.length !== productIds.length) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Some product IDs are invalid or do not belong to your shop",
    });
  }

  return await runInTransaction(async (tx) => {
    if (action === "delete") {
      await tx.product.updateMany({
        where: { id: { in: productIds } },
        data: {
          status: "DELETED",
          deletedAt: new Date(),
        },
      });
    } else if (action === "update_status") {
      if (!status) {
        throw new AppError({
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: "Status is required for status updates",
        });
      }
      await tx.product.updateMany({
        where: { id: { in: productIds } },
        data: { status },
      });
    } else if (action === "toggle_stock") {
      const updateData = {};
      if (stockAvailable !== undefined) updateData.stockAvailable = stockAvailable;
      if (stockStatus !== undefined) updateData.stockStatus = stockStatus;

      await tx.product.updateMany({
        where: { id: { in: productIds } },
        data: updateData,
      });
    }

    return { count: productIds.length };
  });
}

module.exports = {
  getShopkeeperShop,
  getDashboardStats,
  getShopProfile,
  updateShopProfile,
  getShopTimings,
  replaceShopTimings,
  listShopkeeperReviews,
  listShopkeeperLeads,
  listShopkeeperReservations,
  updateReservationStatus,
  listShopkeeperProducts,
  createShopProduct,
  getShopProductDetail,
  updateShopProduct,
  deleteShopProduct,
  toggleShopProductStock,
  attachProductImage,
  detachProductImage,
  bulkUpdateShopProducts,
};
