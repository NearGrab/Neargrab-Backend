const express = require("express");
const validate = require("../../middleware/validate.middleware");
const { authenticate } = require("../../middleware/auth.middleware");
const { authLimiter, otpLimiter } = require("../../middleware/security.middleware");
const authController = require("./auth.controller");
const authSchemas = require("./auth.schema");

const router = express.Router();

router.post(
  "/signup",
  validate({ body: authSchemas.signupBody }),
  authController.signup
);

router.post(
  "/login",
  authLimiter,
  validate({ body: authSchemas.loginBody }),
  authController.login
);

router.post(
  "/google",
  validate({ body: authSchemas.googleBody }),
  authController.googleAuth
);

router.post(
  "/otp/request",
  otpLimiter,
  validate({ body: authSchemas.otpRequestBody }),
  authController.otpRequest
);

router.post(
  "/otp/verify",
  validate({ body: authSchemas.otpVerifyBody }),
  authController.otpVerify
);

router.post(
  "/refresh",
  validate({ body: authSchemas.refreshBody }),
  authController.refresh
);

router.post("/logout", authenticate, authController.logout);

router.post("/logout-all", authenticate, authController.logoutAll);

router.post(
  "/password/forgot",
  validate({ body: authSchemas.forgotPasswordBody }),
  authController.forgotPassword
);

router.post(
  "/password/reset",
  validate({ body: authSchemas.resetPasswordBody }),
  authController.resetPassword
);

module.exports = router;
