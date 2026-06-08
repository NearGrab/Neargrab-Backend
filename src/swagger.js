const express = require("express");
const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
const path = require("path");
const yaml = require("yaml");
const helmet = require("helmet");

const file = fs.readFileSync(path.join(__dirname, "../Docs/openapi.yaml"), "utf8");
const swaggerDocument = yaml.parse(file);

const router = express.Router();

// Custom CSP for Swagger UI to work with helmet
const swaggerHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https://validator.swagger.io"],
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      "style-src": ["'self'", "'unsafe-inline'"],
    },
  },
});

router.use(
  "/",
  swaggerHelmet,
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument)
);

module.exports = router;