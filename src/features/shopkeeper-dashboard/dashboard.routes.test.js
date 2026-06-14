const request = require("supertest");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
  },
  shop: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  shopAddress: {
    upsert: jest.fn(),
  },
  shopContact: {
    upsert: jest.fn(),
  },
  shopTiming: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  shopLanguage: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  shopTag: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  shopPaymentMethod: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  productView: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  shopLead: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  savedProduct: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  product: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  review: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findUnique: jest.fn(),
  },
  reservation: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  reservationItem: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  mediaAsset: {
    findUnique: jest.fn(),
  },
  productImage: {
    create: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
  prisma: mockPrisma,
}));

jest.mock("../notification/notification.service", () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));

process.env.JWT_ACCESS_SECRET = "test-dashboard-routes-secret-key-123456";
env.JWT_ACCESS_SECRET = "test-dashboard-routes-secret-key-123456";

const app = require("../../app");

describe("Shopkeeper Dashboard & Catalog Feature Routes", () => {
  const userId = "shopkeeper-123";
  const sessionId = "session-123";
  let token;

  const mockShop = {
    id: "shop-123",
    ownerId: userId,
    name: "Patel Store",
    username: "patelstore",
    slug: "patelstore",
    status: "ACTIVE",
    verificationStatus: "VERIFIED",
    timings: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    token = jwt.sign(
      { sub: userId, role: "SHOPKEEPER", sessionId },
      env.JWT_ACCESS_SECRET
    );

    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      role: "SHOPKEEPER",
      status: "ACTIVE",
    });
    mockPrisma.session.findUnique.mockResolvedValue({
      id: sessionId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10000),
    });

    mockPrisma.shop.findUnique.mockResolvedValue(mockShop);
  });

  describe("Access Control", () => {
    it("should return 401 if unauthenticated", async () => {
      await request(app).get("/api/v1/shopkeeper/dashboard").expect(401);
    });

    it("should return 403 if authenticated but not a SHOPKEEPER", async () => {
      const customerToken = jwt.sign(
        { sub: "customer-123", role: "CUSTOMER", sessionId },
        env.JWT_ACCESS_SECRET
      );

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "customer-123",
        role: "CUSTOMER",
        status: "ACTIVE",
      });

      await request(app)
        .get("/api/v1/shopkeeper/dashboard")
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe("GET /api/v1/shopkeeper/dashboard", () => {
    it("should return dashboard details successfully", async () => {
      const res = await request(app)
        .get("/api/v1/shopkeeper/dashboard")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.shopProfile.id).toBe("shop-123");
      expect(res.body.data.stats).toBeDefined();
    });
  });

  describe("Shop Profile & Timings", () => {
    it("should return own profile", async () => {
      const res = await request(app)
        .get("/api/v1/shopkeeper/profile")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("shop-123");
    });

    it("should update own profile successfully", async () => {
      mockPrisma.shop.update.mockResolvedValue(mockShop);

      const res = await request(app)
        .patch("/api/v1/shopkeeper/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Updated Shop Name",
          description: "New description text",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it("should replace timings", async () => {
      const timingsInput = Array(7).fill(null).map((_, i) => ({
        weekday: i,
        opensAt: "09:00",
        closesAt: "21:00",
        isClosed: false,
      }));

      mockPrisma.shopTiming.findMany.mockResolvedValueOnce(timingsInput);

      const res = await request(app)
        .put("/api/v1/shopkeeper/profile/timings")
        .set("Authorization", `Bearer ${token}`)
        .send(timingsInput)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(7);
    });
  });

  describe("Product Catalog CRUD", () => {
    const mockProduct = {
      id: "prod-123",
      shopId: "shop-123",
      name: "Fortune Oil 1L",
      pricePaise: 15000,
      stockStatus: "IN_STOCK",
      stockAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should create a product successfully", async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue(mockProduct);
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      const res = await request(app)
        .post("/api/v1/shopkeeper/products")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Fortune Oil 1L",
          pricePaise: 15000,
          stockStatus: "IN_STOCK",
          stockAvailable: true,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("prod-123");
    });

    it("should update a product", async () => {
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      const res = await request(app)
        .patch("/api/v1/shopkeeper/products/prod-123")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Fortune Oil 1.5L",
          pricePaise: 22000,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it("should delete a product", async () => {
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.product.update.mockResolvedValue({ ...mockProduct, status: "DELETED" });

      const res = await request(app)
        .delete("/api/v1/shopkeeper/products/prod-123")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
