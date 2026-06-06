const express = require("express");
const { authenticate } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const onboardingController = require("./onboarding.controller");
const onboardingSchema = require("./onboarding.schema");

const router = express.Router();

router.get("/", authenticate, onboardingController.getState);

router.post(
  "/",
  authenticate,
  validate({ body: onboardingSchema.startDraftBody }),
  onboardingController.createDraft
);

router.patch(
  "/details",
  authenticate,
  validate({ body: onboardingSchema.detailsBody }),
  onboardingController.patchDetails
);

router.patch(
  "/address",
  authenticate,
  validate({ body: onboardingSchema.addressBody }),
  onboardingController.patchAddress
);

router.patch(
  "/contact",
  authenticate,
  validate({ body: onboardingSchema.contactBody }),
  onboardingController.patchContact
);

router.patch(
  "/business",
  authenticate,
  validate({ body: onboardingSchema.businessBody }),
  onboardingController.patchBusiness
);

router.patch(
  "/photos",
  authenticate,
  validate({ body: onboardingSchema.photosBody }),
  onboardingController.patchPhotos
);

router.post("/submit", authenticate, onboardingController.submitDraft);

module.exports = router;
