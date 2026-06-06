const { sendSuccess } = require("../../lib/response");
const reservationService = require("./reservation.service");

async function createReservation(req, res, next) {
  try {
    const data = await reservationService.createReservation(
      req.user.id,
      req.body
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function listReservations(req, res, next) {
  try {
    const result = await reservationService.listReservations(
      req.user.id,
      req.query
    );
    return sendSuccess(res, result.data, result.meta);
  } catch (error) {
    return next(error);
  }
}

async function getReservationDetail(req, res, next) {
  try {
    const data = await reservationService.getReservationDetail(
      req.user.id,
      req.params.reservationId
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function cancelReservation(req, res, next) {
  try {
    const data = await reservationService.cancelReservation(
      req.user.id,
      req.params.reservationId,
      req.body
    );
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

async function expireReservations(req, res, next) {
  try {
    const data = await reservationService.expireReservations(new Date());
    return sendSuccess(res, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createReservation,
  listReservations,
  getReservationDetail,
  cancelReservation,
  expireReservations,
};
