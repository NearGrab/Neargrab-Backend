const requestIdMiddleware = require("./request-id.middleware");

describe("requestIdMiddleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      setHeader: jest.fn(),
    };
    next = jest.fn();
  });

  it("should generate a new UUID if x-request-id is not present", () => {
    requestIdMiddleware(req, res, next);

    expect(req.id).toBeDefined();
    expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", req.id);
    expect(next).toHaveBeenCalled();
  });

  it("should preserve x-request-id if present in headers", () => {
    const customId = "my-custom-request-id-123";
    req.headers["x-request-id"] = customId;

    requestIdMiddleware(req, res, next);

    expect(req.id).toBe(customId);
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", customId);
    expect(next).toHaveBeenCalled();
  });
});
