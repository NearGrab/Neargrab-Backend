const request = require("supertest");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
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
  prisma: mockPrisma,
}));

jest.mock("../notification/notification.service", () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));

process.env.JWT_ACCESS_SECRET = "test-onboarding-routes-secret-key-123456";
env.JWT_ACCESS_SECRET = "test-onboarding-routes-secret-key-123456";

const app = require("../../app");

describe("Shopkeeper Onboarding Feature Routes", () => {
  const userId = "user-123";
  const sessionId = "session-123";
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    token = jwt.sign(
      { sub: userId, role: "CUSTOMER", sessionId },
      env.JWT_ACCESS_SECRET
    );

    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      role: "CUSTOMER",
      status: "ACTIVE",
    });
    mockPrisma.session.findUnique.mockResolvedValue({
      id: sessionId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10000),
    });

    // Smart default mocks
    mockPrisma.shop._findFirstShopOverride = null;
    mockPrisma.shop._findFirstTakenOverride = null;

    mockPrisma.shop.findFirst.mockImplementation((args) => {
      // If doing a username check
      if (args && args.where && (args.where.username || args.where.slug || args.where.OR)) {
        return Promise.resolve(mockPrisma.shop._findFirstTakenOverride);
      }
      return Promise.resolve(
        mockPrisma.shop._findFirstShopOverride || {
          id: "shop-123",
          ownerId: userId,
          name: "Mock Shop",
          username: "mock-shop",
          slug: "mock-shop",
          status: "DRAFT",
          verificationStatus: "UNVERIFIED",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: null,
          contact: null,
          timings: [],
          paymentMethods: [],
          languages: [],
          tags: [],
          photos: [],
        }
      );
    });

    mockPrisma.category.findUnique.mockResolvedValue({
      id: "cat-1",
      name: "Grocery Store",
      slug: "grocery-store",
    });

    mockPrisma.mediaAsset.findUnique.mockImplementation((args) => {
      const id = args.where.id;
      return Promise.resolve({ id, url: `http://example.com/${id}.jpg` });
    });

    mockPrisma.mediaAsset.create.mockImplementation((args) => {
      return Promise.resolve({ id: "media-created", url: args.data.url });
    });
  });

  describe("GET /api/v1/shopkeeper/onboarding", () => {
    it("should return null state if no draft exists", async () => {
      mockPrisma.shop._findFirstShopOverride = null;
      mockPrisma.shop.findFirst.mockResolvedValueOnce(null); // Return null for the first get call

      const res = await request(app)
        .get("/api/v1/shopkeeper/onboarding")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.shop).toBeNull();
    });

    it("should return 401 if unauthenticated", async () => {
      await request(app).get("/api/v1/shopkeeper/onboarding").expect(401);
    });
  });

  describe("POST /api/v1/shopkeeper/onboarding", () => {
    it("should start a new draft successfully", async () => {
      mockPrisma.shop._findFirstShopOverride = null;
      mockPrisma.shop.findFirst.mockResolvedValueOnce(null); // getShopForUser returns null
      mockPrisma.shop.create.mockResolvedValue({
        id: "shop-123",
        name: "Patel Grocery",
        username: "patel-grocery",
        slug: "patel-grocery",
        status: "DRAFT",
        verificationStatus: "UNVERIFIED",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post("/api/v1/shopkeeper/onboarding")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Patel Grocery", username: "patel-grocery" })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.shop.id).toBe("shop-123");
    });

    it("should return 400 for invalid request body", async () => {
      await request(app)
        .post("/api/v1/shopkeeper/onboarding")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "", username: "invalid space in username" })
        .expect(400);
    });
  });

  describe("PATCH /api/v1/shopkeeper/onboarding/details", () => {
    it("should patch details successfully", async () => {
      mockPrisma.shop.update.mockResolvedValue({
        id: "shop-123",
        name: "Patel Grocery",
        username: "patel-grocery",
        slug: "patel-grocery",
        categoryId: "cat-1",
        type: "Retail Shop",
        description: "Local grocer",
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .patch("/api/v1/shopkeeper/onboarding/details")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Patel Grocery",
          username: "patel-grocery",
          categoryId: "cat-1",
          type: "Retail Shop",
          description: "Local grocer",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe("PATCH /api/v1/shopkeeper/onboarding/address", () => {
    it("should patch address successfully", async () => {
      mockPrisma.shopAddress.upsert.mockResolvedValue({});

      const res = await request(app)
        .patch("/api/v1/shopkeeper/onboarding/address")
        .set("Authorization", `Bearer ${token}`)
        .send({
          street: "Shop 12 GIDC Road",
          landmark: "Near temple",
          city: "Navsari",
          state: "Gujarat",
          pincode: "396445",
          coordinates: { lat: 20.94, lng: 72.95 },
          serviceRadiusKm: 5,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe("PATCH /api/v1/shopkeeper/onboarding/contact", () => {
    it("should patch contact successfully", async () => {
      mockPrisma.shopContact.upsert.mockResolvedValue({});
      mockPrisma.shopTiming.deleteMany.mockResolvedValue({});
      mockPrisma.shopTiming.createMany.mockResolvedValue({});

      const res = await request(app)
        .patch("/api/v1/shopkeeper/onboarding/contact")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone: "9876543210",
          whatsapp: "9876543210",
          openingTime: "09:00 AM",
          closingTime: "09:00 PM",
          weekdays: ["Mon", "Tue"],
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe("PATCH /api/v1/shopkeeper/onboarding/business", () => {
    it("should patch business successfully", async () => {
      mockPrisma.shopLanguage.deleteMany.mockResolvedValue({});
      mockPrisma.shopTag.deleteMany.mockResolvedValue({});
      mockPrisma.shopPaymentMethod.deleteMany.mockResolvedValue({});

      const res = await request(app)
        .patch("/api/v1/shopkeeper/onboarding/business")
        .set("Authorization", `Bearer ${token}`)
        .send({
          languages: ["English"],
          tags: ["Groceries"],
          digitalPayments: true,
          upiId: "patel@upi",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe("PATCH /api/v1/shopkeeper/onboarding/photos", () => {
    it("should patch photos successfully", async () => {
      mockPrisma.shopPhoto.deleteMany.mockResolvedValue({});
      mockPrisma.shopPhoto.createMany.mockResolvedValue({});

      const res = await request(app)
        .patch("/api/v1/shopkeeper/onboarding/photos")
        .set("Authorization", `Bearer ${token}`)
        .send({
          photos: [
            { mediaId: "media-1", kind: "front", sortOrder: 0 },
            { mediaId: "media-2", kind: "inside", sortOrder: 1 },
          ],
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /api/v1/shopkeeper/onboarding/submit", () => {
    it("should return 400 if draft is incomplete on submit", async () => {
      // The default mock shop is incomplete, so it should fail with 400.
      await request(app)
        .post("/api/v1/shopkeeper/onboarding/submit")
        .set("Authorization", `Bearer ${token}`)
        .expect(400);
    });
  });
});
