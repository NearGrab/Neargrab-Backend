const exploreService = require("./explore.service");

// Mock Prisma
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
  review: {
    findMany: jest.fn(),
  },
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

describe("ExploreService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("listCategories", () => {
    it("should list active categories sorted by name", async () => {
      mockPrisma.category.findMany.mockResolvedValue([
        { id: "cat-1", name: "Groceries", slug: "groceries", parentId: null, status: "active" },
        { id: "cat-2", name: "Electronics", slug: "electronics", parentId: null, status: "active" },
      ]);

      const res = await exploreService.listCategories({ status: "active" });

      expect(res).toHaveLength(2);
      expect(res[0].name).toBe("Groceries");
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "active", deletedAt: null },
        })
      );
    });

    it("should list subcategories when parentId is passed", async () => {
      mockPrisma.category.findMany.mockResolvedValue([
        { id: "cat-3", name: "Mobile Phones", slug: "mobile-phones", parentId: "cat-2", status: "active" },
      ]);

      const res = await exploreService.listCategories({ status: "active", parentId: "cat-2" });

      expect(res).toHaveLength(1);
      expect(res[0].parentId).toBe("cat-2");
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "active", deletedAt: null, parentId: "cat-2" },
        })
      );
    });
  });

  describe("listBrands", () => {
    it("should list active brands matching query q", async () => {
      mockPrisma.brand.findMany.mockResolvedValue([
        { id: "brand-1", name: "Amul", slug: "amul", status: "active" },
      ]);

      const res = await exploreService.listBrands({ status: "active", q: "amu" });

      expect(res).toHaveLength(1);
      expect(res[0].name).toBe("Amul");
      expect(mockPrisma.brand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: "active",
            deletedAt: null,
            name: { contains: "amu", mode: "insensitive" },
          },
        })
      );
    });
  });

  describe("getExploreFeed", () => {
    it("should compile products, banners, categories, and nearby shops", async () => {
      mockPrisma.category.findMany.mockResolvedValue([
        { id: "cat-1", name: "Groceries", slug: "groceries" },
      ]);
      mockPrisma.banner.findMany.mockResolvedValue([
        {
          id: "banner-1",
          title: "Summer Sale",
          section: "PROMOTIONAL",
          status: "ACTIVE",
          devices: ["ALL"],
          startAt: new Date(),
          endAt: new Date(),
        },
      ]);
      mockPrisma.shop.findMany.mockResolvedValue([
        {
          id: "shop-1",
          name: "Daily Mart",
          slug: "daily-mart",
          status: "ACTIVE",
          verificationStatus: "VERIFIED",
          address: {
            city: "Navsari",
            pincode: "396445",
            latitude: 20.9467,
            longitude: 72.952,
          },
        },
      ]);
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: "prod-1",
          name: "Amul Milk 1L",
          slug: "amul-milk-1l",
          pricePaise: 6000,
          currency: "INR",
          status: "ACTIVE",
          stockStatus: "IN_STOCK",
          stockAvailable: true,
          ratingAvg: 4.8,
          reviewCount: 15,
          viewCount: 120,
          isPinned: true,
          shopId: "shop-1",
          images: [],
          shop: {
            id: "shop-1",
            name: "Daily Mart",
            slug: "daily-mart",
            verificationStatus: "VERIFIED",
            address: { city: "Navsari", pincode: "396445" },
          },
        },
      ]);
      mockPrisma.review.findMany.mockResolvedValue([
        {
          id: "rev-1",
          rating: 5,
          comment: "Excellent quality!",
          createdAt: new Date(),
          user: { name: "John Doe", avatar: { url: "avatar.jpg" } },
          shop: { id: "shop-1", name: "Daily Mart" },
        }
      ]);

      const feed = await exploreService.getExploreFeed({
        city: "Navsari",
        latitude: 20.9467,
        longitude: 72.952,
        radiusKm: 5,
        device: "WEB",
      });

      expect(feed.city).toBe("Navsari");
      expect(feed.categories).toHaveLength(1);
      expect(feed.banners).toHaveLength(1);
      expect(feed.nearbyShops).toHaveLength(1);
      expect(feed.pinnedProducts).toHaveLength(1);
      expect(feed.realReviews).toHaveLength(1);
      expect(feed.realReviews[0].user).toBe("John Doe");
      expect(feed.realReviews[0].rating).toBe(5);
    });
  });

  describe("calculateDistance", () => {
    it("should accurately calculate distance using Haversine formula", () => {
      // Navsari (20.9467, 72.9520) to Surat (21.1702, 72.8311) is approx 28-30 km
      const distance = exploreService.calculateDistance(20.9467, 72.952, 21.1702, 72.8311);
      expect(distance).toBeGreaterThan(25);
      expect(distance).toBeLessThan(35);
    });
  });
});
