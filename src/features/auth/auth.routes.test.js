const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

// Mock prisma client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  session: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  otpCode: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  authAccount: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
  prisma: mockPrisma,
}));

// Set env secret for testing
process.env.JWT_ACCESS_SECRET = "test-auth-routes-secret-key-123456";
env.JWT_ACCESS_SECRET = "test-auth-routes-secret-key-123456";
env.ACCESS_TOKEN_TTL = "15m";

const app = require("../../app");

describe("Auth Feature Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/auth/signup", () => {
    it("should sign up a user successfully and return tokens", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: "user-123",
        name: "Arion",
        email: "arion@example.com",
        phone: null,
        username: "arion",
        role: "CUSTOMER",
        status: "ACTIVE",
        profile: {},
      });

      mockPrisma.session.create.mockResolvedValue({
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: "hash-token",
        expiresAt: new Date(Date.now() + 100000),
      });

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          name: "Arion",
          email: "arion@example.com",
          password: "Password123!",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe("arion@example.com");
    });

    it("should return validation error if email and phone are both missing", async () => {
      await request(app)
        .post("/api/v1/auth/signup")
        .send({
          name: "Arion",
          password: "Password123!",
        })
        .expect(400);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should authenticate user and return session tokens", async () => {
      const passHash = await bcrypt.hash("Password123!", 10);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-123",
        name: "Arion",
        email: "arion@example.com",
        passwordHash: passHash,
        role: "CUSTOMER",
        status: "ACTIVE",
        profile: {},
      });

      mockPrisma.session.create.mockResolvedValue({
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: "hash-token",
        expiresAt: new Date(Date.now() + 100000),
      });

      mockPrisma.user.update.mockResolvedValue({});

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "arion@example.com",
          password: "Password123!",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it("should return 400 on incorrect password", async () => {
      const passHash = await bcrypt.hash("Password123!", 10);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-123",
        name: "Arion",
        email: "arion@example.com",
        passwordHash: passHash,
        role: "CUSTOMER",
        status: "ACTIVE",
        profile: {},
      });

      await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "arion@example.com",
          password: "wrong-password",
        })
        .expect(400);
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("should rotate refresh tokens and return new tokens", async () => {
      const crypto = require("crypto");
      const oldToken = "old-refresh-token";
      const oldHash = crypto.createHash("sha256").update(oldToken).digest("hex");

      mockPrisma.session.findFirst.mockResolvedValue({
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: oldHash,
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
        user: {
          id: "user-123",
          role: "CUSTOMER",
        },
      });

      mockPrisma.session.update.mockResolvedValue({
        id: "session-123",
        userId: "user-123",
        refreshTokenHash: "new-hash",
        expiresAt: new Date(Date.now() + 100000),
      });

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: oldToken })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should log out the session", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        role: "CUSTOMER",
        status: "ACTIVE",
      });
      mockPrisma.session.findUnique.mockResolvedValue({
        id: "session-123",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });

      const token = jwt.sign(
        { sub: "user-123", role: "CUSTOMER", sessionId: "session-123" },
        env.JWT_ACCESS_SECRET
      );

      const res = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "session-123" },
        })
      );
    });
  });
});
