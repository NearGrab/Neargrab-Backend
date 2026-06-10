const express = require("express");
const { authenticate } = require("../../middleware/auth.middleware");
const userController = require("./user.controller");

const router = express.Router();

// Required authentication to view other profiles
router.use(authenticate);

router.route("/:username/profile").get(userController.getUserPublicProfile);

router
  .route("/:userId/follow")
  .post(userController.followUser)
  .delete(userController.unfollowUser);

module.exports = router;
