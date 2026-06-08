const mediaService = require("./media.service");
const { AppError } = require("../../lib/errors");
const { StorageFactory } = require("../../lib/storage/storage-adapter");

const mockPrisma = {
  mediaAsset: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
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
}));

describe("MediaService", () => {
  let mockAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdapter = {
      upload: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(StorageFactory, "getAdapter").mockReturnValue(mockAdapter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("uploadSingleMedia", () => {
    it("should throw error if file is missing", async () => {
      await expect(mediaService.uploadSingleMedia(null, "user-1")).rejects.toThrow(
        "No file provided for upload"
      );
    });

    it("should upload file to storage and save to database", async () => {
      const mockFile = { originalname: "test.jpg" };
      mockAdapter.upload.mockResolvedValue({
        url: "http://localhost/uploads/test.jpg",
        key: "test.jpg",
        bucket: "local",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
      });

      mockPrisma.mediaAsset.create.mockResolvedValue({
        id: "media-1",
        ownerId: "user-1",
        url: "http://localhost/uploads/test.jpg",
        key: "test.jpg",
        bucket: "local",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        createdAt: new Date("2026-06-08T00:00:00.000Z"),
      });

      const result = await mediaService.uploadSingleMedia(mockFile, "user-1");

      expect(mockAdapter.upload).toHaveBeenCalledWith(mockFile);
      expect(mockPrisma.mediaAsset.create).toHaveBeenCalledWith({
        data: {
          ownerId: "user-1",
          url: "http://localhost/uploads/test.jpg",
          key: "test.jpg",
          bucket: "local",
          mimeType: "image/jpeg",
          sizeBytes: 1024,
        },
      });
      expect(result).toEqual({
        id: "media-1",
        ownerId: "user-1",
        url: "http://localhost/uploads/test.jpg",
        key: "test.jpg",
        bucket: "local",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        width: null,
        height: null,
        altText: null,
        createdAt: "2026-06-08T00:00:00.000Z",
      });
    });
  });

  describe("uploadBulkMedia", () => {
    it("should throw error if no files are provided", async () => {
      await expect(mediaService.uploadBulkMedia([], "user-1")).rejects.toThrow(
        "No files provided for upload"
      );
    });

    it("should throw error if files count exceeds 10", async () => {
      const files = Array(11).fill({ originalname: "file.jpg" });
      await expect(mediaService.uploadBulkMedia(files, "user-1")).rejects.toThrow(
        "Cannot upload more than 10 files in a single request"
      );
    });

    it("should upload multiple files and create multiple database entries", async () => {
      const mockFiles = [{ originalname: "1.jpg" }, { originalname: "2.jpg" }];
      mockAdapter.upload
        .mockResolvedValueOnce({
          url: "http://localhost/uploads/1.jpg",
          key: "1.jpg",
          bucket: "local",
          mimeType: "image/jpeg",
          sizeBytes: 500,
        })
        .mockResolvedValueOnce({
          url: "http://localhost/uploads/2.jpg",
          key: "2.jpg",
          bucket: "local",
          mimeType: "image/jpeg",
          sizeBytes: 600,
        });

      mockPrisma.mediaAsset.create
        .mockResolvedValueOnce({
          id: "media-1",
          ownerId: "user-1",
          url: "http://localhost/uploads/1.jpg",
          key: "1.jpg",
          bucket: "local",
          mimeType: "image/jpeg",
          sizeBytes: 500,
          createdAt: new Date("2026-06-08T00:00:00.000Z"),
        })
        .mockResolvedValueOnce({
          id: "media-2",
          ownerId: "user-1",
          url: "http://localhost/uploads/2.jpg",
          key: "2.jpg",
          bucket: "local",
          mimeType: "image/jpeg",
          sizeBytes: 600,
          createdAt: new Date("2026-06-08T00:00:00.000Z"),
        });

      const results = await mediaService.uploadBulkMedia(mockFiles, "user-1");

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("media-1");
      expect(results[1].id).toBe("media-2");
    });

    it("should delete uploaded files from storage if database transaction fails", async () => {
      const mockFiles = [{ originalname: "1.jpg" }, { originalname: "2.jpg" }];
      mockAdapter.upload
        .mockResolvedValueOnce({
          url: "http://localhost/uploads/1.jpg",
          key: "1.jpg",
          bucket: "local",
          mimeType: "image/jpeg",
          sizeBytes: 500,
        })
        .mockResolvedValueOnce({
          url: "http://localhost/uploads/2.jpg",
          key: "2.jpg",
          bucket: "local",
          mimeType: "image/jpeg",
          sizeBytes: 600,
        });

      mockPrisma.mediaAsset.create.mockRejectedValue(new Error("DB Connection Lost"));

      await expect(mediaService.uploadBulkMedia(mockFiles, "user-1")).rejects.toThrow(
        "DB Connection Lost"
      );

      expect(mockAdapter.delete).toHaveBeenCalledWith("1.jpg");
      expect(mockAdapter.delete).toHaveBeenCalledWith("2.jpg");
    });
  });

  describe("deleteMedia", () => {
    it("should throw NOT_FOUND if media asset does not exist", async () => {
      mockPrisma.mediaAsset.findUnique.mockResolvedValue(null);

      await expect(
        mediaService.deleteMedia("media-1", "user-1", "CUSTOMER")
      ).rejects.toThrow("Media asset not found");
    });

    it("should throw FORBIDDEN if user is not the owner and not an admin", async () => {
      mockPrisma.mediaAsset.findUnique.mockResolvedValue({
        id: "media-1",
        ownerId: "user-2",
      });

      await expect(
        mediaService.deleteMedia("media-1", "user-1", "CUSTOMER")
      ).rejects.toThrow("You do not have permission to delete this media asset");
    });

    it("should throw MEDIA_IN_USE if media is linked to a user avatar", async () => {
      mockPrisma.mediaAsset.findUnique.mockResolvedValue({
        id: "media-1",
        ownerId: "user-1",
      });
      mockPrisma.user.findFirst.mockResolvedValue({ id: "user-1" });

      await expect(
        mediaService.deleteMedia("media-1", "user-1", "CUSTOMER")
      ).rejects.toThrow("Cannot delete media asset because it is currently in use");
    });

    it("should allow deletion by owner if not in use", async () => {
      mockPrisma.mediaAsset.findUnique.mockResolvedValue({
        id: "media-1",
        ownerId: "user-1",
        key: "test.jpg",
      });
      // Mock all references as null
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.shop.findFirst.mockResolvedValue(null);
      mockPrisma.shopPhoto.findFirst.mockResolvedValue(null);
      mockPrisma.productImage.findFirst.mockResolvedValue(null);
      mockPrisma.banner.findFirst.mockResolvedValue(null);
      mockPrisma.reviewMedia.findFirst.mockResolvedValue(null);
      mockPrisma.shopUpdate.findFirst.mockResolvedValue(null);

      const result = await mediaService.deleteMedia("media-1", "user-1", "CUSTOMER");

      expect(mockAdapter.delete).toHaveBeenCalledWith("test.jpg");
      expect(mockPrisma.mediaAsset.delete).toHaveBeenCalledWith({
        where: { id: "media-1" },
      });
      expect(result).toEqual({ success: true });
    });

    it("should allow deletion by admin even if owned by someone else, if not in use", async () => {
      mockPrisma.mediaAsset.findUnique.mockResolvedValue({
        id: "media-1",
        ownerId: "user-2",
        key: "test.jpg",
      });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.shop.findFirst.mockResolvedValue(null);
      mockPrisma.shopPhoto.findFirst.mockResolvedValue(null);
      mockPrisma.productImage.findFirst.mockResolvedValue(null);
      mockPrisma.banner.findFirst.mockResolvedValue(null);
      mockPrisma.reviewMedia.findFirst.mockResolvedValue(null);
      mockPrisma.shopUpdate.findFirst.mockResolvedValue(null);

      const result = await mediaService.deleteMedia("media-1", "admin-1", "ADMIN");

      expect(mockAdapter.delete).toHaveBeenCalledWith("test.jpg");
      expect(mockPrisma.mediaAsset.delete).toHaveBeenCalledWith({
        where: { id: "media-1" },
      });
      expect(result).toEqual({ success: true });
    });
  });
});
