import {
  Role,
} from "@prisma/client";

import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  prisma,
} from "@/lib/prisma";

import {
  generateToken,
} from "@/lib/auth";

import {
  POST,
} from "@/app/api/sync/push/route";

describe(
  "POST /api/sync/push",
  () => {
    let restaurantId: string;
    let userId: string;

    let token: string;

    beforeEach(
      async () => {
        const restaurant =
          await prisma.restaurant.create({
            data: {
              name:
                `Sync Test Restaurant ${Date.now()}-${Math.random()}`,

              isActive:
                true,
            },
          });

        restaurantId =
          restaurant.id;

        const user =
          await prisma.user.create({
            data: {
              name:
                "Sync Test Owner",

              email:
                `sync-${Date.now()}-${Math.random()}@example.com`,

              password:
                "test-password-hash",

              role:
                Role.OWNER,

              isActive:
                true,

              restaurantId:
                restaurant.id,
            },
          });

        userId =
          user.id;

        token =
          generateToken({
            id:
              user.id,

            restaurantId:
              restaurant.id,

            name:
              user.name,

            email:
              user.email,

            role:
              user.role,
          });
      },
    );

    it(
      "requires authentication",
      async () => {
        const request =
          new Request(
            "http://localhost/api/sync/push",
            {
              method:
                "POST",

              headers: {
                "content-type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  operations: [],
                }),
            },
          );

        const response =
          await POST(request);

        expect(
          response.status,
        ).toBe(401);

        await expect(
          response.json(),
        ).resolves.toEqual({
          success:
            false,

          error:
            "Unauthorized",
        });
      },
    );

    it(
      "rejects an invalid request body",
      async () => {
        const request =
          new Request(
            "http://localhost/api/sync/push",
            {
              method:
                "POST",

              headers: {
                "content-type":
                  "application/json",

                authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify({
                  invalid:
                    true,
                }),
            },
          );

        const response =
          await POST(request);

        expect(
          response.status,
        ).toBe(400);

        await expect(
          response.json(),
        ).resolves.toEqual({
          success:
            false,

          error:
            "Invalid sync request.",
        });
      },
    );

    it(
      "accepts an authenticated empty operations request",
      async () => {
        const request =
          new Request(
            "http://localhost/api/sync/push",
            {
              method:
                "POST",

              headers: {
                "content-type":
                  "application/json",

                authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify({
                  operations: [],
                }),
            },
          );

        const response =
          await POST(request);

        expect(
          response.status,
        ).toBe(200);

        await expect(
          response.json(),
        ).resolves.toEqual({
          success:
            true,

          data: {
            results: [],
          },
        });
      },
    );
  },
);