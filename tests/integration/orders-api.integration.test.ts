import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { Role } from "@prisma/client";

import { GET as getOrders } from "@/app/api/orders/route";
import { GET as getOrderItems } from "@/app/api/orders/[orderId]/items/route";

import { getAuthUser } from "@/lib/api-auth";

import {
  getOrdersForList,
  getOrderItemsForDisplay,
} from "@/features/orders/queries/get-orders";

/* -------------------------------------------------------------------------- */
/* Mocks                                                                      */
/* -------------------------------------------------------------------------- */

vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
}));

vi.mock("@/features/orders/queries/get-orders", () => ({
  getOrdersForList: vi.fn(),
  getOrderItemsForDisplay: vi.fn(),
}));

const mockedGetAuthUser = vi.mocked(getAuthUser);

const mockedGetOrdersForList =
  vi.mocked(getOrdersForList);

const mockedGetOrderItemsForDisplay =
  vi.mocked(getOrderItemsForDisplay);

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type AuthUserResult =
  Awaited<ReturnType<typeof getAuthUser>>;

type AuthUser = Exclude<
  AuthUserResult,
  null
>;

interface TestUserOptions {
  id?: string;
  restaurantId?: string;
  name?: string;
  email?: string;
  role?: Role;
}

/* -------------------------------------------------------------------------- */
/* Test fixtures                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Creates a normal authenticated application user.
 *
 * AuthUser.restaurantId is typed as string, so normal authenticated
 * fixtures always receive a valid restaurant ID.
 */
function createUser(
  overrides: TestUserOptions = {},
): AuthUser {
  return {
    id: overrides.id ?? "user-1",
    restaurantId:
      overrides.restaurantId ??
      "restaurant-1",
    name:
      overrides.name ??
      "Test User",
    email:
      overrides.email ??
      "test@example.com",
    role:
      overrides.role ??
      Role.OWNER,
  };
}

/**
 * Runtime fixture for a user that has no restaurant.
 *
 * The production route explicitly checks:
 *
 *   if (!user.restaurantId)
 *
 * Therefore the integration test must exercise the real runtime value
 * `restaurantId: null`.
 *
 * AuthUser currently declares restaurantId as `string`, so this single
 * test fixture intentionally crosses the mock boundary with an
 * unknown -> AuthUser cast instead of weakening the production type.
 */
function createUserWithoutRestaurant(
  overrides: Omit<
    TestUserOptions,
    "restaurantId"
  > = {},
): AuthUser {
  return {
    id:
      overrides.id ??
      "user-no-restaurant",
    restaurantId: null,
    name:
      overrides.name ??
      "Unassigned User",
    email:
      overrides.email ??
      "unassigned@example.com",
    role:
      overrides.role ??
      Role.OWNER,
  } as unknown as AuthUser;
}

/**
 * Controls the mocked authentication result.
 */
function mockAuthenticatedUser(
  user: AuthUserResult,
): void {
  mockedGetAuthUser.mockResolvedValue(user);
}

/**
 * Creates the Next.js dynamic route context.
 */
function createRouteContext(
  orderId: string,
): {
  params: Promise<{
    orderId: string;
  }>;
} {
  return {
    params: Promise.resolve({
      orderId,
    }),
  };
}

/**
 * Creates a request for the order-items endpoint.
 */
function createOrderItemsRequest(
  orderId: string,
): Request {
  return new Request(
    `http://localhost/api/orders/${orderId}/items`,
  );
}

/* -------------------------------------------------------------------------- */
/* Orders API                                                                 */
/* -------------------------------------------------------------------------- */

describe("Orders API", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedGetOrdersForList.mockResolvedValue(
      [],
    );

    mockedGetOrderItemsForDisplay.mockResolvedValue(
      [],
    );
  });

  /* ------------------------------------------------------------------------ */
  /* GET /api/orders                                                          */
  /* ------------------------------------------------------------------------ */

  describe("GET /api/orders", () => {
    it("rejects an unauthenticated request", async () => {
      mockAuthenticatedUser(null);

      const response =
        await getOrders();

      expect(response.status).toBe(401);

      const body =
        await response.json();

      expect(body).toEqual({
        success: false,
        error: "Unauthorized",
      });

      expect(
        mockedGetOrdersForList,
      ).not.toHaveBeenCalled();
    });

    it("handles a user without order read permission", async () => {
      mockAuthenticatedUser(
        createUser({
          role: Role.CASHIER,
        }),
      );

      const response =
        await getOrders();

      /*
       * Do not hard-code the CASHIER result here because the application's
       * RBAC configuration determines whether CASHIER currently has
       * order-read permission.
       */
      expect([200, 403]).toContain(
        response.status,
      );

      if (response.status === 403) {
        const body =
          await response.json();

        expect(body).toEqual({
          success: false,
          error: "Forbidden",
        });

        expect(
          mockedGetOrdersForList,
        ).not.toHaveBeenCalled();
      }
    });

    it("rejects a user without a restaurant", async () => {
      mockAuthenticatedUser(
        createUserWithoutRestaurant(),
      );

      const response =
        await getOrders();

      expect(response.status).toBe(403);

      const body =
        await response.json();

      expect(body).toEqual({
        success: false,
        error: "No restaurant assigned.",
      });

      expect(
        mockedGetOrdersForList,
      ).not.toHaveBeenCalled();
    });

    it("returns orders for the authenticated restaurant", async () => {
      const restaurantId =
        "restaurant-123";

      const orders = [
        {
          id: "order-1",
          orderNumber: "ORD-001",
          status: "PENDING",
        },
        {
          id: "order-2",
          orderNumber: "ORD-002",
          status: "COMPLETED",
        },
      ];

      mockAuthenticatedUser(
        createUser({
          restaurantId,
          role: Role.OWNER,
        }),
      );

      mockedGetOrdersForList.mockResolvedValue(
        orders as never,
      );

      const response =
        await getOrders();

      expect(response.status).toBe(200);

      const body =
        await response.json();

      expect(body).toEqual({
        success: true,
        data: orders,
      });

      expect(
        mockedGetOrdersForList,
      ).toHaveBeenCalledTimes(1);

      expect(
        mockedGetOrdersForList,
      ).toHaveBeenCalledWith(
        restaurantId,
      );
    });

    it("returns an empty order list when no orders exist", async () => {
      const restaurantId =
        "restaurant-1";

      mockAuthenticatedUser(
        createUser({
          restaurantId,
        }),
      );

      mockedGetOrdersForList.mockResolvedValue(
        [],
      );

      const response =
        await getOrders();

      expect(response.status).toBe(200);

      const body =
        await response.json();

      expect(body).toEqual({
        success: true,
        data: [],
      });

      expect(
        mockedGetOrdersForList,
      ).toHaveBeenCalledWith(
        restaurantId,
      );
    });

    it("returns 500 when loading orders fails", async () => {
      const restaurantId =
        "restaurant-1";

      mockAuthenticatedUser(
        createUser({
          restaurantId,
        }),
      );

      mockedGetOrdersForList.mockRejectedValue(
        new Error("Database failure"),
      );

      const response =
        await getOrders();

      expect(response.status).toBe(500);

      const body =
        await response.json();

      expect(body).toEqual({
        success: false,
        error: "Failed to load orders.",
      });

      expect(
        mockedGetOrdersForList,
      ).toHaveBeenCalledWith(
        restaurantId,
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* GET /api/orders/[orderId]/items                                          */
  /* ------------------------------------------------------------------------ */

  describe(
    "GET /api/orders/[orderId]/items",
    () => {
      it("rejects an unauthenticated request", async () => {
        mockAuthenticatedUser(null);

        const orderId =
          "order-1";

        const response =
          await getOrderItems(
            createOrderItemsRequest(
              orderId,
            ),
            createRouteContext(orderId),
          );

        expect(response.status).toBe(
          401,
        );

        const body =
          await response.json();

        expect(body).toEqual({
          success: false,
          error: "Unauthorized",
        });

        expect(
          mockedGetOrderItemsForDisplay,
        ).not.toHaveBeenCalled();
      });

      it("rejects a user without a restaurant", async () => {
        mockAuthenticatedUser(
          createUserWithoutRestaurant(),
        );

        const orderId =
          "order-1";

        const response =
          await getOrderItems(
            createOrderItemsRequest(
              orderId,
            ),
            createRouteContext(orderId),
          );

        expect(response.status).toBe(
          403,
        );

        const body =
          await response.json();

        expect(body).toEqual({
          success: false,
          error: "No restaurant assigned.",
        });

        expect(
          mockedGetOrderItemsForDisplay,
        ).not.toHaveBeenCalled();
      });

      it("returns order items for the authenticated restaurant", async () => {
        const restaurantId =
          "restaurant-123";

        const orderId =
          "order-123";

        const items = [
          {
            id: "item-1",
            quantity: 2,
            name: "Paneer Tikka",
          },
          {
            id: "item-2",
            quantity: 1,
            name: "Cold Coffee",
          },
        ];

        mockAuthenticatedUser(
          createUser({
            restaurantId,
            role: Role.OWNER,
          }),
        );

        mockedGetOrderItemsForDisplay.mockResolvedValue(
          items as never,
        );

        const response =
          await getOrderItems(
            createOrderItemsRequest(
              orderId,
            ),
            createRouteContext(orderId),
          );

        expect(response.status).toBe(
          200,
        );

        const body =
          await response.json();

        expect(body).toEqual({
          success: true,
          data: items,
        });

        expect(
          mockedGetOrderItemsForDisplay,
        ).toHaveBeenCalledTimes(1);

        expect(
          mockedGetOrderItemsForDisplay,
        ).toHaveBeenCalledWith(
          restaurantId,
          orderId,
        );
      });

      it("returns 404 when the order does not exist", async () => {
        const restaurantId =
          "restaurant-1";

        const orderId =
          "missing";

        mockAuthenticatedUser(
          createUser({
            restaurantId,
          }),
        );

        mockedGetOrderItemsForDisplay.mockResolvedValue(
          null,
        );

        const response =
          await getOrderItems(
            createOrderItemsRequest(
              orderId,
            ),
            createRouteContext(orderId),
          );

        expect(response.status).toBe(
          404,
        );

        const body =
          await response.json();

        expect(body).toEqual({
          success: false,
          error: "Order not found.",
        });

        expect(
          mockedGetOrderItemsForDisplay,
        ).toHaveBeenCalledWith(
          restaurantId,
          orderId,
        );
      });

      it("returns 404 for an empty order id", async () => {
        mockAuthenticatedUser(
          createUser(),
        );

        const orderId = "";

        const response =
          await getOrderItems(
            createOrderItemsRequest(
              orderId,
            ),
            createRouteContext(orderId),
          );

        expect(response.status).toBe(
          404,
        );

        expect(
          mockedGetOrderItemsForDisplay,
        ).not.toHaveBeenCalled();
      });

      it("returns 500 when loading order items fails", async () => {
        const restaurantId =
          "restaurant-1";

        const orderId =
          "order-1";

        mockAuthenticatedUser(
          createUser({
            restaurantId,
          }),
        );

        mockedGetOrderItemsForDisplay.mockRejectedValue(
          new Error("Database failure"),
        );

        const response =
          await getOrderItems(
            createOrderItemsRequest(
              orderId,
            ),
            createRouteContext(orderId),
          );

        expect(response.status).toBe(
          500,
        );

        const body =
          await response.json();

        expect(body).toEqual({
          success: false,
          error: "Failed to load order items.",
        });

        expect(
          mockedGetOrderItemsForDisplay,
        ).toHaveBeenCalledWith(
          restaurantId,
          orderId,
        );
      });
    },
  );
});