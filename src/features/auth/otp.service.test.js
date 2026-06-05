const otpService = require("./otp.service");
const { AppError } = require("../../lib/errors");

// Mock prisma client
const mockPrisma = {
  otpCode: {
    updateMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};
jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

describe("OtpService", () => {
  const identifier = "9876543210";
  const purpose = "LOGIN";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateOtp", () => {
    it("should generate a 6-digit OTP code and create db entry", async () => {
      mockPrisma.otpCode.create.mockImplementation(({ data }) => Promise.resolve({ id: "otp-1", ...data }));

      const result = await otpService.generateOtp(identifier, purpose);

      expect(result.code).toMatch(/^\d{6}$/);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockPrisma.otpCode.updateMany).toHaveBeenCalled();
      expect(mockPrisma.otpCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            identifier,
            purpose,
            codeHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe("verifyOtp", () => {
    it("should verify and consume a valid, active OTP code", async () => {
      // Generate first to compute hash
      mockPrisma.otpCode.create.mockImplementation(({ data }) => Promise.resolve({ id: "otp-1", ...data }));
      const { code } = await otpService.generateOtp(identifier, purpose);

      const crypto = require("crypto");
      const expectedHash = crypto.createHash("sha256").update(code).digest("hex");

      mockPrisma.otpCode.findFirst.mockResolvedValue({
        id: "otp-1",
        identifier,
        purpose,
        codeHash: expectedHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 300000),
      });

      const verified = await otpService.verifyOtp(identifier, purpose, code);
      expect(verified).toBe(true);
      expect(mockPrisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: "otp-1" },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      });
    });

    it("should fail if no active OTP code is found", async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue(null);

      await expect(
        otpService.verifyOtp(identifier, purpose, "123456")
      ).rejects.toThrow(expect.any(AppError));
    });

    it("should fail if OTP has expired", async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue({
        id: "otp-1",
        identifier,
        purpose,
        codeHash: "some-hash",
        attempts: 0,
        expiresAt: new Date(Date.now() - 1000), // Expired 1s ago
      });

      await expect(
        otpService.verifyOtp(identifier, purpose, "123456")
      ).rejects.toThrow(expect.any(AppError));
    });

    it("should fail and increment attempts on wrong code", async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue({
        id: "otp-1",
        identifier,
        purpose,
        codeHash: "actual-hash",
        attempts: 0,
        expiresAt: new Date(Date.now() + 300000),
      });

      await expect(
        otpService.verifyOtp(identifier, purpose, "wrong-code")
      ).rejects.toThrow(expect.any(AppError));

      expect(mockPrisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: "otp-1" },
        data: { attempts: { increment: 1 } },
      });
    });

    it("should block verification if max attempts are exceeded", async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue({
        id: "otp-1",
        identifier,
        purpose,
        codeHash: "actual-hash",
        attempts: 3, // Already 3 attempts
        expiresAt: new Date(Date.now() + 300000),
      });

      await expect(
        otpService.verifyOtp(identifier, purpose, "123456")
      ).rejects.toThrow(expect.any(AppError));
    });
  });
});
