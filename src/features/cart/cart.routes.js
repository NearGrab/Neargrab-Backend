const express = require("express");
const { authenticate } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const cartController = require("./cart.controller");
const cartSchema = require("./cart.schema");

const router = express.Router();

router.get("/", authenticate, cartController.getCart);

router.post(
  "/items",
  authenticate,
  validate({ body: cartSchema.addToCartBody }),
  cartController.addItem
);

router.patch(
  "/items/:itemId",
  authenticate,
  validate({
    params: cartSchema.cartItemIdParam,
    body: cartSchema.updateCartItemBody,
  }),
  cartController.updateItem
);

router.delete(
  "/items/:itemId",
  authenticate,
  validate({ params: cartSchema.cartItemIdParam }),
  cartController.removeItem
);

router.delete("/", authenticate, cartController.clearCart);

module.exports = router;
