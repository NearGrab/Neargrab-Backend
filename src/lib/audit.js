const { getPrisma } = require("../config/prisma");

/**
 * Creates an audit log entry.
 * Can be run inside an existing transaction by passing `tx`.
 */
async function createAuditLog({
  actorId,
  action,
  entityType,
  entityId,
  before = null,
  after = null,
  ipAddress = null,
  userAgent = null,
  tx = null,
}) {
  const client = tx || getPrisma();
  return client.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      before: before ? JSON.stringify(before) : null,
      after: after ? JSON.stringify(after) : null,
      ipAddress,
      userAgent,
    },
  });
}

module.exports = {
  createAuditLog,
};
