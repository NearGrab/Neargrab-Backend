const request = require("supertest");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

// Mock prisma client
const mockPrisma = {
  shop: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  product: {
    count: jest.fn(),
    findMany: jest.fn(),
    unique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
  },
  review: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
    findUnique: jest.fn(),
  },
  reviewMedia: {
    createMany: jest.fn(),
  },
  reservation: {
    findFirst: jest.fn(),
  },
  shopUpdate: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  shopLead: {
    create: jest.fn(),
  },
  userFollow: {
    count: jest.fn().mockResolvedValue(0),
    findUnique: jest.fn().mockResolvedValue(null),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
  prisma: mockPrisma,
}));

jest.mock("../../lib/transaction", () => ({
  runInTransaction: (callback) => callback(mockPrisma),
}));

process.env.JWT_ACCESS_SECRET = "test-shop-routes-secret-key-123456";
env.JWT_ACCESS_SECRET = "test-shop-routes-secret-key-123456";

const app = require("../../app");

describe("Shop Feature Routes", () => {
  const userId = "user-123";
  const sessionId = "session-123";
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    token = jwt.sign(
      { sub: userId, role: "CUSTOMER", sessionId },
      env.JWT_ACCESS_SECRET
    );
  });

  const mockShop = {
    id: "shop-123",
    name: "Aman Grocery",
    username: "aman-grocery",
    slug: "aman-grocery",
    description: "Store",
    status: "ACTIVE",
    verificationStatus: "VERIFIED",
    ratingAvg: 4.0,
    ratingCount: 10,
    viewCount: 15,
    leadCount: 2,
    category: { id: "cat-1", name: "Grocery" },
    logo: null,
    cover: null,
    address: { city: "Navsari", latitude: 20.95, longitude: 72.95 },
    contact: { phone: "9876543210", acceptCalls: true },
    timings: [],
    photos: [],
    paymentMethods: [],
    languages: [],
    tags: [],
  };

  describe("GET /api/v1/shops/:shopId", () => {
    it("should return shop profile details successfully", async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(mockShop);
      mockPrisma.shop.update.mockResolvedValue(mockShop);
      mockPrisma.product.count.mockResolvedValue(10);
      mockPrisma.review.count.mockResolvedValue(5);

      const res = await request(app)
        .get("/api/v1/shops/aman-grocery")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("shop-123");
      expect(res.body.data.stats.productCount).toBe(10);
    });

    it("should return 404 if shop not found", async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/shops/does-not-exist")
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("SHOP_NOT_FOUND");
    });
  });

  describe("GET /api/v1/shops/:shopId/products", () => {
    it("should return paginated shop products", async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(mockShop);
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: "prod-1",
          name: "Amul Butter",
          slug: "amul-butter",
          pricePaise: 25000,
          currency: "INR",
          status: "ACTIVE",
          stockStatus: "IN_STOCK",
          stockAvailable: true,
          ratingAvg: 4.5,
          reviewCount: 3,
          viewCount: 15,
          images: [],
          category: { id: "cat-1", name: "Grocery" },
          brand: { id: "brand-1", name: "Amul" },
          shop: mockShop,
        },
      ]);

      const res = await request(app)
        .get("/api/v1/shops/aman-grocery/products")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe("prod-1");
    });
  });

  describe("POST /api/v1/shops/:shopId/reviews", () => {
    it("should create shop review successfully when authenticated", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, role: "CUSTOMER", status: "ACTIVE" });
      mockPrisma.session.findUnique.mockResolvedValue({ id: sessionId, revokedAt: null, expiresAt: new Date(Date.now() + 10000) });
      mockPrisma.shop.findFirst.mockResolvedValue(mockShop);
      mockPrisma.review.findFirst.mockResolvedValue(null);
      mockPrisma.review.create.mockResolvedValue({
        id: "rev-1",
        rating: 4,
        comment: "Neat place!",
        verifiedPurchase: false,
        createdAt: new Date(),
      });
      mockPrisma.review.aggregate.mockResolvedValue({
        _count: { _all: 1 },
        _avg: { rating: 4.0 },
      });
      mockPrisma.review.findUnique.mockResolvedValue({
        id: "rev-1",
        rating: 4,
        comment: "Neat place!",
        verifiedPurchase: false,
        createdAt: new Date(),
        user: { id: userId, name: "Customer", avatar: null },
        media: [],
      });

      const res = await request(app)
        .post("/api/v1/shops/aman-grocery/reviews")
        .set("Authorization", `Bearer ${token}`)
        .send({ rating: 4, comment: "Neat place!" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("rev-1");
    });

    it("should return 401 if unauthenticated", async () => {
      await request(app)
        .post("/api/v1/shops/aman-grocery/reviews")
        .send({ rating: 4, comment: "Neat place!" })
        .expect(401);
    });
  });

  describe("GET /api/v1/shops/:shopId/updates", () => {
    it("should return paginated updates", async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(mockShop);
      mockPrisma.shopUpdate.count.mockResolvedValue(1);
      mockPrisma.shopUpdate.findMany.mockResolvedValue([
        {
          id: "up-1",
          shopId: "shop-123",
          title: "Closed on Diwali",
          body: "Happy Diwali!",
          publishedAt: new Date(),
          expiresAt: null,
          createdAt: new Date(),
          media: null,
        },
      ]);

      const res = await request(app)
        .get("/api/v1/shops/aman-grocery/updates")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe("Closed on Diwali");
    });
  });

  describe("POST /api/v1/shops/:shopId/lead", () => {
    it("should track shop lead successfully", async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(mockShop);
      mockPrisma.shopLead.create.mockResolvedValue({ id: "lead-1" });

      const res = await request(app)
        .post("/api/v1/shops/aman-grocery/lead")
        .send({ source: "SEARCH", action: "MAP_OPEN" })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
