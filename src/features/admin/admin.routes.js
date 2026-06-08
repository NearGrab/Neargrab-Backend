const express = require("express");
const { authenticate } = require("../../middleware/auth.middleware");
const { requireRole } = require("../../middleware/role.middleware");
const validate = require("../../middleware/validate.middleware");
const schemas = require("./admin.schema");
const controller = require("./admin.controller");

const router = express.Router();

// 1. Auth (public login)
router.post(
  "/auth/login",
  validate({ body: schemas.loginBody }),
  controller.adminLogin
);

// Protected routes (admin/super-admin/support/content-admin roles)
router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN", "SUPPORT_ADMIN", "CONTENT_ADMIN"));

router.get("/me", controller.getAdminProfile);

// 2. Dashboard
router.get("/dashboard", controller.getDashboardSummary);

// 3. User management
router.get(
  "/users",
  validate({ query: schemas.listUsersQuery }),
  controller.listUsers
);
router.get("/users/:userId", controller.getUserDetail);
router.patch(
  "/users/:userId",
  validate({ body: schemas.updateUserBody }),
  controller.updateUser
);
router.delete("/users/:userId", controller.deleteUser);

// 4. Shop verification
router.get(
  "/shops",
  validate({ query: schemas.listShopsQuery }),
  controller.listShops
);
router.get("/shops/:shopId", controller.getShopDetail);
router.patch(
  "/shops/:shopId/verify",
  validate({ body: schemas.verifyShopBody }),
  controller.verifyShop
);

// 5. Product moderation & pin rules
router.get(
  "/products",
  validate({ query: schemas.listProductsQuery }),
  controller.listProducts
);
router.patch(
  "/products/bulk",
  validate({ body: schemas.bulkProductsBody }),
  controller.bulkUpdateProducts
);
router.patch(
  "/products/:productId",
  validate({ body: schemas.updateProductBody }),
  controller.updateProduct
);
router.get("/pin-rules", controller.getPinRules);
router.post("/products/:productId/pin", controller.pinProduct);
router.post("/products/:productId/unpin", controller.unpinProduct);

// 6. Banners
router.get(
  "/banners",
  validate({ query: schemas.listBannersQuery }),
  controller.listBanners
);
router.get("/banners/metrics", controller.getBannerMetrics);
router.get("/banners/performance", controller.getBannerPerformance);
router.post(
  "/banners",
  validate({ body: schemas.createBannerBody }),
  controller.createBanner
);
router.get("/banners/:bannerId", controller.getBannerDetail);
router.patch(
  "/banners/:bannerId",
  validate({ body: schemas.updateBannerBody }),
  controller.updateBanner
);
router.delete("/banners/:bannerId", controller.deleteBanner);
router.post("/banners/:bannerId/pin", controller.pinBanner);
router.post("/banners/:bannerId/unpin", controller.unpinBanner);

// 7. Content Pages
router.get("/content", controller.getAppContent);
router.patch(
  "/content/:key",
  validate({ body: schemas.updateContentBody }),
  controller.updateContentPage
);

// 8. Moderation
router.get(
  "/reviews",
  validate({ query: schemas.listReviewsQuery }),
  controller.listReviews
);
router.patch(
  "/reviews/:reviewId",
  validate({ body: schemas.updateReviewBody }),
  controller.updateReview
);
router.get(
  "/feedback",
  validate({ query: schemas.listFeedbackQuery }),
  controller.listFeedback
);
router.patch(
  "/feedback/:feedbackId",
  validate({ body: schemas.updateFeedbackBody }),
  controller.updateFeedback
);

// 9. Audit Logs
router.get(
  "/audit-logs",
  validate({ query: schemas.listAuditLogsQuery }),
  controller.listAuditLogs
);

module.exports = router;
