const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const { mapCart } = require("./cart.mapper");

const CART_DETAIL_INCLUDE = {
  items: {
    include: {
      product: {
        include: {
          shop: true,
        },
      },
    },
  },
};

/**
 * Lightweight get-or-create: only resolves the cart id (and userId),
 * without pulling the full items/product/shop graph. Use this for
 * mutations where you just need the cartId to write against.
 */
async function getOrCreateCartId(userId, tx = null) {
  const client = tx || getPrisma();

  let cart = await client.cart.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!cart) {
    cart = await client.cart.create({
      data: {
        userId,
        status: "active",
      },
      select: { id: true },
    });
  }

  return cart;
}

/**
 * Heavy fetch: full cart detail with items/product/shop, for responses only.
 */
async function getCartDetail(userId, tx = null) {
  const client = tx || getPrisma();

  let cart = await client.cart.findUnique({
    where: { userId },
    include: CART_DETAIL_INCLUDE,
  });

  if (!cart) {
    cart = await client.cart.create({
      data: {
        userId,
        status: "active",
      },
      include: CART_DETAIL_INCLUDE,
    });
  }

  return cart;
}

async function getCart(userId) {
  const cart = await getCartDetail(userId);
  return mapCart(cart);
}

/**
 * Adds an item to the cart or increments its quantity.
 */
async function addToCart(userId, { productId, quantity }) {
  const prisma = getPrisma();

  // Independent lookups — run in parallel.
  const [product, cart] = await Promise.all([
    prisma.product.findFirst({
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
    }),
    getOrCreateCartId(userId),
  ]);

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

  // Targeted lookup for just this product's existing line item, instead of
  // loading the whole cart's items + nested product/shop graph.
  const existingItem = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId },
    select: { id: true, quantity: true },
  });

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

  const updatedCart = await getCartDetail(userId);
  return mapCart(updatedCart);
}

/**
 * Updates the quantity of an existing cart item.
 */
async function updateCartItem(userId, itemId, { quantity }) {
  const prisma = getPrisma();

  // Single query: existence + ownership check together, no full cart load.
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
    select: { id: true },
  });

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

  const updatedCart = await getCartDetail(userId);
  return mapCart(updatedCart);
}

/**
 * Removes an item from the cart.
 */
async function removeCartItem(userId, itemId) {
  const prisma = getPrisma();

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
    select: { id: true },
  });

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

  const updatedCart = await getCartDetail(userId);
  return mapCart(updatedCart);
}

/**
 * Clears the user's active cart.
 */
async function clearCart(userId) {
  const prisma = getPrisma();
  const cart = await getOrCreateCartId(userId);

  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });

  const updatedCart = await getCartDetail(userId);
  return mapCart(updatedCart);
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};