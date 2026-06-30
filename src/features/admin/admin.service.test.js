const adminService = require("./admin.service");
const { AppError } = require("../../lib/errors");
const bcrypt = require("bcrypt");
const tokenService = require("../auth/token.service");
const { createNotification } = require("../notification/notification.service");

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
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
    updateMany: jest.fn(),
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
  session: {
    updateMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
  $queryRaw: jest.fn(),
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

jest.mock("../auth/token.service", () => ({
  createSession: jest.fn(),
  generateAccessToken: jest.fn(),
}));

jest.mock("../notification/notification.service", () => ({
  createNotification: jest.fn(),
}));

describe("AdminService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("adminLogin", () => {
    it("should login successfully for a user with SUPER_ADMIN role and correct password", async () => {
      const passwordHash = await bcrypt.hash("Password123", 1);
      const mockAdminUser = {
        id: "admin-1",
        email: "admin@neargrab.com",
        passwordHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockAdminUser);
      mockPrisma.user.update.mockResolvedValue(mockAdminUser);
      tokenService.createSession.mockResolvedValue({
        session: { id: "sess-1" },
        rawRefreshToken: "refresh-token-123",
      });
      tokenService.generateAccessToken.mockReturnValue("access-token-123");

      const result = await adminService.adminLogin({
        email: "admin@neargrab.com",
        password: "Password123",
      });

      expect(result.accessToken).toBe("access-token-123");
      expect(result.refreshToken).toBe("refresh-token-123");
      expect(mockPrisma.user.findUnique).toHaveBeenCalled();
    });

    it("should throw error if user does not have admin role", async () => {
      const passwordHash = await bcrypt.hash("Password123", 1);
      const mockCustomerUser = {
        id: "cust-1",
        email: "cust@neargrab.com",
        passwordHash,
        role: "CUSTOMER",
        status: "ACTIVE",
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockCustomerUser);

      await expect(
        adminService.adminLogin({
          email: "cust@neargrab.com",
          password: "Password123",
        })
      ).rejects.toThrow(AppError);
    });

    it("should throw error if account is suspended", async () => {
      const passwordHash = await bcrypt.hash("Password123", 1);
      const mockAdminUser = {
        id: "admin-1",
        email: "admin@neargrab.com",
        passwordHash,
        role: "ADMIN",
        status: "SUSPENDED",
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockAdminUser);

      await expect(
        adminService.adminLogin({
          email: "admin@neargrab.com",
          password: "Password123",
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe("getDashboardSummary", () => {
    it("should fetch dashboard metrics and calculate trends", async () => {
      mockPrisma.user.count.mockResolvedValue(10);
      mockPrisma.shop.count.mockResolvedValue(5);
      mockPrisma.product.count.mockResolvedValue(20);
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
      mockPrisma.shopLead.findMany.mockResolvedValue([
        { source: "SEARCH", shop: { address: { city: "Surat" } } },
        { source: "MAP_VIEW", shop: { address: { city: "Surat" } } },
      ]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await adminService.getDashboardSummary();

      expect(result.systemSummary.activeUsers).toBe(10);
      expect(result.totals.totalShops).toBe(5);
      expect(result.topCities).toHaveLength(1);
      expect(result.topCities[0].city).toBe("Surat");
    });
  });

  describe("updateUser", () => {
    it("should update user status and revoke active sessions", async () => {
      const user = { id: "user-1", role: "CUSTOMER", status: "ACTIVE" };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({ ...user, status: "SUSPENDED" });

      const updated = await adminService.updateUser(
        "user-1",
        { status: "SUSPENDED" },
        { actorId: "admin-1", ipAddress: "127.0.0.1", userAgent: "Mozilla" }
      );

      expect(updated.status).toBe("SUSPENDED");
      expect(mockPrisma.session.updateMany).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe("verifyShop", () => {
    it("should verify shop status and send notifications to owner", async () => {
      const shop = { id: "shop-1", ownerId: "owner-1", status: "PENDING_REVIEW", verificationStatus: "PENDING" };
      mockPrisma.shop.findUnique.mockResolvedValue(shop);
      mockPrisma.shop.update.mockResolvedValue({
        ...shop,
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
      });

      const updated = await adminService.verifyShop(
        "shop-1",
        { status: "ACTIVE", verificationStatus: "VERIFIED", reason: "All documents valid" },
        { actorId: "admin-1", ipAddress: "127.0.0.1", userAgent: "Mozilla" }
      );

      expect(updated.verificationStatus).toBe("VERIFIED");
      expect(createNotification).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe("pinProduct", () => {
    it("should pin product successfully if within pin limits", async () => {
      const product = {
        id: "prod-1",
        isPinned: false,
        shop: { address: { city: "Surat" } },
      };
      mockPrisma.product.findUnique.mockResolvedValue(product);
      mockPrisma.pinRule.findUnique.mockResolvedValue({ city: "Surat", targetType: "PRODUCT", pinLimit: 5 });
      mockPrisma.product.count.mockResolvedValue(2);
      mockPrisma.product.update.mockResolvedValue({ ...product, isPinned: true });

      const updated = await adminService.pinProduct(
        "prod-1",
        { actorId: "admin-1", ipAddress: "127.0.0.1", userAgent: "Mozilla" }
      );

      expect(updated.isPinned).toBe(true);
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it("should throw error if pin limit is exceeded", async () => {
      const product = {
        id: "prod-1",
        isPinned: false,
        shop: { address: { city: "Surat" } },
      };
      mockPrisma.product.findUnique.mockResolvedValue(product);
      mockPrisma.pinRule.findUnique.mockResolvedValue({ city: "Surat", targetType: "PRODUCT", pinLimit: 2 });
      mockPrisma.product.count.mockResolvedValue(2); // limit is 2, already 2 pinned

      await expect(
        adminService.pinProduct(
          "prod-1",
          { actorId: "admin-1", ipAddress: "127.0.0.1", userAgent: "Mozilla" }
        )
      ).rejects.toThrow(AppError);
    });
  });

  describe("pinBanner", () => {
    it("should pin banner successfully if within pin limits", async () => {
      const banner = {
        id: "banner-1",
        status: "ACTIVE",
        city: "Surat",
      };
      mockPrisma.banner.findUnique.mockResolvedValue(banner);
      mockPrisma.pinRule.findUnique.mockResolvedValue({ city: "Surat", targetType: "BANNER", pinLimit: 3 });
      mockPrisma.banner.count.mockResolvedValue(1);
      mockPrisma.banner.update.mockResolvedValue({ ...banner, status: "PINNED" });

      const updated = await adminService.pinBanner(
        "banner-1",
        { actorId: "admin-1", ipAddress: "127.0.0.1", userAgent: "Mozilla" }
      );

      expect(updated.status).toBe("PINNED");
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });
});
