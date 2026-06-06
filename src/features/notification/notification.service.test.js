const notificationService = require("./notification.service");
const { AppError } = require("../../lib/errors");

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
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

describe("NotificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const dummyUserId = "user-123";

  describe("createNotification helper", () => {
    it("should create in-app notification when preference is enabled (or missing)", async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
      mockPrisma.notification.create.mockResolvedValue({ id: "not-1" });

      const res = await notificationService.createNotification({
        userId: dummyUserId,
        type: "RESERVATION",
        title: "Test",
        message: "Message",
      });

      expect(res).toBeDefined();
      expect(mockPrisma.notification.create).toHaveBeenCalled();
    });

    it("should skip creating in-app notification when preference is explicitly disabled", async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        channel: "IN_APP",
        type: "RESERVATION",
        enabled: false,
      });

      const res = await notificationService.createNotification({
        userId: dummyUserId,
        type: "RESERVATION",
        title: "Test",
        message: "Message",
      });

      expect(res).toBeNull();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe("listNotifications", () => {
    it("should return list with unreadCount in meta", async () => {
      mockPrisma.notification.count.mockResolvedValueOnce(2); // total
      mockPrisma.notification.count.mockResolvedValueOnce(1); // unread
      mockPrisma.notification.findMany.mockResolvedValue([
        {
          id: "not-1",
          type: "RESERVATION",
          title: "T",
          message: "M",
          readAt: null,
          createdAt: new Date(),
        },
        {
          id: "not-2",
          type: "SECURITY",
          title: "T",
          message: "M",
          readAt: new Date(),
          createdAt: new Date(),
        },
      ]);

      const result = await notificationService.listNotifications(dummyUserId, {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.meta.unreadCount).toBe(1);
    });
  });

  describe("markAsRead", () => {
    it("should mark unread notification as read", async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: "not-1",
        userId: dummyUserId,
        readAt: null,
      });

      mockPrisma.notification.update.mockResolvedValue({
        id: "not-1",
        type: "SYSTEM",
        title: "T",
        message: "M",
        readAt: new Date(),
        createdAt: new Date(),
      });

      const result = await notificationService.markAsRead(dummyUserId, "not-1");

      expect(result.read).toBe(true);
      expect(mockPrisma.notification.update).toHaveBeenCalled();
    });
  });

  describe("markAllAsRead", () => {
    it("should update all unread notifications", async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await notificationService.markAllAsRead(dummyUserId);

      expect(result.updatedCount).toBe(5);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: dummyUserId, readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe("deleteNotification", () => {
    it("should delete existing own notification", async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: "not-1",
        userId: dummyUserId,
      });

      const result = await notificationService.deleteNotification(
        dummyUserId,
        "not-1"
      );

      expect(result.deleted).toBe(true);
      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({
        where: { id: "not-1" },
      });
    });
  });
});
