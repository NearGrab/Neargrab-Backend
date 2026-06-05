const request = require("supertest");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

// Mock prisma client
const mockPrisma = {
  product: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
  },
  category: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  brand: {
    findMany: jest.fn(),
  },
  searchEvent: {
    groupBy: jest.fn(),
    create: jest.fn(),
  },
  productRequest: {
    create: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
  prisma: mockPrisma,
}));

process.env.JWT_ACCESS_SECRET = "test-search-routes-secret-key-123456";
env.JWT_ACCESS_SECRET = "test-search-routes-secret-key-123456";

const app = require("../../app");

describe("Search Feature Routes", () => {
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

  describe("GET /api/v1/search/products", () => {
    it("should return list of products and pagination meta", async () => {
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
          reviewCount: 10,
          viewCount: 50,
          isPinned: false,
          images: [],
          category: { id: "cat-1", name: "Groceries", slug: "groceries" },
          brand: { id: "brand-1", name: "Amul", slug: "amul" },
          shop: {
            id: "shop-1",
            name: "Shop 1",
            slug: "shop-1",
            verificationStatus: "VERIFIED",
            address: { city: "Navsari", pincode: "396445" },
          },
        },
      ]);

      const res = await request(app)
        .get("/api/v1/search/products")
        .query({ q: "butter", page: 1, limit: 10 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("Amul Butter");
      expect(res.body.meta.page).toBe(1);
    });
  });

  describe("GET /api/v1/search/suggestions", () => {
    it("should return autocomplete suggestion lists", async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ name: "Butter Milk" }]);
      mockPrisma.category.findMany.mockResolvedValue([]);
      mockPrisma.brand.findMany.mockResolvedValue([]);
      mockPrisma.searchEvent.groupBy.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/search/suggestions")
        .query({ q: "but", limit: 5 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.products).toHaveLength(1);
      expect(res.body.data.products[0].label).toBe("Butter Milk");
    });
  });

  describe("POST /api/v1/search/events", () => {
    it("should track events anonymously", async () => {
      mockPrisma.searchEvent.create.mockResolvedValue({ id: "event-1" });

      const res = await request(app)
        .post("/api/v1/search/events")
        .send({ query: "butter", resultCount: 10, city: "Navsari" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("event-1");
    });

    it("should track events with user ID when authenticated", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, status: "ACTIVE" });
      mockPrisma.session.findUnique.mockResolvedValue({
        id: sessionId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      mockPrisma.searchEvent.create.mockResolvedValue({ id: "event-2" });

      const res = await request(app)
        .post("/api/v1/search/events")
        .set("Authorization", `Bearer ${token}`)
        .send({ query: "cheese", resultCount: 2 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(mockPrisma.searchEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          query: "cheese",
          resultCount: 2,
        }),
      });
    });
  });

  describe("POST /api/v1/product-requests", () => {
    it("should create custom request successfully", async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: "cat-1", name: "Food" });
      mockPrisma.productRequest.create.mockResolvedValue({
        id: "req-1",
        query: "waffles",
        categoryId: "cat-1",
        status: "open",
      });

      const res = await request(app)
        .post("/api/v1/product-requests")
        .send({ query: "waffles", categoryId: "cat-1" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("req-1");
    });

    it("should fail validation if query is empty", async () => {
      await request(app)
        .post("/api/v1/product-requests")
        .send({ query: "" })
        .expect(400);
    });
  });
});
