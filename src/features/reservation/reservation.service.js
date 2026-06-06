const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const { runInTransaction } = require("../../lib/transaction");
const { buildPaginationMeta } = require("../../lib/pagination");
const { mapReservation } = require("./reservation.mapper");
const { createNotification } = require("../notification/notification.service");

/**
 * Creates a new reservation from cart or directly.
 */
async function createReservation(userId, input) {
  const prisma = getPrisma();
  const { source, customerNote } = input;

  let itemsToReserve = [];
  let shopId = null;
  let cart = null;

  if (source === "cart") {
    cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                shop: true,
              },
            },
          },
        },
      },
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.CART_EMPTY,
        message: "Your cart is empty",
      });
    }

    let filteredItems = cart.items;

    if (input.shopId) {
      filteredItems = cart.items.filter(
        (item) => item.product.shopId === input.shopId
      );
      if (filteredItems.length === 0) {
        throw new AppError({
          statusCode: 400,
          code: ERROR_CODES.CART_EMPTY,
          message: "No items from the specified shop found in your cart",
        });
      }
      shopId = input.shopId;
    } else {
      // Group items by shopId
      const uniqueShopIds = [
        ...new Set(cart.items.map((item) => item.product.shopId)),
      ];

      if (uniqueShopIds.length > 1) {
        throw new AppError({
          statusCode: 400,
          code: ERROR_CODES.RESERVATION_MULTIPLE_SHOPS,
          message: "Cart has items from multiple shops. Please select a shop to checkout.",
        });
      }

      if (uniqueShopIds.length === 0) {
        throw new AppError({
          statusCode: 400,
          code: ERROR_CODES.CART_EMPTY,
          message: "Your cart is empty",
        });
      }

      shopId = uniqueShopIds[0];
    }

    itemsToReserve = filteredItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      pricePaiseSnapshot: item.pricePaiseSnapshot,
    }));
  } else if (source === "direct") {
    const { productId, quantity } = input;

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        status: "ACTIVE",
        deletedAt: null,
      },
      include: {
        shop: true,
      },
    });

    if (!product) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.PRODUCT_NOT_FOUND,
        message: "Product not found or inactive",
      });
    }

    if (product.shop?.status !== "ACTIVE" || product.shop?.deletedAt !== null) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.SHOP_NOT_ACTIVE,
        message: "Shop is not active",
      });
    }

    if (!product.stockAvailable || product.stockStatus === "OUT_OF_STOCK") {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.PRODUCT_NOT_ACTIVE,
        message: "Product is out of stock",
      });
    }

    shopId = product.shopId;
    itemsToReserve = [
      {
        productId,
        quantity,
        pricePaiseSnapshot: product.pricePaise,
      },
    ];
  }

  const totalPaise = itemsToReserve.reduce(
    (sum, item) => sum + item.quantity * item.pricePaiseSnapshot,
    0
  );

  const newReservation = await runInTransaction(async (tx) => {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const reservation = await tx.reservation.create({
      data: {
        userId,
        shopId,
        status: "REQUESTED",
        totalPaise,
        currency: "INR",
        customerNote: customerNote || null,
        expiresAt,
      },
    });

    const itemsData = itemsToReserve.map((item) => ({
      reservationId: reservation.id,
      productId: item.productId,
      quantity: item.quantity,
      pricePaiseSnapshot: item.pricePaiseSnapshot,
    }));

    await tx.reservationItem.createMany({
      data: itemsData,
    });

    if (source === "cart" && cart) {
      const reservedProductIds = itemsToReserve.map((i) => i.productId);
      await tx.cartItem.deleteMany({
        where: {
          cartId: cart.id,
          productId: { in: reservedProductIds },
        },
      });
    }

    const shop = await tx.shop.findUnique({
      where: { id: shopId },
      select: { name: true, ownerId: true },
    });

    // Notification for customer
    await createNotification({
      userId,
      type: "RESERVATION",
      title: "Reservation requested",
      message: `Your reservation request was sent to ${shop.name}.`,
      data: { reservationId: reservation.id },
      actionUrl: `/reservations/${reservation.id}`,
      tx,
    });

    // Notification for shopkeeper
    if (shop.ownerId) {
      await createNotification({
        userId: shop.ownerId,
        type: "RESERVATION",
        title: "New Reservation Request",
        message: `You have received a new reservation request.`,
        data: { reservationId: reservation.id },
        actionUrl: `/dashboard/reservations/${reservation.id}`,
        tx,
      });
    }

    return reservation;
  });

  const reloaded = await prisma.reservation.findUnique({
    where: { id: newReservation.id },
    include: {
      shop: {
        include: {
          address: true,
          contact: true,
        },
      },
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { sortOrder: "asc" },
                include: { media: true },
              },
            },
          },
        },
      },
    },
  });

  return mapReservation(reloaded);
}

/**
 * Lists paginated reservations for a customer.
 */
async function listReservations(userId, filters) {
  const prisma = getPrisma();
  const { status, page = 1, limit = 20, sort = "newest" } = filters;

  const where = {
    userId,
    deletedAt: null,
  };

  if (status) {
    where.status = status;
  }

  const orderBy = {
    createdAt: sort === "oldest" ? "asc" : "desc",
  };

  const skip = (page - 1) * limit;

  const [total, reservations] = await Promise.all([
    prisma.reservation.count({ where }),
    prisma.reservation.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        shop: {
          include: {
            address: true,
            contact: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { sortOrder: "asc" },
                  include: { media: true },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const data = reservations.map(mapReservation);
  const meta = buildPaginationMeta({ page, limit, total });

  return { data, meta };
}

/**
 * Gets a reservation detail by ID (checking ownership).
 */
async function getReservationDetail(userId, reservationId) {
  const prisma = getPrisma();

  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      userId,
      deletedAt: null,
    },
    include: {
      shop: {
        include: {
          address: true,
          contact: true,
        },
      },
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { sortOrder: "asc" },
                include: { media: true },
              },
            },
          },
        },
      },
    },
  });

  if (!reservation) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.RESERVATION_NOT_FOUND,
      message: "Reservation not found",
    });
  }

  return mapReservation(reservation);
}

/**
 * Cancels a reservation request.
 */
async function cancelReservation(userId, reservationId, { reason }) {
  const prisma = getPrisma();

  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      userId,
      deletedAt: null,
    },
    include: {
      shop: true,
    },
  });

  if (!reservation) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.RESERVATION_NOT_FOUND,
      message: "Reservation not found",
    });
  }

  if (reservation.status !== "REQUESTED" && reservation.status !== "ACCEPTED") {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.RESERVATION_INVALID_STATE,
      message: "Only REQUESTED or ACCEPTED reservations can be cancelled",
    });
  }

  let finalNote = reservation.customerNote;
  if (reason) {
    finalNote = finalNote
      ? `${finalNote} (Cancellation Reason: ${reason})`
      : `Cancellation Reason: ${reason}`;
  }

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      customerNote: finalNote,
    },
    include: {
      shop: {
        include: {
          address: true,
          contact: true,
        },
      },
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { sortOrder: "asc" },
                include: { media: true },
              },
            },
          },
        },
      },
    },
  });

  // Notify customer
  await createNotification({
    userId,
    type: "RESERVATION",
    title: "Reservation cancelled",
    message: `Your reservation request at ${updated.shop.name} has been cancelled.`,
    data: { reservationId },
    actionUrl: `/reservations/${reservationId}`,
  });

  // Notify shopkeeper
  if (updated.shop.ownerId) {
    await createNotification({
      userId: updated.shop.ownerId,
      type: "RESERVATION",
      title: "Reservation Cancelled by Customer",
      message: `A customer has cancelled their reservation request.`,
      data: { reservationId },
      actionUrl: `/dashboard/reservations/${reservationId}`,
    });
  }

  return mapReservation(updated);
}

/**
 * Helper to mark expired reservations and create notifications.
 */
async function expireReservations(now = new Date()) {
  const prisma = getPrisma();

  const expiredList = await prisma.reservation.findMany({
    where: {
      status: "REQUESTED",
      expiresAt: { lte: now },
    },
    include: {
      shop: true,
    },
  });

  if (expiredList.length === 0) {
    return { count: 0, ids: [] };
  }

  const ids = expiredList.map((r) => r.id);

  await runInTransaction(async (tx) => {
    await tx.reservation.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        status: "EXPIRED",
      },
    });

    for (const r of expiredList) {
      await createNotification({
        userId: r.userId,
        type: "RESERVATION",
        title: "Reservation expired",
        message: `Your reservation request at ${r.shop.name} has expired.`,
        data: { reservationId: r.id },
        actionUrl: `/reservations/${r.id}`,
        tx,
      });
    }
  });

  return { count: ids.length, ids };
}

module.exports = {
  createReservation,
  listReservations,
  getReservationDetail,
  cancelReservation,
  expireReservations,
};
