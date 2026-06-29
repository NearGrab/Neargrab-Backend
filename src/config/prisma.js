const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const env = require("./env");
const logger = require("./logger");

let prisma;
let pool;

function createPrismaClient() {
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 3,
  });
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
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
      // prisma.$on("query", (event) => {
      //   logger.info(`Prisma Query: ${event.query} - Duration: ${event.duration}ms`);
      // });
    }
  }

  return prisma;
}

async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = {
  get prisma() {
    return getPrisma();
  },
  getPrisma,
  disconnectPrisma,
};
