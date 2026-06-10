const express = require("express");
const { sendSuccess } = require("../lib/response");
const metaRoutes = require("./meta.routes");
const seedPreviewRoutes = require("./seed-preview.routes");
const authRoutes = require("../features/auth/auth.routes");
const userRoutes = require("../features/user/user.routes");
const publicUserRoutes = require("../features/user/public-user.routes");
const exploreRoutes = require("../features/explore/explore.routes");
const searchRoutes = require("../features/search/search.routes");
const productRoutes = require("../features/product/product.routes");
const shopRoutes = require("../features/shop/shop.routes");
const cartRoutes = require("../features/cart/cart.routes");
const reservationRoutes = require("../features/reservation/reservation.routes");
const notificationRoutes = require("../features/notification/notification.routes");
const onboardingRoutes = require("../features/shopkeeper-onboarding/onboarding.routes");
const shopkeeperDashboardRoutes = require("../features/shopkeeper-dashboard/dashboard.routes");
const adminRoutes = require("../features/admin/admin.routes");
const mediaRoutes = require("../features/media/media.routes");


const router = express.Router();

router.get("/health", (_req, res) =>
  sendSuccess(res, {
    status: "ok",
    service: "backend",
    timestamp: new Date().toISOString(),
  }),
);

router.use("/api/v1/meta", metaRoutes);
router.use("/api/v1/seed-preview", seedPreviewRoutes);
router.use("/api/v1/auth", authRoutes);
router.use("/api/v1/me", userRoutes);
router.use("/api/v1/users", publicUserRoutes);
router.use("/api/v1", exploreRoutes);
router.use("/api/v1", searchRoutes);
router.use("/api/v1/products", productRoutes);
router.use("/api/v1/shops", shopRoutes);
router.use("/api/v1/cart", cartRoutes);
router.use("/api/v1/reservations", reservationRoutes);
router.use("/api/v1/notifications", notificationRoutes);
router.use("/api/v1/shopkeeper/onboarding", onboardingRoutes);
router.use("/api/v1/shopkeeper", shopkeeperDashboardRoutes);
router.use("/api/v1/admin", adminRoutes);
router.use("/api/v1/media", mediaRoutes);


module.exports = router;
