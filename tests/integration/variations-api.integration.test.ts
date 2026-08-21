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
} from "@/app/api/variations/route";

import {
  PATCH,
  DELETE,
} from "@/app/api/variations/[id]/route";

vi.mock(
  "@/lib/api-auth",
  () => ({
    getAuthUser: vi.fn(),
  }),
);

import {
  getAuthUser,
} from "@/lib/api-auth";

const mockedGetAuthUser =
  vi.mocked(getAuthUser);

async function createRestaurant(
  suffix: string,
) {
  return prisma.restaurant.create({
    data: {
      name:
        `Variation Test Restaurant ${suffix}`,
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
        `Variation Test User ${suffix}`,

      email:
        `variation-test-${suffix}@example.com`,

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
  suffix =
    `${Date.now()}-${Math.random()}`,
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
      `${suffix}@example.com`,

    role:
      user.role,
  });

  return user;
}

async function createVariation(
  restaurantId: string,
  overrides: Partial<{
    name: string;
    slug: string;
    description: string | null;
    isActive: boolean;
  }> = {},
) {
  const suffix =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

  return prisma.variationGroup.create({
    data: {
      name:
        overrides.name ??
        `Test Variation ${suffix}`,

      slug:
        overrides.slug ??
        `test-variation-${suffix}`,

      description:
        overrides.description ??
        "Test variation",

      isActive:
        overrides.isActive ??
        true,

      restaurantId,
    },
  });
}

function params(
  id: string,
) {
  return Promise.resolve({
    id,
  });
}

function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
) {
  return new Request(
    url,
    {
      method,

      headers: {
        "Content-Type":
          "application/json",
      },

      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe(
  "Variations API",
  () => {
    describe(
      "GET /api/variations",
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
          },
        );

        it(
          "returns only variation groups belonging to the restaurant",
          async () => {
            const suffix =
              `${Date.now()}-get-isolation`;

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
              `${suffix}-user`,
            );

            await createVariation(
              restaurantA.id,
              {
                name:
                  `Restaurant A Variation ${suffix}`,
              },
            );

            await createVariation(
              restaurantB.id,
              {
                name:
                  `Restaurant B Variation ${suffix}`,
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
              body.data[0].name,
            ).toContain(
              "Restaurant A Variation",
            );
          },
        );

        it(
          "returns variation options",
          async () => {
            const suffix =
              `${Date.now()}-options`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const variation =
              await createVariation(
                restaurant.id,
                {
                  name:
                    `Size ${suffix}`,
                },
              );

            await prisma.variationOption.createMany({
              data: [
                {
                  name: "Small",
                  price: 0,
                  sortOrder: 1,
                  isDefault: true,
                  isActive: true,
                  variationGroupId:
                    variation.id,
                },
                {
                  name: "Large",
                  price: 50,
                  sortOrder: 2,
                  isDefault: false,
                  isActive: true,
                  variationGroupId:
                    variation.id,
                },
              ],
            });

            const response =
              await GET();

            const body =
              await response.json();

            expect(
              response.status,
            ).toBe(200);

            expect(
              body.data[0].options,
            ).toHaveLength(2);

            expect(
              typeof body.data[0]
                .options[0].price,
            ).toBe("number");

            expect(
              body.data[0]
                ._count.options,
            ).toBe(2);
          },
        );

        it(
          "serializes option Decimal prices as numbers",
          async () => {
            const suffix =
              `${Date.now()}-decimal`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const variation =
              await createVariation(
                restaurant.id,
              );

            await prisma.variationOption.create({
              data: {
                name:
                  `Extra ${suffix}`,

                price:
                  25.5,

                sortOrder: 0,

                isDefault: false,

                isActive: true,

                variationGroupId:
                  variation.id,
              },
            });

            const response =
              await GET();

            const body =
              await response.json();

            expect(
              body.data[0]
                .options[0].price,
            ).toBe(25.5);
          },
        );
      },
    );

    describe(
      "POST /api/variations",
      () => {
        it(
          "rejects an unauthenticated request",
          async () => {
            mockedGetAuthUser.mockResolvedValue(
              null,
            );

            const response =
              await POST(
                jsonRequest(
                  "http://localhost/api/variations",
                  "POST",
                  {
                    name:
                      "Size",
                  },
                ),
              );

            expect(
              response.status,
            ).toBe(401);
          },
        );

        it(
          "creates a variation group",
          async () => {
            const suffix =
              `${Date.now()}-create`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const response =
              await POST(
                jsonRequest(
                  "http://localhost/api/variations",
                  "POST",
                  {
                    name:
                      `Size ${suffix}`,

                    description:
                      "Choose a size",
                  },
                ),
              );

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
              `Size ${suffix}`,
            );

            expect(
              body.data.slug,
            ).toBe(
              `size-${suffix}`,
            );

            expect(
              body.data.isActive,
            ).toBe(true);
          },
        );

        it(
          "trims the variation name",
          async () => {
            const suffix =
              `${Date.now()}-trim`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const response =
              await POST(
                jsonRequest(
                  "http://localhost/api/variations",
                  "POST",
                  {
                    name:
                      "  Size  ",
                  },
                ),
              );

            expect(
              response.status,
            ).toBe(201);

            const body =
              await response.json();

            expect(
              body.data.name,
            ).toBe("Size");

            expect(
              body.data.slug,
            ).toBe("size");
          },
        );

        it(
          "rejects a missing name",
          async () => {
            const suffix =
              `${Date.now()}-missing-name`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const response =
              await POST(
                jsonRequest(
                  "http://localhost/api/variations",
                  "POST",
                  {},
                ),
              );

            expect(
              response.status,
            ).toBe(400);
          },
        );

        it(
          "rejects an invalid JSON body",
          async () => {
            const suffix =
              `${Date.now()}-invalid-json`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const response =
              await POST(
                new Request(
                  "http://localhost/api/variations",
                  {
                    method: "POST",

                    headers: {
                      "Content-Type":
                        "application/json",
                    },

                    body:
                      "{invalid-json",
                  },
                ),
              );

            expect(
              response.status,
            ).toBe(400);
          },
        );

        it(
          "rejects a duplicate slug in the same restaurant",
          async () => {
            const suffix =
              `${Date.now()}-duplicate`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            await createVariation(
              restaurant.id,
              {
                name:
                  "Size",
                slug:
                  "size",
              },
            );

            const response =
              await POST(
                jsonRequest(
                  "http://localhost/api/variations",
                  "POST",
                  {
                    name:
                      "Size",
                  },
                ),
              );

            expect(
              response.status,
            ).toBe(409);
          },
        );

        it(
          "allows the same name in different restaurants",
          async () => {
            const suffix =
              `${Date.now()}-different-restaurants`;

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
              `${suffix}-a`,
            );

            const first =
              await POST(
                jsonRequest(
                  "http://localhost/api/variations",
                  "POST",
                  {
                    name:
                      "Size",
                  },
                ),
              );

            expect(
              first.status,
            ).toBe(201);

            await authenticate(
              restaurantB.id,
              Role.OWNER,
              `${suffix}-b`,
            );

            const second =
              await POST(
                jsonRequest(
                  "http://localhost/api/variations",
                  "POST",
                  {
                    name:
                      "Size",
                  },
                ),
              );

            expect(
              second.status,
            ).toBe(201);
          },
        );
      },
    );

    describe(
      "PATCH /api/variations/[id]",
      () => {
        it(
          "rejects an unauthenticated request",
          async () => {
            mockedGetAuthUser.mockResolvedValue(
              null,
            );

            const response =
              await PATCH(
                jsonRequest(
                  "http://localhost/api/variations/test",
                  "PATCH",
                  {
                    name:
                      "Updated",
                  },
                ) as any,
                {
                  params:
                    params("test"),
                },
              );

            expect(
              response.status,
            ).toBe(401);
          },
        );

        it(
          "updates a variation belonging to the restaurant",
          async () => {
            const suffix =
              `${Date.now()}-update`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const variation =
              await createVariation(
                restaurant.id,
                {
                  name:
                    "Old Size",
                  slug:
                    `old-size-${suffix}`,
                },
              );

            const response =
              await PATCH(
                jsonRequest(
                  "http://localhost/api/variations/test",
                  "PATCH",
                  {
                    name:
                      "New Size",

                    description:
                      "Updated description",

                    isActive:
                      false,
                  },
                ) as any,
                {
                  params:
                    params(
                      variation.id,
                    ),
                },
              );

            expect(
              response.status,
            ).toBe(200);

            const body =
              await response.json();

            expect(
              body.data.name,
            ).toBe(
              "New Size",
            );

            expect(
              body.data.slug,
            ).toBe(
              "new-size",
            );

            expect(
              body.data.description,
            ).toBe(
              "Updated description",
            );

            expect(
              body.data.isActive,
            ).toBe(false);
          },
        );

        it(
          "cannot update a variation belonging to another restaurant",
          async () => {
            const suffix =
              `${Date.now()}-ownership`;

            const restaurantA =
              await createRestaurant(
                `${suffix}-a`,
              );

            const restaurantB =
              await createRestaurant(
                `${suffix}-b`,
              );

            const variation =
              await createVariation(
                restaurantA.id,
              );

            await authenticate(
              restaurantB.id,
              Role.OWNER,
              `${suffix}-b`,
            );

            const response =
              await PATCH(
                jsonRequest(
                  "http://localhost/api/variations/test",
                  "PATCH",
                  {
                    name:
                      "Hacked",
                  },
                ) as any,
                {
                  params:
                    params(
                      variation.id,
                    ),
                },
              );

            expect(
              response.status,
            ).toBe(404);
          },
        );

        it(
          "returns 404 for a non-existent variation",
          async () => {
            const suffix =
              `${Date.now()}-not-found`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const response =
              await PATCH(
                jsonRequest(
                  "http://localhost/api/variations/test",
                  "PATCH",
                  {
                    name:
                      "Updated",
                  },
                ) as any,
                {
                  params:
                    params(
                      "does-not-exist",
                    ),
                },
              );

            expect(
              response.status,
            ).toBe(404);
          },
        );

        it(
          "rejects duplicate generated slugs",
          async () => {
            const suffix =
              `${Date.now()}-duplicate-update`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            await createVariation(
              restaurant.id,
              {
                name:
                  "Large",
                slug:
                  "large",
              },
            );

            const variation =
              await createVariation(
                restaurant.id,
                {
                  name:
                    "Small",
                  slug:
                    "small",
                },
              );

            const response =
              await PATCH(
                jsonRequest(
                  "http://localhost/api/variations/test",
                  "PATCH",
                  {
                    name:
                      "Large",
                  },
                ) as any,
                {
                  params:
                    params(
                      variation.id,
                    ),
                },
              );

            expect(
              response.status,
            ).toBe(409);
          },
        );

        it(
          "rejects an empty update",
          async () => {
            const suffix =
              `${Date.now()}-empty-update`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const variation =
              await createVariation(
                restaurant.id,
              );

            const response =
              await PATCH(
                jsonRequest(
                  "http://localhost/api/variations/test",
                  "PATCH",
                  {},
                ) as any,
                {
                  params:
                    params(
                      variation.id,
                    ),
                },
              );

            expect(
              response.status,
            ).toBe(400);
          },
        );
      },
    );

    describe(
      "DELETE /api/variations/[id]",
      () => {
        it(
          "rejects an unauthenticated request",
          async () => {
            mockedGetAuthUser.mockResolvedValue(
              null,
            );

            const response =
              await DELETE(
                new Request(
                  "http://localhost/api/variations/test",
                  {
                    method:
                      "DELETE",
                  },
                ) as any,
                {
                  params:
                    params("test"),
                },
              );

            expect(
              response.status,
            ).toBe(401);
          },
        );

        it(
          "deletes a variation belonging to the restaurant",
          async () => {
            const suffix =
              `${Date.now()}-delete`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const variation =
              await createVariation(
                restaurant.id,
              );

            const response =
              await DELETE(
                new Request(
                  "http://localhost/api/variations/test",
                  {
                    method:
                      "DELETE",
                  },
                ) as any,
                {
                  params:
                    params(
                      variation.id,
                    ),
                },
              );

            expect(
              response.status,
            ).toBe(200);

            const databaseVariation =
              await prisma.variationGroup.findUnique({
                where: {
                  id:
                    variation.id,
                },
              });

            expect(
              databaseVariation,
            ).toBeNull();
          },
        );

        it(
          "cannot delete a variation belonging to another restaurant",
          async () => {
            const suffix =
              `${Date.now()}-delete-owner`;

            const restaurantA =
              await createRestaurant(
                `${suffix}-a`,
              );

            const restaurantB =
              await createRestaurant(
                `${suffix}-b`,
              );

            const variation =
              await createVariation(
                restaurantA.id,
              );

            await authenticate(
              restaurantB.id,
              Role.OWNER,
              `${suffix}-b`,
            );

            const response =
              await DELETE(
                new Request(
                  "http://localhost/api/variations/test",
                  {
                    method:
                      "DELETE",
                  },
                ) as any,
                {
                  params:
                    params(
                      variation.id,
                    ),
                },
              );

            expect(
              response.status,
            ).toBe(404);
          },
        );

        it(
          "returns 404 for a non-existent variation",
          async () => {
            const suffix =
              `${Date.now()}-delete-not-found`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const response =
              await DELETE(
                new Request(
                  "http://localhost/api/variations/test",
                  {
                    method:
                      "DELETE",
                  },
                ) as any,
                {
                  params:
                    params(
                      "does-not-exist",
                    ),
                },
              );

            expect(
              response.status,
            ).toBe(404);
          },
        );
      },
    );
  },
);