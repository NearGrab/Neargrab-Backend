const request = require("supertest");

// Mock prisma client
const mockPrisma = {
  category: {
    findMany: jest.fn(),
  },
  brand: {
    findMany: jest.fn(),
  },
  banner: {
    findMany: jest.fn(),
  },
  shop: {
    findMany: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
  },
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
  prisma: mockPrisma,
}));

process.env.JWT_ACCESS_SECRET = "test-explore-routes-secret-key-123456";

const app = require("../../app");

describe("Explore Feature Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/v1/categories", () => {
    it("should return public active categories", async () => {
      mockPrisma.category.findMany.mockResolvedValue([
        { id: "cat-1", name: "Groceries", slug: "groceries", parentId: null, status: "active" },
      ]);

      const res = await request(app)
        .get("/api/v1/categories")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].slug).toBe("groceries");
    });
  });

  describe("GET /api/v1/brands", () => {
    it("should return public active brands", async () => {
      mockPrisma.brand.findMany.mockResolvedValue([
        { id: "brand-1", name: "Amul", slug: "amul", status: "active" },
      ]);

      const res = await request(app)
        .get("/api/v1/brands")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].slug).toBe("amul");
    });
  });

  describe("GET /api/v1/explore", () => {
    it("should return explore feed data summary", async () => {
      mockPrisma.category.findMany.mockResolvedValue([
        { id: "cat-1", name: "Groceries", slug: "groceries" },
      ]);
      mockPrisma.banner.findMany.mockResolvedValue([]);
      mockPrisma.shop.findMany.mockResolvedValue([]);
      mockPrisma.product.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/explore")
        .query({ city: "Navsari" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.city).toBe("Navsari");
      expect(res.body.data.categories).toHaveLength(1);
      expect(res.body.data.nearbyShops).toHaveLength(0);
    });

    it("should reject invalid coordinates in validation", async () => {
      await request(app)
        .get("/api/v1/explore")
        .query({ latitude: 120, longitude: 72 }) // Latitude must be <= 90
        .expect(400);
    });
  });
});
