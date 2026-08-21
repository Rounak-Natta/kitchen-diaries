import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  CategoryType,
  DietaryType,
  MenuItemStatus,
  Role,
  SpiceLevel,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  GET as GET_MENU,
  POST as POST_MENU,
} from "@/app/api/menu/route";

import {
  GET as GET_MENU_ITEM,
  PATCH as PATCH_MENU_ITEM,
  DELETE as DELETE_MENU_ITEM,
} from "@/app/api/menu/[id]/route";

vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
}));

import { getAuthUser } from "@/lib/api-auth";

const mockedGetAuthUser =
  vi.mocked(getAuthUser);

/* ============================================================
   HELPERS
============================================================ */

async function createRestaurant(
  suffix: string,
) {
  return prisma.restaurant.create({
    data: {
      name:
        `Menu API Restaurant ${suffix}`,
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
        `Menu API User ${suffix}`,

      email:
        `menu-api-${suffix}@example.com`,

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
  suffix = `${Date.now()}-${Math.random()}`,
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

async function createCategory(
  restaurantId: string,
  suffix = `${Date.now()}-${Math.random()}`,
) {
  return prisma.category.create({
    data: {
      name:
        `Menu Test Category ${suffix}`,

      slug:
        `menu-test-category-${suffix}`,

      type:
        CategoryType.FOOD,

      dietaryType:
        DietaryType.VEG,

      isActive:
        true,

      restaurantId,
    },
  });
}

async function createVariationGroup(
  restaurantId: string,
  suffix = `${Date.now()}-${Math.random()}`,
) {
  return prisma.variationGroup.create({
    data: {
      name:
        `Size ${suffix}`,

      slug:
        `size-${suffix}`,

      restaurantId,
    },
  });
}

async function createAddon(
  restaurantId: string,
  suffix = `${Date.now()}-${Math.random()}`,
) {
  return prisma.addon.create({
    data: {
      name:
        `Extra ${suffix}`,

      price:
        25,

      restaurantId,
    },
  });
}

async function createMenuItem(
  restaurantId: string,
  categoryId: string,
  overrides: Record<
    string,
    unknown
  > = {},
) {
  const suffix =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

  return prisma.menuItem.create({
    data: {
      name:
        `Test Menu Item ${suffix}`,

      slug:
        `test-menu-item-${suffix}`,

      price:
        150,

      categoryId,

      dietaryType:
        DietaryType.VEG,

      spiceLevel:
        SpiceLevel.NONE,

      status:
        MenuItemStatus.AVAILABLE,

      isFeatured:
        false,

      isRecommended:
        false,

      isActive:
        true,

      sortOrder:
        0,

      restaurantId,

      ...overrides,
    },
  });
}

function menuPayload(
  categoryId: string,
  overrides: Record<
    string,
    unknown
  > = {},
) {
  return {
    name:
      `Paneer Test Item ${Date.now()}`,

    description:
      "Test menu item",

    price:
      180,

    categoryId,

    dietaryType:
      "VEG",

    spiceLevel:
      "MEDIUM",

    status:
      "AVAILABLE",

    isFeatured:
      false,

    isRecommended:
      false,

    isActive:
      true,

    sortOrder:
      0,

    ...overrides,
  };
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

function menuParams(
  id: string,
) {
  return {
    params: Promise.resolve({
      id,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ============================================================
   GET /api/menu
============================================================ */

describe(
  "GET /api/menu",
  () => {
    it(
      "rejects an unauthenticated request",
      async () => {
        mockedGetAuthUser.mockResolvedValue(
          null,
        );

        const response =
          await GET_MENU();

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
      "returns only menu items belonging to the authenticated restaurant",
      async () => {
        const suffix =
          `${Date.now()}-tenant`;

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

        const categoryA =
          await createCategory(
            restaurantA.id,
            `${suffix}-category-a`,
          );

        const categoryB =
          await createCategory(
            restaurantB.id,
            `${suffix}-category-b`,
          );

        const itemA =
          await createMenuItem(
            restaurantA.id,
            categoryA.id,
          );

        await createMenuItem(
          restaurantB.id,
          categoryB.id,
        );

        const response =
          await GET_MENU();

        expect(
          response.status,
        ).toBe(200);

        const body =
          await response.json();

        expect(
          body.success,
        ).toBe(true);

        expect(
          body.data.some(
            (item: { id: string }) =>
              item.id ===
              itemA.id,
          ),
        ).toBe(true);

        expect(
          body.data.every(
            (
              item: {
                id: string;
              },
            ) =>
              item.id ===
              itemA.id,
          ),
        ).toBe(true);
      },
    );

    it(
      "does not return soft-deleted menu items",
      async () => {
        const suffix =
          `${Date.now()}-deleted`;

        const restaurant =
          await createRestaurant(
            suffix,
          );

        await authenticate(
          restaurant.id,
          Role.OWNER,
          suffix,
        );

        const category =
          await createCategory(
            restaurant.id,
            suffix,
          );

        await createMenuItem(
          restaurant.id,
          category.id,
          {
            deletedAt:
              new Date(),
          },
        );

        const response =
          await GET_MENU();

        const body =
          await response.json();

        expect(
          body.success,
        ).toBe(true);

        expect(
          body.data.length,
        ).toBe(0);
      },
    );

    it(
      "serializes Decimal prices as numbers",
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

        const category =
          await createCategory(
            restaurant.id,
            suffix,
          );

        await createMenuItem(
          restaurant.id,
          category.id,
          {
            price:
              199.50,

            comparePrice:
              249.75,

            costPrice:
              100.25,
          },
        );

        const response =
          await GET_MENU();

        const body =
          await response.json();

        expect(
          typeof body.data[0]
            .price,
        ).toBe("number");

        expect(
          body.data[0]
            .price,
        ).toBe(199.5);

        expect(
          body.data[0]
            .comparePrice,
        ).toBe(249.75);

        expect(
          body.data[0]
            .costPrice,
        ).toBe(100.25);
      },
    );
  },
);

/* ============================================================
   POST /api/menu
============================================================ */

describe(
  "POST /api/menu",
  () => {
    it(
      "rejects an unauthenticated request",
      async () => {
        mockedGetAuthUser.mockResolvedValue(
          null,
        );

        const response =
          await POST_MENU(
            jsonRequest(
              "http://localhost/api/menu",
              "POST",
              {},
            ),
          );

        expect(
          response.status,
        ).toBe(401);
      },
    );

    it(
      "creates a menu item",
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

        const category =
          await createCategory(
            restaurant.id,
            suffix,
          );

        const response =
          await POST_MENU(
            jsonRequest(
              "http://localhost/api/menu",
              "POST",
              menuPayload(
                category.id,
              ),
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
          body.data.id,
        ).toBeTruthy();

        expect(
          body.data.name,
        ).toContain(
          "Paneer Test Item",
        );

        expect(
          typeof body.data.price,
        ).toBe("number");

        expect(
          body.data.category.id,
        ).toBe(
          category.id,
        );
      },
    );

    it(
      "rejects invalid JSON",
      async () => {
        const suffix =
          `${Date.now()}-json`;

        const restaurant =
          await createRestaurant(
            suffix,
          );

        await authenticate(
          restaurant.id,
          Role.OWNER,
          suffix,
        );

        const request =
          new Request(
            "http://localhost/api/menu",
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
          );

        const response =
          await POST_MENU(
            request,
          );

        expect(
          response.status,
        ).toBe(400);
      },
    );

    it(
      "rejects a category belonging to another restaurant",
      async () => {
        const suffix =
          `${Date.now()}-category-owner`;

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

        const categoryB =
          await createCategory(
            restaurantB.id,
            `${suffix}-category-b`,
          );

        const response =
          await POST_MENU(
            jsonRequest(
              "http://localhost/api/menu",
              "POST",
              menuPayload(
                categoryB.id,
              ),
            ),
          );

        expect(
          response.status,
        ).toBe(400);

        const body =
          await response.json();

        expect(
          body.message,
        ).toBe(
          "Category does not belong to this restaurant.",
        );
      },
    );

    it(
      "creates a menu item with variation groups and addons",
      async () => {
        const suffix =
          `${Date.now()}-relations`;

        const restaurant =
          await createRestaurant(
            suffix,
          );

        await authenticate(
          restaurant.id,
          Role.OWNER,
          suffix,
        );

        const category =
          await createCategory(
            restaurant.id,
            suffix,
          );

        const variation =
          await createVariationGroup(
            restaurant.id,
            suffix,
          );

        const addon =
          await createAddon(
            restaurant.id,
            suffix,
          );

        const response =
          await POST_MENU(
            jsonRequest(
              "http://localhost/api/menu",
              "POST",
              menuPayload(
                category.id,
                {
                  variationIds: [
                    variation.id,
                  ],

                  addonIds: [
                    addon.id,
                  ],
                },
              ),
            ),
          );

        expect(
          response.status,
        ).toBe(201);

        const created =
          await prisma.menuItem.findFirst({
            where: {
              restaurantId:
                restaurant.id,
            },

            orderBy: {
              createdAt:
                "desc",
            },

            include: {
              variations: true,
              addons: true,
            },
          });

        expect(
          created,
        ).not.toBeNull();

        expect(
          created?.variations.length,
        ).toBe(1);

        expect(
          created?.addons.length,
        ).toBe(1);
      },
    );

    it(
      "rejects variation groups belonging to another restaurant",
      async () => {
        const suffix =
          `${Date.now()}-variation-owner`;

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

        const category =
          await createCategory(
            restaurantA.id,
            suffix,
          );

        const variation =
          await createVariationGroup(
            restaurantB.id,
            suffix,
          );

        const response =
          await POST_MENU(
            jsonRequest(
              "http://localhost/api/menu",
              "POST",
              menuPayload(
                category.id,
                {
                  variationIds: [
                    variation.id,
                  ],
                },
              ),
            ),
          );

        expect(
          response.status,
        ).toBe(400);
      },
    );

    it(
      "rejects addons belonging to another restaurant",
      async () => {
        const suffix =
          `${Date.now()}-addon-owner`;

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

        const category =
          await createCategory(
            restaurantA.id,
            suffix,
          );

        const addon =
          await createAddon(
            restaurantB.id,
            suffix,
          );

        const response =
          await POST_MENU(
            jsonRequest(
              "http://localhost/api/menu",
              "POST",
              menuPayload(
                category.id,
                {
                  addonIds: [
                    addon.id,
                  ],
                },
              ),
            ),
          );

        expect(
          response.status,
        ).toBe(400);
      },
    );

    it(
      "rejects duplicate menu slugs within the same restaurant",
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

        const category =
          await createCategory(
            restaurant.id,
            suffix,
          );

        const payload =
          menuPayload(
            category.id,
            {
              name:
                "Duplicate Menu Item",
            },
          );

        const first =
          await POST_MENU(
            jsonRequest(
              "http://localhost/api/menu",
              "POST",
              payload,
            ),
          );

        expect(
          first.status,
        ).toBe(201);

        const second =
          await POST_MENU(
            jsonRequest(
              "http://localhost/api/menu",
              "POST",
              payload,
            ),
          );

        expect(
          second.status,
        ).toBe(409);
      },
    );
  },
);

/* ============================================================
   GET /api/menu/[id]
============================================================ */

describe(
  "GET /api/menu/[id]",
  () => {
    it(
      "rejects an unauthenticated request",
      async () => {
        mockedGetAuthUser.mockResolvedValue(
          null,
        );

        const response =
          await GET_MENU_ITEM(
            new Request(
              "http://localhost/api/menu/test",
            ),
            menuParams(
              "test",
            ),
          );

        expect(
          response.status,
        ).toBe(401);
      },
    );

    it(
      "returns a menu item belonging to the restaurant",
      async () => {
        const suffix =
          `${Date.now()}-single`;

        const restaurant =
          await createRestaurant(
            suffix,
          );

        await authenticate(
          restaurant.id,
          Role.OWNER,
          suffix,
        );

        const category =
          await createCategory(
            restaurant.id,
            suffix,
          );

        const item =
          await createMenuItem(
            restaurant.id,
            category.id,
          );

        const response =
          await GET_MENU_ITEM(
            new Request(
              `http://localhost/api/menu/${item.id}`,
            ),
            menuParams(
              item.id,
            ),
          );

        expect(
          response.status,
        ).toBe(200);

        const body =
          await response.json();

        expect(
          body.data.id,
        ).toBe(
          item.id,
        );

        expect(
          body.data.categoryId,
        ).toBe(
          category.id,
        );
      },
    );

    it(
      "cannot read a menu item belonging to another restaurant",
      async () => {
        const suffix =
          `${Date.now()}-isolation`;

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

        const categoryB =
          await createCategory(
            restaurantB.id,
            suffix,
          );

        const item =
          await createMenuItem(
            restaurantB.id,
            categoryB.id,
          );

        const response =
          await GET_MENU_ITEM(
            new Request(
              `http://localhost/api/menu/${item.id}`,
            ),
            menuParams(
              item.id,
            ),
          );

        expect(
          response.status,
        ).toBe(404);
      },
    );

    it(
      "returns 404 for a non-existent menu item",
      async () => {
        const suffix =
          `${Date.now()}-missing`;

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
          await GET_MENU_ITEM(
            new Request(
              "http://localhost/api/menu/missing",
            ),
            menuParams(
              "missing",
            ),
          );

        expect(
          response.status,
        ).toBe(404);
      },
    );
  },
);

/* ============================================================
   PATCH /api/menu/[id]
============================================================ */

describe(
  "PATCH /api/menu/[id]",
  () => {
    it(
      "rejects an unauthenticated request",
      async () => {
        mockedGetAuthUser.mockResolvedValue(
          null,
        );

        const response =
          await PATCH_MENU_ITEM(
            jsonRequest(
              "http://localhost/api/menu/test",
              "PATCH",
              {},
            ),
            menuParams(
              "test",
            ),
          );

        expect(
          response.status,
        ).toBe(401);
      },
    );

    it(
      "updates a menu item",
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

        const category =
          await createCategory(
            restaurant.id,
            suffix,
          );

        const item =
          await createMenuItem(
            restaurant.id,
            category.id,
          );

        const response =
          await PATCH_MENU_ITEM(
            jsonRequest(
              `http://localhost/api/menu/${item.id}`,
              "PATCH",
              {
                name:
                  "Updated Menu Item",

                price:
                  225,
              },
            ),
            menuParams(
              item.id,
            ),
          );

        expect(
          response.status,
        ).toBe(200);

        const body =
          await response.json();

        expect(
          body.data.name,
        ).toBe(
          "Updated Menu Item",
        );

        expect(
          body.data.price,
        ).toBe(225);
      },
    );

    it(
      "cannot update a menu item belonging to another restaurant",
      async () => {
        const suffix =
          `${Date.now()}-update-isolation`;

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

        const categoryB =
          await createCategory(
            restaurantB.id,
            suffix,
          );

        const item =
          await createMenuItem(
            restaurantB.id,
            categoryB.id,
          );

        const response =
          await PATCH_MENU_ITEM(
            jsonRequest(
              `http://localhost/api/menu/${item.id}`,
              "PATCH",
              {
                name:
                  "Hacked Item",
              },
            ),
            menuParams(
              item.id,
            ),
          );

        expect(
          response.status,
        ).toBe(404);
      },
    );

    it(
      "replaces variation groups when variationIds are supplied",
      async () => {
        const suffix =
          `${Date.now()}-replace-variation`;

        const restaurant =
          await createRestaurant(
            suffix,
          );

        await authenticate(
          restaurant.id,
          Role.OWNER,
          suffix,
        );

        const category =
          await createCategory(
            restaurant.id,
            suffix,
          );

        const variationA =
          await createVariationGroup(
            restaurant.id,
            `${suffix}-a`,
          );

        const variationB =
          await createVariationGroup(
            restaurant.id,
            `${suffix}-b`,
          );

        const item =
          await createMenuItem(
            restaurant.id,
            category.id,
          );

        await prisma.menuItemVariation.create({
          data: {
            menuItemId:
              item.id,

            variationGroupId:
              variationA.id,
          },
        });

        const response =
          await PATCH_MENU_ITEM(
            jsonRequest(
              `http://localhost/api/menu/${item.id}`,
              "PATCH",
              {
                variationIds: [
                  variationB.id,
                ],
              },
            ),
            menuParams(
              item.id,
            ),
          );

        expect(
          response.status,
        ).toBe(200);

        const relations =
          await prisma.menuItemVariation.findMany({
            where: {
              menuItemId:
                item.id,
            },
          });

        expect(
          relations.length,
        ).toBe(1);

        expect(
          relations[0]
            .variationGroupId,
        ).toBe(
          variationB.id,
        );
      },
    );

    it(
      "does not replace variations when variationIds are omitted",
      async () => {
        const suffix =
          `${Date.now()}-preserve-variation`;

        const restaurant =
          await createRestaurant(
            suffix,
          );

        await authenticate(
          restaurant.id,
          Role.OWNER,
          suffix,
        );

        const category =
          await createCategory(
            restaurant.id,
            suffix,
          );

        const variation =
          await createVariationGroup(
            restaurant.id,
            suffix,
          );

        const item =
          await createMenuItem(
            restaurant.id,
            category.id,
          );

        await prisma.menuItemVariation.create({
          data: {
            menuItemId:
              item.id,

            variationGroupId:
              variation.id,
          },
        });

        await PATCH_MENU_ITEM(
          jsonRequest(
            `http://localhost/api/menu/${item.id}`,
            "PATCH",
            {
              price:
                250,
            },
          ),
          menuParams(
            item.id,
          ),
        );

        const relation =
          await prisma.menuItemVariation.findFirst({
            where: {
              menuItemId:
                item.id,
            },
          });

        expect(
          relation,
        ).not.toBeNull();

        expect(
          relation?.variationGroupId,
        ).toBe(
          variation.id,
        );
      },
    );

    it(
      "returns 404 for a non-existent menu item",
      async () => {
        const suffix =
          `${Date.now()}-patch-missing`;

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
          await PATCH_MENU_ITEM(
            jsonRequest(
              "http://localhost/api/menu/missing",
              "PATCH",
              {
                name:
                  "Updated",
              },
            ),
            menuParams(
              "missing",
            ),
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
          `${Date.now()}-patch-duplicate`;

        const restaurant =
          await createRestaurant(
            suffix,
          );

        await authenticate(
          restaurant.id,
          Role.OWNER,
          suffix,
        );

        const category =
          await createCategory(
            restaurant.id,
            suffix,
          );

        const first =
          await createMenuItem(
            restaurant.id,
            category.id,
            {
              name:
                "Existing Menu",
              slug:
                "existing-menu",
            },
          );

        const second =
          await createMenuItem(
            restaurant.id,
            category.id,
          );

        const response =
          await PATCH_MENU_ITEM(
            jsonRequest(
              `http://localhost/api/menu/${second.id}`,
              "PATCH",
              {
                name:
                  first.name,
              },
            ),
            menuParams(
              second.id,
            ),
          );

        expect(
          response.status,
        ).toBe(409);
      },
    );
  },
);

/* ============================================================
   DELETE /api/menu/[id]
============================================================ */

describe(
  "DELETE /api/menu/[id]",
  () => {
    it(
      "rejects an unauthenticated request",
      async () => {
        mockedGetAuthUser.mockResolvedValue(
          null,
        );

        const response =
          await DELETE_MENU_ITEM(
            new Request(
              "http://localhost/api/menu/test",
              {
                method:
                  "DELETE",
              },
            ),
            menuParams(
              "test",
            ),
          );

        expect(
          response.status,
        ).toBe(401);
      },
    );

    it(
      "soft deletes a menu item",
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

        const category =
          await createCategory(
            restaurant.id,
            suffix,
          );

        const item =
          await createMenuItem(
            restaurant.id,
            category.id,
          );

        const response =
          await DELETE_MENU_ITEM(
            new Request(
              `http://localhost/api/menu/${item.id}`,
              {
                method:
                  "DELETE",
              },
            ),
            menuParams(
              item.id,
            ),
          );

        expect(
          response.status,
        ).toBe(200);

        const databaseItem =
          await prisma.menuItem.findUnique({
            where: {
              id:
                item.id,
            },
          });

        expect(
          databaseItem,
        ).not.toBeNull();

        expect(
          databaseItem?.deletedAt,
        ).not.toBeNull();

        expect(
          databaseItem?.isActive,
        ).toBe(false);
      },
    );

    it(
      "cannot delete a menu item belonging to another restaurant",
      async () => {
        const suffix =
          `${Date.now()}-delete-isolation`;

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

        const categoryB =
          await createCategory(
            restaurantB.id,
            suffix,
          );

        const item =
          await createMenuItem(
            restaurantB.id,
            categoryB.id,
          );

        const response =
          await DELETE_MENU_ITEM(
            new Request(
              `http://localhost/api/menu/${item.id}`,
              {
                method:
                  "DELETE",
              },
            ),
            menuParams(
              item.id,
            ),
          );

        expect(
          response.status,
        ).toBe(404);

        const unchanged =
          await prisma.menuItem.findUnique({
            where: {
              id:
                item.id,
            },
          });

        expect(
          unchanged?.deletedAt,
        ).toBeNull();
      },
    );

    it(
      "returns 404 for a non-existent menu item",
      async () => {
        const suffix =
          `${Date.now()}-delete-missing`;

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
          await DELETE_MENU_ITEM(
            new Request(
              "http://localhost/api/menu/missing",
              {
                method:
                  "DELETE",
              },
            ),
            menuParams(
              "missing",
            ),
          );

        expect(
          response.status,
        ).toBe(404);
      },
    );
  },
);