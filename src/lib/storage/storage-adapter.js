const fs = require("fs").promises;
const path = require("path");
const cloudinary = require("cloudinary").v2;
const env = require("../../config/env");
const logger = require("../../config/logger");

// Configure cloudinary if URL is present
if (env.CLOUDINARY_URLS) {
  process.env.CLOUDINARY_URL = env.CLOUDINARY_URLS;
}

/**
 * Abstract Storage Adapter Interface / Base Class
 */
class StorageAdapter {
  /**
   * Upload a file to storage.
   * @param {Object} file - The multer file object.
   * @param {Object} [options] - Optional configurations.
   * @returns {Promise<{ url: string, key: string, bucket: string, mimeType: string, sizeBytes: number }>}
   */
  async upload(file, options) {
    throw new Error("Method 'upload()' must be implemented.");
  }

  /**
   * Delete a file from storage.
   * @param {string} key - The identifier key of the file.
   * @returns {Promise<void>}
   */
  async delete(key) {
    throw new Error("Method 'delete()' must be implemented.");
  }
}

/**
 * Local Storage Adapter
 */
class LocalStorageAdapter extends StorageAdapter {
  async upload(file, options = {}) {
    // If the file was uploaded via diskStorage, it is already in env.UPLOAD_DIR.
    // In case it's in memory (or path is missing), write it manually.
    if (!file.path) {
      const filename = file.filename || `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      const filePath = path.join(env.UPLOAD_DIR, filename);
      await fs.writeFile(filePath, file.buffer);
      file.path = filePath;
      file.filename = filename;
    }

    const relativePath = file.filename;
    const url = `${env.PUBLIC_BASE_URL}/uploads/${relativePath}`;

    return {
      url,
      key: relativePath,
      bucket: "local",
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  async delete(key) {
    const filePath = path.join(env.UPLOAD_DIR, key);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        logger.error(`Failed to delete local file: ${filePath}`, err);
        throw err;
      }
    }
  }
}

/**
 * Cloudinary Storage Adapter
 */
class CloudinaryStorageAdapter extends StorageAdapter {
  constructor() {
    super();
    // Use mock/dry-run client in test env or when credentials are not configured
    this.isMock = env.NODE_ENV === "test" || !env.CLOUDINARY_URLS;
  }

  async upload(file, options = {}) {
    if (this.isMock) {
      // Return a simulated mock Cloudinary URL and details
      const filename = file.filename || `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      const mockKey = `mock_cloudinary/${filename}`;
      const url = `https://res.cloudinary.com/mock-cloud/image/upload/${mockKey}`;

      // Clean up the local file if it was saved by multer to prevent disk leak
      if (file.path) {
        try {
          await fs.unlink(file.path);
        } catch (err) {
          logger.warn(`Could not delete temp local file ${file.path}: ${err.message}`);
        }
      }

      return {
        url,
        key: mockKey,
        bucket: "cloudinary",
        mimeType: file.mimetype,
        sizeBytes: file.size,
      };
    }

    // Production Cloudinary Upload
    try {
      if (!file.path) {
        throw new Error("Local file path is missing for Cloudinary upload");
      }

      const result = await cloudinary.uploader.upload(file.path, {
        folder: "neargrab",
        resource_type: "auto",
        ...options,
      });

      // Clean up temporary local file
      try {
        await fs.unlink(file.path);
      } catch (err) {
        logger.warn(`Could not delete temp local file ${file.path}: ${err.message}`);
      }

      return {
        url: result.secure_url,
        key: result.public_id,
        bucket: "cloudinary",
        mimeType: file.mimetype,
        sizeBytes: file.bytes || file.size,
      };
    } catch (err) {
      logger.error("Cloudinary upload failed", err);
      throw err;
    }
  }

  async delete(key) {
    if (this.isMock) {
      logger.info(`Mock Cloudinary delete called for key: ${key}`);
      return;
    }

    try {
      // Determine resource type if key contains raw files like PDF
      const isPdf = key.endsWith(".pdf");
      const result = await cloudinary.uploader.destroy(key, {
        resource_type: isPdf ? "raw" : "image",
      });
      if (result.result !== "ok" && result.result !== "not found") {
        logger.warn(`Cloudinary delete result for key ${key}: ${result.result}`);
      }
    } catch (err) {
      logger.error(`Cloudinary delete failed for key: ${key}`, err);
      throw err;
    }
  }
}

/**
 * Storage Factory
 */
class StorageFactory {
  /**
   * Get the active Storage Adapter instance.
   * @returns {StorageAdapter}
   */
  static getAdapter() {
    const driver = env.UPLOAD_DRIVER;
    if (driver === "cloudinary") {
      return new CloudinaryStorageAdapter();
    }
    return new LocalStorageAdapter();
  }
}

module.exports = {
  StorageAdapter,
  LocalStorageAdapter,
  CloudinaryStorageAdapter,
  StorageFactory,
};
