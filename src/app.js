const express = require("express");
const requestIdMiddleware = require("./middleware/request-id.middleware");
const loggerMiddleware = require("./middleware/logger.middleware");
const {
  helmetMiddleware,
  corsMiddleware,
  jsonMiddleware,
  urlEncodedMiddleware,
  generalLimiter,
} = require("./middleware/security.middleware");
const routes = require("./routes");
const notFoundMiddleware = require("./middleware/not-found.middleware");
const errorMiddleware = require("./middleware/error.middleware");

const app = express();

// Request ID attachment
app.use(requestIdMiddleware);

// Structured logger
app.use(loggerMiddleware);

// Security and body parsing
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(jsonMiddleware);
app.use(urlEncodedMiddleware);

// Rate limiting
app.use(generalLimiter);

// App routes
app.use(routes);

// Not Found Handler
app.use(notFoundMiddleware);

// Centralized Error Handler
app.use(errorMiddleware);

module.exports = app;
