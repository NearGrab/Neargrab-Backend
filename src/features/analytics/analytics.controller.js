const { sendSuccess } = require("../../lib/response");
const { AppError } = require("../../lib/errors");
const analyticsService = require("./analytics.service");

/**
 * POST /analytics/visit controller.
 */
async function logVisit(req, res, next) {
  try {
    const { visitorId, path } = req.body;
    
    if (!visitorId || !path) {
      throw new AppError({
        statusCode: 400,
        message: "Missing visitorId or path",
      });
    }

    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Log asynchronously to avoid blocking the response
    analyticsService.logVisit({
      visitorId,
      path,
      ipAddress,
      userAgent
    }).catch(err => {
      console.error("Failed to log page visit:", err);
    });

    return sendSuccess(res, { success: true });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  logVisit
};
