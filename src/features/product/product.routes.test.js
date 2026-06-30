const request = require("supertest");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

// Mock prisma client
const mockPrisma = {
  product: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
  },
  savedProduct: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  review: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
    findUnique: jest.fn(),
    groupBy: jest.fn(),
  },
  reviewMedia: {
    createMany: jest.fn(),
  },
  reservation: {
    findFirst: jest.fn(),
  },
  productView: {
    create: jest.fn(),
  },
  feedback: {
    create: jest.fn(),
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

process.env.JWT_ACCESS_SECRET = "test-product-routes-secret-key-123456";
env.JWT_ACCESS_SECRET = "test-product-routes-secret-key-123456";

const app = require("../../app");

describe("Product Feature Routes", () => {
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

  const mockProduct = {
    id: "prod-1",
    name: "Test product",
    slug: "test-product",
    sku: "TEST-SKU",
    pricePaise: 5000,
    currency: "INR",
    status: "ACTIVE",
    stockStatus: "IN_STOCK",
    stockAvailable: true,
    ratingAvg: 4.5,
    reviewCount: 1,
    viewCount: 10,
    images: [],
    attributes: [],
    category: { id: "cat-1", name: "Cat", slug: "cat" },
    brand: { id: "brand-1", name: "Brand", slug: "brand" },
    shop: { id: "shop-1", name: "Shop Name", slug: "shop-name", address: { city: "Navsari" } },
  };

  describe("GET /api/v1/products/:productId", () => {
    it("should return product details successfully", async () => {
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.review.groupBy.mockResolvedValue([{ rating: 5, _count: { _all: 1 } }]);

      const res = await request(app)
        .get("/api/v1/products/test-product")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("prod-1");
      expect(res.body.data.reviewSummary.count).toBe(1);
    });

    it("should return 404 if product not found", async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/products/does-not-exist")
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND");
    });
  });

  describe("POST /api/v1/products/:productId/reviews", () => {
    it("should create review successfully when authenticated", async () => {
      // Mock auth lookup
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, role: "CUSTOMER", status: "ACTIVE" });
      mockPrisma.session.findUnique.mockResolvedValue({ id: sessionId, revokedAt: null, expiresAt: new Date(Date.now() + 10000) });

      // Mock service lookup
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.review.findFirst.mockResolvedValue(null); // No duplicates
      mockPrisma.review.create.mockResolvedValue({
        id: "rev-1",
        rating: 5,
        comment: "Amazing!",
        verifiedPurchase: false,
        createdAt: new Date(),
      });
      mockPrisma.review.aggregate.mockResolvedValue({
        _count: { _all: 1 },
        _avg: { rating: 5.0 },
      });
      mockPrisma.review.findUnique.mockResolvedValue({
        id: "rev-1",
        rating: 5,
        comment: "Amazing!",
        verifiedPurchase: false,
        createdAt: new Date(),
        user: { id: userId, name: "Test User", avatar: null },
        media: [],
      });

      const res = await request(app)
        .post("/api/v1/products/prod-1/reviews")
        .set("Authorization", `Bearer ${token}`)
        .send({ rating: 5, comment: "Amazing!" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("rev-1");
      expect(res.body.data.comment).toBe("Amazing!");
    });

    it("should return 401 if unauthenticated", async () => {
      await request(app)
        .post("/api/v1/products/prod-1/reviews")
        .send({ rating: 5, comment: "Amazing!" })
        .expect(401);
    });

    it("should return 400 on validation failure", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, role: "CUSTOMER", status: "ACTIVE" });
      mockPrisma.session.findUnique.mockResolvedValue({ id: sessionId, revokedAt: null, expiresAt: new Date(Date.now() + 10000) });

      await request(app)
        .post("/api/v1/products/prod-1/reviews")
        .set("Authorization", `Bearer ${token}`)
        .send({ rating: 10, comment: "" }) // Rating max 5, comment required
        .expect(400);
    });
  });

  describe("POST /api/v1/products/:productId/save", () => {
    it("should save product successfully", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, role: "CUSTOMER", status: "ACTIVE" });
      mockPrisma.session.findUnique.mockResolvedValue({ id: sessionId, revokedAt: null, expiresAt: new Date(Date.now() + 10000) });
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.savedProduct.upsert.mockResolvedValue({});

      const res = await request(app)
        .post("/api/v1/products/prod-1/save")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.saved).toBe(true);
    });
  });

  describe("POST /api/v1/products/:productId/view", () => {
    it("should track view successfully", async () => {
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.productView.create.mockResolvedValue({});
      mockPrisma.product.update.mockResolvedValue({});

      const res = await request(app)
        .post("/api/v1/products/prod-1/view")
        .send({ source: "SEARCH" })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /api/v1/products/:productId/feedback", () => {
    it("should create feedback successfully", async () => {
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.feedback.create.mockResolvedValue({ id: "feed-123" });

      const res = await request(app)
        .post("/api/v1/products/prod-1/feedback")
        .send({ type: "REPORT", message: "Broken image" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("feed-123");
    });
  });
});
