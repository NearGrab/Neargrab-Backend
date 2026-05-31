const { PrismaClient } = require("@prisma/client");
const env = require("./env");
const logger = require("./logger");

let prisma;

function createPrismaClient() {
  return new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "error" },
            { emit: "event", level: "warn" },
          ]
        : [{ emit: "event", level: "error" }],
  });
}

function getPrisma() {
  if (!prisma) {
    prisma = createPrismaClient();

    prisma.$on("error", (event) => {
      logger.error({ prisma: event }, "Prisma error");
    });

    if (env.NODE_ENV === "development") {
      prisma.$on("warn", (event) => {
        logger.warn({ prisma: event }, "Prisma warning");
      });
    }
  }

  return prisma;
}

async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}

module.exports = {
  get prisma() {
    return getPrisma();
  },
  getPrisma,
  disconnectPrisma,
};
