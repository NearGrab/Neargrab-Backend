const fs = require("fs").promises;
const path = require("path");
const env = require("../../config/env");
const { LocalStorageAdapter, CloudinaryStorageAdapter, StorageFactory } = require("./storage-adapter");

jest.mock("fs", () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("Storage Adapters", () => {
  const originalUploadDir = env.UPLOAD_DIR;
  const originalPublicBaseUrl = env.PUBLIC_BASE_URL;

  beforeAll(() => {
    env.UPLOAD_DIR = "/var/uploads";
    env.PUBLIC_BASE_URL = "http://localhost/uploads";
  });

  afterAll(() => {
    env.UPLOAD_DIR = originalUploadDir;
    env.PUBLIC_BASE_URL = originalPublicBaseUrl;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("LocalStorageAdapter", () => {
    const adapter = new LocalStorageAdapter();

    it("should successfully upload a file to local disk", async () => {
      const mockFile = {
        originalname: "photo.jpg",
        buffer: Buffer.from("dummy-content"),
        mimetype: "image/jpeg",
        size: 1024,
      };

      const result = await adapter.upload(mockFile);

      expect(fs.writeFile).toHaveBeenCalled();
      expect(result.url).toContain("http://localhost/uploads/");
      expect(result.url).toContain(".jpg");
      expect(result.key).toContain(".jpg");
      expect(result.bucket).toBe("local");
      expect(result.mimeType).toBe("image/jpeg");
      expect(result.sizeBytes).toBe(1024);
    });

    it("should delete a file from local disk", async () => {
      await adapter.delete("some-key-photo.jpg");
      expect(fs.unlink).toHaveBeenCalledWith(path.join("/var/uploads", "some-key-photo.jpg"));
    });
  });

  describe("CloudinaryStorageAdapter", () => {
    const adapter = new CloudinaryStorageAdapter();

    it("should fallback to mock upload in test/dev environment", async () => {
      const mockFile = {
        originalname: "cloud.png",
        buffer: Buffer.from("content"),
        mimetype: "image/png",
        size: 500,
      };

      const result = await adapter.upload(mockFile);
      expect(result.url).toContain("https://res.cloudinary.com/mock-cloud/image/upload/");
      expect(result.key).toContain("mock_cloudinary/");
      expect(result.bucket).toBe("cloudinary");
      expect(result.mimeType).toBe("image/png");
      expect(result.sizeBytes).toBe(500);
    });

    it("should mock delete successfully", async () => {
      await adapter.delete("mock-key");
      // Just verifying mock delete doesn't throw and logs action
    });
  });

  describe("StorageFactory", () => {
    const originalDriver = env.UPLOAD_DRIVER;

    afterEach(() => {
      env.UPLOAD_DRIVER = originalDriver;
    });

    it("should return LocalStorageAdapter when UPLOAD_DRIVER is local", () => {
      env.UPLOAD_DRIVER = "local";
      const adapter = StorageFactory.getAdapter();
      expect(adapter).toBeInstanceOf(LocalStorageAdapter);
    });

    it("should return CloudinaryStorageAdapter when UPLOAD_DRIVER is cloudinary", () => {
      env.UPLOAD_DRIVER = "cloudinary";
      const adapter = StorageFactory.getAdapter();
      expect(adapter).toBeInstanceOf(CloudinaryStorageAdapter);
    });
  });
});
