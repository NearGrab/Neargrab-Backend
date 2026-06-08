const request = require("supertest");

const mockPrisma = {
  shopAddress: {
    findMany: jest.fn(),
  },
  category: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  brand: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  user: {
    count: jest.fn(),
  },
  shop: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  product: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  banner: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock("./config/prisma", () => ({
  getPrisma: () => mockPrisma,
  prisma: mockPrisma,
  disconnectPrisma: jest.fn(),
}));

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

describe("GET /api/v1/meta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns seeded metadata lists and enum values", async () => {
    mockPrisma.shopAddress.findMany.mockResolvedValue([
      { city: "Navsari", state: "Gujarat" },
      { city: "Surat", state: "Gujarat" },
    ]);
    mockPrisma.category.findMany.mockResolvedValue([
      { id: "cat_1", name: "Grocery", slug: "grocery", icon: "grocery" },
    ]);
    mockPrisma.brand.findMany.mockResolvedValue([
      { id: "brand_1", name: "Amul", slug: "amul" },
    ]);

    const response = await request(app).get("/api/v1/meta").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.cities).toEqual([
      { name: "Navsari", state: "Gujarat" },
      { name: "Surat", state: "Gujarat" },
    ]);
    expect(response.body.data.categories).toHaveLength(1);
    expect(response.body.data.brands).toHaveLength(1);
    expect(response.body.data.enums.bannerSections).toContain("TOP_HERO");
  });
});

describe("GET /api/v1/seed-preview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns compact seeded database counts and samples", async () => {
    mockPrisma.user.count.mockResolvedValue(5);
    mockPrisma.shop.count.mockResolvedValue(2);
    mockPrisma.product.count.mockResolvedValue(12);
    mockPrisma.category.count.mockResolvedValue(6);
    mockPrisma.brand.count.mockResolvedValue(6);
    mockPrisma.banner.count.mockResolvedValue(1);
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: "product_1",
        name: "Amul Butter 500g",
        pricePaise: 28000,
        stockStatus: "IN_STOCK",
        status: "ACTIVE",
        shop: { id: "shop_1", name: "Patel Daily Mart", slug: "patel-daily-mart" },
        category: { id: "cat_1", name: "Grocery", slug: "grocery" },
      },
    ]);
    mockPrisma.shop.findMany.mockResolvedValue([
      {
        id: "shop_1",
        name: "Patel Daily Mart",
        slug: "patel-daily-mart",
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
        address: { city: "Navsari", state: "Gujarat", pincode: "396445" },
      },
    ]);
    mockPrisma.banner.findMany.mockResolvedValue([
      {
        id: "banner_1",
        title: "Navsari Local Deals",
        city: "Navsari",
        section: "TOP_HERO",
        status: "ACTIVE",
        startAt: new Date("2026-01-01T00:00:00.000Z"),
        endAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    ]);

    const response = await request(app).get("/api/v1/seed-preview").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      userCount: 5,
      shopCount: 2,
      productCount: 12,
      categoryCount: 6,
      brandCount: 6,
      activeBannerCount: 1,
    });
    expect(response.body.data.recentProducts).toHaveLength(1);
    expect(response.body.data.sampleShops).toHaveLength(1);
    expect(response.body.data.sampleBanners).toHaveLength(1);
  });
});

describe("GET /docs", () => {
  it("redirects to /docs/", async () => {
    await request(app)
      .get("/docs")
      .expect(301)
      .expect("Location", "/docs/");
  });

  it("serves the Swagger UI HTML at /docs/", async () => {
    const response = await request(app)
      .get("/docs/")
      .expect(200);
    
    expect(response.text).toContain("swagger-ui");
  });
});

