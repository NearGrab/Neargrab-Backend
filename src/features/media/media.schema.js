const { z } = require("zod");

const deleteMediaParams = z.object({
  mediaId: z.string().cuid({ message: "Invalid media ID format" }),
});

module.exports = {
  deleteMediaParams,
};
