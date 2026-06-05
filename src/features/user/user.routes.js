const express = require("express");
const { authenticate } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const userController = require("./user.controller");
const userSchemas = require("./user.schema");

const router = express.Router();

// All /me endpoints require authentication
router.use(authenticate);

router
  .route("/")
  .get(userController.getMe)
  .patch(validate({ body: userSchemas.updateMeBody }), userController.updateMe)
  .delete(userController.deactivateMe);

router
  .route("/profile")
  .get(userController.getProfile)
  .patch(validate({ body: userSchemas.updateProfileBody }), userController.updateProfile);

router
  .route("/settings")
  .get(userController.getSettings)
  .patch(validate({ body: userSchemas.updateSettingsBody }), userController.updateSettings);

module.exports = router;
