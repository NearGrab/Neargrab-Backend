const pinoHttp = require("pino-http");
const logger = require("../config/logger");
const env = require("../config/env");

const loggerMiddleware = pinoHttp({
  logger,
  genReqId: (req) => req.id,
  quietReqLogger: env.NODE_ENV === "test",
  // auto-log requests in non-test env
  autoLogging: {
    ignore: (req) => {
      // Ignore health check routes if we want to reduce noise,
      // but standard is fine unless test env where we ignore all
      return env.NODE_ENV === "test";
    }
  },
  customProps: (req) => {
    return {
      requestId: req.id,
    };
  },
});

module.exports = loggerMiddleware;
