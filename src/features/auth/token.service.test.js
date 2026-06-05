const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const tokenService = require("./token.service");
const { AppError } = require("../../lib/errors");
const env = require("../../config/env");

// Mock prisma client
const mockPrisma = {
  session: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};
jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

process.env.JWT_ACCESS_SECRET = "test-token-service-secret-key-123456";
env.JWT_ACCESS_SECRET = "test-token-service-secret-key-123456";
env.ACCESS_TOKEN_TTL = "15m";

describe("TokenService", () => {
  const userId = "user-123";
  const user = { id: userId, role: "CUSTOMER" };
  const session = { id: "session-456" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateAccessToken", () => {
    it("should sign a JWT containing userId, role, and sessionId", () => {
      const token = tokenService.generateAccessToken(user, session);

      expect(token).toBeDefined();
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
      expect(decoded.sub).toBe(userId);
      expect(decoded.role).toBe("CUSTOMER");
      expect(decoded.sessionId).toBe("session-456");
    });
  });

  describe("createSession", () => {
    it("should create a database session and return session and raw refresh token", async () => {
      mockPrisma.session.create.mockImplementation(({ data }) => Promise.resolve({ id: "session-1", ...data }));

      const { session: newSession, rawRefreshToken } = await tokenService.createSession(userId, "Mozilla", "127.0.0.1");

      expect(rawRefreshToken).toHaveLength(80); // 40 bytes hex
      expect(newSession.userId).toBe(userId);
      expect(newSession.userAgent).toBe("Mozilla");
      expect(newSession.ipAddress).toBe("127.0.0.1");
      expect(newSession.refreshTokenHash).toBe(tokenService.hashToken(rawRefreshToken));
      expect(mockPrisma.session.create).toHaveBeenCalled();
    });
  });

  describe("rotateTokens", () => {
    it("should rotate refresh token and return new token pair", async () => {
      const oldRawToken = "old-raw-token";
      const oldHash = tokenService.hashToken(oldRawToken);

      mockPrisma.session.findFirst.mockResolvedValue({
        id: "session-1",
        userId,
        refreshTokenHash: oldHash,
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
        user,
      });

      mockPrisma.session.update.mockImplementation(({ data }) => Promise.resolve({
        id: "session-1",
        userId,
        ...data,
      }));

      const result = await tokenService.rotateTokens(oldRawToken, "Mozilla", "127.0.0.1");

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(oldRawToken);
      expect(mockPrisma.session.update).toHaveBeenCalled();
    });

    it("should reject rotation if session is not found", async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);

      await expect(
        tokenService.rotateTokens("invalid-raw-token")
      ).rejects.toThrow(expect.any(AppError));
    });

    it("should reject rotation if session is revoked", async () => {
      const oldRawToken = "old-raw-token";
      const oldHash = tokenService.hashToken(oldRawToken);

      mockPrisma.session.findFirst.mockResolvedValue({
        id: "session-1",
        userId,
        refreshTokenHash: oldHash,
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: new Date(),
        user,
      });

      await expect(
        tokenService.rotateTokens(oldRawToken)
      ).rejects.toThrow(expect.any(AppError));
    });
  });
});
