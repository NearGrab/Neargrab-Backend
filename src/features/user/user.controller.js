const { sendSuccess } = require("../../lib/response");
const userService = require("./user.service");
const { AppError, ERROR_CODES } = require("../../lib/errors");

/**
 * Handle GET /me request.
 */
async function getMe(req, res, next) {
  try {
    const result = await userService.getMe(req.user.id);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle PATCH /me request.
 */
async function updateMe(req, res, next) {
  try {
    const result = await userService.updateMe(req.user.id, req.body);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle GET /me/profile request.
 */
async function getProfile(req, res, next) {
  try {
    const result = await userService.getProfile(req.user.id, req.user.id);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle PATCH /me/profile request.
 */
async function updateProfile(req, res, next) {
  try {
    const result = await userService.updateProfile(req.user.id, req.body);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle GET /me/settings request.
 */
async function getSettings(req, res, next) {
  try {
    const result = await userService.getSettings(req.user.id);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle PATCH /me/settings request.
 */
async function updateSettings(req, res, next) {
  try {
    const result = await userService.updateSettings(req.user.id, req.body);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle DELETE /me request (deactivate).
 */
async function deactivateMe(req, res, next) {
  try {
    const result = await userService.deactivateMe(req.user.id);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle GET /users/:username/profile request.
 */
async function getUserPublicProfile(req, res, next) {
  try {
    const targetUser = await userService.getUserByUsername(req.params.username);
    if (!targetUser) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: "User not found",
      });
    }
    const result = await userService.getProfile(targetUser.id, req.user?.id);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle POST /users/:userId/follow request.
 */
async function followUser(req, res, next) {
  try {
    const result = await userService.followUser(req.user.id, req.params.userId);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle DELETE /users/:userId/follow request.
 */
async function unfollowUser(req, res, next) {
  try {
    const result = await userService.unfollowUser(req.user.id, req.params.userId);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMe,
  updateMe,
  getProfile,
  updateProfile,
  getSettings,
  updateSettings,
  deactivateMe,
  getUserPublicProfile,
  followUser,
  unfollowUser,
};
