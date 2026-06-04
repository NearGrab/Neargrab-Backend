const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const PASSWORD = "Password123!";
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
      pincode: city === "Ahmedabad" ? "380001" : city === "Surat" ? "395003" : "396445",
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
      bio: `${name} is using Neargrab to discover local products.`,
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
  const categories = {};
  for (const name of ["Grocery", "Electronics", "Stationery", "Hardware", "Pharmacy", "Clothing"]) {
    categories[name] = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: { name, status: "active" },
      create: { name, slug: slugify(name), status: "active", icon: slugify(name) },
    });
  }

  const brands = {};
  for (const name of ["Generic", "Amul", "Surf Excel", "Samsung", "Classmate", "Fevicol"]) {
    brands[name] = await prisma.brand.upsert({
      where: { slug: slugify(name) },
      update: { name, status: "active" },
      create: { name, slug: slugify(name), status: "active" },
    });
  }

  const customer = await upsertUser({
    email: "customer@neargrab.test",
    name: "Aarav Customer",
    username: "aarav-customer",
    role: "CUSTOMER",
    city: "Navsari",
    phone: "+919900000001",
  });
  const shopkeeper1 = await upsertUser({
    email: "shopkeeper1@neargrab.test",
    name: "Meera Patel",
    username: "meera-patel",
    role: "SHOPKEEPER",
    city: "Navsari",
    phone: "+919900000002",
  });
  const shopkeeper2 = await upsertUser({
    email: "shopkeeper2@neargrab.test",
    name: "Rohan Shah",
    username: "rohan-shah",
    role: "SHOPKEEPER",
    city: "Surat",
    phone: "+919900000003",
  });
  const admin = await upsertUser({
    email: "admin@neargrab.test",
    name: "Neargrab Admin",
    username: "neargrab-admin",
    role: "ADMIN",
    city: "Ahmedabad",
    phone: "+919900000004",
  });
  const superAdmin = await upsertUser({
    email: "superadmin@neargrab.test",
    name: "Neargrab Super Admin",
    username: "neargrab-super-admin",
    role: "SUPER_ADMIN",
    city: "Ahmedabad",
    phone: "+919900000005",
  });

  const shopsData = [
    {
      owner: shopkeeper1,
      name: "Patel Daily Mart",
      username: "patel-daily-mart",
      category: categories.Grocery,
      city: "Navsari",
      street: "Station Road, near Tower",
      pincode: "396445",
      latitude: "20.9467",
      longitude: "72.9520",
      phone: "+912637220101",
      tags: ["kirana", "daily-needs", "fresh-stock"],
      languages: ["Gujarati", "Hindi", "English"],
    },
    {
      owner: shopkeeper2,
      name: "Shah Electronics Hub",
      username: "shah-electronics-hub",
      category: categories.Electronics,
      city: "Surat",
      street: "Ring Road, Textile Market",
      pincode: "395003",
      latitude: "21.1702",
      longitude: "72.8311",
      phone: "+912612201202",
      tags: ["electronics", "mobile-accessories", "gadgets"],
      languages: ["Gujarati", "Hindi"],
    },
  ];

  const shops = [];
  for (const shopData of shopsData) {
    const logo = await upsertMedia(`shop/${shopData.username}/logo`, `${shopData.name} logo`, shopData.owner.id);
    const cover = await upsertMedia(`shop/${shopData.username}/cover`, `${shopData.name} storefront`, shopData.owner.id);

    const shop = await prisma.shop.upsert({
      where: { ownerId: shopData.owner.id },
      update: {
        name: shopData.name,
        username: shopData.username,
        slug: shopData.username,
        categoryId: shopData.category.id,
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
        logoId: logo.id,
        coverId: cover.id,
      },
      create: {
        ownerId: shopData.owner.id,
        name: shopData.name,
        username: shopData.username,
        slug: shopData.username,
        categoryId: shopData.category.id,
        description: `${shopData.name} serves nearby customers with updated local stock.`,
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
        logoId: logo.id,
        coverId: cover.id,
        ratingAvg: 4.4,
        ratingCount: 8,
      },
    });
    shops.push(shop);

    await prisma.shopAddress.upsert({
      where: { shopId: shop.id },
      update: {
        street: shopData.street,
        city: shopData.city,
        state: "Gujarat",
        pincode: shopData.pincode,
        latitude: shopData.latitude,
        longitude: shopData.longitude,
      },
      create: {
        shopId: shop.id,
        street: shopData.street,
        landmark: "Main market",
        city: shopData.city,
        state: "Gujarat",
        pincode: shopData.pincode,
        latitude: shopData.latitude,
        longitude: shopData.longitude,
        serviceRadiusKm: 3,
      },
    });

    await prisma.shopContact.upsert({
      where: { shopId: shop.id },
      update: { phone: shopData.phone, whatsapp: shopData.phone },
      create: { shopId: shop.id, phone: shopData.phone, whatsapp: shopData.phone, email: shopData.owner.email },
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
        create: { shopId: shop.id, method, upiId: method === "UPI" ? `${shopData.username}@upi` : null },
      });
    }

    for (const language of shopData.languages) {
      await prisma.shopLanguage.upsert({
        where: { shopId_language: { shopId: shop.id, language } },
        update: {},
        create: { shopId: shop.id, language },
      });
    }

    for (const tag of shopData.tags) {
      await prisma.shopTag.upsert({
        where: { shopId_tag: { shopId: shop.id, tag } },
        update: {},
        create: { shopId: shop.id, tag },
      });
    }

    const photo = await upsertMedia(`shop/${shopData.username}/front`, `${shopData.name} front photo`, shopData.owner.id);
    await prisma.shopPhoto.upsert({
      where: { id: `${shop.id}-front-photo` },
      update: { mediaId: photo.id },
      create: { id: `${shop.id}-front-photo`, shopId: shop.id, mediaId: photo.id, kind: "front" },
    });
  }

  const productData = [
    ["Amul Butter 500g", shops[0], categories.Grocery, brands.Amul, 28000, 30000, "IN_STOCK", 30],
    ["Surf Excel Easy Wash 1kg", shops[0], categories.Grocery, brands["Surf Excel"], 14500, 16000, "LOW_STOCK", 4],
    ["Fresh Wheat Atta 5kg", shops[0], categories.Grocery, brands.Generic, 23000, 25000, "IN_STOCK", 20],
    ["LED Bulb 9W", shops[0], categories.Hardware, brands.Generic, 9900, 12000, "IN_STOCK", 45],
    ["Fevicol MR 200g", shops[0], categories.Hardware, brands.Fevicol, 8500, 9000, "LOW_STOCK", 5],
    ["Classmate Notebook 172 Pages", shops[0], categories.Stationery, brands.Classmate, 5500, 6500, "OUT_OF_STOCK", 0],
    ["Samsung USB-C Charger 25W", shops[1], categories.Electronics, brands.Samsung, 119900, 149900, "IN_STOCK", 12],
    ["Bluetooth Neckband", shops[1], categories.Electronics, brands.Generic, 89900, 129900, "IN_STOCK", 9],
    ["Tempered Glass Pack", shops[1], categories.Electronics, brands.Generic, 19900, 24900, "LOW_STOCK", 3],
    ["USB-C Cable 1m", shops[1], categories.Electronics, brands.Generic, 24900, 29900, "IN_STOCK", 18],
    ["Power Bank 10000mAh", shops[1], categories.Electronics, brands.Generic, 99900, 129900, "PENDING_APPROVAL", 7],
    ["Smartphone Stand", shops[1], categories.Electronics, brands.Generic, 14900, 19900, "DRAFT", 16],
  ];

  const products = [];
  for (const [name, shop, category, brand, pricePaise, mrpPaise, stockOrStatus, stockCount] of productData) {
    const isStatus = ["DRAFT", "PENDING_APPROVAL"].includes(stockOrStatus);
    const slug = slugify(name);
    const product = await prisma.product.upsert({
      where: { shopId_sku: { shopId: shop.id, sku: slug.toUpperCase().replace(/-/g, "_") } },
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
        shopId: shop.id,
        categoryId: category.id,
        brandId: brand.id,
        name,
        slug,
        sku: slug.toUpperCase().replace(/-/g, "_"),
        description: `${name} available at ${shop.name}.`,
        tags: [category.name.toLowerCase(), brand.name.toLowerCase()],
        pricePaise,
        mrpPaise,
        status: isStatus ? stockOrStatus : "ACTIVE",
        stockStatus: isStatus ? "IN_STOCK" : stockOrStatus,
        stockAvailable: stockOrStatus !== "OUT_OF_STOCK",
        stockCount,
        ratingAvg: 4.2,
        reviewCount: 2,
        viewCount: 24,
      },
    });
    products.push(product);

    const media = await upsertMedia(`product/${product.slug}`, `${name} product image`, shop.ownerId);
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

  await prisma.savedProduct.upsert({
    where: { userId_productId: { userId: customer.id, productId: products[0].id } },
    update: {},
    create: { userId: customer.id, productId: products[0].id },
  });

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
      shopNameSnapshot: shops[0].name,
    },
  });

  const reservation = await prisma.reservation.upsert({
    where: { id: "seed-reservation-1" },
    update: { totalPaise: products[0].pricePaise * 2 },
    create: {
      id: "seed-reservation-1",
      userId: customer.id,
      shopId: shops[0].id,
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

  await prisma.review.upsert({
    where: { id: "seed-review-product-1" },
    update: { rating: 5, comment: "Fresh stock and quick confirmation." },
    create: {
      id: "seed-review-product-1",
      userId: customer.id,
      shopId: shops[0].id,
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
      shopId: shops[1].id,
      rating: 4,
      comment: "Helpful shopkeeper and easy to locate.",
    },
  });

  for (const type of ["SYSTEM", "PROMO", "RESERVATION"]) {
    await prisma.notification.upsert({
      where: { id: `seed-notification-${type.toLowerCase()}` },
      update: { title: `${type} update` },
      create: {
        id: `seed-notification-${type.toLowerCase()}`,
        userId: customer.id,
        type,
        title: `${type} update`,
        message: "Demo notification for Phase 1 seed data.",
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

  const bannerImage = await upsertMedia("banner/navsari-local-deals", "Navsari local deals banner", admin.id);
  const banner = await prisma.banner.upsert({
    where: { id: "seed-banner-navsari-local-deals" },
    update: { status: "ACTIVE", imageId: bannerImage.id },
    create: {
      id: "seed-banner-navsari-local-deals",
      title: "Navsari Local Deals",
      shopId: shops[0].id,
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

  for (const city of ["Navsari", "Surat", "Ahmedabad"]) {
    for (const targetType of ["product", "banner"]) {
      await prisma.pinRule.upsert({
        where: { city_targetType: { city, targetType } },
        update: { pinLimit: 10 },
        create: { city, targetType, pinLimit: 10 },
      });
    }
  }

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

  await prisma.searchEvent.create({ data: { userId: customer.id, query: "butter", city: "Navsari", radiusKm: 3, resultCount: 3 } });
  await prisma.productView.create({ data: { userId: customer.id, productId: products[0].id, shopId: shops[0].id, source: "SEARCH" } });
  await prisma.shopLead.create({ data: { userId: customer.id, shopId: shops[0].id, productId: products[0].id, source: "MAP_VIEW", metadata: { action: "open_google_maps" } } });
  await prisma.bannerImpression.create({ data: { bannerId: banner.id, userId: customer.id, device: "MOBILE", city: "Navsari", clickedAt: now } });
  await prisma.feedback.create({ data: { userId: customer.id, type: "product_report", subject: "Demo report", message: "Seed feedback for moderation testing." } });
  await prisma.auditLog.create({ data: { actorId: superAdmin.id, action: "seed.phase1", entityType: "database", after: { version: "phase-1" } } });

  console.log("Phase 1 seed complete.");
  console.log("Seed credentials:");
  console.log(`customer@neargrab.test / ${PASSWORD}`);
  console.log(`shopkeeper1@neargrab.test / ${PASSWORD}`);
  console.log(`shopkeeper2@neargrab.test / ${PASSWORD}`);
  console.log(`admin@neargrab.test / ${PASSWORD}`);
  console.log(`superadmin@neargrab.test / ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
