const { runInTransaction } = require("./transaction");

// Mock prisma config
const mockPrisma = {
  $transaction: jest.fn((callback) => callback("mock-tx")),
};
jest.mock("../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

describe("Transaction Helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should run the transaction callback and return its value", async () => {
    const callback = jest.fn((tx) => `result-${tx}`);
    const options = { maxWait: 5000 };

    const result = await runInTransaction(callback, options);

    expect(result).toBe("result-mock-tx");
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(callback, options);
    expect(callback).toHaveBeenCalledWith("mock-tx");
  });
});
