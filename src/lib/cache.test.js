const cache = require("./cache");

describe("MemoryCache", () => {
  beforeEach(() => {
    cache.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should set and get values successfully", () => {
    cache.set("foo", "bar", 10);
    expect(cache.get("foo")).toBe("bar");
  });

  it("should return null for non-existent keys", () => {
    expect(cache.get("non-existent")).toBeNull();
  });

  it("should expire keys after their TTL", () => {
    cache.set("test-key", "test-val", 5);
    expect(cache.get("test-key")).toBe("test-val");

    // Advance time by 6 seconds
    jest.advanceTimersByTime(6000);

    expect(cache.get("test-key")).toBeNull();
  });

  it("should invalidate keys by tags", () => {
    cache.set("k1", "v1", 60, ["tag1", "common"]);
    cache.set("k2", "v2", 60, ["tag2", "common"]);
    cache.set("k3", "v3", 60, ["tag3"]);

    expect(cache.get("k1")).toBe("v1");
    expect(cache.get("k2")).toBe("v2");
    expect(cache.get("k3")).toBe("v3");

    // Invalidate tag1
    cache.invalidate(["tag1"]);
    expect(cache.get("k1")).toBeNull();
    expect(cache.get("k2")).toBe("v2");
    expect(cache.get("k3")).toBe("v3");

    // Invalidate common
    cache.set("k1", "v1", 60, ["tag1", "common"]); // Reset k1
    cache.invalidate(["common"]);
    expect(cache.get("k1")).toBeNull();
    expect(cache.get("k2")).toBeNull();
    expect(cache.get("k3")).toBe("v3");
  });

  it("should clear all keys", () => {
    cache.set("k1", "v1", 60);
    cache.set("k2", "v2", 60);

    expect(cache.get("k1")).toBe("v1");
    expect(cache.get("k2")).toBe("v2");

    cache.clear();

    expect(cache.get("k1")).toBeNull();
    expect(cache.get("k2")).toBeNull();
  });
});
