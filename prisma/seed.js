require("dotenv").config();
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const PASSWORD = "Neargrab@123";
const now = new Date();
const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function upsertMedia(key, altText, ownerId) {
  return prisma.mediaAsset.upsert({
    where: { key },
    update: { altText, ownerId },
    create: {
      key,
      ownerId,
      altText,
      bucket: "seed",
      mimeType: "image/jpeg",
      sizeBytes: 120000,
      width: 1200,
      height: 800,
      url: `https://placehold.co/1200x800?text=${encodeURIComponent(altText)}`,
    },
  });
}

async function upsertUser({ email, name, username, role, city, phone }) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, username, role, city, phone, passwordHash },
    create: {
      email,
      name,
      username,
      role,
      city,
      phone,
      state: "Gujarat",
      pincode: "396445",
      passwordHash,
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: { language: "en-IN", preferencesJson: { city } },
    create: {
      userId: user.id,
      bio: `${name} is using Neargrab.`,
      language: "en-IN",
      preferencesJson: { city, radiusKm: 3 },
      privacyJson: { showCity: true },
    },
  });

  await prisma.authAccount.upsert({
    where: {
      provider_providerUserId: {
        provider: "EMAIL",
        providerUserId: email,
      },
    },
    update: { userId: user.id },
    create: {
      userId: user.id,
      provider: "EMAIL",
      providerUserId: email,
    },
  });

  return user;
}

async function main() {
  // Create Categories
  const categories = {};
  for (const name of ["Grocery", "Electronics", "Stationery", "Hardware", "Pharmacy", "Clothing", "Bakery"]) {
    categories[name] = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: { name, status: "active" },
      create: { name, slug: slugify(name), status: "active", icon: slugify(name) },
    });
  }

  // Create Brands
  const brands = {};
  for (const name of ["Generic", "Amul", "Surf Excel", "Samsung", "Classmate", "Fevicol"]) {
    brands[name] = await prisma.brand.upsert({
      where: { slug: slugify(name) },
      update: { name, status: "active" },
      create: { name, slug: slugify(name), status: "active" },
    });
  }

  // Create Users
  const customer = await upsertUser({
    email: "customer@neargrab.in",
    name: "Customer User",
    username: "customer-neargrab",
    role: "CUSTOMER",
    city: "Navsari",
    phone: "+919900000001",
  });

  const shopkeeper = await upsertUser({
    email: "shop@neargrab.in",
    name: "Bakery Shopkeeper",
    username: "shop-neargrab",
    role: "SHOPKEEPER",
    city: "Navsari",
    phone: "+919900000002",
  });

  const superAdmin = await upsertUser({
    email: "admin@neargrab.in",
    name: "Neargrab Super Admin",
    username: "admin-neargrab",
    role: "SUPER_ADMIN",
    city: "Navsari",
    phone: "+919900000003",
  });

  // Create Shop
  const logo = await upsertMedia("shop/5startbakery/logo", "5startbakery logo", shopkeeper.id);
  const cover = await upsertMedia("shop/5startbakery/cover", "5startbakery storefront", shopkeeper.id);

  const shop = await prisma.shop.upsert({
    where: { ownerId: shopkeeper.id },
    update: {
      name: "5startbakery",
      username: "5startbakery",
      slug: "5startbakery",
      categoryId: categories.Bakery.id,
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      logoId: logo.id,
      coverId: cover.id,
      city: "Navsari",
    },
    create: {
      ownerId: shopkeeper.id,
      name: "5startbakery",
      username: "5startbakery",
      slug: "5startbakery",
      categoryId: categories.Bakery.id,
      description: "5startbakery serves premium baked items to nearby customers with updated local stock.",
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      logoId: logo.id,
      coverId: cover.id,
      ratingAvg: 4.8,
      ratingCount: 15,
      city: "Navsari",
    },
  });

  const shops = [shop];

  await prisma.shopAddress.upsert({
    where: { shopId: shop.id },
    update: {
      street: "Sayaji Road, near Tower",
      city: "Navsari",
      state: "Gujarat",
      pincode: "396445",
      latitude: "20.9467",
      longitude: "72.9520",
    },
    create: {
      shopId: shop.id,
      street: "Sayaji Road, near Tower",
      landmark: "Main market",
      city: "Navsari",
      state: "Gujarat",
      pincode: "396445",
      latitude: "20.9467",
      longitude: "72.9520",
      serviceRadiusKm: 3,
    },
  });

  await prisma.shopContact.upsert({
    where: { shopId: shop.id },
    update: { phone: "+919900000002", whatsapp: "+919900000002" },
    create: { shopId: shop.id, phone: "+919900000002", whatsapp: "+919900000002", email: "shop@neargrab.in" },
  });

  for (let weekday = 0; weekday <= 6; weekday += 1) {
    await prisma.shopTiming.upsert({
      where: { shopId_weekday: { shopId: shop.id, weekday } },
      update: { opensAt: "09:00", closesAt: "21:00", isClosed: false },
      create: { shopId: shop.id, weekday, opensAt: "09:00", closesAt: "21:00", isClosed: false },
    });
  }

  for (const method of ["CASH", "UPI", "CARD"]) {
    await prisma.shopPaymentMethod.upsert({
      where: { shopId_method: { shopId: shop.id, method } },
      update: { enabled: true },
      create: { shopId: shop.id, method, upiId: "5startbakery@upi" },
    });
  }

  for (const language of ["Gujarati", "Hindi", "English"]) {
    await prisma.shopLanguage.upsert({
      where: { shopId_language: { shopId: shop.id, language } },
      update: {},
      create: { shopId: shop.id, language },
    });
  }

  for (const tag of ["bakery", "cakes", "fresh-baked"]) {
    await prisma.shopTag.upsert({
      where: { shopId_tag: { shopId: shop.id, tag } },
      update: {},
      create: { shopId: shop.id, tag },
    });
  }

  const photo = await upsertMedia("shop/5startbakery/front", "5startbakery front photo", shopkeeper.id);
  await prisma.shopPhoto.upsert({
    where: { id: `${shop.id}-front-photo` },
    update: { mediaId: photo.id },
    create: { id: `${shop.id}-front-photo`, shopId: shop.id, mediaId: photo.id, kind: "front" },
  });

  // Create 10 Products
  const productData = [
    ["Chocolate Cake 500g", shop, categories.Bakery, brands.Amul, 35000, 40000, "IN_STOCK", 10],
    ["Pineapple Cake 500g", shop, categories.Bakery, brands.Amul, 30000, 35000, "IN_STOCK", 8],
    ["Fresh Butter Cookies 200g", shop, categories.Bakery, brands.Amul, 12000, 15000, "IN_STOCK", 15],
    ["Garlic Bread 1pc", shop, categories.Bakery, brands.Generic, 8000, 10000, "IN_STOCK", 20],
    ["Whole Wheat Bread 400g", shop, categories.Bakery, brands.Generic, 5000, 5500, "IN_STOCK", 25],
    ["Veg Puff 1pc", shop, categories.Bakery, brands.Generic, 2000, 2500, "IN_STOCK", 30],
    ["Cheese Croissant 1pc", shop, categories.Bakery, brands.Generic, 6000, 7000, "IN_STOCK", 12],
    ["Chocolate Muffin 1pc", shop, categories.Bakery, brands.Generic, 4500, 5000, "IN_STOCK", 15],
    ["Paneer Pizza 1pc", shop, categories.Bakery, brands.Generic, 15000, 18000, "LOW_STOCK", 5],
    ["Vanilla Cupcake 1pc", shop, categories.Bakery, brands.Generic, 3500, 4000, "OUT_OF_STOCK", 0],
  ];

  const products = [];
  for (const [name, shopObj, category, brand, pricePaise, mrpPaise, stockOrStatus, stockCount] of productData) {
    const isStatus = ["DRAFT", "PENDING_APPROVAL"].includes(stockOrStatus);
    const slug = slugify(name);
    const product = await prisma.product.upsert({
      where: { shopId_sku: { shopId: shopObj.id, sku: slug.toUpperCase().replace(/-/g, "_") } },
      update: {
        name,
        categoryId: category.id,
        brandId: brand.id,
        pricePaise,
        mrpPaise,
        status: isStatus ? stockOrStatus : "ACTIVE",
        stockStatus: isStatus ? "IN_STOCK" : stockOrStatus,
        stockAvailable: stockOrStatus !== "OUT_OF_STOCK",
        stockCount,
      },
      create: {
        shopId: shopObj.id,
        categoryId: category.id,
        brandId: brand.id,
        name,
        slug,
        sku: slug.toUpperCase().replace(/-/g, "_"),
        description: `${name} available at ${shopObj.name}.`,
        tags: [category.name.toLowerCase(), brand.name.toLowerCase()],
        pricePaise,
        mrpPaise,
        status: isStatus ? stockOrStatus : "ACTIVE",
        stockStatus: isStatus ? "IN_STOCK" : stockOrStatus,
        stockAvailable: stockOrStatus !== "OUT_OF_STOCK",
        stockCount,
        ratingAvg: 4.5,
        reviewCount: 2,
        viewCount: 30,
      },
    });
    products.push(product);

    const media = await upsertMedia(`product/${product.slug}`, `${name} product image`, shopkeeper.id);
    await prisma.productImage.upsert({
      where: { id: `${product.id}-image-1` },
      update: { mediaId: media.id, alt: name },
      create: { id: `${product.id}-image-1`, productId: product.id, mediaId: media.id, alt: name },
    });
    await prisma.productAttribute.upsert({
      where: { id: `${product.id}-attr-size` },
      update: { value: product.size || "standard" },
      create: { id: `${product.id}-attr-size`, productId: product.id, key: "Pack", value: "standard" },
    });
  }

  // Saved Product
  await prisma.savedProduct.upsert({
    where: { userId_productId: { userId: customer.id, productId: products[0].id } },
    update: {},
    create: { userId: customer.id, productId: products[0].id },
  });

  // Cart & Cart Items
  const cart = await prisma.cart.upsert({
    where: { userId: customer.id },
    update: { status: "active" },
    create: { userId: customer.id, status: "active" },
  });
  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId: products[0].id } },
    update: { quantity: 2 },
    create: {
      cartId: cart.id,
      productId: products[0].id,
      quantity: 2,
      nameSnapshot: products[0].name,
      pricePaiseSnapshot: products[0].pricePaise,
      shopNameSnapshot: shop.name,
    },
  });

  // Reservation
  const reservation = await prisma.reservation.upsert({
    where: { id: "seed-reservation-1" },
    update: { totalPaise: products[0].pricePaise * 2 },
    create: {
      id: "seed-reservation-1",
      userId: customer.id,
      shopId: shop.id,
      status: "REQUESTED",
      totalPaise: products[0].pricePaise * 2,
      customerNote: "Please keep this aside till evening.",
      expiresAt: future,
    },
  });
  await prisma.reservationItem.upsert({
    where: { id: "seed-reservation-item-1" },
    update: { quantity: 2 },
    create: {
      id: "seed-reservation-item-1",
      reservationId: reservation.id,
      productId: products[0].id,
      quantity: 2,
      pricePaiseSnapshot: products[0].pricePaise,
    },
  });

  // Reviews
  await prisma.review.upsert({
    where: { id: "seed-review-product-1" },
    update: { rating: 5, comment: "Fresh stock and quick confirmation." },
    create: {
      id: "seed-review-product-1",
      userId: customer.id,
      shopId: shop.id,
      productId: products[0].id,
      reservationId: reservation.id,
      rating: 5,
      comment: "Fresh stock and quick confirmation.",
      verifiedPurchase: true,
    },
  });
  await prisma.review.upsert({
    where: { id: "seed-review-shop-1" },
    update: { rating: 4, comment: "Helpful shopkeeper and easy to locate." },
    create: {
      id: "seed-review-shop-1",
      userId: customer.id,
      shopId: shop.id,
      rating: 4,
      comment: "Helpful shopkeeper and easy to locate.",
    },
  });

  // Notifications
  for (const type of ["SYSTEM", "PROMO", "RESERVATION"]) {
    await prisma.notification.upsert({
      where: { id: `seed-notification-${type.toLowerCase()}` },
      update: { title: `${type} update` },
      create: {
        id: `seed-notification-${type.toLowerCase()}`,
        userId: customer.id,
        type,
        title: `${type} update`,
        message: "Demo notification for Neargrab seed data.",
      },
    });
  }

  for (const type of ["SYSTEM", "PROMO", "RESERVATION"]) {
    await prisma.notificationPreference.upsert({
      where: { userId_channel_type: { userId: customer.id, channel: "IN_APP", type } },
      update: { enabled: true },
      create: { userId: customer.id, channel: "IN_APP", type, enabled: true },
    });
  }

  // Banner
  const bannerImage = await upsertMedia("banner/navsari-local-deals", "Navsari local deals banner", superAdmin.id);
  const banner = await prisma.banner.upsert({
    where: { id: "seed-banner-navsari-local-deals" },
    update: { status: "ACTIVE", imageId: bannerImage.id },
    create: {
      id: "seed-banner-navsari-local-deals",
      title: "Navsari Local Deals",
      shopId: shop.id,
      productId: products[0].id,
      city: "Navsari",
      section: "TOP_HERO",
      status: "ACTIVE",
      devices: ["MOBILE", "DESKTOP"],
      plan: "launch",
      imageId: bannerImage.id,
      startAt: now,
      endAt: future,
      views: 120,
      clicks: 18,
      revenuePaise: 50000,
    },
  });

  // Pin Rules
  for (const city of ["Navsari", "Surat", "Ahmedabad"]) {
    for (const targetType of ["product", "banner"]) {
      await prisma.pinRule.upsert({
        where: { city_targetType: { city, targetType } },
        update: { pinLimit: 10 },
        create: { city, targetType, pinLimit: 10 },
      });
    }
  }

  // Content Pages
  for (const [key, title] of [
    ["about", "About Neargrab"],
    ["help", "Neargrab Help"],
    ["privacy", "Privacy Policy"],
    ["terms", "Terms of Service"],
  ]) {
    await prisma.contentPage.upsert({
      where: { key },
      update: { title, status: "published", publishedAt: now },
      create: { key, title, status: "published", publishedAt: now, body: { blocks: [{ type: "paragraph", text: `${title} demo content.` }] } },
    });
  }

  // Admin Permissions
  for (const permission of ["dashboard.read", "users.manage", "shops.verify", "products.moderate", "banners.manage"]) {
    await prisma.adminPermission.upsert({
      where: { role_permission: { role: "ADMIN", permission } },
      update: {},
      create: { role: "ADMIN", permission },
    });
    await prisma.adminPermission.upsert({
      where: { role_permission: { role: "SUPER_ADMIN", permission } },
      update: {},
      create: { role: "SUPER_ADMIN", permission },
    });
  }

  // Events & Logs
  await prisma.searchEvent.create({ data: { userId: customer.id, query: "cake", city: "Navsari", radiusKm: 3, resultCount: 3 } });
  await prisma.productView.create({ data: { userId: customer.id, productId: products[0].id, shopId: shop.id, source: "SEARCH" } });
  await prisma.shopLead.create({ data: { userId: customer.id, shopId: shop.id, productId: products[0].id, source: "MAP_VIEW", metadata: { action: "open_google_maps" } } });
  await prisma.bannerImpression.create({ data: { bannerId: banner.id, userId: customer.id, device: "MOBILE", city: "Navsari", clickedAt: now } });
  await prisma.feedback.create({ data: { userId: customer.id, type: "product_report", subject: "Demo report", message: "Seed feedback for moderation testing." } });
  await prisma.auditLog.create({ data: { actorId: superAdmin.id, action: "seed.phase1", entityType: "database", after: { version: "phase-1" } } });

  console.log("Phase 1 seed complete.");
  console.log("Seed credentials:");
  console.log(`customer: customer@neargrab.in / ${PASSWORD}`);
  console.log(`shopkeeper: shop@neargrab.in / ${PASSWORD}`);
  console.log(`superadmin: admin@neargrab.in / ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
