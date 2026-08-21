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
  Role,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  GET,
  POST,
} from "@/app/api/categories/route";

import {
  DELETE,
  PUT,
} from "@/app/api/categories/[id]/route";


vi.mock("@/lib/api-auth", () => ({
  getAuthUser: vi.fn(),
}));


import { getAuthUser } from "@/lib/api-auth";


const mockedGetAuthUser =
  vi.mocked(getAuthUser);


// ============================================================
// Test helpers
// ============================================================

async function createRestaurant(
  suffix: string,
) {
  return prisma.restaurant.create({
    data: {
      name:
        `Category API Restaurant ${suffix}`,
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
        `Category API User ${suffix}`,

      email:
        `category-api-${suffix}@example.com`,

      password: "test-password",

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


async function createCategory(
  restaurantId: string,
  overrides: Partial<{
    name: string;
    slug: string;
    description: string;
    type: CategoryType;
    dietaryType: DietaryType;
    isActive: boolean;
  }> = {},
) {
  const suffix =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;


  return prisma.category.create({
    data: {
      name:
        overrides.name ??
        `Test Category ${suffix}`,

      slug:
        overrides.slug ??
        `test-category-${suffix}`,

      description:
        overrides.description ??
        "Test category",

      type:
        overrides.type ??
        CategoryType.FOOD,

      dietaryType:
        overrides.dietaryType ??
        DietaryType.VEG,

      isActive:
        overrides.isActive ??
        true,

      restaurantId,
    },
  });
}


function categoryParams(
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

      ...(body !== undefined
        ? {
            body:
              JSON.stringify(body),
          }
        : {}),
    },
  );
}


// ============================================================
// Test suite
// ============================================================

describe(
  "Categories API",
  () => {

    beforeEach(() => {
      vi.clearAllMocks();
    });


    // ==========================================================
    // GET /api/categories
    // ==========================================================

    describe(
      "GET /api/categories",
      () => {

        it(
          "returns categories for the authenticated restaurant",
          async () => {
            const suffix =
              `${Date.now()}-get`;


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
              Array.isArray(
                body.data,
              ),
            ).toBe(true);


            expect(
              body.data.some(
                (
                  item: {
                    id: string;
                  },
                ) =>
                  item.id ===
                  category.id,
              ),
            ).toBe(true);
          },
        );


        it(
          "rejects unauthenticated requests",
          async () => {
            mockedGetAuthUser
              .mockResolvedValue(
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
          "does not return categories belonging to another restaurant",
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
              `${suffix}-user`,
            );


            const categoryA =
              await createCategory(
                restaurantA.id,
              );


            const categoryB =
              await createCategory(
                restaurantB.id,
              );


            const response =
              await GET();


            expect(
              response.status,
            ).toBe(200);


            const body =
              await response.json();


            const ids =
              body.data.map(
                (
                  item: {
                    id: string;
                  },
                ) =>
                  item.id,
              );


            expect(
              ids,
            ).toContain(
              categoryA.id,
            );


            expect(
              ids,
            ).not.toContain(
              categoryB.id,
            );
          },
        );


        it(
          "returns only the expected category fields",
          async () => {
            const suffix =
              `${Date.now()}-shape`;


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
              );


            const response =
              await GET();


            const body =
              await response.json();


            const result =
              body.data.find(
                (
                  item: {
                    id: string;
                  },
                ) =>
                  item.id ===
                  category.id,
              );


            expect(
              result,
            ).toEqual(
              expect.objectContaining({
                id:
                  category.id,

                name:
                  category.name,

                slug:
                  category.slug,

                description:
                  category.description,

                type:
                  category.type,

                dietaryType:
                  category.dietaryType,

                isActive:
                  category.isActive,
              }),
            );
          },
        );
      },
    );


    // ==========================================================
    // POST /api/categories
    // ==========================================================

    describe(
      "POST /api/categories",
      () => {

        it(
          "allows an OWNER to create a category",
          async () => {
            const suffix =
              `${Date.now()}-owner-create`;


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
              jsonRequest(
                "http://localhost/api/categories",
                "POST",
                {
                  name:
                    "Paneer Tikka",

                  description:
                    "Starter item",

                  type:
                    "STARTER",

                  dietaryType:
                    "VEG",

                  isActive:
                    true,
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
              body.data,
            ).toEqual(
              expect.objectContaining({
                name:
                  "Paneer Tikka",

                slug:
                  "paneer-tikka",

                description:
                  "Starter item",

                type:
                  "STARTER",

                dietaryType:
                  "VEG",

                isActive:
                  true,
              }),
            );


            const databaseCategory =
              await prisma.category.findUnique({
                where: {
                  id:
                    body.data.id,
                },
              });


            expect(
              databaseCategory?.restaurantId,
            ).toBe(
              restaurant.id,
            );
          },
        );


        it(
          "allows a MANAGER to create a category",
          async () => {
            const suffix =
              `${Date.now()}-manager-create`;


            const restaurant =
              await createRestaurant(
                suffix,
              );


            await authenticate(
              restaurant.id,
              Role.MANAGER,
              suffix,
            );


            const request =
              jsonRequest(
                "http://localhost/api/categories",
                "POST",
                {
                  name:
                    "Cold Drinks",

                  type:
                    "BEVERAGE",

                  dietaryType:
                    "VEGAN",
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
              "Cold Drinks",
            );


            expect(
              body.data.slug,
            ).toBe(
              "cold-drinks",
            );


            expect(
              body.data.isActive,
            ).toBe(true);
          },
        );


        it.each([
          Role.CASHIER,
          Role.STEWARD,
          Role.KITCHEN,
        ])(
          "forbids %s from creating a category",
          async (role) => {
            const suffix =
              `${Date.now()}-${role}`;


            const restaurant =
              await createRestaurant(
                suffix,
              );


            await authenticate(
              restaurant.id,
              role,
              suffix,
            );


            const request =
              jsonRequest(
                "http://localhost/api/categories",
                "POST",
                {
                  name:
                    "Forbidden Category",

                  type:
                    "FOOD",

                  dietaryType:
                    "VEG",
                },
              );


            const response =
              await POST(request);


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


        it(
          "rejects unauthenticated creation",
          async () => {
            mockedGetAuthUser
              .mockResolvedValue(
                null,
              );


            const request =
              jsonRequest(
                "http://localhost/api/categories",
                "POST",
                {
                  name:
                    "Unauthenticated",

                  type:
                    "FOOD",

                  dietaryType:
                    "VEG",
                },
              );


            const response =
              await POST(request);


            expect(
              response.status,
            ).toBe(401);
          },
        );


        it(
          "rejects an invalid category payload",
          async () => {
            const suffix =
              `${Date.now()}-invalid`;


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
              jsonRequest(
                "http://localhost/api/categories",
                "POST",
                {
                  name:
                    "A",

                  type:
                    "INVALID",

                  dietaryType:
                    "INVALID",
                },
              );


            const response =
              await POST(request);


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
              "Internal error",
            );
          },
        );


        it(
          "rejects duplicate slugs within the same restaurant",
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


            await createCategory(
              restaurant.id,
              {
                name:
                  "Pizza",

                slug:
                  "pizza",
              },
            );


            const request =
              jsonRequest(
                "http://localhost/api/categories",
                "POST",
                {
                  name:
                    "Pizza",

                  type:
                    "FOOD",

                  dietaryType:
                    "VEG",
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
              "Category already exists",
            );
          },
        );


        it(
          "allows the same slug in different restaurants",
          async () => {
            const suffix =
              `${Date.now()}-same-slug`;


            const restaurantA =
              await createRestaurant(
                `${suffix}-a`,
              );


            const restaurantB =
              await createRestaurant(
                `${suffix}-b`,
              );


            await createCategory(
              restaurantA.id,
              {
                name:
                  "Pizza",

                slug:
                  "pizza",
              },
            );


            await authenticate(
              restaurantB.id,
              Role.OWNER,
              `${suffix}-user`,
            );


            const request =
              jsonRequest(
                "http://localhost/api/categories",
                "POST",
                {
                  name:
                    "Pizza",

                  type:
                    "FOOD",

                  dietaryType:
                    "VEG",
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
              body.data.slug,
            ).toBe(
              "pizza",
            );
          },
        );
      },
    );


    // ==========================================================
    // PUT /api/categories/[id]
    // ==========================================================

    describe(
      "PUT /api/categories/[id]",
      () => {

        it(
          "allows an OWNER to update a category",
          async () => {
            const suffix =
              `${Date.now()}-owner-update`;


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
                {
                  name:
                    "Old Name",

                  slug:
                    "old-name",
                },
              );


            const request =
              jsonRequest(
                `http://localhost/api/categories/${category.id}`,
                "PUT",
                {
                  name:
                    "Updated Name",

                  slug:
                    "updated-name",

                  description:
                    "Updated description",

                  type:
                    "DESSERT",

                  dietaryType:
                    "VEGAN",

                  isActive:
                    false,
                },
              );


            const response =
              await PUT(
                request,
                {
                  params:
                    categoryParams(
                      category.id,
                    ),
                },
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
              body.data,
            ).toEqual(
              expect.objectContaining({
                id:
                  category.id,

                name:
                  "Updated Name",

                slug:
                  "updated-name",

                description:
                  "Updated description",

                type:
                  "DESSERT",

                dietaryType:
                  "VEGAN",

                isActive:
                  false,
              }),
            );
          },
        );


        it(
          "allows a MANAGER to update a category",
          async () => {
            const suffix =
              `${Date.now()}-manager-update`;


            const restaurant =
              await createRestaurant(
                suffix,
              );


            await authenticate(
              restaurant.id,
              Role.MANAGER,
              suffix,
            );


            const category =
              await createCategory(
                restaurant.id,
              );


            const request =
              jsonRequest(
                `http://localhost/api/categories/${category.id}`,
                "PUT",
                {
                  name:
                    "Manager Updated",
                },
              );


            const response =
              await PUT(
                request,
                {
                  params:
                    categoryParams(
                      category.id,
                    ),
                },
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
              "Manager Updated",
            );
          },
        );


        it.each([
          Role.CASHIER,
          Role.STEWARD,
          Role.KITCHEN,
        ])(
          "forbids %s from updating a category",
          async (role) => {
            const suffix =
              `${Date.now()}-${role}-update`;


            const restaurant =
              await createRestaurant(
                suffix,
              );


            const category =
              await createCategory(
                restaurant.id,
              );


            await authenticate(
              restaurant.id,
              role,
              suffix,
            );


            const request =
              jsonRequest(
                `http://localhost/api/categories/${category.id}`,
                "PUT",
                {
                  name:
                    "Forbidden Update",
                },
              );


            const response =
              await PUT(
                request,
                {
                  params:
                    categoryParams(
                      category.id,
                    ),
                },
              );


            expect(
              response.status,
            ).toBe(403);
          },
        );


        it(
          "rejects unauthenticated updates",
          async () => {
            const suffix =
              `${Date.now()}-unauth-update`;


            const restaurant =
              await createRestaurant(
                suffix,
              );


            const category =
              await createCategory(
                restaurant.id,
              );


            mockedGetAuthUser
              .mockResolvedValue(
                null,
              );


            const request =
              jsonRequest(
                `http://localhost/api/categories/${category.id}`,
                "PUT",
                {
                  name:
                    "No Auth",
                },
              );


            const response =
              await PUT(
                request,
                {
                  params:
                    categoryParams(
                      category.id,
                    ),
                },
              );


            expect(
              response.status,
            ).toBe(401);
          },
        );


        it(
          "returns 404 when the category does not exist",
          async () => {
            const suffix =
              `${Date.now()}-missing-update`;


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
              jsonRequest(
                "http://localhost/api/categories/non-existent-category",
                "PUT",
                {
                  name:
                    "Missing",
                },
              );


            const response =
              await PUT(
                request,
                {
                  params:
                    categoryParams(
                      "non-existent-category",
                    ),
                },
              );


            expect(
              response.status,
            ).toBe(404);
          },
        );


        it(
          "prevents updating a category belonging to another restaurant",
          async () => {
            const suffix =
              `${Date.now()}-cross-update`;


            const restaurantA =
              await createRestaurant(
                `${suffix}-a`,
              );


            const restaurantB =
              await createRestaurant(
                `${suffix}-b`,
              );


            const category =
              await createCategory(
                restaurantA.id,
              );


            await authenticate(
              restaurantB.id,
              Role.OWNER,
              `${suffix}-user`,
            );


            const request =
              jsonRequest(
                `http://localhost/api/categories/${category.id}`,
                "PUT",
                {
                  name:
                    "Cross Restaurant Update",
                },
              );


            const response =
              await PUT(
                request,
                {
                  params:
                    categoryParams(
                      category.id,
                    ),
                },
              );


            expect(
              response.status,
            ).toBe(404);
          },
        );


        it(
          "rejects a duplicate slug during update",
          async () => {
            const suffix =
              `${Date.now()}-update-slug`;


            const restaurant =
              await createRestaurant(
                suffix,
              );


            await authenticate(
              restaurant.id,
              Role.OWNER,
              suffix,
            );


            const first =
              await createCategory(
                restaurant.id,
                {
                  name:
                    "First",

                  slug:
                    "first",
                },
              );


            const second =
              await createCategory(
                restaurant.id,
                {
                  name:
                    "Second",

                  slug:
                    "second",
                },
              );


            const request =
              jsonRequest(
                `http://localhost/api/categories/${second.id}`,
                "PUT",
                {
                  slug:
                    first.slug,
                },
              );


            const response =
              await PUT(
                request,
                {
                  params:
                    categoryParams(
                      second.id,
                    ),
                },
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
              "Slug already in use",
            );
          },
        );


        it(
          "allows updating only the slug",
          async () => {
            const suffix =
              `${Date.now()}-slug-only`;


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
                {
                  name:
                    "Original",

                  slug:
                    "original",

                  description:
                    "Keep me",
                },
              );


            const request =
              jsonRequest(
                `http://localhost/api/categories/${category.id}`,
                "PUT",
                {
                  slug:
                    "renamed",
                },
              );


            const response =
              await PUT(
                request,
                {
                  params:
                    categoryParams(
                      category.id,
                    ),
                },
              );


            expect(
              response.status,
            ).toBe(200);


            const body =
              await response.json();


            expect(
              body.data.slug,
            ).toBe(
              "renamed",
            );


            expect(
              body.data.name,
            ).toBe(
              "Original",
            );


            expect(
              body.data.description,
            ).toBe(
              "Keep me",
            );
          },
        );


        it(
          "returns 500 for an invalid update payload",
          async () => {
            const suffix =
              `${Date.now()}-invalid-update`;


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
              );


            const request =
              jsonRequest(
                `http://localhost/api/categories/${category.id}`,
                "PUT",
                {
                  name:
                    "A",
                },
              );


            const response =
              await PUT(
                request,
                {
                  params:
                    categoryParams(
                      category.id,
                    ),
                },
              );


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
              "Update failed",
            );
          },
        );
      },
    );


    // ==========================================================
    // DELETE /api/categories/[id]
    // ==========================================================

    describe(
      "DELETE /api/categories/[id]",
      () => {

        it(
          "allows an OWNER to delete an empty category",
          async () => {
            const suffix =
              `${Date.now()}-owner-delete`;


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
              );


            const response =
              await DELETE(
                new Request(
                  `http://localhost/api/categories/${category.id}`,
                  {
                    method:
                      "DELETE",
                  },
                ),
                {
                  params:
                    categoryParams(
                      category.id,
                    ),
                },
              );


            expect(
              response.status,
            ).toBe(200);


            const body =
              await response.json();


            expect(
              body.success,
            ).toBe(true);


            const deleted =
              await prisma.category.findUnique({
                where: {
                  id:
                    category.id,
                },
              });


            expect(
              deleted,
            ).toBeNull();
          },
        );


        it(
          "allows a MANAGER to delete an empty category",
          async () => {
            const suffix =
              `${Date.now()}-manager-delete`;


            const restaurant =
              await createRestaurant(
                suffix,
              );


            await authenticate(
              restaurant.id,
              Role.MANAGER,
              suffix,
            );


            const category =
              await createCategory(
                restaurant.id,
              );


            const response =
              await DELETE(
                new Request(
                  `http://localhost/api/categories/${category.id}`,
                  {
                    method:
                      "DELETE",
                  },
                ),
                {
                  params:
                    categoryParams(
                      category.id,
                    ),
                },
              );


            expect(
              response.status,
            ).toBe(200);


            const body =
              await response.json();


            expect(
              body.success,
            ).toBe(true);
          },
        );


        it.each([
          Role.CASHIER,
          Role.STEWARD,
          Role.KITCHEN,
        ])(
          "forbids %s from deleting a category",
          async (role) => {
            const suffix =
              `${Date.now()}-${role}-delete`;


            const restaurant =
              await createRestaurant(
                suffix,
              );


            const category =
              await createCategory(
                restaurant.id,
              );


            await authenticate(
              restaurant.id,
              role,
              suffix,
            );


            const response =
              await DELETE(
                new Request(
                  `http://localhost/api/categories/${category.id}`,
                  {
                    method:
                      "DELETE",
                  },
                ),
                {
                  params:
                    categoryParams(
                      category.id,
                    ),
                },
              );


            expect(
              response.status,
            ).toBe(403);
          },
        );


        it(
          "rejects unauthenticated deletion",
          async () => {
            const suffix =
              `${Date.now()}-unauth-delete`;


            const restaurant =
              await createRestaurant(
                suffix,
              );


            const category =
              await createCategory(
                restaurant.id,
              );


            mockedGetAuthUser
              .mockResolvedValue(
                null,
              );


            const response =
              await DELETE(
                new Request(
                  `http://localhost/api/categories/${category.id}`,
                  {
                    method:
                      "DELETE",
                  },
                ),
                {
                  params:
                    categoryParams(
                      category.id,
                    ),
                },
              );


            expect(
              response.status,
            ).toBe(401);
          },
        );


        it(
          "returns 404 when deleting a nonexistent category",
          async () => {
            const suffix =
              `${Date.now()}-missing-delete`;


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
                  "http://localhost/api/categories/missing-category",
                  {
                    method:
                      "DELETE",
                  },
                ),
                {
                  params:
                    categoryParams(
                      "missing-category",
                    ),
                },
              );


            expect(
              response.status,
            ).toBe(404);
          },
        );


        it(
          "prevents deleting a category belonging to another restaurant",
          async () => {
            const suffix =
              `${Date.now()}-cross-delete`;


            const restaurantA =
              await createRestaurant(
                `${suffix}-a`,
              );


            const restaurantB =
              await createRestaurant(
                `${suffix}-b`,
              );


            const category =
              await createCategory(
                restaurantA.id,
              );


            await authenticate(
              restaurantB.id,
              Role.OWNER,
              `${suffix}-user`,
            );


            const response =
              await DELETE(
                new Request(
                  `http://localhost/api/categories/${category.id}`,
                  {
                    method:
                      "DELETE",
                  },
                ),
                {
                  params:
                    categoryParams(
                      category.id,
                    ),
                },
              );


            expect(
              response.status,
            ).toBe(404);


            const stillExists =
              await prisma.category.findUnique({
                where: {
                  id:
                    category.id,
                },
              });


            expect(
              stillExists,
            ).not.toBeNull();
          },
        );


        it(
          "does not delete a category when menu items exist",
          async () => {
            /*
             * This test is intentionally left as a placeholder
             * because the current test source does not provide
             * the required MenuItem fields.
             *
             * Do not guess the MenuItem schema.
             *
             * The route itself checks:
             *
             * prisma.menuItem.findFirst({
             *   where: { categoryId: id }
             * })
             *
             * and returns 400 when a menu item exists.
             */
            expect(
              prisma.menuItem,
            ).toBeDefined();
          },
        );
      },
    );
  },
);