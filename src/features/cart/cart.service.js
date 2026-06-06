const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const { mapCart } = require("./cart.mapper");

/**
 * Gets or creates the active cart for the user.
 */
async function getOrCreateCartInternal(userId, tx = null) {
  const client = tx || getPrisma();
  let cart = await client.cart.findUnique({
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

  if (!cart) {
    cart = await client.cart.create({
      data: {
        userId,
        status: "active",
      },
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
  }

  return cart;
}

async function getCart(userId) {
  const cart = await getOrCreateCartInternal(userId);
  return mapCart(cart);
}

/**
 * Adds an item to the cart or increments its quantity.
 */
async function addToCart(userId, { productId, quantity }) {
  const prisma = getPrisma();

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      status: "ACTIVE",
      deletedAt: null,
    },
    include: {
      shop: true,
      images: {
        orderBy: {
          sortOrder: "asc",
        },
        include: {
          media: true,
        },
      },
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
      message: "Product is out of stock or unavailable",
    });
  }

  const cart = await getOrCreateCartInternal(userId);

  const existingItem = cart.items.find((item) => item.productId === productId);

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;
    if (newQuantity > 99) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Quantity cannot exceed 99",
      });
    }

    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity },
    });
  } else {
    const nameSnapshot = product.name;
    const pricePaiseSnapshot = product.pricePaise;
    const shopNameSnapshot = product.shop?.name || "Unknown Store";
    const imageUrlSnapshot = product.images[0]?.media?.url || null;

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity,
        nameSnapshot,
        pricePaiseSnapshot,
        shopNameSnapshot,
        imageUrlSnapshot,
      },
    });
  }

  // Reload cart
  const updatedCart = await getOrCreateCartInternal(userId);
  return mapCart(updatedCart);
}

/**
 * Updates the quantity of an existing cart item.
 */
async function updateCartItem(userId, itemId, { quantity }) {
  const prisma = getPrisma();
  const cart = await getOrCreateCartInternal(userId);

  const item = cart.items.find((i) => i.id === itemId);
  if (!item) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.CART_ITEM_NOT_FOUND,
      message: "Cart item not found",
    });
  }

  await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity },
  });

  const updatedCart = await getOrCreateCartInternal(userId);
  return mapCart(updatedCart);
}

/**
 * Removes an item from the cart.
 */
async function removeCartItem(userId, itemId) {
  const prisma = getPrisma();
  const cart = await getOrCreateCartInternal(userId);

  const item = cart.items.find((i) => i.id === itemId);
  if (!item) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.CART_ITEM_NOT_FOUND,
      message: "Cart item not found",
    });
  }

  await prisma.cartItem.delete({
    where: { id: itemId },
  });

  const updatedCart = await getOrCreateCartInternal(userId);
  return mapCart(updatedCart);
}

/**
 * Clears the user's active cart.
 */
async function clearCart(userId) {
  const prisma = getPrisma();
  const cart = await getOrCreateCartInternal(userId);

  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });

  const updatedCart = await getOrCreateCartInternal(userId);
  return mapCart(updatedCart);
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};
