const request = require("supertest");
const app = require("./app");

describe("GET /health", () => {
  it("returns the backend health payload", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        status: "ok",
        service: "backend",
        timestamp: expect.any(String),
      },
    });
  });
});
