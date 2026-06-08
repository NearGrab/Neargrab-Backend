const request = require("supertest");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");
const { StorageFactory } = require("../../lib/storage/storage-adapter");

// Mock prisma client
const mockPrisma = {
  mediaAsset: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
  },
  shop: {
    findFirst: jest.fn(),
  },
  shopPhoto: {
    findFirst: jest.fn(),
  },
  productImage: {
    findFirst: jest.fn(),
  },
  banner: {
    findFirst: jest.fn(),
  },
  reviewMedia: {
    findFirst: jest.fn(),
  },
  shopUpdate: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
  prisma: mockPrisma,
}));

process.env.JWT_ACCESS_SECRET = "test-media-routes-secret-key-123456";
env.JWT_ACCESS_SECRET = "test-media-routes-secret-key-123456";

const app = require("../../app");

describe("Media Feature Routes", () => {
  const userId = "user-123";
  const sessionId = "session-123";
  let token;
  let mockAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    token = jwt.sign(
      { sub: userId, role: "CUSTOMER", sessionId },
      env.JWT_ACCESS_SECRET
    );

    mockAdapter = {
      upload: jest.fn(),
      delete: jest.fn(),
    };
    jest.spyOn(StorageFactory, "getAdapter").mockReturnValue(mockAdapter);

    // Default mock behavior for auth middleware
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      role: "CUSTOMER",
      status: "ACTIVE",
    });
    mockPrisma.session.findUnique.mockResolvedValue({
      id: sessionId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("POST /api/v1/media/upload", () => {
    it("should successfully upload a single file", async () => {
      mockAdapter.upload.mockResolvedValue({
        url: "http://localhost/uploads/test.jpg",
        key: "test.jpg",
        bucket: "local",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
      });

      mockPrisma.mediaAsset.create.mockResolvedValue({
        id: "media-1",
        ownerId: userId,
        url: "http://localhost/uploads/test.jpg",
        key: "test.jpg",
        bucket: "local",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        createdAt: new Date("2026-06-08T00:00:00.000Z"),
      });

      const res = await request(app)
        .post("/api/v1/media/upload")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("fake-file"), "test.jpg")
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("media-1");
      expect(mockAdapter.upload).toHaveBeenCalled();
      expect(mockPrisma.mediaAsset.create).toHaveBeenCalled();
    });

    it("should return 400 if file is missing", async () => {
      const res = await request(app)
        .post("/api/v1/media/upload")
        .set("Authorization", `Bearer ${token}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/media/upload/bulk", () => {
    it("should successfully upload multiple files", async () => {
      mockAdapter.upload.mockResolvedValue({
        url: "http://localhost/uploads/test.jpg",
        key: "test.jpg",
        bucket: "local",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
      });

      mockPrisma.mediaAsset.create.mockResolvedValue({
        id: "media-1",
        ownerId: userId,
        url: "http://localhost/uploads/test.jpg",
        key: "test.jpg",
        bucket: "local",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        createdAt: new Date(),
      });

      const res = await request(app)
        .post("/api/v1/media/upload/bulk")
        .set("Authorization", `Bearer ${token}`)
        .attach("files", Buffer.from("fake-1"), "1.jpg")
        .attach("files", Buffer.from("fake-2"), "2.jpg")
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(mockAdapter.upload).toHaveBeenCalledTimes(2);
    });
  });

  describe("DELETE /api/v1/media/:mediaId", () => {
    it("should delete own media asset successfully", async () => {
      mockPrisma.mediaAsset.findUnique.mockResolvedValue({
        id: "media-1",
        ownerId: userId,
        key: "key.jpg",
      });
      // All references null
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.shop.findFirst.mockResolvedValue(null);
      mockPrisma.shopPhoto.findFirst.mockResolvedValue(null);
      mockPrisma.productImage.findFirst.mockResolvedValue(null);
      mockPrisma.banner.findFirst.mockResolvedValue(null);
      mockPrisma.reviewMedia.findFirst.mockResolvedValue(null);
      mockPrisma.shopUpdate.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/v1/media/cju1234560000y7890abcdefg")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(mockAdapter.delete).toHaveBeenCalledWith("key.jpg");
      expect(mockPrisma.mediaAsset.delete).toHaveBeenCalled();
    });

    it("should return 400 with MEDIA_IN_USE if media is currently referenced", async () => {
      mockPrisma.mediaAsset.findUnique.mockResolvedValue({
        id: "media-1",
        ownerId: userId,
        key: "key.jpg",
      });
      mockPrisma.user.findFirst.mockResolvedValue({ id: "user-123" });

      const res = await request(app)
        .delete("/api/v1/media/cju1234560000y7890abcdefg")
        .set("Authorization", `Bearer ${token}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("MEDIA_IN_USE");
    });

    it("should return 403 with MEDIA_FORBIDDEN if trying to delete another user's asset", async () => {
      mockPrisma.mediaAsset.findUnique.mockResolvedValue({
        id: "media-1",
        ownerId: "user-other",
        key: "key.jpg",
      });

      const res = await request(app)
        .delete("/api/v1/media/cju1234560000y7890abcdefg")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("MEDIA_FORBIDDEN");
    });
  });
});
