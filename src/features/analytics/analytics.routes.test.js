const request = require("supertest");

// Mock prisma client
const mockPrisma = {
  visitorLog: {
    create: jest.fn(),
  },
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
  prisma: mockPrisma,
}));

process.env.JWT_ACCESS_SECRET = "test-analytics-routes-secret-key-123456";

const app = require("../../app");

describe("Analytics Feature Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/analytics/visit", () => {
    it("should return success when logging a visit", async () => {
      mockPrisma.visitorLog.create.mockResolvedValue({
        id: "log-1",
        visitorId: "device-123",
        path: "/explore",
        createdAt: new Date(),
      });

      const res = await request(app)
        .post("/api/v1/analytics/visit")
        .send({
          visitorId: "device-123",
          path: "/explore",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it("should return 400 bad request if parameters are missing", async () => {
      const res = await request(app)
        .post("/api/v1/analytics/visit")
        .send({
          path: "/explore",
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe("Missing visitorId or path");
    });
  });
});
