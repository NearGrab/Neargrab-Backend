const onboardingService = require("./onboarding.service");
const { AppError } = require("../../lib/errors");

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  shop: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    _findFirstShopOverride: null,
    _findFirstTakenOverride: null,
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
  shopPhoto: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    create: jest.fn(),
  },
  mediaAsset: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  category: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
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

describe("OnboardingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma.shop._findFirstShopOverride = null;
    mockPrisma.shop._findFirstTakenOverride = null;

    mockPrisma.shop.findFirst.mockImplementation((args) => {
      // If checking username/slug uniqueness
      if (args && args.where && (args.where.username || args.where.slug || args.where.OR)) {
        return Promise.resolve(mockPrisma.shop._findFirstTakenOverride);
      }
      return Promise.resolve(mockPrisma.shop._findFirstShopOverride);
    });

    // Setup robust default mocks
    mockPrisma.mediaAsset.findUnique.mockImplementation((args) => {
      const id = args.where.id;
      return Promise.resolve({ id, url: `http://example.com/${id}.jpg` });
    });
    mockPrisma.mediaAsset.create.mockImplementation((args) => {
      return Promise.resolve({ id: "media-created", url: args.data.url });
    });
  });

  const dummyUserId = "user-123";

  describe("getOnboardingState", () => {
    it("should return null state if shop draft does not exist", async () => {
      mockPrisma.shop._findFirstShopOverride = null;

      const result = await onboardingService.getOnboardingState(dummyUserId);

      expect(result.shop).toBeNull();
      expect(result.completion.submittable).toBe(false);
      expect(result.completion.missing).toContain("details.name");
    });

    it("should return mapped state if shop exists", async () => {
      const mockShop = {
        id: "shop-123",
        name: "Test Shop",
        username: "test-shop",
        slug: "test-shop",
        categoryId: "cat-1",
        category: { id: "cat-1", name: "Grocery Store", slug: "grocery-store" },
        type: "Retail",
        establishedYear: 2020,
        description: "Test description",
        gstNumber: null,
        panNumber: null,
        status: "DRAFT",
        verificationStatus: "UNVERIFIED",
        logo: null,
        cover: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        address: null,
        contact: null,
        timings: [],
        paymentMethods: [],
        languages: [],
        tags: [],
        photos: [],
      };

      mockPrisma.shop._findFirstShopOverride = mockShop;

      const result = await onboardingService.getOnboardingState(dummyUserId);

      expect(result.shop.id).toBe("shop-123");
      expect(result.shop.name).toBe("Test Shop");
      expect(result.completion.details).toBe(true);
    });
  });

  describe("startDraft", () => {
    it("should throw error if user status is not ACTIVE", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ status: "INACTIVE" });

      await expect(
        onboardingService.startDraft(dummyUserId, { name: "New", username: "new-shop" })
      ).rejects.toThrow(AppError);
    });

    it("should return existing onboarding state if shop already exists", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ status: "ACTIVE" });
      const mockShop = {
        id: "shop-123",
        name: "Test Shop",
        username: "test-shop",
        slug: "test-shop",
        categoryId: null,
        type: null,
        establishedYear: null,
        description: null,
        gstNumber: null,
        panNumber: null,
        status: "DRAFT",
        verificationStatus: "UNVERIFIED",
        logo: null,
        cover: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.shop._findFirstShopOverride = mockShop;

      const result = await onboardingService.startDraft(dummyUserId, { name: "Test Shop", username: "test-shop" });

      expect(result.shop.id).toBe("shop-123");
    });

    it("should throw error if username is taken", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ status: "ACTIVE" });
      mockPrisma.shop._findFirstShopOverride = null;
      mockPrisma.shop._findFirstTakenOverride = { id: "other-shop" };

      await expect(
        onboardingService.startDraft(dummyUserId, { name: "Test", username: "taken-username" })
      ).rejects.toThrow(AppError);
    });

    it("should create a new draft shop", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ status: "ACTIVE" });
      mockPrisma.shop._findFirstShopOverride = null;
      mockPrisma.shop.create.mockResolvedValue({
        id: "shop-new",
        name: "Test Shop",
        username: "test-shop",
        slug: "test-shop",
        status: "DRAFT",
        verificationStatus: "UNVERIFIED",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await onboardingService.startDraft(dummyUserId, { name: "Test Shop", username: "test-shop" });

      expect(result.shop.id).toBe("shop-new");
      expect(mockPrisma.shop.create).toHaveBeenCalled();
    });
  });

  describe("updateDetails", () => {
    it("should throw error if shop is locked", async () => {
      mockPrisma.shop._findFirstShopOverride = {
        id: "shop-123",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      await expect(
        onboardingService.updateDetails(dummyUserId, { name: "A", username: "b" })
      ).rejects.toThrow(AppError);
    });

    it("should update details successfully", async () => {
      const mockShop = {
        id: "shop-123",
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      mockPrisma.shop._findFirstShopOverride = mockShop;
      mockPrisma.category.findUnique.mockResolvedValue({ id: "cat-1" });
      mockPrisma.shop.update.mockResolvedValue(mockShop);

      const result = await onboardingService.updateDetails(dummyUserId, {
        name: "Updated Name",
        username: "updated-username",
        categoryId: "cat-1",
        type: "Retail",
        description: "New description text",
      });

      expect(mockPrisma.shop.update).toHaveBeenCalled();
    });
  });

  describe("updateAddress", () => {
    it("should upsert address details", async () => {
      const mockShop = {
        id: "shop-123",
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      mockPrisma.shop._findFirstShopOverride = mockShop;
      mockPrisma.shopAddress.upsert.mockResolvedValue({});

      const result = await onboardingService.updateAddress(dummyUserId, {
        street: "Main St",
        landmark: "Mall",
        city: "Navsari",
        state: "Gujarat",
        pincode: "396445",
        coordinates: { lat: 21.0, lng: 73.0 },
        serviceRadiusKm: 5,
      });

      expect(mockPrisma.shopAddress.upsert).toHaveBeenCalled();
    });
  });

  describe("updateContact", () => {
    it("should upsert contact and recreate timing records", async () => {
      const mockShop = {
        id: "shop-123",
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      mockPrisma.shop._findFirstShopOverride = mockShop;
      mockPrisma.shopContact.upsert.mockResolvedValue({});

      const result = await onboardingService.updateContact(dummyUserId, {
        phone: "9876543210",
        whatsapp: "9876543210",
        openingTime: "09:00 AM",
        closingTime: "09:00 PM",
        weekdays: ["Mon", "Tue"],
      });

      expect(mockPrisma.shopContact.upsert).toHaveBeenCalled();
      expect(mockPrisma.shopTiming.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.shopTiming.createMany).toHaveBeenCalled();
    });
  });

  describe("updateBusiness", () => {
    it("should recreate languages, tags, and payment methods", async () => {
      const mockShop = {
        id: "shop-123",
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      mockPrisma.shop._findFirstShopOverride = mockShop;

      const result = await onboardingService.updateBusiness(dummyUserId, {
        languages: ["English", "Hindi"],
        tags: ["Groceries"],
        digitalPayments: true,
        upiId: "test@upi",
      });

      expect(mockPrisma.shopLanguage.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.shopTag.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.shopPaymentMethod.deleteMany).toHaveBeenCalled();
    });
  });

  describe("updatePhotos", () => {
    it("should recreate photos list", async () => {
      const mockShop = {
        id: "shop-123",
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      mockPrisma.shop._findFirstShopOverride = mockShop;

      const result = await onboardingService.updatePhotos(dummyUserId, {
        photos: [
          { mediaId: "media-1", kind: "front", sortOrder: 0 },
          { mediaId: "media-2", kind: "inside", sortOrder: 1 },
        ],
      });

      expect(mockPrisma.shopPhoto.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.shopPhoto.createMany).toHaveBeenCalled();
    });
  });

  describe("submitOnboarding", () => {
    it("should throw error if onboarding is incomplete", async () => {
      mockPrisma.shop._findFirstShopOverride = {
        id: "shop-123",
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      await expect(onboardingService.submitOnboarding(dummyUserId)).rejects.toThrow(AppError);
    });

    it("should submit onboarding successfully and update role & send notifications", async () => {
      const fullMockShop = {
        id: "shop-123",
        name: "Shop Complete",
        username: "shop-complete",
        slug: "shop-complete",
        categoryId: "cat-1",
        category: { id: "cat-1", name: "Grocery", slug: "grocery" },
        type: "Retail",
        establishedYear: 2020,
        description: "Full description is valid",
        gstNumber: null,
        panNumber: null,
        status: "DRAFT",
        verificationStatus: "UNVERIFIED",
        logo: null,
        cover: null,
        googleMapsUrl: "https://maps.google.com/?q=shop",
        city: "Navsari",
        createdAt: new Date(),
        updatedAt: new Date(),
        address: {
          street: "Main St",
          landmark: "Near temple",
          city: "Navsari",
          state: "Gujarat",
          pincode: "396445",
          latitude: 21.0,
          longitude: 73.0,
          serviceRadiusKm: 5,
        },
        contact: {
          phone: "9876543210",
          whatsapp: "9876543210",
          alternatePhone: null,
          email: null,
          acceptCalls: true,
          enableStockRequests: true,
          receiveNotifications: true,
        },
        timings: [
          { weekday: 1, opensAt: "09:00 AM", closesAt: "09:00 PM", isClosed: false }
        ],
        paymentMethods: [
          { method: "CASH", enabled: true }
        ],
        languages: [{ language: "English" }],
        tags: [{ tag: "Groceries" }],
        photos: [
          { mediaId: "m1", kind: "front", sortOrder: 0, media: { url: "front.jpg" } },
          { mediaId: "m2", kind: "inside", sortOrder: 1, media: { url: "inside.jpg" } },
          { mediaId: "m3", kind: "registration_doc", sortOrder: 0, media: { url: "lic.pdf" } },
        ],
      };

      mockPrisma.shop._findFirstShopOverride = fullMockShop;
      mockPrisma.user.findMany.mockResolvedValue([{ id: "admin-1" }]);

      const result = await onboardingService.submitOnboarding(dummyUserId);

      expect(mockPrisma.shop.update).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(createNotification).toHaveBeenCalled();
    });
  });
});
