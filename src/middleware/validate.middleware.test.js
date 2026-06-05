const { z } = require("zod");
const validate = require("./validate.middleware");
const { AppError } = require("../lib/errors");

describe("Validate Middleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {},
    };
    res = {};
    next = jest.fn();
  });

  const bodySchema = z.object({
    username: z.string().min(3),
    age: z.number().int().positive(),
  });

  const querySchema = z.object({
    limit: z.coerce.number().int().default(10),
  });

  it("should pass when the request body matches the schema and update req.body", () => {
    req.body = { username: "alice", age: 25, extra: "ignored" }; // wait: if strict mode is not used, it filters extra fields
    const middleware = validate({ body: bodySchema });
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    // Zod strips extra parameters by default unless using .passthrough()
    expect(req.body).toEqual({ username: "alice", age: 25 });
  });

  it("should fail and forward an AppError with 400 status if request body is invalid", () => {
    req.body = { username: "al", age: -5 };
    const middleware = validate({ body: bodySchema });
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details.username).toBeDefined();
    expect(error.details.age).toBeDefined();
  });

  it("should coerce query parameters and apply defaults", () => {
    req.query = { limit: "25" };
    const middleware = validate({ query: querySchema });
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.query.limit).toBe(25);
  });
});
