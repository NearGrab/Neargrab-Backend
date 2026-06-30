const { getPrisma } = require("../../config/prisma");

/**
 * Log a new visitor page hit.
 */
async function logVisit({ visitorId, path, ipAddress, userAgent }) {
  const prisma = getPrisma();
  
  return prisma.visitorLog.create({
    data: {
      visitorId,
      path,
      ipAddress,
      userAgent
    }
  });
}

module.exports = {
  logVisit
};
