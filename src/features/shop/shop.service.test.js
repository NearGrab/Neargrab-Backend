const shopService = require("./shop.service");

// Mock Prisma
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
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

jest.mock("../../lib/transaction", () => ({
  runInTransaction: (callback) => callback(mockPrisma),
}));

describe("ShopService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const dummyUser = { id: "user-123", role: "CUSTOMER" };

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

  describe("getPublicShop", () => {
    it("should return public active shop details with stats", async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(mockShop);
      mockPrisma.product.count.mockResolvedValue(20);
      mockPrisma.review.count.mockResolvedValue(10);

      const result = await shopService.getPublicShop("aman-grocery");

      expect(result.id).toBe("shop-123");
      expect(result.stats.productCount).toBe(20);
      expect(result.stats.reviewCount).toBe(10);
    });

    it("should throw 404 if shop is not found or inactive", async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(null);

      await expect(shopService.getPublicShop("does-not-exist")).rejects.toThrow(
        "Shop not found"
      );
    });
  });

  describe("listShopProducts", () => {
    it("should list active products in the shop with pagination", async () => {
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

      const result = await shopService.listShopProducts("shop-123", {
        q: "butter",
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("prod-1");
      expect(result.meta.total).toBe(1);
    });
  });

  describe("createShopReview", () => {
    it("should create shop review, verify reservation and recalculate ratings", async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(mockShop);
      mockPrisma.review.findFirst.mockResolvedValue(null);
      mockPrisma.reservation.findFirst.mockResolvedValue({ id: "res-1" });

      mockPrisma.review.create.mockResolvedValue({
        id: "rev-123",
        rating: 5,
        comment: "Fast service!",
        verifiedPurchase: true,
        createdAt: new Date(),
      });

      mockPrisma.review.aggregate.mockResolvedValue({
        _count: { _all: 3 },
        _avg: { rating: 4.5 },
      });

      mockPrisma.review.findUnique.mockResolvedValue({
        id: "rev-123",
        rating: 5,
        comment: "Fast service!",
        verifiedPurchase: true,
        createdAt: new Date(),
        user: { id: "user-123", name: "Customer", avatar: null },
        media: [],
      });

      const input = { rating: 5, comment: "Fast service!", reservationId: "res-1" };
      const result = await shopService.createShopReview("shop-123", input, dummyUser);

      expect(result.id).toBe("rev-123");
      expect(result.verifiedPurchase).toBe(true);
      expect(mockPrisma.shop.update).toHaveBeenCalledWith({
        where: { id: "shop-123" },
        data: { ratingAvg: 4.5, ratingCount: 3 },
      });
    });

    it("should throw 409 conflict if review already exists", async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(mockShop);
      mockPrisma.review.findFirst.mockResolvedValue({ id: "rev-old" });

      await expect(
        shopService.createShopReview("shop-123", { rating: 5, comment: "Ok" }, dummyUser)
      ).rejects.toThrow("You have already reviewed this shop");
    });
  });

  describe("listShopUpdates", () => {
    it("should list published and active updates", async () => {
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

      const result = await shopService.listShopUpdates("shop-123", { page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("Closed on Diwali");
    });
  });

  describe("trackShopLead", () => {
    it("should track shop lead successfully", async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(mockShop);
      mockPrisma.shopLead.create.mockResolvedValue({ id: "lead-1" });

      const result = await shopService.trackShopLead(
        "shop-123",
        { source: "SHOP_PROFILE", action: "WHATSAPP_CLICK" },
        dummyUser
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.shopLead.create).toHaveBeenCalled();
      expect(mockPrisma.shop.update).toHaveBeenCalledWith({
        where: { id: "shop-123" },
        data: { leadCount: { increment: 1 } },
      });
    });
  });
});
