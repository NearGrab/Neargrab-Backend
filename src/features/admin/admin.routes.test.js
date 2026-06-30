const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  session: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  shop: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  product: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  review: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  feedback: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  banner: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  },
  pinRule: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  auditLog: {
    count: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  shopLead: {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  contentPage: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
  $queryRaw: jest.fn(),
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
  prisma: mockPrisma,
}));

process.env.JWT_ACCESS_SECRET = "test-admin-routes-secret-key-123456";
env.JWT_ACCESS_SECRET = "test-admin-routes-secret-key-123456";
env.ACCESS_TOKEN_TTL = "15m";

const app = require("../../app");

describe("Admin Feature Routes", () => {
  let adminToken;

  beforeEach(() => {
    jest.clearAllMocks();

    adminToken = jwt.sign(
      { sub: "admin-123", role: "SUPER_ADMIN", sessionId: "session-123" },
      env.JWT_ACCESS_SECRET
    );

    mockPrisma.session.findUnique.mockResolvedValue({
      id: "session-123",
      userId: "admin-123",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: "admin-123",
      name: "Admin User",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    });
  });

  describe("POST /api/v1/admin/auth/login", () => {
    it("should login successfully and return tokens", async () => {
      const passHash = await bcrypt.hash("Password123", 1);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "admin-123",
        email: "admin@example.com",
        passwordHash: passHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      });

      mockPrisma.session.create.mockResolvedValue({
        id: "session-123",
        userId: "admin-123",
        refreshTokenHash: "hash-token",
        expiresAt: new Date(Date.now() + 100000),
      });

      mockPrisma.user.update.mockResolvedValue({});

      const res = await request(app)
        .post("/api/v1/admin/auth/login")
        .send({
          email: "admin@example.com",
          password: "Password123",
        })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it("should return validation error for invalid email", async () => {
      await request(app)
        .post("/api/v1/admin/auth/login")
        .send({
          email: "invalid-email",
          password: "Pass",
        })
        .expect(400);
    });
  });

  describe("GET /api/v1/admin/dashboard", () => {
    it("should return dashboard summary for authorized admin", async () => {
      mockPrisma.user.count.mockResolvedValue(10);
      mockPrisma.shop.count.mockResolvedValue(5);
      mockPrisma.product.count.mockResolvedValue(100);
      mockPrisma.review.count.mockResolvedValue(2);
      mockPrisma.feedback.count.mockResolvedValue(1);
      mockPrisma.shopLead.count.mockResolvedValue(50);
      mockPrisma.shopLead.groupBy.mockResolvedValue([
        { source: "SEARCH", _count: { _all: 30 } },
        { source: "MAP_VIEW", _count: { _all: 20 } },
      ]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { city: "Surat", count: 50 },
      ]);
      mockPrisma.shopLead.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/admin/dashboard")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.systemSummary).toBeDefined();
    });

    it("should return 401 when token is missing", async () => {
      await request(app)
        .get("/api/v1/admin/dashboard")
        .expect(401);
    });

    it("should return 403 when role is CUSTOMER", async () => {
      const customerToken = jwt.sign(
        { sub: "cust-123", role: "CUSTOMER", sessionId: "session-123" },
        env.JWT_ACCESS_SECRET
      );

      mockPrisma.session.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "cust-123",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "cust-123",
        role: "CUSTOMER",
        status: "ACTIVE",
      });

      await request(app)
        .get("/api/v1/admin/dashboard")
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe("GET /api/v1/admin/analytics/visits", () => {
    it("should return route visits summary for authorized admin", async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ path: "/explore", totalVisits: 100, uniqueVisitors: 50 }])
        .mockResolvedValueOnce([{ count: 50 }]);

      const res = await request(app)
        .get("/api/v1/admin/analytics/visits")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.visits).toHaveLength(1);
      expect(res.body.data.visits[0].path).toBe("/explore");
      expect(res.body.data.totalUniqueVisitors).toBe(50);
    });
  });

  describe("PATCH /api/v1/admin/users/:userId", () => {
    it("should successfully update a user's status", async () => {
      const targetUser = {
        id: "user-999",
        role: "CUSTOMER",
        status: "ACTIVE",
      };

      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === "user-999") return Promise.resolve(targetUser);
        return Promise.resolve({ id: "admin-123", role: "SUPER_ADMIN", status: "ACTIVE" });
      });

      mockPrisma.user.update.mockResolvedValue({
        ...targetUser,
        status: "SUSPENDED",
      });

      const res = await request(app)
        .patch("/api/v1/admin/users/user-999")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "SUSPENDED" })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("SUSPENDED");
    });
  });

  describe("PATCH /api/v1/admin/shops/:shopId/verify", () => {
    it("should successfully verify a shop", async () => {
      const targetShop = {
        id: "shop-999",
        ownerId: "owner-1",
        status: "PENDING_REVIEW",
        verificationStatus: "PENDING",
      };

      mockPrisma.shop.findUnique.mockResolvedValue(targetShop);
      mockPrisma.shop.update.mockResolvedValue({
        ...targetShop,
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
      });

      const res = await request(app)
        .patch("/api/v1/admin/shops/shop-999/verify")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          status: "ACTIVE",
          verificationStatus: "VERIFIED",
          reason: "Approved by Admin",
        })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationStatus).toBe("VERIFIED");
    });
  });
});
