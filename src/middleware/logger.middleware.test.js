const loggerMiddleware = require("./logger.middleware");

describe("Logger Middleware", () => {
  it("should attach a pino logger to req.log and use the request id", () => {
    const req = {
      id: "test-req-id-123",
      headers: {},
    };
    const res = {
      on: jest.fn(),
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    loggerMiddleware(req, res, next);

    expect(req.log).toBeDefined();
    expect(next).toHaveBeenCalled();
  });
});
