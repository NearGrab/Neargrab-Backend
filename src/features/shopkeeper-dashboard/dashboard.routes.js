const express = require("express");
const { authenticate } = require("../../middleware/auth.middleware");
const { requireRole } = require("../../middleware/role.middleware");
const validate = require("../../middleware/validate.middleware");
const controller = require("./dashboard.controller");
const schema = require("./dashboard.schema");

const router = express.Router();

// Apply auth and SHOPKEEPER role middleware globally to these routes
router.use(authenticate);
router.use(requireRole("SHOPKEEPER"));

// Dashboard Stats
router.get("/dashboard", controller.getDashboardStats);

// Shop Profile management
router.get("/profile", controller.getShopProfile);
router.patch("/profile", validate({ body: schema.updateProfileBody }), controller.updateShopProfile);

// Shop Timings
router.get("/profile/timings", controller.getShopTimings);
router.put("/profile/timings", validate({ body: schema.replaceTimingsBody }), controller.replaceShopTimings);

// Reviews & Leads
router.get("/reviews", validate({ query: schema.listReviewsQuery }), controller.listShopkeeperReviews);
router.get("/leads", validate({ query: schema.listLeadsQuery }), controller.listShopkeeperLeads);

// Reservations
router.get("/reservations", validate({ query: schema.listReservationsQuery }), controller.listShopkeeperReservations);
router.patch(
  "/reservations/:reservationId/status",
  validate({
    params: schema.reservationIdParam,
    body: schema.updateReservationStatusBody,
  }),
  controller.updateReservationStatus
);

// Products Catalog management
router.get("/products", validate({ query: schema.listProductsQuery }), controller.listShopkeeperProducts);
router.post("/products", validate({ body: schema.createProductBody }), controller.createShopProduct);
router.post("/products/bulk", validate({ body: schema.bulkProductsBody }), controller.bulkUpdateShopProducts);

router.get("/products/:productId", validate({ params: schema.productIdParam }), controller.getShopProductDetail);
router.patch(
  "/products/:productId",
  validate({
    params: schema.productIdParam,
    body: schema.updateProductBody,
  }),
  controller.updateShopProduct
);
router.delete("/products/:productId", validate({ params: schema.productIdParam }), controller.deleteShopProduct);

router.patch(
  "/products/:productId/stock",
  validate({
    params: schema.productIdParam,
    body: schema.toggleStockBody,
  }),
  controller.toggleShopProductStock
);

router.post(
  "/products/:productId/images",
  validate({
    params: schema.productIdParam,
    body: schema.attachProductImageBody,
  }),
  controller.attachProductImage
);

router.delete(
  "/products/:productId/images/:imageId",
  validate({
    params: schema.imageIdParam,
  }),
  controller.detachProductImage
);

// Promotions / Banner Requests
router.get("/promotions", controller.listPromotionRequests);
router.post(
  "/promotions",
  validate({ body: schema.createPromotionRequestBody }),
  controller.createPromotionRequest
);

module.exports = router;
