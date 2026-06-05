const request = require("supertest");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

// Mock prisma client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  session: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  userProfile: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  notificationPreference: {
    upsert: jest.fn(),
  },
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
  prisma: mockPrisma,
}));

process.env.JWT_ACCESS_SECRET = "test-user-routes-secret-key-123456";
env.JWT_ACCESS_SECRET = "test-user-routes-secret-key-123456";

const app = require("../../app");

describe("User Feature Routes", () => {
  const userId = "user-123";
  const sessionId = "session-123";
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    token = jwt.sign(
      { sub: userId, role: "CUSTOMER", sessionId },
      env.JWT_ACCESS_SECRET
    );
  });

  describe("GET /api/v1/me", () => {
    it("should return the authenticated user's profile and data", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        name: "Arion",
        email: "arion@example.com",
        role: "CUSTOMER",
        status: "ACTIVE",
        profile: { bio: "Hello" },
        shop: null,
      });
      mockPrisma.session.findUnique.mockResolvedValue({
        id: sessionId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });

      const res = await request(app)
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(userId);
      expect(res.body.data.profile.bio).toBe("Hello");
    });

    it("should return 401 if unauthorized", async () => {
      await request(app)
        .get("/api/v1/me")
        .expect(401);
    });
  });

  describe("PATCH /api/v1/me", () => {
    it("should update basic fields successfully", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: "CUSTOMER",
        status: "ACTIVE",
      });
      mockPrisma.session.findUnique.mockResolvedValue({
        id: sessionId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      mockPrisma.user.update.mockResolvedValue({
        id: userId,
        name: "New Name",
        email: "arion@example.com",
      });

      const res = await request(app)
        .patch("/api/v1/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "New Name" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("New Name");
    });
  });

  describe("DELETE /api/v1/me", () => {
    it("should soft-delete user and revoke sessions", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: "CUSTOMER",
        status: "ACTIVE",
      });
      mockPrisma.session.findUnique.mockResolvedValue({
        id: sessionId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      mockPrisma.user.update.mockResolvedValue({
        id: userId,
        status: "DEACTIVATED",
      });

      const res = await request(app)
        .delete("/api/v1/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: expect.objectContaining({ status: "DEACTIVATED" }),
        })
      );
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
        })
      );
    });
  });
});
