const { sendSuccess } = require("../../lib/response");
const notificationService = require("./notification.service");

async function listNotifications(req, res, next) {
  try {
    const result = await notificationService.listNotifications(
      req.user.id,
      req.query
    );
    return sendSuccess(res, result.data, result.meta);
  } catch (error) {
    return next(error);
  }
}

async function markAsRead(req, res, next) {
  try {
    const data = await notificationService.markAsRead(
      req.user.id,
      req.params.notificationId
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    const data = await notificationService.markAllAsRead(req.user.id);
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function deleteNotification(req, res, next) {
  try {
    const data = await notificationService.deleteNotification(
      req.user.id,
      req.params.notificationId
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function getPreferences(req, res, next) {
  try {
    const data = await notificationService.getPreferences(req.user.id);
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function updatePreferences(req, res, next) {
  try {
    const data = await notificationService.updatePreferences(
      req.user.id,
      req.body
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
};
