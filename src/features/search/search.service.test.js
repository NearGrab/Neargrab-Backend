const searchService = require("./search.service");
const { AppError } = require("../../lib/errors");

// Mock Prisma
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
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

describe("SearchService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("searchProducts", () => {
    it("should search products by text query and sort by relevance by default", async () => {
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

      const res = await searchService.searchProducts({
        q: "butter",
        page: 1,
        limit: 10,
        sort: "relevance",
      });

      expect(res.data).toHaveLength(1);
      expect(res.data[0].name).toBe("Amul Butter");
      expect(res.meta.total).toBe(1);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: { contains: "butter", mode: "insensitive" } }),
            ]),
          }),
        })
      );
    });

    it("should filter by city when city is passed", async () => {
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: "prod-1",
          name: "Butter Close",
          slug: "butter-close",
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
          shopId: "shop-1",
          shop: {
            id: "shop-1",
            name: "Shop 1",
            slug: "shop-1",
            city: "Navsari",
            verificationStatus: "VERIFIED",
            address: {
              city: "Navsari",
              pincode: "396445",
            },
          },
        },
      ]);

      const res = await searchService.searchProducts({
        q: "butter",
        city: "Navsari",
        page: 1,
        limit: 10,
      });

      expect(res.data).toHaveLength(1);
      expect(res.data[0].name).toBe("Butter Close");
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            shop: expect.objectContaining({
              city: { equals: "Navsari", mode: "insensitive" },
            }),
          }),
        })
      );
    });
  });

  describe("getSuggestions", () => {
    it("should aggregate categories, brands, products, and popular queries", async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ name: "Butter Milk" }]);
      mockPrisma.category.findMany.mockResolvedValue([{ name: "Groceries" }]);
      mockPrisma.brand.findMany.mockResolvedValue([{ name: "Amul" }]);
      mockPrisma.searchEvent.groupBy.mockResolvedValue([
        { query: "butter", _count: { query: 12 } },
      ]);

      const res = await searchService.getSuggestions({ q: "but", limit: 5 });

      expect(res.products).toContainEqual({ label: "Butter Milk", value: "Butter Milk", type: "product" });
      expect(res.categories).toContainEqual({ label: "Groceries", value: "Groceries", type: "category" });
      expect(res.brands).toContainEqual({ label: "Amul", value: "Amul", type: "brand" });
      expect(res.popular).toContainEqual({ label: "butter", value: "butter", type: "popular" });
    });
  });

  describe("trackSearchEvent", () => {
    it("should log the search event and return details", async () => {
      mockPrisma.searchEvent.create.mockResolvedValue({ id: "event-1" });

      const res = await searchService.trackSearchEvent(
        { query: "cheese", city: "Navsari", resultCount: 5 },
        "user-1"
      );

      expect(res.id).toBe("event-1");
      expect(mockPrisma.searchEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          query: "cheese",
          city: "Navsari",
          resultCount: 5,
        }),
      });
    });
  });

  describe("createProductRequest", () => {
    it("should throw error if categoryId does not exist", async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(
        searchService.createProductRequest({ query: "waffles", categoryId: "bad-cat" }, "user-1")
      ).rejects.toThrow(expect.any(AppError));
    });

    it("should create request successfully", async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: "cat-1", name: "Food" });
      mockPrisma.productRequest.create.mockResolvedValue({
        id: "req-1",
        query: "waffles",
        categoryId: "cat-1",
        status: "open",
      });

      const res = await searchService.createProductRequest(
        { query: "waffles", categoryId: "cat-1" },
        "user-1"
      );

      expect(res.id).toBe("req-1");
      expect(res.status).toBe("open");
    });
  });
});
