const { sendSuccess } = require("../../lib/response");
const onboardingService = require("./onboarding.service");

async function getState(req, res, next) {
  try {
    const data = await onboardingService.getOnboardingState(req.user.id);
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function createDraft(req, res, next) {
  try {
    const data = await onboardingService.startDraft(req.user.id, req.body);
    return sendSuccess(res, data, undefined, 201);
  } catch (err) {
    next(err);
  }
}

async function patchDetails(req, res, next) {
  try {
    const data = await onboardingService.updateDetails(req.user.id, req.body);
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function patchAddress(req, res, next) {
  try {
    const data = await onboardingService.updateAddress(req.user.id, req.body);
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function patchContact(req, res, next) {
  try {
    const data = await onboardingService.updateContact(req.user.id, req.body);
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function patchBusiness(req, res, next) {
  try {
    const data = await onboardingService.updateBusiness(req.user.id, req.body);
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function patchPhotos(req, res, next) {
  try {
    const data = await onboardingService.updatePhotos(req.user.id, req.body);
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

async function submitDraft(req, res, next) {
  try {
    const data = await onboardingService.submitOnboarding(req.user.id);
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getState,
  createDraft,
  patchDetails,
  patchAddress,
  patchContact,
  patchBusiness,
  patchPhotos,
  submitDraft,
};
