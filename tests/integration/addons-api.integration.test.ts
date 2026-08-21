import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  Role,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  GET,
  POST,
} from "@/app/api/addons/route";

import {
  PATCH,
  DELETE,
} from "@/app/api/addons/[id]/route";

vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
}));

import { getAuthUser } from "@/lib/api-auth";

const mockedGetAuthUser =
  vi.mocked(getAuthUser);

// ============================================================
// Helpers
// ============================================================

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

async function createRestaurant(
  suffix: string,
) {
  return prisma.restaurant.create({
    data: {
      name:
        `Addon API Restaurant ${suffix}`,
    },
  });
}

async function createUser(
  restaurantId: string,
  role: Role,
  suffix: string,
) {
  return prisma.user.create({
    data: {
      name:
        `Addon API User ${suffix}`,

      email:
        `addon-api-${suffix}@example.com`,

      password:
        "test-password",

      role,

      restaurantId,
    },
  });
}

async function authenticate(
  restaurantId: string,
  role: Role = Role.OWNER,
  suffix = uniqueSuffix(),
) {
  const user =
    await createUser(
      restaurantId,
      role,
      suffix,
    );

  mockedGetAuthUser.mockResolvedValue({
    id: user.id,

    restaurantId:
      user.restaurantId,

    name:
      user.name,

    email:
      user.email ??
      `addon-${suffix}@example.com`,

    role:
      user.role,
  });

  return user;
}

async function createAddon(
  restaurantId: string,
  overrides: Partial<{
    name: string;
    price: number;
    isActive: boolean;
    sortOrder: number;
  }> = {},
) {
  const suffix =
    uniqueSuffix();

  return prisma.addon.create({
    data: {
      name:
        overrides.name ??
        `Test Addon ${suffix}`,

      price:
        overrides.price ??
        50,

      isActive:
        overrides.isActive ??
        true,

      sortOrder:
        overrides.sortOrder ??
        0,

      restaurantId,
    },
  });
}

function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
): Request {
  return new Request(
    url,
    {
      method,

      headers: {
        "Content-Type":
          "application/json",
      },

      ...(body !== undefined
        ? {
            body:
              JSON.stringify(body),
          }
        : {}),
    },
  );
}

/**
 * Next.js dynamic route context.
 *
 * The route expects:
 *
 * {
 *   params: Promise<{ id: string }>
 * }
 */
function addonParams(
  id: string,
): {
  params: Promise<{
    id: string;
  }>;
} {
  return {
    params:
      Promise.resolve({
        id,
      }),
  };
}

// ============================================================
// Test suite
// ============================================================

describe(
  "Addons API",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    // ========================================================
    // GET /api/addons
    // ========================================================

    describe(
      "GET /api/addons",
      () => {
        it(
          "rejects an unauthenticated request",
          async () => {
            mockedGetAuthUser.mockResolvedValue(
              null,
            );

            const response =
              await GET();

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

        it(
          "returns only addons belonging to the authenticated restaurant",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurantA =
              await createRestaurant(
                `${suffix}-a`,
              );

            const restaurantB =
              await createRestaurant(
                `${suffix}-b`,
              );

            await authenticate(
              restaurantA.id,
              Role.OWNER,
              `${suffix}-owner`,
            );

            const addonA =
              await createAddon(
                restaurantA.id,
                {
                  name:
                    `Restaurant A Addon ${suffix}`,
                  price: 100,
                },
              );

            await createAddon(
              restaurantB.id,
              {
                name:
                  `Restaurant B Addon ${suffix}`,
                price: 200,
              },
            );

            const response =
              await GET();

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
            ).toHaveLength(1);

            expect(
              body.data[0].id,
            ).toBe(
              addonA.id,
            );

            expect(
              body.data[0].name,
            ).toBe(
              addonA.name,
            );

            expect(
              body.data[0].price,
            ).toBe(100);
          },
        );

        it(
          "serializes Decimal price as a number",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              `${suffix}-owner`,
            );

            await createAddon(
              restaurant.id,
              {
                name:
                  `Cheese ${suffix}`,

                price:
                  75.5,
              },
            );

            const response =
              await GET();

            expect(
              response.status,
            ).toBe(200);

            const body =
              await response.json();

            expect(
              body.success,
            ).toBe(true);

            expect(
              typeof body.data[0].price,
            ).toBe("number");

            expect(
              body.data[0].price,
            ).toBe(75.5);
          },
        );

        it(
          "returns addon fields required by the API",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              `${suffix}-owner`,
            );

            await createAddon(
              restaurant.id,
              {
                name:
                  `Extra Sauce ${suffix}`,

                price:
                  25,

                isActive:
                  false,

                sortOrder:
                  5,
              },
            );

            const response =
              await GET();

            const body =
              await response.json();

            expect(
              body.success,
            ).toBe(true);

            expect(
              body.data[0],
            ).toMatchObject({
              name:
                `Extra Sauce ${suffix}`,

              price:
                25,

              isActive:
                false,

              sortOrder:
                5,
            });

            expect(
              body.data[0],
            ).toHaveProperty(
              "id",
            );

            expect(
              body.data[0],
            ).toHaveProperty(
              "createdAt",
            );

            expect(
              body.data[0],
            ).toHaveProperty(
              "updatedAt",
            );
          },
        );
      },
    );

    // ========================================================
    // POST /api/addons
    // ========================================================

    describe(
      "POST /api/addons",
      () => {
        it(
          "rejects an unauthenticated request",
          async () => {
            mockedGetAuthUser.mockResolvedValue(
              null,
            );

            const request =
              jsonRequest(
                "http://localhost/api/addons",
                "POST",
                {
                  name:
                    "Extra Cheese",

                  price:
                    50,
                },
              );

            const response =
              await POST(request);

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

        it(
          "creates an addon",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              `${suffix}-owner`,
            );

            const request =
              jsonRequest(
                "http://localhost/api/addons",
                "POST",
                {
                  name:
                    `Extra Cheese ${suffix}`,

                  price:
                    75,
                },
              );

            const response =
              await POST(request);

            expect(
              response.status,
            ).toBe(201);

            const body =
              await response.json();

            expect(
              body.success,
            ).toBe(true);

            expect(
              body.data.name,
            ).toBe(
              `Extra Cheese ${suffix}`,
            );

            expect(
              body.data.price,
            ).toBe(75);

            const databaseAddon =
              await prisma.addon.findUnique({
                where: {
                  id:
                    body.data.id,
                },
              });

            expect(
              databaseAddon,
            ).not.toBeNull();

            expect(
              databaseAddon?.restaurantId,
            ).toBe(
              restaurant.id,
            );

            expect(
              Number(
                databaseAddon?.price,
              ),
            ).toBe(75);
          },
        );

        it(
          "rejects a missing name",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              `${suffix}-owner`,
            );

            const request =
              jsonRequest(
                "http://localhost/api/addons",
                "POST",
                {
                  price:
                    50,
                },
              );

            const response =
              await POST(request);

            expect(
              response.status,
            ).toBe(400);

            const body =
              await response.json();

            expect(
              body.success,
            ).toBe(false);

            expect(
              body.message,
            ).toBe(
              "Addon name is required",
            );
          },
        );

        it(
          "rejects a non-numeric price",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              `${suffix}-owner`,
            );

            const request =
              jsonRequest(
                "http://localhost/api/addons",
                "POST",
                {
                  name:
                    `Invalid Price ${suffix}`,

                  price:
                    "50",
                },
              );

            const response =
              await POST(request);

            expect(
              response.status,
            ).toBe(400);

            const body =
              await response.json();

            expect(
              body.success,
            ).toBe(false);

            expect(
              body.message,
            ).toBe(
              "Addon price must be a non-negative number",
            );
          },
        );

        it(
          "rejects duplicate addon names within the same restaurant",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              `${suffix}-owner`,
            );

            const name =
              `Duplicate Addon ${suffix}`;

            await createAddon(
              restaurant.id,
              {
                name,
              },
            );

            const request =
              jsonRequest(
                "http://localhost/api/addons",
                "POST",
                {
                  name,

                  price:
                    100,
                },
              );

            const response =
              await POST(request);

            expect(
              response.status,
            ).toBe(409);

            const body =
              await response.json();

            expect(
              body.success,
            ).toBe(false);

            expect(
              body.message,
            ).toBe(
              "Addon name already exists",
            );
          },
        );

        it(
          "allows the same addon name in different restaurants",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurantA =
              await createRestaurant(
                `${suffix}-a`,
              );

            const restaurantB =
              await createRestaurant(
                `${suffix}-b`,
              );

            const name =
              `Extra Cheese ${suffix}`;

            await authenticate(
              restaurantA.id,
              Role.OWNER,
              `${suffix}-owner-a`,
            );

            const requestA =
              jsonRequest(
                "http://localhost/api/addons",
                "POST",
                {
                  name,

                  price:
                    50,
                },
              );

            const responseA =
              await POST(requestA);

            expect(
              responseA.status,
            ).toBe(201);

            await authenticate(
              restaurantB.id,
              Role.OWNER,
              `${suffix}-owner-b`,
            );

            const requestB =
              jsonRequest(
                "http://localhost/api/addons",
                "POST",
                {
                  name,

                  price:
                    75,
                },
              );

            const responseB =
              await POST(requestB);

            expect(
              responseB.status,
            ).toBe(201);
          },
        );
      },
    );

    // ========================================================
    // PATCH /api/addons/[id]
    // ========================================================

    describe(
      "PATCH /api/addons/[id]",
      () => {
        it(
          "rejects an unauthenticated request",
          async () => {
            mockedGetAuthUser.mockResolvedValue(
              null,
            );

            const request =
              jsonRequest(
                "http://localhost/api/addons/test-id",
                "PATCH",
                {
                  name:
                    "Updated",

                  price:
                    100,
                },
              );

            const response =
              await PATCH(
                request,
                addonParams(
                  "test-id",
                ),
              );

            expect(
              response.status,
            ).toBe(401);
          },
        );

        it(
          "updates an addon belonging to the restaurant",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              `${suffix}-owner`,
            );

            const addon =
              await createAddon(
                restaurant.id,
                {
                  name:
                    `Original ${suffix}`,

                  price:
                    50,
                },
              );

            const request =
              jsonRequest(
                `http://localhost/api/addons/${addon.id}`,
                "PATCH",
                {
                  name:
                    `Updated ${suffix}`,

                  price:
                    125,
                },
              );

            const response =
              await PATCH(
                request,
                addonParams(
                  addon.id,
                ),
              );

            expect(
              response.status,
            ).toBe(200);

            const body =
              await response.json();

            expect(
              body.success,
            ).toBe(true);

            expect(
              body.data.name,
            ).toBe(
              `Updated ${suffix}`,
            );

            expect(
              body.data.price,
            ).toBe(125);

            const databaseAddon =
              await prisma.addon.findUnique({
                where: {
                  id:
                    addon.id,
                },
              });

            expect(
              databaseAddon?.name,
            ).toBe(
              `Updated ${suffix}`,
            );

            expect(
              Number(
                databaseAddon?.price,
              ),
            ).toBe(125);
          },
        );

        it(
          "cannot update an addon belonging to another restaurant",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurantA =
              await createRestaurant(
                `${suffix}-a`,
              );

            const restaurantB =
              await createRestaurant(
                `${suffix}-b`,
              );

            const addon =
              await createAddon(
                restaurantA.id,
                {
                  name:
                    `Protected Addon ${suffix}`,

                  price:
                    50,
                },
              );

            await authenticate(
              restaurantB.id,
              Role.OWNER,
              `${suffix}-owner-b`,
            );

            const request =
              jsonRequest(
                `http://localhost/api/addons/${addon.id}`,
                "PATCH",
                {
                  name:
                    "Hacked Addon",

                  price:
                    999,
                },
              );

            const response =
              await PATCH(
                request,
                addonParams(
                  addon.id,
                ),
              );

            expect(
              response.status,
            ).toBe(404);

            const databaseAddon =
              await prisma.addon.findUnique({
                where: {
                  id:
                    addon.id,
                },
              });

            expect(
              databaseAddon?.name,
            ).toBe(
              `Protected Addon ${suffix}`,
            );

            expect(
              Number(
                databaseAddon?.price,
              ),
            ).toBe(50);
          },
        );

        it(
          "returns 404 for a non-existent addon",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              `${suffix}-owner`,
            );

            const request =
              jsonRequest(
                "http://localhost/api/addons/non-existent-addon",
                "PATCH",
                {
                  name:
                    "Updated",

                  price:
                    100,
                },
              );

            const response =
              await PATCH(
                request,
                addonParams(
                  "non-existent-addon",
                ),
              );

            expect(
              response.status,
            ).toBe(404);

            const body =
              await response.json();

            expect(
              body.message,
            ).toBe(
              "Addon not found",
            );
          },
        );

        it(
          "rejects duplicate addon name during update",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              `${suffix}-owner`,
            );

            const addonA =
              await createAddon(
                restaurant.id,
                {
                  name:
                    `Addon A ${suffix}`,
                },
              );

            await createAddon(
              restaurant.id,
              {
                name:
                  `Addon B ${suffix}`,
              },
            );

            const request =
              jsonRequest(
                `http://localhost/api/addons/${addonA.id}`,
                "PATCH",
                {
                  name:
                    `Addon B ${suffix}`,

                  price:
                    100,
                },
              );

            const response =
              await PATCH(
                request,
                addonParams(
                  addonA.id,
                ),
              );

            expect(
              response.status,
            ).toBe(409);

            const body =
              await response.json();

            expect(
              body.success,
            ).toBe(false);

            expect(
              body.message,
            ).toBe(
              "Addon name already exists",
            );
          },
        );
      },
    );

    // ========================================================
    // DELETE /api/addons/[id]
    // ========================================================

    describe(
      "DELETE /api/addons/[id]",
      () => {
        it(
          "rejects an unauthenticated request",
          async () => {
            mockedGetAuthUser.mockResolvedValue(
              null,
            );

            const request =
              jsonRequest(
                "http://localhost/api/addons/test-id",
                "DELETE",
              );

            const response =
              await DELETE(
                request,
                addonParams(
                  "test-id",
                ),
              );

            expect(
              response.status,
            ).toBe(401);
          },
        );

        it(
          "deletes an addon belonging to the restaurant",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              `${suffix}-owner`,
            );

            const addon =
              await createAddon(
                restaurant.id,
                {
                  name:
                    `Delete Me ${suffix}`,
                },
              );

            const request =
              jsonRequest(
                `http://localhost/api/addons/${addon.id}`,
                "DELETE",
              );

            const response =
              await DELETE(
                request,
                addonParams(
                  addon.id,
                ),
              );

            expect(
              response.status,
            ).toBe(200);

            const body =
              await response.json();

            expect(
              body.success,
            ).toBe(true);

            const databaseAddon =
              await prisma.addon.findUnique({
                where: {
                  id:
                    addon.id,
                },
              });

            expect(
              databaseAddon,
            ).toBeNull();
          },
        );

        it(
          "cannot delete an addon belonging to another restaurant",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurantA =
              await createRestaurant(
                `${suffix}-a`,
              );

            const restaurantB =
              await createRestaurant(
                `${suffix}-b`,
              );

            const addon =
              await createAddon(
                restaurantA.id,
                {
                  name:
                    `Protected Delete ${suffix}`,
                },
              );

            await authenticate(
              restaurantB.id,
              Role.OWNER,
              `${suffix}-owner-b`,
            );

            const request =
              jsonRequest(
                `http://localhost/api/addons/${addon.id}`,
                "DELETE",
              );

            const response =
              await DELETE(
                request,
                addonParams(
                  addon.id,
                ),
              );

            expect(
              response.status,
            ).toBe(404);

            const databaseAddon =
              await prisma.addon.findUnique({
                where: {
                  id:
                    addon.id,
                },
              });

            expect(
              databaseAddon,
            ).not.toBeNull();
          },
        );

        it(
          "returns 404 when deleting a non-existent addon",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              `${suffix}-owner`,
            );

            const request =
              jsonRequest(
                "http://localhost/api/addons/non-existent-addon",
                "DELETE",
              );

            const response =
              await DELETE(
                request,
                addonParams(
                  "non-existent-addon",
                ),
              );

            expect(
              response.status,
            ).toBe(404);

            const body =
              await response.json();

            expect(
              body.message,
            ).toBe(
              "Addon not found",
            );
          },
        );

        it(
          "cannot delete an addon linked to a menu item",
          async () => {
            const suffix =
              uniqueSuffix();

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              `${suffix}-owner`,
            );

            const addon =
              await createAddon(
                restaurant.id,
              );

            /*
             * This test should be implemented once
             * the test suite has a standard helper
             * for creating MenuItemAddon records.
             */
            expect(addon.id).toBeTruthy();
          },
        );
      },
    );
  },
);