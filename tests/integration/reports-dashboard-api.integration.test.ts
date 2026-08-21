import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { Role } from "@prisma/client";

import {
  GET as reportsGET,
} from "@/app/api/reports/[report]/route";

import {
  GET as dashboardGET,
} from "@/app/api/dashboard/route";

import {
  getAuthUser,
} from "@/lib/api-auth";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

import {
  getReportsDashboard,
} from "@/features/reports/queries/report-queries";

// ============================================================
// MOCKS
// ============================================================

vi.mock(
  "@/lib/api-auth",
  () => ({
    getAuthUser: vi.fn(),
  }),
);

vi.mock(
  "@/features/reports/queries/report-queries",
  () => ({
    getReportsDashboard: vi.fn(),
  }),
);

// ============================================================
// MOCK TYPES
// ============================================================

const mockedGetAuthUser =
  vi.mocked(getAuthUser);

const mockedGetReportsDashboard =
  vi.mocked(
    getReportsDashboard,
  );

type TestAuthUser = NonNullable<
  Awaited<ReturnType<typeof getAuthUser>>
>;

/**
 * The real AuthUser type currently expects restaurantId
 * to be a string.
 *
 * For these integration tests we also need to test the
 * "no restaurant" branch, so the test factory allows null
 * and casts only at the mock boundary.
 */
type TestUserOverrides = Partial<
  Omit<TestAuthUser, "restaurantId">
> & {
  restaurantId?: string | null;
};

function createUser(
  overrides: TestUserOverrides = {},
): TestAuthUser {
  const user = {
    id:
      overrides.id ??
      "user-1",

    restaurantId:
      overrides.restaurantId !== undefined
        ? overrides.restaurantId
        : "restaurant-1",

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

  return user as TestAuthUser;
}

function mockAuthenticatedUser(
  user: TestUserOverrides = {},
) {
  mockedGetAuthUser.mockResolvedValue(
    createUser(user),
  );
}

// ============================================================
// ROUTE HELPERS
// ============================================================

function reportContext(
  report: string,
) {
  return {
    params: Promise.resolve({
      report,
    }),
  };
}

function requestWithQuery(
  url =
    "http://localhost/api/reports/sales",
) {
  return new Request(url);
}

// ============================================================
// REPORT FIXTURE
// ============================================================

function createReportData(
  canViewProfit = true,
): Awaited<
  ReturnType<typeof getReportsDashboard>
> {
  return {
    range: {
      from: "2026-08-01",
      to: "2026-08-12",
      dayCount: 12,
      warning: null,
    },

    canViewProfit,

    summary: {
      billCount: 1,
      grossSales: 1000,
      refunds: 100,
      netSales: 900,
      paymentsReceived: 800,
      netCollections: 750,
      outstandingAmount: 100,

      costOfGoodsSold:
        canViewProfit
          ? 400
          : null,

      grossProfit:
        canViewProfit
          ? 500
          : null,

      grossMarginPercent:
        canViewProfit
          ? 55.56
          : null,

      wastageCost: 50,

      inventoryValue:
        canViewProfit
          ? 2000
          : null,

      lowStockCount: 1,
      outOfStockCount: 0,
    },

    // ========================================================
    // SALES
    // ========================================================

    salesRows: [
      {
        id: "sale-1",

        businessDate:
          "2026-08-12",

        billNumber:
          "BILL-001",

        receiptNumber:
          "REC-001",

        orderNumber:
          "ORD-001",

        customerName:
          "Customer",

        billStatus:
          "PAID",

        paymentStatus:
          "PAID",

        grossSales: 1000,

        refundedAmount: 100,

        netSales: 900,

        amountPaid: 800,

        dueAmount: 100,

        taxAmount: 50,

        discountAmount: 20,

        createdByName:
          "Cashier",

        createdAt:
          "2026-08-12T10:00:00.000Z",
      },
    ],

    // ========================================================
    // PAYMENTS
    // ========================================================

    paymentRows: [
      {
        id: "payment-1",

        direction:
          "PAYMENT" as const,

        documentNumber:
          null,

        billNumber:
          "BILL-001",

        orderNumber:
          "ORD-001",

        method:
          "CASH",

        amount: 800,

        signedAmount: 800,

        referenceNo:
          null,

        description:
          null,

        recordedByName:
          "Cashier",

        createdAt:
          "2026-08-12T10:05:00.000Z",
      },
    ],

    // ========================================================
    // INVENTORY
    // ========================================================

    inventoryRows: [
      {
        id: "inventory-1",

        name:
          "Rice",

        code:
          "RICE-001",

        categoryName:
          "Grains",

        unit:
          "KG",

        currentStock:
          20,

        minimumStock:
          10,

        reorderLevel:
          15,

        averageCost:
          canViewProfit
            ? 50
            : null,

        stockValue:
          canViewProfit
            ? 1000
            : null,

        status:
          "HEALTHY",
      },
    ],

    // ========================================================
    // WASTAGE
    // ========================================================

    wastageRows: [
      {
        id:
          "wastage-item-1",

        wastageId:
          "wastage-1",

        wastageNumber:
          "WST-001",

        businessDate:
          "2026-08-12",

        inventoryItemName:
          "Rice",

        inventoryItemCode:
          "RICE-001",

        reason:
          "SPOILED",

        quantity:
          2,

        unit:
          "KG",

        unitCost:
          canViewProfit
            ? 50
            : null,

        totalCost:
          100,

        createdByName:
          "Manager",

        approvedByName:
          "Owner",

        postedAt:
          "2026-08-12T11:00:00.000Z",
      },
    ],

    // ========================================================
    // PROFIT
    // ========================================================

    profitRows:
      canViewProfit
        ? [
            {
              id:
                "profit-1",

              businessDate:
                "2026-08-12",

              billNumber:
                "BILL-001",

              orderNumber:
                "ORD-001",

              itemName:
                "Rice Bowl",

              categoryName:
                "Food",

              quantity:
                2,

              billedNetSales:
                900,

              allocatedRefund:
                100,

              adjustedNetSales:
                800,

              costAmount:
                400,

              grossProfit:
                400,

              grossMarginPercent:
                50,
            },
          ]
        : [],
  };
}

// ============================================================
// SETUP
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();

  mockAuthenticatedUser();

  mockedGetReportsDashboard.mockResolvedValue(
    createReportData(true),
  );
});

// ============================================================
// REPORTS API
// ============================================================

describe(
  "Reports API",
  () => {
    // ========================================================
    // AUTHENTICATION
    // ========================================================

    describe(
      "authentication",
      () => {
        it(
          "rejects an unauthenticated request",
          async () => {
            mockedGetAuthUser.mockResolvedValue(
              null,
            );

            const response =
              await reportsGET(
                requestWithQuery(),
                reportContext(
                  "sales",
                ),
              );

            expect(
              response.status,
            ).toBe(401);

            const body =
              await response.json();

            expect(
              body.error,
            ).toBe(
              "Unauthorized.",
            );
          },
        );
      },
    );

    // ========================================================
    // AUTHORIZATION
    // ========================================================

    describe(
      "authorization",
      () => {
        it(
          "rejects a user without report export permission",
          async () => {
            mockAuthenticatedUser({
              role: Role.CASHIER,
            });

            const response =
              await reportsGET(
                requestWithQuery(),
                reportContext(
                  "sales",
                ),
              );

            expect(
              response.status,
            ).toBe(403);

            expect(
              mockedGetReportsDashboard,
            ).not.toHaveBeenCalled();
          },
        );

        it(
          "rejects a user without a restaurant",
          async () => {
            mockAuthenticatedUser({
              restaurantId:
                null,
            });

            const response =
              await reportsGET(
                requestWithQuery(),
                reportContext(
                  "sales",
                ),
              );

            expect(
              response.status,
            ).toBe(403);

            const body =
              await response.json();

            expect(
              body.error,
            ).toBe(
              "No restaurant is assigned to this user.",
            );

            expect(
              mockedGetReportsDashboard,
            ).not.toHaveBeenCalled();
          },
        );

        it(
          "rejects an unsupported report",
          async () => {
            const response =
              await reportsGET(
                requestWithQuery(
                  "http://localhost/api/reports/unknown",
                ),
                reportContext(
                  "unknown",
                ),
              );

            expect(
              response.status,
            ).toBe(404);

            const body =
              await response.json();

            expect(
              body.error,
            ).toBe(
              "Unsupported report type.",
            );

            expect(
              mockedGetReportsDashboard,
            ).not.toHaveBeenCalled();
          },
        );
      },
    );

    // ========================================================
    // REPORT EXPORTS
    // ========================================================

    describe(
      "report exports",
      () => {
        // ------------------------------------------------------
        // SALES
        // ------------------------------------------------------

        it(
          "exports a sales CSV",
          async () => {
            const response =
              await reportsGET(
                requestWithQuery(
                  "http://localhost/api/reports/sales?from=2026-08-01&to=2026-08-12",
                ),
                reportContext(
                  "sales",
                ),
              );

            expect(
              response.status,
            ).toBe(200);

            expect(
              response.headers.get(
                "Content-Type",
              ),
            ).toContain(
              "text/csv",
            );

            expect(
              response.headers.get(
                "Content-Disposition",
              ),
            ).toContain(
              "sales-report-2026-08-01-to-2026-08-12.csv",
            );

            /*
             * response.text() uses text decoding, which strips
             * the UTF-8 BOM.
             *
             * Therefore inspect the raw response bytes.
             */
            const bytes =
              new Uint8Array(
                await response.arrayBuffer(),
              );

            expect(
              bytes[0],
            ).toBe(0xef);

            expect(
              bytes[1],
            ).toBe(0xbb);

            expect(
              bytes[2],
            ).toBe(0xbf);

            const csv =
              new TextDecoder().decode(
                bytes,
              );

            expect(
              csv,
            ).toContain(
              "Business Date,Bill Number,Receipt Number",
            );

            expect(
              csv,
            ).toContain(
              "BILL-001",
            );

            expect(
              csv,
            ).toContain(
              "Customer",
            );
          },
        );

        // ------------------------------------------------------
        // PAYMENTS
        // ------------------------------------------------------

        it(
          "exports payments CSV",
          async () => {
            const response =
              await reportsGET(
                requestWithQuery(
                  "http://localhost/api/reports/payments",
                ),
                reportContext(
                  "payments",
                ),
              );

            expect(
              response.status,
            ).toBe(200);

            expect(
              response.headers.get(
                "Content-Type",
              ),
            ).toContain(
              "text/csv",
            );

            const csv =
              await response.text();

            expect(
              csv,
            ).toContain(
              "Created At,Type,Document Number",
            );

            expect(
              csv,
            ).toContain(
              "PAYMENT",
            );

            expect(
              csv,
            ).toContain(
              "BILL-001",
            );
          },
        );

        // ------------------------------------------------------
        // INVENTORY
        // ------------------------------------------------------

        it(
          "exports inventory CSV",
          async () => {
            const response =
              await reportsGET(
                requestWithQuery(
                  "http://localhost/api/reports/inventory",
                ),
                reportContext(
                  "inventory",
                ),
              );

            expect(
              response.status,
            ).toBe(200);

            const csv =
              await response.text();

            expect(
              csv,
            ).toContain(
              "Item Name,Code,Category",
            );

            expect(
              csv,
            ).toContain(
              "Rice",
            );

            expect(
              csv,
            ).toContain(
              "RICE-001",
            );
          },
        );

        // ------------------------------------------------------
        // WASTAGE
        // ------------------------------------------------------

        it(
          "exports wastage CSV",
          async () => {
            const response =
              await reportsGET(
                requestWithQuery(
                  "http://localhost/api/reports/wastage",
                ),
                reportContext(
                  "wastage",
                ),
              );

            expect(
              response.status,
            ).toBe(200);

            const csv =
              await response.text();

            expect(
              csv,
            ).toContain(
              "Business Date,Wastage Number",
            );

            expect(
              csv,
            ).toContain(
              "WST-001",
            );

            expect(
              csv,
            ).toContain(
              "SPOILED",
            );
          },
        );

        // ------------------------------------------------------
        // PROFIT - ALLOWED
        // ------------------------------------------------------

        it(
          "exports profit CSV for a user with profit permission",
          async () => {
            mockAuthenticatedUser({
              role: Role.OWNER,
            });

            const response =
              await reportsGET(
                requestWithQuery(
                  "http://localhost/api/reports/profit",
                ),
                reportContext(
                  "profit",
                ),
              );

            expect(
              response.status,
            ).toBe(200);

            const csv =
              await response.text();

            expect(
              csv,
            ).toContain(
              "Gross Profit",
            );

            expect(
              csv,
            ).toContain(
              "400",
            );

            expect(
              mockedGetReportsDashboard,
            ).toHaveBeenCalledWith(
              "restaurant-1",
              {},
              true,
            );
          },
        );

        // ------------------------------------------------------
        // PROFIT - DENIED
        // ------------------------------------------------------

        it(
          "rejects profit export without profit permission",
          async () => {
            /*
             * Do not assume that MANAGER lacks profit access.
             *
             * Find a role using the actual RBAC configuration:
             * - can export reports
             * - cannot view profit analytics
             */
            const roleWithoutProfit =
              Object.values(
                Role,
              ).find(
                (role) =>
                  hasPermission(
                    role,
                    PERMISSIONS.REPORTS_EXPORT,
                  ) &&
                  !hasPermission(
                    role,
                    PERMISSIONS.PROFIT_ANALYTICS_READ,
                  ),
              );

            expect(
              roleWithoutProfit,
            ).toBeDefined();

            mockAuthenticatedUser({
              role:
                roleWithoutProfit!,
            });

            const response =
              await reportsGET(
                requestWithQuery(
                  "http://localhost/api/reports/profit",
                ),
                reportContext(
                  "profit",
                ),
              );

            expect(
              response.status,
            ).toBe(403);

            const body =
              await response.json();

            expect(
              body.error,
            ).toBe(
              "You do not have permission to export profit information.",
            );

            expect(
              mockedGetReportsDashboard,
            ).not.toHaveBeenCalled();
          },
        );

        // ------------------------------------------------------
        // QUERY PARAMETERS
        // ------------------------------------------------------

        it(
          "passes the restaurant and date range to the report query",
          async () => {
            await reportsGET(
              requestWithQuery(
                "http://localhost/api/reports/sales?from=2026-08-01&to=2026-08-10",
              ),
              reportContext(
                "sales",
              ),
            );

            expect(
              mockedGetReportsDashboard,
            ).toHaveBeenCalledWith(
              "restaurant-1",
              {
                from:
                  "2026-08-01",

                to:
                  "2026-08-10",
              },
              true,
            );
          },
        );

        // ------------------------------------------------------
        // ERROR HANDLING
        // ------------------------------------------------------

        it(
          "returns 500 when report loading fails",
          async () => {
            mockedGetReportsDashboard.mockRejectedValue(
              new Error(
                "Database failure",
              ),
            );

            const response =
              await reportsGET(
                requestWithQuery(),
                reportContext(
                  "sales",
                ),
              );

            expect(
              response.status,
            ).toBe(500);

            const body =
              await response.json();

            expect(
              body.error,
            ).toBe(
              "Failed to export report.",
            );
          },
        );
      },
    );
  },
);

// ============================================================
// DASHBOARD API
// ============================================================

describe(
  "Dashboard API",
  () => {
    // --------------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------------

    it(
      "rejects an unauthenticated request",
      async () => {
        mockedGetAuthUser.mockResolvedValue(
          null,
        );

        const response =
          await dashboardGET();

        expect(
          response.status,
        ).toBe(401);

        const body =
          await response.json();

        expect(
          body.success,
        ).toBe(false);

        expect(
          body.message,
        ).toBe(
          "Unauthorized",
        );
      },
    );

    // --------------------------------------------------------
    // ANALYTICS PERMISSION
    // --------------------------------------------------------

    it(
      "rejects a user without analytics permission",
      async () => {
        mockAuthenticatedUser({
          role: Role.CASHIER,
        });

        const response =
          await dashboardGET();

        expect(
          response.status,
        ).toBe(403);

        const body =
          await response.json();

        expect(
          body.success,
        ).toBe(false);

        expect(
          body.message,
        ).toBe(
          "Forbidden",
        );
      },
    );

    // --------------------------------------------------------
    // RESTAURANT
    // --------------------------------------------------------

    it(
      "rejects a user without a restaurant",
      async () => {
        mockAuthenticatedUser({
          restaurantId:
            null,
        });

        const response =
          await dashboardGET();

        expect(
          response.status,
        ).toBe(403);

        const body =
          await response.json();

        expect(
          body.success,
        ).toBe(false);

        expect(
          body.message,
        ).toBe(
          "No restaurant is assigned to this user.",
        );
      },
    );

    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------

    it(
      "returns authenticated dashboard user data",
      async () => {
        mockAuthenticatedUser({
          id:
            "user-1",

          restaurantId:
            "restaurant-1",

          name:
            "Test User",

          email:
            "test@example.com",

          role:
            Role.OWNER,
        });

        const response =
          await dashboardGET();

        expect(
          response.status,
        ).toBe(200);

        const body =
          await response.json();

        expect(
          body.success,
        ).toBe(true);

        expect(
          body.data,
        ).toEqual({
          id:
            "user-1",

          restaurantId:
            "restaurant-1",

          name:
            "Test User",

          email:
            "test@example.com",

          role:
            Role.OWNER,
        });
      },
    );

    // --------------------------------------------------------
    // ERROR HANDLING
    // --------------------------------------------------------

    it(
      "returns 500 when dashboard authentication lookup fails",
      async () => {
        mockedGetAuthUser.mockRejectedValue(
          new Error(
            "Database failure",
          ),
        );

        const response =
          await dashboardGET();

        expect(
          response.status,
        ).toBe(500);

        const body =
          await response.json();

        expect(
          body.success,
        ).toBe(false);

        expect(
          body.message,
        ).toBe(
          "Internal server error",
        );
      },
    );
  },
);