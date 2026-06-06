const cartService = require("./cart.service");
const { AppError } = require("../../lib/errors");

const mockPrisma = {
  cart: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  cartItem: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  product: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

describe("CartService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const dummyUserId = "user-1";

  describe("getCart", () => {
    it("should return empty cart when no cart exists", async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(null);
      mockPrisma.cart.create.mockResolvedValue({
        id: "cart-1",
        status: "active",
        items: [],
      });

      const result = await cartService.getCart(dummyUserId);

      expect(result.id).toBe("cart-1");
      expect(result.items).toHaveLength(0);
      expect(result.summary.totalItems).toBe(0);
    });
  });

  describe("addToCart", () => {
    it("should add item and snapshot product info", async () => {
      const mockProduct = {
        id: "prod-1",
        name: "Aashirvaad Atta",
        pricePaise: 27500,
        status: "ACTIVE",
        stockAvailable: true,
        stockStatus: "IN_STOCK",
        shop: {
          id: "shop-1",
          name: "Patel General Store",
          status: "ACTIVE",
          deletedAt: null,
        },
        images: [
          { media: { url: "http://image-url" } }
        ],
      };

      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.cart.findUnique.mockResolvedValue({
        id: "cart-1",
        status: "active",
        items: [],
      });

      await cartService.addToCart(dummyUserId, {
        productId: "prod-1",
        quantity: 2,
      });

      expect(mockPrisma.cartItem.create).toHaveBeenCalledWith({
        data: {
          cartId: "cart-1",
          productId: "prod-1",
          quantity: 2,
          nameSnapshot: "Aashirvaad Atta",
          pricePaiseSnapshot: 27500,
          shopNameSnapshot: "Patel General Store",
          imageUrlSnapshot: "http://image-url",
        },
      });
    });

    it("should increment quantity when same item already in cart", async () => {
      const mockProduct = {
        id: "prod-1",
        name: "Aashirvaad Atta",
        pricePaise: 27500,
        status: "ACTIVE",
        stockAvailable: true,
        stockStatus: "IN_STOCK",
        shop: {
          id: "shop-1",
          name: "Patel General Store",
          status: "ACTIVE",
          deletedAt: null,
        },
        images: [],
      };

      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.cart.findUnique.mockResolvedValue({
        id: "cart-1",
        status: "active",
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            quantity: 3,
            pricePaiseSnapshot: 27500,
            nameSnapshot: "Aashirvaad Atta",
            shopNameSnapshot: "Patel General Store",
          },
        ],
      });

      await cartService.addToCart(dummyUserId, {
        productId: "prod-1",
        quantity: 2,
      });

      expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: { quantity: 5 },
      });
    });

    it("should throw error if product is inactive/out of stock", async () => {
      const mockProduct = {
        id: "prod-1",
        status: "ACTIVE",
        stockAvailable: false,
        stockStatus: "OUT_OF_STOCK",
        shop: {
          id: "shop-1",
          status: "ACTIVE",
          deletedAt: null,
        },
      };

      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);

      await expect(
        cartService.addToCart(dummyUserId, { productId: "prod-1", quantity: 1 })
      ).rejects.toThrow("Product is out of stock or unavailable");
    });
  });

  describe("updateCartItem", () => {
    it("should update quantity of an item", async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({
        id: "cart-1",
        status: "active",
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            quantity: 3,
            pricePaiseSnapshot: 100,
          },
        ],
      });

      await cartService.updateCartItem(dummyUserId, "item-1", { quantity: 10 });

      expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: { quantity: 10 },
      });
    });
  });

  describe("removeCartItem", () => {
    it("should remove item from cart", async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({
        id: "cart-1",
        status: "active",
        items: [
          { id: "item-1", productId: "prod-1", pricePaiseSnapshot: 100 },
        ],
      });

      await cartService.removeCartItem(dummyUserId, "item-1");

      expect(mockPrisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: "item-1" },
      });
    });
  });

  describe("clearCart", () => {
    it("should delete all items from user's cart", async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({
        id: "cart-1",
        status: "active",
        items: [],
      });

      await cartService.clearCart(dummyUserId);

      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: "cart-1" },
      });
    });
  });
});
