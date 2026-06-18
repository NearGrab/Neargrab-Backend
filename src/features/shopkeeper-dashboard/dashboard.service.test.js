const dashboardService = require("./dashboard.service");
const { AppError } = require("../../lib/errors");

const mockPrisma = {
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
    findMany: jest.fn(),
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
  userFollow: {
    count: jest.fn().mockResolvedValue(0),
  },
  savedProduct: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  productAnalytics: {
    aggregate: jest.fn().mockResolvedValue({ _sum: { totalClicks: 0 } }),
    create: jest.fn(),
    upsert: jest.fn(),
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
  productAttribute: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  productImage: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  },
  banner: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

jest.mock("../notification/notification.service", () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));

const { createNotification } = require("../notification/notification.service");

describe("DashboardService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const dummyUserId = "user-111";
  const mockShop = {
    id: "shop-111",
    ownerId: dummyUserId,
    name: "Patel General Store",
    username: "patelgeneralstore",
    slug: "patel-general-store",
    status: "ACTIVE",
    verificationStatus: "VERIFIED",
    ratingAvg: 4.5,
    ratingCount: 12,
  };

  describe("getShopkeeperShop", () => {
    it("should throw error if shop does not exist", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(null);

      await expect(dashboardService.getShopkeeperShop(dummyUserId)).rejects.toThrow(AppError);
    });

    it("should throw error if shop is in DRAFT status", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue({ ...mockShop, status: "DRAFT" });

      await expect(dashboardService.getShopkeeperShop(dummyUserId)).rejects.toThrow(AppError);
    });

    it("should return the shop if active", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(mockShop);

      const result = await dashboardService.getShopkeeperShop(dummyUserId);
      expect(result.id).toBe("shop-111");
    });
  });

  describe("getDashboardStats", () => {
    it("should calculate stats aggregates and trend lines", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(mockShop);
      mockPrisma.productView.findMany.mockResolvedValue([
        { id: "pv-1", createdAt: new Date() },
      ]);
      mockPrisma.shopLead.findMany.mockResolvedValue([
        { id: "sl-1", source: "SHOP_PROFILE", metadata: { action: "SHOP_PROFILE_VIEW" }, createdAt: new Date() },
        { id: "sl-2", source: "MAP_VIEW", metadata: { action: "MAP_OPEN" }, createdAt: new Date() },
      ]);
      mockPrisma.savedProduct.findMany.mockResolvedValue([]);
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.review.findMany.mockResolvedValue([]);

      const result = await dashboardService.getDashboardStats(dummyUserId);

      expect(result.shop.id).toBe("shop-111");
      expect(result.stats.views.trend).toHaveLength(7);
      expect(result.stats.views.trend[6]).toBe(1); // Today has 1 view
    });
  });

  describe("updateShopProfile", () => {
    it("should update shop properties and details inside transaction", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(mockShop);
      mockPrisma.shop.update.mockResolvedValue(mockShop);

      const updateInput = {
        name: "New Store Name",
        description: "Updated description",
        address: { street: "123 Main St", city: "Navsari", pincode: "396445" },
        contact: { phone: "9876543210", whatsapp: "9876543210" },
      };

      await dashboardService.updateShopProfile(dummyUserId, updateInput);

      expect(mockPrisma.shop.update).toHaveBeenCalled();
      expect(mockPrisma.shopAddress.upsert).toHaveBeenCalled();
      expect(mockPrisma.shopContact.upsert).toHaveBeenCalled();
    });
  });

  describe("replaceShopTimings", () => {
    it("should delete existing timings and create new timings atomically", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(mockShop);
      mockPrisma.shopTiming.findMany.mockResolvedValue([]);

      const timingsInput = Array(7).fill(null).map((_, i) => ({
        weekday: i,
        opensAt: "09:00",
        closesAt: "21:00",
        isClosed: false,
      }));

      await dashboardService.replaceShopTimings(dummyUserId, timingsInput);

      expect(mockPrisma.shopTiming.deleteMany).toHaveBeenCalledWith({ where: { shopId: "shop-111" } });
      expect(mockPrisma.shopTiming.createMany).toHaveBeenCalled();
    });
  });

  describe("updateReservationStatus", () => {
    const mockReservation = {
      id: "resv-111",
      shopId: "shop-111",
      userId: "user-cust",
      status: "REQUESTED",
    };

    it("should transition status from REQUESTED to ACCEPTED and send notification", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(mockShop);
      mockPrisma.reservation.findUnique.mockResolvedValue(mockReservation);
      mockPrisma.reservation.update.mockResolvedValue({ ...mockReservation, status: "ACCEPTED" });

      await dashboardService.updateReservationStatus(dummyUserId, "resv-111", { status: "ACCEPTED" });

      expect(mockPrisma.reservation.update).toHaveBeenCalled();
      expect(createNotification).toHaveBeenCalled();
    });

    it("should throw error for invalid status transitions", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(mockShop);
      mockPrisma.reservation.findUnique.mockResolvedValue({ ...mockReservation, status: "COMPLETED" });

      await expect(
        dashboardService.updateReservationStatus(dummyUserId, "resv-111", { status: "ACCEPTED" })
      ).rejects.toThrow(AppError);
    });
  });

  describe("Product Catalog Actions", () => {
    const mockProduct = {
      id: "prod-111",
      shopId: "shop-111",
      sku: "SKU-111",
      name: "Fortran Wheat 5kg",
      status: "ACTIVE",
    };

    it("should create a product successfully", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(mockShop);
      mockPrisma.product.findFirst.mockResolvedValue(null); // SKU not taken
      mockPrisma.product.create.mockResolvedValue(mockProduct);
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      const result = await dashboardService.createShopProduct(dummyUserId, {
        name: "Fortran Wheat 5kg",
        sku: "SKU-111",
        pricePaise: 25000,
        stockStatus: "IN_STOCK",
      });

      expect(result.sku).toBe("SKU-111");
      expect(mockPrisma.product.create).toHaveBeenCalled();
    });

    it("should throw error if SKU is already taken", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(mockShop);
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct); // SKU taken

      await expect(
        dashboardService.createShopProduct(dummyUserId, {
          name: "Fortran Wheat 5kg",
          sku: "SKU-111",
          pricePaise: 25000,
        })
      ).rejects.toThrow(AppError);
    });

    it("should soft-delete a product", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(mockShop);
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);

      await dashboardService.deleteShopProduct(dummyUserId, "prod-111");

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: "prod-111" },
        data: expect.objectContaining({ status: "INACTIVE" }),
      });
    });

    it("should execute bulk actions on catalog products", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(mockShop);
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);

      await dashboardService.bulkUpdateShopProducts(dummyUserId, {
        productIds: ["prod-111"],
        action: "toggle_stock",
        stockAvailable: false,
      });

      expect(mockPrisma.product.updateMany).toHaveBeenCalled();
    });
  });

  describe("Promotions Actions", () => {
    const mockBanner = {
      id: "banner-111",
      title: "Weekend Sale 20% Off",
      shopId: "shop-111",
      city: "Navsari",
      section: "TOP_CAROUSEL",
      status: "DRAFT",
      devices: ["MOBILE", "DESKTOP"],
      plan: "PROMOTION",
      imageId: "media-111",
      startAt: new Date(),
      endAt: new Date(),
    };

    it("should successfully create a promotion request", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(mockShop);
      mockPrisma.mediaAsset.findUnique.mockResolvedValue({
        id: "media-111",
        ownerId: dummyUserId,
      });
      mockPrisma.banner.create.mockResolvedValue(mockBanner);

      const result = await dashboardService.createPromotionRequest(dummyUserId, {
        description: "Weekend Sale 20% Off",
        mediaId: "media-111",
      });

      expect(result.id).toBe("banner-111");
      expect(mockPrisma.banner.create).toHaveBeenCalled();
    });

    it("should throw error if media asset does not exist", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(mockShop);
      mockPrisma.mediaAsset.findUnique.mockResolvedValue(null);

      await expect(
        dashboardService.createPromotionRequest(dummyUserId, {
          description: "Weekend Sale 20% Off",
          mediaId: "media-invalid",
        })
      ).rejects.toThrow(AppError);
    });

    it("should successfully list promotion requests", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(mockShop);
      mockPrisma.banner.findMany.mockResolvedValue([mockBanner]);

      const result = await dashboardService.listPromotionRequests(dummyUserId);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Weekend Sale 20% Off");
      expect(mockPrisma.banner.findMany).toHaveBeenCalled();
    });
  });
});
