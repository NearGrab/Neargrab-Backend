const request = require("supertest");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

// Mock prisma client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
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
  userFollow: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  review: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  reviewVote: {
    aggregate: jest.fn(),
  },
  savedProduct: {
    count: jest.fn(),
  },
  reservation: {
    findMany: jest.fn(),
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

  describe("GET /api/v1/users/:username/profile", () => {
    it("should return the public user profile", async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: sessionId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: userId,
        role: "CUSTOMER",
        status: "ACTIVE",
      }); // for authenticating the request
      
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "target-user-id",
        username: "target_user",
      }); // for resolving getUserByUsername

      mockPrisma.userProfile.findUnique.mockResolvedValue({
        userId: "target-user-id",
        bio: "Target user bio",
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "target-user-id",
        createdAt: new Date(),
        name: "Target User",
        username: "target_user",
        avatarId: null,
        city: "Navsari",
        state: "Gujarat",
        avatar: null,
      }); // for getProfile user info

      mockPrisma.review.aggregate.mockResolvedValue({
        _count: { id: 0 },
        _avg: { rating: null },
      });
      mockPrisma.reviewVote.aggregate.mockResolvedValue({
        _sum: { value: 0 },
      });
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.reservation.findMany.mockResolvedValue([]);
      mockPrisma.savedProduct.count.mockResolvedValue(0);
      mockPrisma.userFollow.count.mockResolvedValue(0);
      mockPrisma.userFollow.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/users/target_user/profile")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.username).toBe("target_user");
    });

    it("should return 404 if user not found", async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: sessionId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: userId,
        role: "CUSTOMER",
        status: "ACTIVE",
      }); // authentication
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // getUserByUsername not found

      const res = await request(app)
        .get("/api/v1/users/nonexistent/profile")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/users/:userId/follow", () => {
    it("should follow a user successfully", async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: sessionId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: userId,
        role: "CUSTOMER",
        status: "ACTIVE",
      }); // authentication
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "target-user-id",
        role: "CUSTOMER",
        status: "ACTIVE",
      }); // followUser target user check
      mockPrisma.userFollow.upsert.mockResolvedValue({
        followerId: userId,
        followingId: "target-user-id",
      });

      const res = await request(app)
        .post("/api/v1/users/target-user-id/follow")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.following).toBe(true);
    });
  });
});
