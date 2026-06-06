const { sendSuccess } = require("../../lib/response");
const cartService = require("./cart.service");

async function getCart(req, res, next) {
  try {
    const data = await cartService.getCart(req.user.id);
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function addItem(req, res, next) {
  try {
    const data = await cartService.addToCart(req.user.id, req.body);
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function updateItem(req, res, next) {
  try {
    const data = await cartService.updateCartItem(
      req.user.id,
      req.params.itemId,
      req.body
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function removeItem(req, res, next) {
  try {
    const data = await cartService.removeCartItem(
      req.user.id,
      req.params.itemId
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function clearCart(req, res, next) {
  try {
    const data = await cartService.clearCart(req.user.id);
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
};
