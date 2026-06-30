const productService = require("./product.service");

// Mock Prisma
const mockPrisma = {
  product: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
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
}));

jest.mock("../../lib/transaction", () => ({
  runInTransaction: (callback) => callback(mockPrisma),
}));

describe("ProductService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const dummyUser = { id: "user-123", role: "CUSTOMER" };

  describe("getProductDetail", () => {
    it("should return active product details and review summary", async () => {
      const mockProduct = {
        id: "prod-1",
        name: "Test Product",
        slug: "test-product",
        sku: "TEST-1",
        pricePaise: 1000,
        currency: "INR",
        status: "ACTIVE",
        stockStatus: "IN_STOCK",
        stockAvailable: true,
        ratingAvg: 4,
        reviewCount: 2,
        viewCount: 10,
        images: [{ id: "img-1", mediaId: "m-1", sortOrder: 1, media: { id: "m-1", url: "http://url" } }],
        attributes: [{ key: "color", value: "red" }],
        category: { id: "cat-1", name: "Cat", slug: "cat" },
        brand: { id: "brand-1", name: "Brand", slug: "brand" },
        shop: { id: "shop-1", name: "Shop", slug: "shop", address: { city: "Navsari", pincode: "123" } },
      };

      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.savedProduct.findUnique.mockResolvedValue({ userId: "user-123", productId: "prod-1" });
      mockPrisma.review.groupBy.mockResolvedValue([
        { rating: 5, _count: { _all: 1 } },
        { rating: 3, _count: { _all: 1 } },
      ]);
      mockPrisma.review.findMany.mockResolvedValue([{ rating: 5 }, { rating: 3 }]);

      const result = await productService.getProductDetail("test-product", dummyUser);

      expect(result.id).toBe("prod-1");
      expect(result.isSaved).toBe(true);
      expect(result.reviewSummary.count).toBe(2);
      expect(result.reviewSummary.breakdown["5"]).toBe(1);
      expect(result.reviewSummary.breakdown["3"]).toBe(1);
    });

    it("should throw 404 if product is inactive or not found", async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(productService.getProductDetail("test-product")).rejects.toThrow(
        "Product not found"
      );
    });
  });

  describe("getAvailableStores", () => {
    it("should return other stores selling the brand/category", async () => {
      const refProduct = { id: "prod-1", shopId: "shop-1", name: "Butter", brandId: "brand-1", categoryId: "cat-1" };
      mockPrisma.product.findFirst.mockResolvedValue(refProduct);

      const candidateProducts = [
        {
          id: "prod-2",
          name: "Amul Butter",
          pricePaise: 1200,
          stockStatus: "IN_STOCK",
          brandId: "brand-1",
          categoryId: "cat-1",
          shop: {
            id: "shop-2",
            name: "Other Shop",
            slug: "other-shop",
            address: { latitude: 20.95, longitude: 72.95 },
          },
        },
      ];
      mockPrisma.product.findMany.mockResolvedValue(candidateProducts);

      const result = await productService.getAvailableStores("prod-1", {
        latitude: 20.94,
        longitude: 72.94,
        radiusKm: 10,
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].shop.id).toBe("shop-2");
      expect(result.data[0].distanceKm).toBeDefined();
    });
  });

  describe("createProductReview", () => {
    it("should create a review, verify purchase and recalculate ratings", async () => {
      const mockProduct = { id: "prod-1", shopId: "shop-1", status: "ACTIVE" };
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.review.findFirst.mockResolvedValue(null);
      mockPrisma.reservation.findFirst.mockResolvedValue({ id: "res-1" });

      mockPrisma.review.create.mockResolvedValue({
        id: "rev-1",
        rating: 5,
        comment: "Great product",
        verifiedPurchase: true,
        createdAt: new Date(),
        user: { id: "user-123", name: "Asha", avatar: null },
      });

      mockPrisma.review.aggregate.mockResolvedValue({
        _count: { _all: 5 },
        _avg: { rating: 4.2 },
      });

      mockPrisma.review.findUnique.mockResolvedValue({
        id: "rev-1",
        rating: 5,
        comment: "Great product",
        verifiedPurchase: true,
        createdAt: new Date(),
        user: { id: "user-123", name: "Asha", avatar: null },
        media: [],
      });

      const input = { rating: 5, comment: "Great product", reservationId: "res-1" };
      const review = await productService.createProductReview("prod-1", input, dummyUser);

      expect(review.id).toBe("rev-1");
      expect(review.verifiedPurchase).toBe(true);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: { ratingAvg: 4.2, reviewCount: 5 },
      });
    });

    it("should throw 409 conflict if review already exists", async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: "prod-1" });
      mockPrisma.review.findFirst.mockResolvedValue({ id: "rev-existing" });

      await expect(
        productService.createProductReview("prod-1", { rating: 5, comment: "Yo" }, dummyUser)
      ).rejects.toThrow("You have already reviewed this product");
    });
  });

  describe("saveProduct and unsaveProduct", () => {
    it("should save product successfully", async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: "prod-1" });
      mockPrisma.savedProduct.upsert.mockResolvedValue({});

      const result = await productService.saveProduct("prod-1", dummyUser);
      expect(result.saved).toBe(true);
    });

    it("should unsave product successfully", async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: "prod-1" });
      mockPrisma.savedProduct.delete.mockResolvedValue({});

      const result = await productService.unsaveProduct("prod-1", dummyUser);
      expect(result.saved).toBe(false);
    });
  });

  describe("trackProductView", () => {
    it("should log product views", async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: "prod-1", shopId: "shop-1" });

      const result = await productService.trackProductView("prod-1", { source: "SEARCH" }, dummyUser);
      expect(result.success).toBe(true);
      expect(mockPrisma.productView.create).toHaveBeenCalled();
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: { viewCount: { increment: 1 } },
      });
    });
  });
});
