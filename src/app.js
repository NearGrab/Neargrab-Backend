const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pinoHttp = require("pino-http");
const env = require("./config/env");
const logger = require("./config/logger");
const routes = require("./routes");
const { AppError, ERROR_CODES } = require("./lib/errors");
const { sendError } = require("./lib/response");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(
        new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: "Origin is not allowed by CORS",
        }),
      );
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(
  pinoHttp({
    logger,
    quietReqLogger: env.NODE_ENV === "test",
    autoLogging: false,
  }),
);
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info(
      `[request] ${req.method} ${req.originalUrl} ${res.statusCode} ${req.ip} ${Math.round(durationMs)}ms`,
    );
  });

  next();
});

app.use(routes);

app.use((req, _res, next) => {
  next(
    new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: `Route ${req.method} ${req.originalUrl} not found`,
    }),
  );
});

app.use((err, req, res, _next) => {
  const appError =
    err instanceof AppError
      ? err
      : new AppError({
          message:
            env.NODE_ENV === "production"
              ? "Something went wrong"
              : err.message || "Something went wrong",
        });

  if (!(err instanceof AppError)) {
    req.log?.error({ err }, "Unhandled application error");
  }

  return sendError(res, {
    statusCode: appError.statusCode,
    code: appError.code,
    message: appError.message,
    details: appError.details,
  });
});

module.exports = app;
