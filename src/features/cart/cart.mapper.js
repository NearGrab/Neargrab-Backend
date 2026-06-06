function mapCart(cart) {
  if (!cart) {
    return {
      id: null,
      status: "active",
      items: [],
      summary: {
        totalItems: 0,
        uniqueProducts: 0,
        uniqueShops: 0,
        subtotalPaise: 0,
        currency: "INR",
      },
    };
  }

  const items = (cart.items || []).map((item) => {
    const product = item.product || {};
    const shop = product.shop || {};

    return {
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      name: item.nameSnapshot,
      pricePaise: item.pricePaiseSnapshot,
      shopName: item.shopNameSnapshot,
      imageUrl: item.imageUrlSnapshot,
      product: {
        id: product.id || item.productId,
        slug: product.slug || null,
        name: product.name || item.nameSnapshot,
        stockStatus: product.stockStatus || "OUT_OF_STOCK",
        stockAvailable: product.stockAvailable ?? false,
        shop: {
          id: shop.id || null,
          name: shop.name || item.shopNameSnapshot,
          slug: shop.slug || null,
        },
      },
      lineTotalPaise: item.quantity * item.pricePaiseSnapshot,
      createdAt: item.createdAt ? (item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt)).toISOString() : new Date().toISOString(),
    };
  });

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const uniqueProducts = items.length;
  
  // Count unique shop IDs or unique shop names
  const shopIds = new Set();
  items.forEach((item) => {
    if (item.product?.shop?.id) {
      shopIds.add(item.product.shop.id);
    } else if (item.shopName) {
      shopIds.add(item.shopName);
    }
  });
  const uniqueShops = shopIds.size;

  const subtotalPaise = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);

  return {
    id: cart.id,
    status: cart.status,
    items,
    summary: {
      totalItems,
      uniqueProducts,
      uniqueShops,
      subtotalPaise,
      currency: "INR",
    },
  };
}

module.exports = {
  mapCart,
};
