const { getPrisma } = require("../../config/prisma");
const { AppError, ERROR_CODES } = require("../../lib/errors");
const { StorageFactory } = require("../../lib/storage/storage-adapter");
const { mapMediaAsset } = require("./media.mapper");

/**
 * Upload a single media file.
 * @param {Object} file - Express multer file object.
 * @param {string} ownerId - ID of the user uploading the file.
 * @returns {Promise<Object>} Created MediaAsset details.
 */
async function uploadSingleMedia(file, ownerId) {
  if (!file) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "No file provided for upload",
    });
  }

  const adapter = StorageFactory.getAdapter();
  const uploadResult = await adapter.upload(file);

  const prisma = getPrisma();
  const media = await prisma.mediaAsset.create({
    data: {
      ownerId,
      url: uploadResult.url,
      key: uploadResult.key,
      bucket: uploadResult.bucket,
      mimeType: uploadResult.mimeType,
      sizeBytes: uploadResult.sizeBytes,
    },
  });

  return mapMediaAsset(media);
}

/**
 * Upload multiple media files.
 * @param {Array<Object>} files - Array of Express multer file objects.
 * @param {string} ownerId - ID of the user uploading the files.
 * @returns {Promise<Array<Object>>} Array of created MediaAsset details.
 */
async function uploadBulkMedia(files, ownerId) {
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "No files provided for upload",
    });
  }

  if (files.length > 10) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Cannot upload more than 10 files in a single request",
    });
  }

  const adapter = StorageFactory.getAdapter();
  
  // Upload all files in parallel to storage driver
  const uploadResults = await Promise.all(
    files.map((file) => adapter.upload(file))
  );

  const prisma = getPrisma();
  const createdAssets = [];

  try {
    // Save records inside database transaction
    await prisma.$transaction(async (tx) => {
      for (const res of uploadResults) {
        const asset = await tx.mediaAsset.create({
          data: {
            ownerId,
            url: res.url,
            key: res.key,
            bucket: res.bucket,
            mimeType: res.mimeType,
            sizeBytes: res.sizeBytes,
          },
        });
        createdAssets.push(mapMediaAsset(asset));
      }
    });
  } catch (err) {
    // If DB save fails, clean up all files uploaded to storage during this request
    await Promise.all(
      uploadResults.map((res) => adapter.delete(res.key).catch(() => {}))
    );
    throw err;
  }

  return createdAssets;
}

/**
 * Delete a media asset.
 * Checks for existence, ownership, and active references before deleting from database and storage.
 * @param {string} mediaId - ID of the media asset to delete.
 * @param {string} actorId - ID of the user trying to delete the media asset.
 * @param {string} actorRole - Role of the user trying to delete the media asset.
 * @returns {Promise<{ success: boolean }>}
 */
async function deleteMedia(mediaId, actorId, actorRole) {
  const prisma = getPrisma();

  // 1. Check Existence
  const media = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
  });

  if (!media) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.MEDIA_NOT_FOUND,
      message: "Media asset not found",
    });
  }

  // 2. Ownership Check (Owner or Admin/Super Admin)
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(actorRole);
  if (media.ownerId !== actorId && !isAdmin) {
    throw new AppError({
      statusCode: 403,
      code: ERROR_CODES.MEDIA_FORBIDDEN,
      message: "You do not have permission to delete this media asset",
    });
  }

  // 3. Reference Protection (Verify that media is not linked to active models)
  const [
    userAvatar,
    shopLogoOrCover,
    shopPhoto,
    productImage,
    bannerImage,
    reviewMedia,
    shopUpdate,
  ] = await Promise.all([
    prisma.user.findFirst({ where: { avatarId: mediaId } }),
    prisma.shop.findFirst({
      where: {
        OR: [{ logoId: mediaId }, { coverId: mediaId }],
      },
    }),
    prisma.shopPhoto.findFirst({ where: { mediaId } }),
    prisma.productImage.findFirst({ where: { mediaId } }),
    prisma.banner.findFirst({ where: { imageId: mediaId } }),
    prisma.reviewMedia.findFirst({ where: { mediaId } }),
    prisma.shopUpdate.findFirst({ where: { mediaId } }),
  ]);

  if (
    userAvatar ||
    shopLogoOrCover ||
    shopPhoto ||
    productImage ||
    bannerImage ||
    reviewMedia ||
    shopUpdate
  ) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.MEDIA_IN_USE,
      message: "Cannot delete media asset because it is currently in use",
    });
  }

  // 4. Physical Deletion from Storage
  const adapter = StorageFactory.getAdapter();
  await adapter.delete(media.key);

  // 5. Database Deletion
  await prisma.mediaAsset.delete({
    where: { id: mediaId },
  });

  return { success: true };
}

module.exports = {
  uploadSingleMedia,
  uploadBulkMedia,
  deleteMedia,
};
