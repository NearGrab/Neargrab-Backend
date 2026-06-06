function mapReservation(reservation) {
  if (!reservation) return null;

  const shop = reservation.shop || {};
  const contact = shop.contact || {};
  const address = shop.address || {};

  const items = (reservation.items || []).map((item) => {
    const product = item.product || {};
    const images = product.images || [];
    const imageUrl = images[0]?.media?.url || null;

    return {
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      pricePaise: item.pricePaiseSnapshot,
      lineTotalPaise: item.quantity * item.pricePaiseSnapshot,
      product: {
        id: product.id || item.productId,
        name: product.name || "Unknown Product",
        slug: product.slug || null,
        imageUrl,
      },
    };
  });

  return {
    id: reservation.id,
    status: reservation.status,
    totalPaise: reservation.totalPaise,
    currency: reservation.currency,
    customerNote: reservation.customerNote,
    shopkeeperNote: reservation.shopkeeperNote,
    expiresAt: reservation.expiresAt ? reservation.expiresAt.toISOString() : null,
    acceptedAt: reservation.acceptedAt ? reservation.acceptedAt.toISOString() : null,
    completedAt: reservation.completedAt ? reservation.completedAt.toISOString() : null,
    cancelledAt: reservation.cancelledAt ? reservation.cancelledAt.toISOString() : null,
    createdAt: reservation.createdAt.toISOString(),
    shop: {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      contact: {
        phone: contact.phone || "",
        whatsapp: contact.whatsapp || null,
      },
      address: {
        street: address.street || "",
        city: address.city || "",
        state: address.state || "",
        pincode: address.pincode || "",
        latitude: address.latitude ? Number(address.latitude) : null,
        longitude: address.longitude ? Number(address.longitude) : null,
      },
    },
    items,
  };
}

module.exports = {
  mapReservation,
};
