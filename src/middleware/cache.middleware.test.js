const cacheMiddleware = require("./cache.middleware");
const cache = require("../lib/cache");

jest.mock("../lib/cache", () => {
  const store = new Map();
  return {
    get: jest.fn((key) => store.get(key)),
    set: jest.fn((key, val, ttl, tags) => store.set(key, val)),
    clear: jest.fn(() => store.clear()),
    invalidate: jest.fn(),
  };
});

describe("cacheMiddleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    cache.clear();
    req = {
      method: "GET",
      originalUrl: "/api/v1/test",
      query: {},
      params: {},
      user: null,
    };
    res = {
      statusCode: 200,
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it("should bypass caching for non-GET methods", () => {
    req.method = "POST";
    const middleware = cacheMiddleware();
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(cache.get).not.toHaveBeenCalled();
  });

  it("should return cached response if exist", () => {
    cache.set("guest:/api/v1/test", { data: "cached" });

    const middleware = cacheMiddleware();
    middleware(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ data: "cached" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should differentiate guest and logged-in user in cache key", () => {
    req.user = { id: "user-123" };
    cache.set("user:user-123:/api/v1/test", { data: "user-cached" });

    const middleware = cacheMiddleware();
    middleware(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ data: "user-cached" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should intercept res.json and store response in cache", () => {
    const originalMockJson = res.json;
    const middleware = cacheMiddleware({ ttlSeconds: 30, tags: ["test-tag"] });
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();

    // Call intercepted res.json
    const body = { success: true, payload: "fresh-data" };
    res.json(body);

    expect(cache.set).toHaveBeenCalledWith(
      "guest:/api/v1/test",
      body,
      30,
      ["test-tag"]
    );
    expect(originalMockJson).toHaveBeenCalledWith(body);
  });
});
