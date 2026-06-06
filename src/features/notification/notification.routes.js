const express = require("express");
const { authenticate } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const notificationController = require("./notification.controller");
const notificationSchema = require("./notification.schema");

const router = express.Router();

router.get(
  "/",
  authenticate,
  validate({ query: notificationSchema.queryNotifications }),
  notificationController.listNotifications
);

router.patch("/read-all", authenticate, notificationController.markAllAsRead);

router.patch(
  "/:notificationId/read",
  authenticate,
  validate({ params: notificationSchema.notificationIdParam }),
  notificationController.markAsRead
);

router.delete(
  "/:notificationId",
  authenticate,
  validate({ params: notificationSchema.notificationIdParam }),
  notificationController.deleteNotification
);

router.get("/preferences", authenticate, notificationController.getPreferences);

router.patch(
  "/preferences",
  authenticate,
  validate({ body: notificationSchema.updatePreferencesBody }),
  notificationController.updatePreferences
);

module.exports = router;
