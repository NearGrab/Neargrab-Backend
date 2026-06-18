const express = require("express");
const { authenticate } = require("../../middleware/auth.middleware");
const { requireRole } = require("../../middleware/role.middleware");
const validate = require("../../middleware/validate.middleware");
const controller = require("../shopkeeper-dashboard/dashboard.controller");
const schema = require("../shopkeeper-dashboard/dashboard.schema");

const router = express.Router();

// Apply auth and SHOPKEEPER role middleware globally
router.use(authenticate);
router.use(requireRole("SHOPKEEPER"));

router.get("/me", controller.getShopProfile);
router.patch("/me", validate({ body: schema.updateProfileBody }), controller.updateShopProfile);
router.put("/me", validate({ body: schema.updateProfileBody }), controller.updateShopProfile);

module.exports = router;
