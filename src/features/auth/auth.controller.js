const { sendSuccess } = require("../../lib/response");
const authService = require("./auth.service");
const tokenService = require("./token.service");

/**
 * Handle signup request.
 */
async function signup(req, res, next) {
  try {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    const result = await authService.signup({
      ...req.body,
      userAgent,
      ipAddress,
    });
    return sendSuccess(res, result, undefined, 201);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle login request.
 */
async function login(req, res, next) {
  try {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    const result = await authService.login({
      ...req.body,
      userAgent,
      ipAddress,
    });
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle Google authentication request.
 */
async function googleAuth(req, res, next) {
  try {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    const result = await authService.googleAuth({
      ...req.body,
      userAgent,
      ipAddress,
    });
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle OTP request.
 */
async function otpRequest(req, res, next) {
  try {
    const { identifier, purpose } = req.body;
    const result = await authService.otpRequest(identifier, purpose);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle OTP verification request.
 */
async function otpVerify(req, res, next) {
  try {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    const result = await authService.otpVerify({
      ...req.body,
      userAgent,
      ipAddress,
    });
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle token rotation refresh request.
 */
async function refresh(req, res, next) {
  try {
    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;
    const { refreshToken } = req.body;
    const result = await tokenService.rotateTokens(refreshToken, userAgent, ipAddress);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle logout current session request.
 */
async function logout(req, res, next) {
  try {
    const result = await authService.logout(req.user.sessionId);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle logout all sessions request.
 */
async function logoutAll(req, res, next) {
  try {
    const result = await authService.logoutAll(req.user.id);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle forgot password request.
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle reset password request.
 */
async function resetPassword(req, res, next) {
  try {
    const { email, code, password } = req.body;
    const result = await authService.resetPassword(email, code, password);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  signup,
  login,
  googleAuth,
  otpRequest,
  otpVerify,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
};
