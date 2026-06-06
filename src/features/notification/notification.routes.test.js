const request = require("supertest");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

const mockPrisma = {
  notification: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  notificationPreference: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
  },
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
  prisma: mockPrisma,
}));

process.env.JWT_ACCESS_SECRET = "test-notification-routes-secret-key-123456";
env.JWT_ACCESS_SECRET = "test-notification-routes-secret-key-123456";

const app = require("../../app");

describe("Notification Feature Routes", () => {
  const userId = "user-123";
  const sessionId = "session-123";
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    token = jwt.sign(
      { sub: userId, role: "CUSTOMER", sessionId },
      env.JWT_ACCESS_SECRET
    );

    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      role: "CUSTOMER",
      status: "ACTIVE",
    });
    mockPrisma.session.findUnique.mockResolvedValue({
      id: sessionId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10000),
    });
  });

  describe("GET /api/v1/notifications", () => {
    it("should list notifications successfully", async () => {
      mockPrisma.notification.count.mockResolvedValueOnce(0); // total
      mockPrisma.notification.count.mockResolvedValueOnce(0); // unread
      mockPrisma.notification.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe("PATCH /api/v1/notifications/read-all", () => {
    it("should mark all as read successfully", async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 2 });

      const res = await request(app)
        .patch("/api/v1/notifications/read-all")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.updatedCount).toBe(2);
    });
  });

  describe("PATCH /api/v1/notifications/:notificationId/read", () => {
    it("should mark single notification as read successfully", async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: "not-1",
        userId: userId,
        readAt: null,
      });
      mockPrisma.notification.update.mockResolvedValue({
        id: "not-1",
        type: "SYSTEM",
        title: "Title",
        message: "Message",
        readAt: new Date(),
        createdAt: new Date(),
      });

      const res = await request(app)
        .patch("/api/v1/notifications/not-1/read")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.read).toBe(true);
    });
  });

  describe("DELETE /api/v1/notifications/:notificationId", () => {
    it("should delete notification successfully", async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: "not-1",
        userId: userId,
      });
      mockPrisma.notification.delete.mockResolvedValue({});

      const res = await request(app)
        .delete("/api/v1/notifications/not-1")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);
    });
  });

  describe("GET /api/v1/notifications/preferences", () => {
    it("should return preferences successfully", async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/notifications/preferences")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.preferences).toBeDefined();
      expect(res.body.data.ui).toBeDefined();
    });
  });

  describe("PATCH /api/v1/notifications/preferences", () => {
    it("should update preference toggle successfully", async () => {
      mockPrisma.notificationPreference.upsert.mockResolvedValue({});
      mockPrisma.notificationPreference.findMany.mockResolvedValue([]);

      const res = await request(app)
        .patch("/api/v1/notifications/preferences")
        .set("Authorization", `Bearer ${token}`)
        .send({ key: "email", enabled: false })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
