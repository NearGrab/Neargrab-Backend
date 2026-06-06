const reservationService = require("./reservation.service");
const { AppError } = require("../../lib/errors");

const mockPrisma = {
  cart: {
    findUnique: jest.fn(),
  },
  cartItem: {
    deleteMany: jest.fn(),
  },
  product: {
    findFirst: jest.fn(),
  },
  shop: {
    findUnique: jest.fn(),
  },
  reservation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  reservationItem: {
    createMany: jest.fn(),
  },
  notificationPreference: {
    findUnique: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock("../../config/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

jest.mock("../../lib/transaction", () => ({
  runInTransaction: (callback) => callback(mockPrisma),
}));

describe("ReservationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const dummyUserId = "user-123";

  describe("createReservation - direct mode", () => {
    it("should create reservation directly from product", async () => {
      const mockProduct = {
        id: "prod-1",
        name: "Direct Product",
        pricePaise: 500,
        status: "ACTIVE",
        stockAvailable: true,
        stockStatus: "IN_STOCK",
        shopId: "shop-1",
        shop: {
          id: "shop-1",
          name: "Test Shop",
          status: "ACTIVE",
          deletedAt: null,
          ownerId: "owner-1",
        },
      };

      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.reservation.create.mockResolvedValue({
        id: "res-1",
        status: "REQUESTED",
        totalPaise: 1000,
      });
      mockPrisma.shop.findUnique.mockResolvedValue({
        id: "shop-1",
        name: "Test Shop",
        ownerId: "owner-1",
      });
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: "res-1",
        status: "REQUESTED",
        totalPaise: 1000,
        createdAt: new Date(),
        items: [
          {
            id: "rit-1",
            productId: "prod-1",
            quantity: 2,
            pricePaiseSnapshot: 500,
            product: { id: "prod-1", name: "Direct Product", slug: "direct" },
          },
        ],
        shop: { id: "shop-1", name: "Test Shop", slug: "test" },
      });

      const result = await reservationService.createReservation(dummyUserId, {
        source: "direct",
        productId: "prod-1",
        quantity: 2,
        customerNote: "Please pack it",
      });

      expect(result.id).toBe("res-1");
      expect(mockPrisma.reservation.create).toHaveBeenCalled();
      expect(mockPrisma.reservationItem.createMany).toHaveBeenCalledWith({
        data: [
          {
            reservationId: "res-1",
            productId: "prod-1",
            quantity: 2,
            pricePaiseSnapshot: 500,
          },
        ],
      });
    });
  });

  describe("createReservation - cart mode", () => {
    it("should throw error if cart has multiple shops and shopId is missing", async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({
        id: "cart-1",
        items: [
          { productId: "p-1", quantity: 1, product: { shopId: "shop-1" } },
          { productId: "p-2", quantity: 1, product: { shopId: "shop-2" } },
        ],
      });

      await expect(
        reservationService.createReservation(dummyUserId, { source: "cart" })
      ).rejects.toThrow("Cart has items from multiple shops. Please select a shop");
    });
  });

  describe("cancelReservation", () => {
    it("should cancel reservation successfully if in REQUESTED state", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: "res-1",
        userId: dummyUserId,
        status: "REQUESTED",
        customerNote: "Hi",
        shop: { id: "shop-1", name: "Test Shop", ownerId: "owner-1" },
      });

      mockPrisma.reservation.update.mockResolvedValue({
        id: "res-1",
        status: "CANCELLED",
        totalPaise: 500,
        currency: "INR",
        customerNote: "Hi (Cancellation Reason: Changed my mind)",
        createdAt: new Date(),
        shop: { id: "shop-1", name: "Test Shop", ownerId: "owner-1" },
        items: [],
      });

      const result = await reservationService.cancelReservation(
        dummyUserId,
        "res-1",
        { reason: "Changed my mind" }
      );

      expect(result.status).toBe("CANCELLED");
      expect(mockPrisma.reservation.update).toHaveBeenCalled();
    });

    it("should throw error if status is not REQUESTED or ACCEPTED", async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: "res-1",
        userId: dummyUserId,
        status: "COMPLETED",
        shop: { id: "shop-1" },
      });

      await expect(
        reservationService.cancelReservation(dummyUserId, "res-1", {
          reason: "No",
        })
      ).rejects.toThrow("Only REQUESTED or ACCEPTED reservations can be cancelled");
    });
  });

  describe("expireReservations", () => {
    it("should expire all matching reservations", async () => {
      const mockExpired = [
        { id: "res-1", userId: "user-1", shop: { id: "shop-1", name: "Shop 1" } },
        { id: "res-2", userId: "user-2", shop: { id: "shop-2", name: "Shop 2" } },
      ];

      mockPrisma.reservation.findMany.mockResolvedValue(mockExpired);

      const result = await reservationService.expireReservations(new Date());

      expect(result.count).toBe(2);
      expect(result.ids).toContain("res-1");
      expect(mockPrisma.reservation.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["res-1", "res-2"] } },
        data: { status: "EXPIRED" },
      });
    });
  });
});
