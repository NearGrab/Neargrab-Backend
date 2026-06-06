const request = require("supertest");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

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
  user: {
    findUnique: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
  prisma: mockPrisma,
}));

process.env.JWT_ACCESS_SECRET = "test-cart-routes-secret-key-123456";
env.JWT_ACCESS_SECRET = "test-cart-routes-secret-key-123456";

const app = require("../../app");

describe("Cart Feature Routes", () => {
  const userId = "user-123";
  const sessionId = "session-123";
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    token = jwt.sign(
      { sub: userId, role: "CUSTOMER", sessionId },
      env.JWT_ACCESS_SECRET
    );

    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      role: "CUSTOMER",
      status: "ACTIVE",
    });
    mockPrisma.session.findUnique.mockResolvedValue({
      id: sessionId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10000),
    });
  });

  describe("GET /api/v1/cart", () => {
    it("should return empty cart if none exists", async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(null);
      mockPrisma.cart.create.mockResolvedValue({
        id: "cart-1",
        status: "active",
        items: [],
      });

      const res = await request(app)
        .get("/api/v1/cart")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("cart-1");
      expect(res.body.data.items).toHaveLength(0);
    });

    it("should return 401 if unauthenticated", async () => {
      await request(app).get("/api/v1/cart").expect(401);
    });
  });

  describe("POST /api/v1/cart/items", () => {
    it("should add item successfully", async () => {
      const mockProduct = {
        id: "prod-1",
        name: "Test Product",
        pricePaise: 200,
        status: "ACTIVE",
        stockAvailable: true,
        stockStatus: "IN_STOCK",
        shop: {
          id: "shop-1",
          name: "Test Shop",
          status: "ACTIVE",
          deletedAt: null,
        },
        images: [],
      };

      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.cart.findUnique.mockResolvedValue({
        id: "cart-1",
        status: "active",
        items: [],
      });
      mockPrisma.cartItem.create.mockResolvedValue({});

      const res = await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: "prod-1", quantity: 2 })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it("should return 400 for invalid validation", async () => {
      await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: "", quantity: 0 })
        .expect(400);
    });
  });

  describe("PATCH /api/v1/cart/items/:itemId", () => {
    it("should update quantity successfully", async () => {
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

      const res = await request(app)
        .patch("/api/v1/cart/items/item-1")
        .set("Authorization", `Bearer ${token}`)
        .send({ quantity: 5 })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe("DELETE /api/v1/cart/items/:itemId", () => {
    it("should delete item successfully", async () => {
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

      const res = await request(app)
        .delete("/api/v1/cart/items/item-1")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe("DELETE /api/v1/cart", () => {
    it("should clear cart successfully", async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({
        id: "cart-1",
        status: "active",
        items: [],
      });

      const res = await request(app)
        .delete("/api/v1/cart")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
