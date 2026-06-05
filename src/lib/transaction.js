const { getPrisma } = require("../config/prisma");

/**
 * Executes a callback within a Prisma transaction block.
 * Passes the transaction transaction client to the callback.
 */
async function runInTransaction(callback, options) {
  const prisma = getPrisma();
  return prisma.$transaction(callback, options);
}

module.exports = {
  runInTransaction,
};
