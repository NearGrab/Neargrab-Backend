const { sendSuccess } = require("../lib/response");
const metaService = require("../services/meta.service");

async function getMeta(_req, res, next) {
  try {
    const meta = await metaService.getMeta();
    return sendSuccess(res, meta);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMeta,
};
