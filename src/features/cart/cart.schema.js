const { z } = require("zod");

const addToCartBody = z.object({
  productId: z.string().nonempty({ message: "Product ID is required" }),
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number" })
    .int()
    .min(1, { message: "Quantity must be at least 1" })
    .max(99, { message: "Quantity cannot exceed 99" }),
});

const updateCartItemBody = z.object({
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number" })
    .int()
    .min(1, { message: "Quantity must be at least 1" })
    .max(99, { message: "Quantity cannot exceed 99" }),
});

const cartItemIdParam = z.object({
  itemId: z.string().nonempty({ message: "Item ID is required" }),
});

module.exports = {
  addToCartBody,
  updateCartItemBody,
  cartItemIdParam,
};
