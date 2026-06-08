const logger = require("../config/logger");
const env = require("../config/env");

function loggerMiddleware(req, res, next) {
  // Attach req.log for error handlers and controllers
  req.log = logger.child({ requestId: req.id });

  if (env.NODE_ENV === "test") {
    return next();
  }

  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const timestamp = new Date().toISOString();
    const url = req.originalUrl || req.url;

    // Method URL request ip time-taken timestamp
    console.log(`${req.method} ${url} ${ip} ${duration}ms ${timestamp}`);
  });

  next();
}

module.exports = loggerMiddleware;
