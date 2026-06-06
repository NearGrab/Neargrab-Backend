const request = require("supertest");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

const mockPrisma = {
  cart: {
    findUnique: jest.fn(),
  },
  cartItem: {
    deleteMany: jest.fn(),
  },
  product: {
    findFirst: jest.fn(),
  },
  shop: {
    findUnique: jest.fn(),
  },
  reservation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  reservationItem: {
    createMany: jest.fn(),
  },
  notificationPreference: {
    findUnique: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
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

process.env.JWT_ACCESS_SECRET = "test-reservation-routes-secret-key-123456";
env.JWT_ACCESS_SECRET = "test-reservation-routes-secret-key-123456";

const app = require("../../app");

describe("Reservation Feature Routes", () => {
  const userId = "user-123";
  const sessionId = "session-123";
  let token;
  let adminToken;

  beforeEach(() => {
    jest.clearAllMocks();
    token = jwt.sign(
      { sub: userId, role: "CUSTOMER", sessionId },
      env.JWT_ACCESS_SECRET
    );
    adminToken = jwt.sign(
      { sub: userId, role: "SUPER_ADMIN", sessionId },
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
  });

  describe("POST /api/v1/reservations", () => {
    it("should create direct reservation successfully", async () => {
      const mockProduct = {
        id: "prod-1",
        name: "Direct Product",
        pricePaise: 500,
        status: "ACTIVE",
        stockAvailable: true,
        stockStatus: "IN_STOCK",
        shopId: "shop-1",
        shop: {
          id: "shop-1",
          name: "Test Shop",
          status: "ACTIVE",
          deletedAt: null,
          ownerId: "owner-1",
        },
      };

      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.reservation.create.mockResolvedValue({
        id: "res-1",
        status: "REQUESTED",
        totalPaise: 1000,
      });
      mockPrisma.shop.findUnique.mockResolvedValue({
        id: "shop-1",
        name: "Test Shop",
        ownerId: "owner-1",
      });
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: "res-1",
        status: "REQUESTED",
        totalPaise: 1000,
        createdAt: new Date(),
        items: [
          {
            id: "rit-1",
            productId: "prod-1",
            quantity: 2,
            pricePaiseSnapshot: 500,
            product: { id: "prod-1", name: "Direct Product", slug: "direct" },
          },
        ],
        shop: { id: "shop-1", name: "Test Shop", slug: "test" },
      });

      const res = await request(app)
        .post("/api/v1/reservations")
        .set("Authorization", `Bearer ${token}`)
        .send({
          source: "direct",
          productId: "prod-1",
          quantity: 2,
          customerNote: "Please pack it",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("res-1");
    });
  });

  describe("GET /api/v1/reservations", () => {
    it("should list reservations with pagination meta", async () => {
      mockPrisma.reservation.count.mockResolvedValue(1);
      mockPrisma.reservation.findMany.mockResolvedValue([
        {
          id: "res-1",
          status: "REQUESTED",
          totalPaise: 1000,
          currency: "INR",
          createdAt: new Date(),
          shop: { id: "shop-1" },
          items: [],
        },
      ]);

      const res = await request(app)
        .get("/api/v1/reservations")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toBeDefined();
    });
  });

  describe("POST /api/v1/reservations/expire", () => {
    it("should allow admin role to trigger expiration", async () => {
      // Mock auth lookup for admin user
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      });

      mockPrisma.reservation.findMany.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/v1/reservations/expire")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(0);
    });

    it("should block non-admin customer role with 403", async () => {
      await request(app)
        .post("/api/v1/reservations/expire")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });
  });

  describe("PATCH /api/v1/reservations/:reservationId/cancel", () => {
    it("should cancel reservation successfully", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: "res-1",
        userId: userId,
        status: "REQUESTED",
        customerNote: "Hi",
        shop: { id: "shop-1", name: "Test Shop", ownerId: "owner-1" },
      });

      mockPrisma.reservation.update.mockResolvedValue({
        id: "res-1",
        status: "CANCELLED",
        totalPaise: 500,
        currency: "INR",
        customerNote: "Hi (Cancellation Reason: Cancel)",
        createdAt: new Date(),
        shop: { id: "shop-1", name: "Test Shop", ownerId: "owner-1" },
        items: [],
      });

      const res = await request(app)
        .patch("/api/v1/reservations/res-1/cancel")
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Cancel" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("CANCELLED");
    });
  });
});
