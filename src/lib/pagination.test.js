const {
  parsePagination,
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} = require("./pagination");

describe("Pagination Utility", () => {
  describe("parsePagination", () => {
    it("should parse valid pagination strings into numbers", () => {
      const result = parsePagination({ page: "3", limit: "15" });
      expect(result).toEqual({
        page: 3,
        limit: 15,
        skip: 30,
        take: 15,
      });
    });

    it("should use defaults if parameters are missing or invalid", () => {
      const result = parsePagination({});
      expect(result).toEqual({
        page: DEFAULT_PAGE,
        limit: DEFAULT_LIMIT,
        skip: 0,
        take: DEFAULT_LIMIT,
      });

      const invalidResult = parsePagination({ page: "abc", limit: "-5" });
      expect(invalidResult).toEqual({
        page: DEFAULT_PAGE,
        limit: DEFAULT_LIMIT,
        skip: 0,
        take: DEFAULT_LIMIT,
      });
    });

    it("should clamp limit to MAX_LIMIT if it exceeds it", () => {
      const result = parsePagination({ page: "1", limit: "500" });
      expect(result.limit).toBe(MAX_LIMIT);
      expect(result.take).toBe(MAX_LIMIT);
    });
  });

  describe("buildPaginationMeta", () => {
    it("should construct metadata correctly", () => {
      const meta = buildPaginationMeta({ page: 2, limit: 10, total: 35 });
      expect(meta).toEqual({
        page: 2,
        limit: 10,
        total: 35,
        totalPages: 4,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    it("should handle boundary cases where page is last page", () => {
      const meta = buildPaginationMeta({ page: 4, limit: 10, total: 35 });
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(true);
    });

    it("should handle total of 0", () => {
      const meta = buildPaginationMeta({ page: 1, limit: 20, total: 0 });
      expect(meta.totalPages).toBe(1);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(false);
    });
  });
});
