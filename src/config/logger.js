const pino = require("pino");
const env = require("./env");

const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : process.env.LOG_LEVEL || "info",
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;
