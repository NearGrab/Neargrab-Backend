const bcrypt = require("bcrypt");
const authService = require("./auth.service");
const tokenService = require("./token.service");
const otpService = require("./otp.service");
const { AppError } = require("../../lib/errors");

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  authAccount: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};
jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

// Mock TokenService and OtpService
jest.mock("./token.service", () => ({
  createSession: jest.fn(),
  generateAccessToken: jest.fn(),
  revokeAllUserSessions: jest.fn(),
}));

jest.mock("./otp.service", () => ({
  generateOtp: jest.fn(),
  verifyOtp: jest.fn(),
}));

describe("AuthService", () => {
  const email = "test@example.com";
  const password = "Password123!";
  const name = "Test User";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("signup", () => {
    it("should hash password and create a User record", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: "user-1",
        name,
        email,
        phone: null,
        username: "test",
        status: "ACTIVE",
        profile: {},
      });

      tokenService.createSession.mockResolvedValue({
        session: { id: "session-1" },
        rawRefreshToken: "raw-refresh-token",
      });
      tokenService.generateAccessToken.mockReturnValue("access-token");

      const result = await authService.signup({
        name,
        email,
        password,
      });

      expect(result.accessToken).toBe("access-token");
      expect(result.refreshToken).toBe("raw-refresh-token");
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email,
            name,
            passwordHash: expect.any(String),
          }),
        })
      );

      // Verify password hashing
      const createdHash = mockPrisma.user.create.mock.calls[0][0].data.passwordHash;
      const isValid = await bcrypt.compare(password, createdHash);
      expect(isValid).toBe(true);
    });

    it("should throw a conflict error if email is already taken", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", email });

      await expect(
        authService.signup({ name, email, password })
      ).rejects.toThrow(expect.any(AppError));
    });
  });

  describe("login", () => {
    it("should allow login with valid credentials", async () => {
      const passwordHash = await bcrypt.hash(password, 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email,
        passwordHash,
        status: "ACTIVE",
      });

      tokenService.createSession.mockResolvedValue({
        session: { id: "session-1" },
        rawRefreshToken: "raw-refresh-token",
      });
      tokenService.generateAccessToken.mockReturnValue("access-token");

      const result = await authService.login({ email, password });

      expect(result.accessToken).toBe("access-token");
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it("should reject login with invalid password", async () => {
      const passwordHash = await bcrypt.hash(password, 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email,
        passwordHash,
        status: "ACTIVE",
      });

      await expect(
        authService.login({ email, password: "wrong-password" })
      ).rejects.toThrow(expect.any(AppError));
    });

    it("should reject suspended or deactivated users", async () => {
      const passwordHash = await bcrypt.hash(password, 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email,
        passwordHash,
        status: "SUSPENDED",
      });

      await expect(
        authService.login({ email, password })
      ).rejects.toThrow(expect.any(AppError));
    });
  });

  describe("resetPassword", () => {
    it("should verify OTP, hash new password and revoke sessions", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email,
      });

      otpService.verifyOtp.mockResolvedValue(true);

      const result = await authService.resetPassword(email, "123456", "NewPassword123!");

      expect(result.success).toBe(true);
      expect(otpService.verifyOtp).toHaveBeenCalledWith(email, "PASSWORD_RESET", "123456");
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({ passwordHash: expect.any(String) }),
        })
      );
      expect(tokenService.revokeAllUserSessions).toHaveBeenCalledWith("user-1");
    });
  });
});
