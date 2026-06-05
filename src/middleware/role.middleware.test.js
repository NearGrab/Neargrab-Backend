const { requireRole, requireAdminPermission } = require("./role.middleware");
const { AppError } = require("../lib/errors");

// Mock prisma config
const mockPrisma = {
  adminPermission: {
    findUnique: jest.fn(),
  },
};
jest.mock("../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

describe("Role Middleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {};
    res = {};
    next = jest.fn();
  });

  describe("requireRole", () => {
    it("should return 401 if req.user is missing", () => {
      const middleware = requireRole("ADMIN");
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("UNAUTHENTICATED");
    });

    it("should return 403 if req.user.role is not allowed", () => {
      req.user = { id: "user-1", role: "CUSTOMER" };
      const middleware = requireRole("ADMIN", "SUPER_ADMIN");
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("FORBIDDEN");
    });

    it("should call next if req.user.role matches", () => {
      req.user = { id: "user-1", role: "ADMIN" };
      const middleware = requireRole("ADMIN", "SUPER_ADMIN");
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("requireAdminPermission", () => {
    it("should return 401 if req.user is missing", async () => {
      const middleware = requireAdminPermission("manage_users");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it("should allow SUPER_ADMIN role without checking database", async () => {
      req.user = { id: "user-1", role: "SUPER_ADMIN" };
      const middleware = requireAdminPermission("manage_users");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(mockPrisma.adminPermission.findUnique).not.toHaveBeenCalled();
    });

    it("should allow other admin roles if they have the permission in database", async () => {
      req.user = { id: "user-1", role: "CONTENT_ADMIN" };
      mockPrisma.adminPermission.findUnique.mockResolvedValue({
        id: "perm-1",
        role: "CONTENT_ADMIN",
        permission: "edit_content",
      });

      const middleware = requireAdminPermission("edit_content");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(mockPrisma.adminPermission.findUnique).toHaveBeenCalledWith({
        where: {
          role_permission: {
            role: "CONTENT_ADMIN",
            permission: "edit_content",
          },
        },
      });
    });

    it("should block request with 403 if permission is missing in database", async () => {
      req.user = { id: "user-1", role: "CONTENT_ADMIN" };
      mockPrisma.adminPermission.findUnique.mockResolvedValue(null);

      const middleware = requireAdminPermission("delete_database");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("FORBIDDEN");
    });
  });
});
