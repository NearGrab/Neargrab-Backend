const express = require("express");
const { authenticate } = require("../../middleware/auth.middleware");
const { requireRole } = require("../../middleware/role.middleware");
const validate = require("../../middleware/validate.middleware");
const reservationController = require("./reservation.controller");
const reservationSchema = require("./reservation.schema");

const router = express.Router();

router.post(
  "/",
  authenticate,
  validate({ body: reservationSchema.createReservationBody }),
  reservationController.createReservation
);

router.get(
  "/",
  authenticate,
  validate({ query: reservationSchema.queryReservations }),
  reservationController.listReservations
);

router.post(
  "/expire",
  authenticate,
  requireRole("ADMIN", "SUPER_ADMIN", "SUPPORT_ADMIN"),
  reservationController.expireReservations
);

router.get(
  "/:reservationId",
  authenticate,
  validate({ params: reservationSchema.reservationIdParam }),
  reservationController.getReservationDetail
);

router.patch(
  "/:reservationId/cancel",
  authenticate,
  validate({
    params: reservationSchema.reservationIdParam,
    body: reservationSchema.cancelReservationBody,
  }),
  reservationController.cancelReservation
);

module.exports = router;
