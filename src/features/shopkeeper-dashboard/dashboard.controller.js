const { sendSuccess } = require("../../lib/response");
const dashboardService = require("./dashboard.service");
const { mapShopDetail } = require("../shop/shop.mapper");
const {
  mapDashboardProduct,
  mapDashboardReservation,
  mapDashboardReview,
  mapDashboardLead,
  mapDashboardStats,
} = require("./dashboard.mapper");

async function getDashboardStats(req, res, next) {
  try {
    const { shop, stats } = await dashboardService.getDashboardStats(req.user.id);
    const data = mapDashboardStats(shop, stats);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function getShopProfile(req, res, next) {
  try {
    const shop = await dashboardService.getShopProfile(req.user.id);
    const data = mapShopDetail(shop);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function updateShopProfile(req, res, next) {
  try {
    const updated = await dashboardService.updateShopProfile(req.user.id, req.body);
    const data = mapShopDetail(updated);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function getShopTimings(req, res, next) {
  try {
    const timings = await dashboardService.getShopTimings(req.user.id);
    const data = timings.map((t) => ({
      weekday: t.weekday,
      opensAt: t.opensAt,
      closesAt: t.closesAt,
      isClosed: t.isClosed,
    }));
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function replaceShopTimings(req, res, next) {
  try {
    const timings = await dashboardService.replaceShopTimings(req.user.id, req.body);
    const data = timings.map((t) => ({
      weekday: t.weekday,
      opensAt: t.opensAt,
      closesAt: t.closesAt,
      isClosed: t.isClosed,
    }));
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function listShopkeeperReviews(req, res, next) {
  try {
    const filters = {
      rating: req.query.rating,
      page: req.query.page,
      limit: req.query.limit,
    };
    const { reviews, meta } = await dashboardService.listShopkeeperReviews(req.user.id, filters);
    const data = reviews.map(mapDashboardReview);
    sendSuccess(res, data, meta);
  } catch (err) {
    next(err);
  }
}

async function listShopkeeperLeads(req, res, next) {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
    };
    const { leads, meta } = await dashboardService.listShopkeeperLeads(req.user.id, filters);
    const data = leads.map(mapDashboardLead);
    sendSuccess(res, data, meta);
  } catch (err) {
    next(err);
  }
}

async function listShopkeeperReservations(req, res, next) {
  try {
    const filters = {
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    };
    const { reservations, meta } = await dashboardService.listShopkeeperReservations(req.user.id, filters);
    const data = reservations.map(mapDashboardReservation);
    sendSuccess(res, data, meta);
  } catch (err) {
    next(err);
  }
}

async function updateReservationStatus(req, res, next) {
  try {
    const { reservationId } = req.params;
    const updated = await dashboardService.updateReservationStatus(req.user.id, reservationId, req.body);
    const data = mapDashboardReservation(updated);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function listShopkeeperProducts(req, res, next) {
  try {
    const filters = {
      q: req.query.q,
      categoryId: req.query.categoryId,
      stockStatus: req.query.stockStatus,
      page: req.query.page,
      limit: req.query.limit,
    };
    const { products, meta } = await dashboardService.listShopkeeperProducts(req.user.id, filters);
    const data = products.map(mapDashboardProduct);
    sendSuccess(res, data, meta);
  } catch (err) {
    next(err);
  }
}

async function createShopProduct(req, res, next) {
  try {
    const product = await dashboardService.createShopProduct(req.user.id, req.body);
    const data = mapDashboardProduct(product);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function getShopProductDetail(req, res, next) {
  try {
    const { productId } = req.params;
    const product = await dashboardService.getShopProductDetail(req.user.id, productId);
    const data = mapDashboardProduct(product);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function updateShopProduct(req, res, next) {
  try {
    const { productId } = req.params;
    const updated = await dashboardService.updateShopProduct(req.user.id, productId, req.body);
    const data = mapDashboardProduct(updated);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function deleteShopProduct(req, res, next) {
  try {
    const { productId } = req.params;
    const result = await dashboardService.deleteShopProduct(req.user.id, productId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

async function toggleShopProductStock(req, res, next) {
  try {
    const { productId } = req.params;
    const updated = await dashboardService.toggleShopProductStock(req.user.id, productId, req.body);
    const data = mapDashboardProduct(updated);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function attachProductImage(req, res, next) {
  try {
    const { productId } = req.params;
    const pImg = await dashboardService.attachProductImage(req.user.id, productId, req.body);
    sendSuccess(res, {
      id: pImg.id,
      mediaId: pImg.mediaId,
      url: pImg.media?.url || "",
      alt: pImg.alt || "",
      sortOrder: pImg.sortOrder,
    });
  } catch (err) {
    next(err);
  }
}

async function detachProductImage(req, res, next) {
  try {
    const { productId, imageId } = req.params;
    const result = await dashboardService.detachProductImage(req.user.id, productId, imageId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

async function bulkUpdateShopProducts(req, res, next) {
  try {
    const result = await dashboardService.bulkUpdateShopProducts(req.user.id, req.body);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

async function listPromotionRequests(req, res, next) {
  try {
    const banners = await dashboardService.listPromotionRequests(req.user.id);
    const data = banners.map((b) => ({
      id: b.id,
      description: b.title,
      status: b.status,
      imageUrl: b.image?.url || "",
      mediaId: b.imageId,
      startAt: b.startAt,
      endAt: b.endAt,
      createdAt: b.createdAt,
    }));
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function createPromotionRequest(req, res, next) {
  try {
    const banner = await dashboardService.createPromotionRequest(req.user.id, req.body);
    const data = {
      id: banner.id,
      description: banner.title,
      status: banner.status,
      imageUrl: banner.image?.url || "",
      mediaId: banner.imageId,
      startAt: banner.startAt,
      endAt: banner.endAt,
      createdAt: banner.createdAt,
    };
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
  listPromotionRequests,
  createPromotionRequest,
};
