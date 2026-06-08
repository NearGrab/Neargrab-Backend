function mapMediaAsset(media) {
  if (!media) return null;
  return {
    id: media.id,
    ownerId: media.ownerId,
    url: media.url,
    key: media.key,
    bucket: media.bucket,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    width: media.width || null,
    height: media.height || null,
    altText: media.altText || null,
    createdAt: media.createdAt ? media.createdAt.toISOString() : null,
  };
}

module.exports = {
  mapMediaAsset,
};
