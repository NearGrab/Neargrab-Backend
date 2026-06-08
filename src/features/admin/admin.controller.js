const { sendSuccess } = require("../../lib/response");
const adminService = require("./admin.service");
const mappers = require("./admin.mapper");

async function adminLogin(req, res, next) {
  try {
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;
    const result = await adminService.adminLogin({
      email: req.body.email,
      password: req.body.password,
      userAgent,
      ipAddress,
    });
    // map user using mapAdminUser
    const responseData = {
      user: mappers.mapAdminUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
    sendSuccess(res, responseData);
  } catch (err) {
    next(err);
  }
}

async function getAdminProfile(req, res, next) {
  try {
    const admin = await adminService.getAdminProfile(req.user.id);
    const data = mappers.mapAdminUser(admin);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function getDashboardSummary(req, res, next) {
  try {
    const data = await adminService.getDashboardSummary();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const filters = {
      search: req.query.search,
      role: req.query.role,
      status: req.query.status,
      city: req.query.city,
      page: req.query.page,
      limit: req.query.limit,
    };
    const { users, meta } = await adminService.listUsers(filters);
    const data = users.map(mappers.mapAdminUser);
    sendSuccess(res, data, meta);
  } catch (err) {
    next(err);
  }
}

async function getUserDetail(req, res, next) {
  try {
    const user = await adminService.getUserDetail(req.params.userId);
    const data = mappers.mapAdminUser(user);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;
    
    const updated = await adminService.updateUser(
      req.params.userId,
      req.body,
      { actorId, userAgent, ipAddress }
    );
    const data = mappers.mapAdminUser(updated);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;

    const result = await adminService.deleteUser(
      req.params.userId,
      { actorId, userAgent, ipAddress }
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

async function listShops(req, res, next) {
  try {
    const filters = {
      search: req.query.search,
      status: req.query.status,
      verificationStatus: req.query.verificationStatus,
      city: req.query.city,
      page: req.query.page,
      limit: req.query.limit,
    };
    const { shops, meta } = await adminService.listShops(filters);
    const data = shops.map(mappers.mapAdminShop);
    sendSuccess(res, data, meta);
  } catch (err) {
    next(err);
  }
}

async function getShopDetail(req, res, next) {
  try {
    const shop = await adminService.getShopDetail(req.params.shopId);
    const data = mappers.mapAdminShop(shop);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function verifyShop(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;

    const updated = await adminService.verifyShop(
      req.params.shopId,
      req.body,
      { actorId, userAgent, ipAddress }
    );
    const data = mappers.mapAdminShop(updated);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function listProducts(req, res, next) {
  try {
    const filters = {
      search: req.query.search,
      category: req.query.category,
      status: req.query.status,
      stockStatus: req.query.stockStatus,
      city: req.query.city,
      isPinned: req.query.isPinned,
      page: req.query.page,
      limit: req.query.limit,
    };
    const { products, meta } = await adminService.listProducts(filters);
    const data = products.map(mappers.mapAdminProduct);
    sendSuccess(res, data, meta);
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;

    const updated = await adminService.updateProduct(
      req.params.productId,
      req.body,
      { actorId, userAgent, ipAddress }
    );
    const data = mappers.mapAdminProduct(updated);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function bulkUpdateProducts(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;

    const result = await adminService.bulkUpdateProducts(
      req.body,
      { actorId, userAgent, ipAddress }
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

async function getPinRules(req, res, next) {
  try {
    const rules = await adminService.getPinRules();
    sendSuccess(res, rules);
  } catch (err) {
    next(err);
  }
}

async function pinProduct(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;

    const updated = await adminService.pinProduct(
      req.params.productId,
      { actorId, userAgent, ipAddress }
    );
    const data = mappers.mapAdminProduct(updated);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function unpinProduct(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;

    const updated = await adminService.unpinProduct(
      req.params.productId,
      { actorId, userAgent, ipAddress }
    );
    const data = mappers.mapAdminProduct(updated);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function listBanners(req, res, next) {
  try {
    const filters = {
      search: req.query.search,
      city: req.query.city,
      section: req.query.section,
      status: req.query.status,
      device: req.query.device,
      page: req.query.page,
      limit: req.query.limit,
    };
    const { banners, meta } = await adminService.listBanners(filters);
    const data = banners.map(mappers.mapAdminBanner);
    sendSuccess(res, data, meta);
  } catch (err) {
    next(err);
  }
}

async function createBanner(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;

    const banner = await adminService.createBanner(
      req.body,
      { actorId, userAgent, ipAddress }
    );
    const data = mappers.mapAdminBanner(banner);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function getBannerDetail(req, res, next) {
  try {
    const banner = await adminService.getBannerDetail(req.params.bannerId);
    const data = mappers.mapAdminBanner(banner);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function updateBanner(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;

    const updated = await adminService.updateBanner(
      req.params.bannerId,
      req.body,
      { actorId, userAgent, ipAddress }
    );
    const data = mappers.mapAdminBanner(updated);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function deleteBanner(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;

    const result = await adminService.deleteBanner(
      req.params.bannerId,
      { actorId, userAgent, ipAddress }
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

async function getBannerMetrics(req, res, next) {
  try {
    const data = await adminService.getBannerMetrics();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function getBannerPerformance(req, res, next) {
  try {
    const data = await adminService.getBannerPerformance();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function pinBanner(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;

    const updated = await adminService.pinBanner(
      req.params.bannerId,
      { actorId, userAgent, ipAddress }
    );
    const data = mappers.mapAdminBanner(updated);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function unpinBanner(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;

    const updated = await adminService.unpinBanner(
      req.params.bannerId,
      { actorId, userAgent, ipAddress }
    );
    const data = mappers.mapAdminBanner(updated);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function getAppContent(req, res, next) {
  try {
    const data = await adminService.getAppContent();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function updateContentPage(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;

    const updated = await adminService.updateContentPage(
      req.params.key,
      req.body,
      { actorId, userAgent, ipAddress }
    );
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
}

async function listReviews(req, res, next) {
  try {
    const filters = {
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    };
    const { reviews, meta } = await adminService.listReviews(filters);
    const data = reviews.map(mappers.mapAdminReview);
    sendSuccess(res, data, meta);
  } catch (err) {
    next(err);
  }
}

async function updateReview(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;

    const updated = await adminService.updateReview(
      req.params.reviewId,
      req.body,
      { actorId, userAgent, ipAddress }
    );
    const data = mappers.mapAdminReview(updated);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function listFeedback(req, res, next) {
  try {
    const filters = {
      type: req.query.type,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    };
    const { feedbacks, meta } = await adminService.listFeedback(filters);
    const data = feedbacks.map(mappers.mapAdminFeedback);
    sendSuccess(res, data, meta);
  } catch (err) {
    next(err);
  }
}

async function updateFeedback(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const userAgent = req.headers["user-agent"] || null;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || null;

    const updated = await adminService.updateFeedback(
      req.params.feedbackId,
      req.body,
      { actorId, userAgent, ipAddress }
    );
    const data = mappers.mapAdminFeedback(updated);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function listAuditLogs(req, res, next) {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
    };
    const { logs, meta } = await adminService.listAuditLogs(filters);
    const data = logs.map(mappers.mapAdminAuditLog);
    sendSuccess(res, data, meta);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  adminLogin,
  getAdminProfile,
  getDashboardSummary,
  listUsers,
  getUserDetail,
  updateUser,
  deleteUser,
  listShops,
  getShopDetail,
  verifyShop,
  listProducts,
  updateProduct,
  bulkUpdateProducts,
  getPinRules,
  pinProduct,
  unpinProduct,
  listBanners,
  createBanner,
  getBannerDetail,
  updateBanner,
  deleteBanner,
  getBannerMetrics,
  getBannerPerformance,
  pinBanner,
  unpinBanner,
  getAppContent,
  updateContentPage,
  listReviews,
  updateReview,
  listFeedback,
  updateFeedback,
  listAuditLogs,
};
