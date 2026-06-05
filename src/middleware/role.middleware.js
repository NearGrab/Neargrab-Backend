const { AppError, ERROR_CODES } = require("../lib/errors");
const { getPrisma } = require("../config/prisma");

/**
 * Middleware to require one of the specified roles.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError({
          statusCode: 401,
          code: ERROR_CODES.UNAUTHENTICATED,
          message: "Authentication required",
        })
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: "Access forbidden: insufficient role permissions",
        })
      );
    }

    next();
  };
}

/**
 * Middleware to require any of the specified roles array.
 */
function requireAnyRole(roles) {
  return requireRole(...roles);
}

/**
 * Middleware to require a specific permission for admin routes.
 * SUPER_ADMIN is automatically granted all permissions.
 * Other admin roles are looked up in the AdminPermission table.
 */
function requireAdminPermission(permission) {
  return async (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError({
          statusCode: 401,
          code: ERROR_CODES.UNAUTHENTICATED,
          message: "Authentication required",
        })
      );
    }

    // SUPER_ADMIN has full permissions
    if (req.user.role === "SUPER_ADMIN") {
      return next();
    }

    try {
      const prisma = getPrisma();
      const permissionRecord = await prisma.adminPermission.findUnique({
        where: {
          role_permission: {
            role: req.user.role,
            permission,
          },
        },
      });

      if (!permissionRecord) {
        return next(
          new AppError({
            statusCode: 403,
            code: ERROR_CODES.FORBIDDEN,
            message: `Access forbidden: requires permission '${permission}'`,
          })
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  requireRole,
  requireAnyRole,
  requireAdminPermission,
};
