const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { AppError } = require("../lib/errors");

// Define prisma mock
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
  },
};

// Mock prisma config
jest.mock("../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

// Set up the test secret
process.env.JWT_ACCESS_SECRET = "test-jwt-access-secret-123456";
env.JWT_ACCESS_SECRET = "test-jwt-access-secret-123456";

const { authenticate, optionalAuth } = require("./auth.middleware");

describe("Auth Middleware", () => {
  let req;
  let res;
  let next;
  const userId = "user-123";
  const sessionId = "session-456";
  const role = "CUSTOMER";

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: {},
    };
    res = {};
    next = jest.fn();
  });

  const generateToken = (payload = {}) => {
    return jwt.sign(
      {
        sub: userId,
        role,
        sessionId,
        ...payload,
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: "1h" }
    );
  };

  describe("authenticate", () => {
    it("should return 401 if Authorization header is missing", async () => {
      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("UNAUTHENTICATED");
    });

    it("should return 401 if Authorization header does not start with Bearer", async () => {
      req.headers.authorization = "Basic token123";
      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it("should return 401 if JWT is invalid", async () => {
      req.headers.authorization = "Bearer invalid-jwt-signature";
      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it("should return 401 if user does not exist in DB", async () => {
      const token = generateToken();
      req.headers.authorization = `Bearer ${token}`;
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it("should return 401 if user is not ACTIVE in DB", async () => {
      const token = generateToken();
      req.headers.authorization = `Bearer ${token}`;
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: "CUSTOMER",
        status: "SUSPENDED",
      });

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it("should return 401 if session is revoked in DB", async () => {
      const token = generateToken();
      req.headers.authorization = `Bearer ${token}`;
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: "CUSTOMER",
        status: "ACTIVE",
      });
      mockPrisma.session.findUnique.mockResolvedValue({
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      });

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it("should authenticate, attach req.user, and call next if token and DB state are valid", async () => {
      const token = generateToken();
      req.headers.authorization = `Bearer ${token}`;
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: "CUSTOMER",
        status: "ACTIVE",
      });
      mockPrisma.session.findUnique.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
      });

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toEqual({
        id: userId,
        role: "CUSTOMER",
        sessionId,
      });
    });
  });

  describe("optionalAuth", () => {
    it("should set req.user = null and continue if Authorization header is missing", async () => {
      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeNull();
    });

    it("should set req.user = null and continue if token is invalid", async () => {
      req.headers.authorization = "Bearer invalid-token";
      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeNull();
    });

    it("should set req.user and continue if token and user status are valid", async () => {
      const token = generateToken();
      req.headers.authorization = `Bearer ${token}`;
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: "CUSTOMER",
        status: "ACTIVE",
      });
      mockPrisma.session.findUnique.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
      });

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toEqual({
        id: userId,
        role: "CUSTOMER",
        sessionId,
      });
    });
  });
});
