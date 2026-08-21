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

import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

import { POST } from "@/app/api/variation-options/route";

import {
  PATCH,
  DELETE,
} from "@/app/api/variation-options/[id]/route";

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
        `Variation Option Restaurant ${suffix}`,
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
        `Variation Option User ${suffix}`,

      email:
        `variation-option-${suffix}@example.com`,

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
    id:
      user.id,

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

async function createVariationGroup(
  restaurantId: string,
  suffix: string,
) {
  return prisma.variationGroup.create({
    data: {
      name:
        `Size ${suffix}`,

      slug:
        `size-${suffix}`,

      description:
        "Test variation group",

      isActive:
        true,

      restaurantId,
    },
  });
}

async function createOption(
  variationGroupId: string,
  overrides: Partial<{
    name: string;
    description: string | null;
    price: number;
    sortOrder: number;
    isDefault: boolean;
    isActive: boolean;
  }> = {},
) {
  const suffix =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

  return prisma.variationOption.create({
    data: {
      name:
        overrides.name ??
        `Option ${suffix}`,

      description:
        overrides.description ??
        "Test option",

      price:
        overrides.price ??
        0,

      sortOrder:
        overrides.sortOrder ??
        0,

      isDefault:
        overrides.isDefault ??
        false,

      isActive:
        overrides.isActive ??
        true,

      variationGroupId,
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

      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    },
  );
}

function nextRequest(
  url: string,
  method: string,
  body?: unknown,
): NextRequest {
  return new NextRequest(
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

function params(
  id: string,
) {
  return Promise.resolve({
    id,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe(
  "Variation Options API",
  () => {
    describe(
      "POST /api/variation-options",
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
                  "http://localhost/api/variation-options",
                  "POST",
                  {
                    name:
                      "Large",

                    variationGroupId:
                      "test-group",
                  },
                ),
              );

            expect(
              response.status,
            ).toBe(401);
          },
        );

        it(
          "creates a variation option",
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

            const group =
              await createVariationGroup(
                restaurant.id,
                suffix,
              );

            const response =
              await POST(
                jsonRequest(
                  "http://localhost/api/variation-options",
                  "POST",
                  {
                    name:
                      "Large",

                    description:
                      "Large size",

                    price:
                      50,

                    sortOrder:
                      2,

                    isDefault:
                      false,

                    isActive:
                      true,

                    variationGroupId:
                      group.id,
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
            ).toBe("Large");

            expect(
              body.data.description,
            ).toBe(
              "Large size",
            );

            expect(
              body.data.price,
            ).toBe(50);

            expect(
              body.data.sortOrder,
            ).toBe(2);

            expect(
              body.data.isDefault,
            ).toBe(false);

            expect(
              body.data.isActive,
            ).toBe(true);
          },
        );

        it(
          "allows a zero price",
          async () => {
            const suffix =
              `${Date.now()}-zero-price`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const group =
              await createVariationGroup(
                restaurant.id,
                suffix,
              );

            const response =
              await POST(
                jsonRequest(
                  "http://localhost/api/variation-options",
                  "POST",
                  {
                    name:
                      "Regular",

                    price:
                      0,

                    variationGroupId:
                      group.id,
                  },
                ),
              );

            expect(
              response.status,
            ).toBe(201);

            const body =
              await response.json();

            expect(
              body.data.price,
            ).toBe(0);
          },
        );

        it(
          "rejects a missing option name",
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

            const group =
              await createVariationGroup(
                restaurant.id,
                suffix,
              );

            const response =
              await POST(
                jsonRequest(
                  "http://localhost/api/variation-options",
                  "POST",
                  {
                    variationGroupId:
                      group.id,
                  },
                ),
              );

            expect(
              response.status,
            ).toBe(400);
          },
        );

        it(
          "rejects a negative price",
          async () => {
            const suffix =
              `${Date.now()}-negative-price`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const group =
              await createVariationGroup(
                restaurant.id,
                suffix,
              );

            const response =
              await POST(
                jsonRequest(
                  "http://localhost/api/variation-options",
                  "POST",
                  {
                    name:
                      "Large",

                    price:
                      -10,

                    variationGroupId:
                      group.id,
                  },
                ),
              );

            expect(
              response.status,
            ).toBe(400);
          },
        );

        it(
          "rejects a non-numeric price",
          async () => {
            const suffix =
              `${Date.now()}-invalid-price`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const group =
              await createVariationGroup(
                restaurant.id,
                suffix,
              );

            const response =
              await POST(
                jsonRequest(
                  "http://localhost/api/variation-options",
                  "POST",
                  {
                    name:
                      "Large",

                    price:
                      "50",

                    variationGroupId:
                      group.id,
                  },
                ),
              );

            expect(
              response.status,
            ).toBe(400);
          },
        );

        it(
          "rejects a missing variation group",
          async () => {
            const suffix =
              `${Date.now()}-missing-group`;

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
                  "http://localhost/api/variation-options",
                  "POST",
                  {
                    name:
                      "Large",
                  },
                ),
              );

            expect(
              response.status,
            ).toBe(400);
          },
        );

        it(
          "rejects a variation group belonging to another restaurant",
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

            const group =
              await createVariationGroup(
                restaurantA.id,
                `${suffix}-a`,
              );

            await authenticate(
              restaurantB.id,
              Role.OWNER,
              `${suffix}-b`,
            );

            const response =
              await POST(
                jsonRequest(
                  "http://localhost/api/variation-options",
                  "POST",
                  {
                    name:
                      "Hacked",

                    variationGroupId:
                      group.id,
                  },
                ),
              );

            expect(
              response.status,
            ).toBe(404);
          },
        );

        it(
          "rejects invalid JSON",
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
                  "http://localhost/api/variation-options",
                  {
                    method:
                      "POST",

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
      },
    );

    describe(
      "PATCH /api/variation-options/[id]",
      () => {
        it(
          "rejects an unauthenticated request",
          async () => {
            mockedGetAuthUser.mockResolvedValue(
              null,
            );

            const response =
              await PATCH(
                nextRequest(
                  "http://localhost/api/variation-options/test",
                  "PATCH",
                  {
                    name:
                      "Updated",
                  },
                ),
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
          "updates an option belonging to the restaurant",
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

            const group =
              await createVariationGroup(
                restaurant.id,
                suffix,
              );

            const option =
              await createOption(
                group.id,
                {
                  name:
                    "Small",

                  price:
                    20,
                },
              );

            const response =
              await PATCH(
                nextRequest(
                  "http://localhost/api/variation-options/test",
                  "PATCH",
                  {
                    name:
                      "Large",

                    description:
                      "Updated",

                    price:
                      50,

                    sortOrder:
                      3,

                    isDefault:
                      true,

                    isActive:
                      false,
                  },
                ),
                {
                  params:
                    params(
                      option.id,
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
            ).toBe("Large");

            expect(
              body.data.description,
            ).toBe("Updated");

            expect(
              body.data.price,
            ).toBe(50);

            expect(
              body.data.sortOrder,
            ).toBe(3);

            expect(
              body.data.isDefault,
            ).toBe(true);

            expect(
              body.data.isActive,
            ).toBe(false);
          },
        );

        it(
          "cannot update an option belonging to another restaurant",
          async () => {
            const suffix =
              `${Date.now()}-update-owner`;

            const restaurantA =
              await createRestaurant(
                `${suffix}-a`,
              );

            const restaurantB =
              await createRestaurant(
                `${suffix}-b`,
              );

            const group =
              await createVariationGroup(
                restaurantA.id,
                `${suffix}-a`,
              );

            const option =
              await createOption(
                group.id,
              );

            await authenticate(
              restaurantB.id,
              Role.OWNER,
              `${suffix}-b`,
            );

            const response =
              await PATCH(
                nextRequest(
                  "http://localhost/api/variation-options/test",
                  "PATCH",
                  {
                    name:
                      "Hacked",
                  },
                ),
                {
                  params:
                    params(
                      option.id,
                    ),
                },
              );

            expect(
              response.status,
            ).toBe(404);
          },
        );

        it(
          "returns 404 for a non-existent option",
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
                nextRequest(
                  "http://localhost/api/variation-options/test",
                  "PATCH",
                  {
                    name:
                      "Updated",
                  },
                ),
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
          "rejects a negative update price",
          async () => {
            const suffix =
              `${Date.now()}-negative-update`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const group =
              await createVariationGroup(
                restaurant.id,
                suffix,
              );

            const option =
              await createOption(
                group.id,
              );

            const response =
              await PATCH(
                nextRequest(
                  "http://localhost/api/variation-options/test",
                  "PATCH",
                  {
                    price:
                      -5,
                  },
                ),
                {
                  params:
                    params(
                      option.id,
                    ),
                },
              );

            expect(
              response.status,
            ).toBe(400);
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

            const group =
              await createVariationGroup(
                restaurant.id,
                suffix,
              );

            const option =
              await createOption(
                group.id,
              );

            const response =
              await PATCH(
                nextRequest(
                  "http://localhost/api/variation-options/test",
                  "PATCH",
                  {},
                ),
                {
                  params:
                    params(
                      option.id,
                    ),
                },
              );

            expect(
              response.status,
            ).toBe(400);
          },
        );

        it(
          "allows updating price to zero",
          async () => {
            const suffix =
              `${Date.now()}-zero-update`;

            const restaurant =
              await createRestaurant(
                suffix,
              );

            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );

            const group =
              await createVariationGroup(
                restaurant.id,
                suffix,
              );

            const option =
              await createOption(
                group.id,
                {
                  price:
                    50,
                },
              );

            const response =
              await PATCH(
                nextRequest(
                  "http://localhost/api/variation-options/test",
                  "PATCH",
                  {
                    price:
                      0,
                  },
                ),
                {
                  params:
                    params(
                      option.id,
                    ),
                },
              );

            expect(
              response.status,
            ).toBe(200);

            const body =
              await response.json();

            expect(
              body.data.price,
            ).toBe(0);
          },
        );
      },
    );

    describe(
      "DELETE /api/variation-options/[id]",
      () => {
        it(
          "rejects an unauthenticated request",
          async () => {
            mockedGetAuthUser.mockResolvedValue(
              null,
            );

            const response =
              await DELETE(
                nextRequest(
                  "http://localhost/api/variation-options/test",
                  "DELETE",
                ),
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
          "deletes an option belonging to the restaurant",
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

            const group =
              await createVariationGroup(
                restaurant.id,
                suffix,
              );

            const option =
              await createOption(
                group.id,
              );

            const response =
              await DELETE(
                nextRequest(
                  "http://localhost/api/variation-options/test",
                  "DELETE",
                ),
                {
                  params:
                    params(
                      option.id,
                    ),
                },
              );

            expect(
              response.status,
            ).toBe(200);

            const deleted =
              await prisma.variationOption.findUnique({
                where: {
                  id:
                    option.id,
                },
              });

            expect(
              deleted,
            ).toBeNull();
          },
        );

        it(
          "cannot delete an option belonging to another restaurant",
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

            const group =
              await createVariationGroup(
                restaurantA.id,
                `${suffix}-a`,
              );

            const option =
              await createOption(
                group.id,
              );

            await authenticate(
              restaurantB.id,
              Role.OWNER,
              `${suffix}-b`,
            );

            const response =
              await DELETE(
                nextRequest(
                  "http://localhost/api/variation-options/test",
                  "DELETE",
                ),
                {
                  params:
                    params(
                      option.id,
                    ),
                },
              );

            expect(
              response.status,
            ).toBe(404);
          },
        );

        it(
          "returns 404 for a non-existent option",
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
                nextRequest(
                  "http://localhost/api/variation-options/test",
                  "DELETE",
                ),
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