const app = require("./app");
const env = require("./config/env");
const logger = require("./config/logger");
const { disconnectPrisma } = require("./config/prisma");

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      url: `${env.PUBLIC_BASE_URL}/health`,
    },
    "Backend server started",
  );
});

async function shutdown(signal) {
  logger.info({ signal }, "Shutting down backend server");

  server.close(async (error) => {
    if (error) {
      logger.error({ err: error }, "Error while closing HTTP server");
      process.exit(1);
    }

    try {
      await disconnectPrisma();
      process.exit(0);
    } catch (disconnectError) {
      logger.error({ err: disconnectError }, "Error while disconnecting Prisma");
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
