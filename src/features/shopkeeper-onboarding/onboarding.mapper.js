function mapOnboardingState(shop) {
  if (!shop) {
    return {
      shop: null,
      address: null,
      contact: null,
      timings: [],
      business: null,
      photos: [],
      completion: {
        details: false,
        address: false,
        contact: false,
        business: false,
        photos: false,
        submittable: false,
        missing: [
          "details.name",
          "details.username",
          "details.category",
          "details.type",
          "details.description",
          "address.street",
          "address.landmark",
          "address.city",
          "address.state",
          "address.pincode",
          "address.googleMapsUrl",
          "contact.phone",
          "contact.whatsapp",
          "contact.timings",
          "business.languages",
          "business.registrationDoc",
          "photos.front",
          "photos.inside",
        ],
      },
    };
  }

  // 1. Map basic Shop details
  const mappedShop = {
    id: shop.id,
    name: shop.name,
    username: shop.username,
    slug: shop.slug,
    categoryId: shop.categoryId,
    category: shop.category
      ? {
          id: shop.category.id,
          name: shop.category.name,
          slug: shop.category.slug,
        }
      : null,
    type: shop.type,
    establishedYear: shop.establishedYear,
    description: shop.description,
    gstNumber: shop.gstNumber,
    panNumber: shop.panNumber,
    status: shop.status,
    verificationStatus: shop.verificationStatus,
    logo: shop.logo ? shop.logo.url : null,
    cover: shop.cover ? shop.cover.url : null,
    googleMapsUrl: shop.googleMapsUrl,
    city: shop.city,
    createdAt: shop.createdAt instanceof Date ? shop.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: shop.updatedAt instanceof Date ? shop.updatedAt.toISOString() : new Date().toISOString(),
  };

  // 2. Map Address
  const mappedAddress = shop.address
    ? {
        street: shop.address.street,
        landmark: shop.address.landmark,
        city: shop.city || shop.address.city,
        state: shop.address.state,
        pincode: shop.address.pincode,
        latitude: Number(shop.address.latitude),
        longitude: Number(shop.address.longitude),
        serviceRadiusKm: Number(shop.address.serviceRadiusKm),
        googleMapsUrl: shop.googleMapsUrl,
      }
    : null;

  // 3. Map Contact
  const mappedContact = shop.contact
    ? {
        phone: shop.contact.phone,
        whatsapp: shop.contact.whatsapp,
        alternatePhone: shop.contact.alternatePhone,
        email: shop.contact.email,
        acceptCalls: shop.contact.acceptCalls,
        enableStockRequests: shop.contact.enableStockRequests,
        receiveNotifications: shop.contact.receiveNotifications,
      }
    : null;

  // 4. Map Timings (Sorted by weekday 0-6)
  const weekdayOrder = [0, 1, 2, 3, 4, 5, 6];
  const rawTimings = shop.timings || [];
  const mappedTimings = weekdayOrder.map((dayNum) => {
    const dbTiming = rawTimings.find((t) => t.weekday === dayNum);
    return {
      weekday: dayNum,
      opensAt: dbTiming ? dbTiming.opensAt : "08:00 AM",
      closesAt: dbTiming ? dbTiming.closesAt : "10:00 PM",
      isClosed: dbTiming ? dbTiming.isClosed : true,
    };
  });

  // 5. Map Business Info (languages, tags, payments)
  const languages = (shop.languages || []).map((l) => l.language);
  // Separate special system tags from standard user tags if necessary, but keep it simple
  const tags = (shop.tags || []).map((t) => t.tag);

  const rawPayments = shop.paymentMethods || [];
  const paymentMethods = [
    {
      method: "CASH",
      upiId: null,
      enabled: rawPayments.some((p) => p.method === "CASH" && p.enabled),
    },
    {
      method: "UPI",
      upiId: rawPayments.find((p) => p.method === "UPI")?.upiId || null,
      enabled: rawPayments.some((p) => p.method === "UPI" && p.enabled),
    },
  ];

  const mappedBusiness = {
    languages,
    tags,
    paymentMethods,
  };

  // 6. Map Photos (sorted by sortOrder)
  const rawPhotos = shop.photos || [];
  const mappedPhotos = rawPhotos
    .filter((p) => p.kind !== "registration_doc") // Registration docs can be kept separate or included. Let's include all non-registration photos in this list
    .map((p) => ({
      id: p.mediaId,
      url: p.media ? p.media.url : "",
      kind: p.kind,
      sortOrder: p.sortOrder,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // 7. Calculate completion & missing fields
  const missing = [];

  // Details validations
  if (!shop.name) missing.push("details.name");
  if (!shop.username) missing.push("details.username");
  if (!shop.categoryId) missing.push("details.category");
  if (!shop.type) missing.push("details.type");
  if (!shop.description) missing.push("details.description");

  // Address validations
  if (!shop.address?.street) missing.push("address.street");
  if (!shop.address?.landmark) missing.push("address.landmark");
  if (!shop.address?.city) missing.push("address.city");
  if (!shop.address?.state) missing.push("address.state");
  if (!shop.address?.pincode || shop.address.pincode.length !== 6) missing.push("address.pincode");
  if (!shop.googleMapsUrl) {
    missing.push("address.googleMapsUrl");
  }

  // Contact validations
  if (!shop.contact?.phone) missing.push("contact.phone");
  if (!shop.contact?.whatsapp) missing.push("contact.whatsapp");
  const hasAtLeastOneOpenDay = mappedTimings.some((t) => !t.isClosed);
  if (!hasAtLeastOneOpenDay) missing.push("contact.timings");

  // Business validations
  if (languages.length === 0) missing.push("business.languages");
  const registrationDoc = rawPhotos.find((p) => p.kind === "registration_doc");
  if (!registrationDoc) missing.push("business.registrationDoc");
  const upiEnabled = paymentMethods.find((p) => p.method === "UPI")?.enabled;
  const upiId = paymentMethods.find((p) => p.method === "UPI")?.upiId;
  if (upiEnabled && !upiId) missing.push("business.upiId");

  // Photos validations
  const hasFrontPhoto = rawPhotos.some((p) => p.kind === "front");
  const hasInsidePhoto = rawPhotos.some((p) => p.kind === "inside");
  if (!hasFrontPhoto) missing.push("photos.front");
  if (!hasInsidePhoto) missing.push("photos.inside");

  // Determine completions
  const detailsComplete =
    !!shop.name &&
    !!shop.username &&
    !!shop.categoryId &&
    !!shop.type &&
    !!shop.description &&
    shop.description.length <= 300;

  const addressComplete =
    !!shop.address?.street &&
    !!shop.address?.landmark &&
    !!shop.address?.city &&
    !!shop.address?.state &&
    shop.address.pincode.length === 6 &&
    !!shop.googleMapsUrl;

  const contactComplete =
    !!shop.contact?.phone &&
    !!shop.contact?.whatsapp &&
    hasAtLeastOneOpenDay;

  const businessComplete =
    languages.length > 0 &&
    !!registrationDoc &&
    (!upiEnabled || !!upiId);

  const photosComplete = hasFrontPhoto && hasInsidePhoto;

  const submittable = missing.length === 0;

  return {
    shop: mappedShop,
    address: mappedAddress,
    contact: mappedContact,
    timings: mappedTimings,
    business: mappedBusiness,
    photos: mappedPhotos,
    completion: {
      details: detailsComplete,
      address: addressComplete,
      contact: contactComplete,
      business: businessComplete,
      photos: photosComplete,
      submittable,
      missing,
    },
  };
}

module.exports = {
  mapOnboardingState,
};
