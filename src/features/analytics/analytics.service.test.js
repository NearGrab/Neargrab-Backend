const analyticsService = require("./analytics.service");

// Mock Prisma
const mockPrisma = {
  visitorLog: {
    create: jest.fn(),
  },
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

describe("AnalyticsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("logVisit", () => {
    it("should successfully log a visit to VisitorLog", async () => {
      mockPrisma.visitorLog.create.mockResolvedValue({
        id: "log-1",
        visitorId: "device-123",
        path: "/explore",
        ipAddress: "127.0.0.1",
        userAgent: "Jest",
        createdAt: new Date(),
      });

      const res = await analyticsService.logVisit({
        visitorId: "device-123",
        path: "/explore",
        ipAddress: "127.0.0.1",
        userAgent: "Jest",
      });

      expect(res.id).toBe("log-1");
      expect(mockPrisma.visitorLog.create).toHaveBeenCalledWith({
        data: {
          visitorId: "device-123",
          path: "/explore",
          ipAddress: "127.0.0.1",
          userAgent: "Jest",
        },
      });
    });
  });
});
