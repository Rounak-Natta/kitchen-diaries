import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  DeviceStatus,
  Role,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  createActivationCode,
} from "@/lib/subscription/activation-code-service";

import { POST } from "@/app/api/device/activate/route";

vi.mock(
  "@/lib/api-auth",
  () => ({
    getAuthUser:
      vi.fn(),
  }),
);

import {
  getAuthUser,
} from "@/lib/api-auth";

const mockedGetAuthUser =
  vi.mocked(getAuthUser);

// ======================================================
// TEST HELPERS
// ======================================================

async function createTestRestaurant(
  suffix: string,
) {
  return prisma.restaurant.create({
    data: {
      name:
        `API Device Restaurant ${suffix}`,
    },
  });
}

async function createTestOwner(
  restaurantId: string,
  suffix: string,
) {
  return prisma.user.create({
    data: {
      name:
        `API Device Owner ${suffix}`,

      email:
        `api-device-${suffix}@example.com`,

      password:
        "test-password",

      role:
        Role.OWNER,

      restaurantId,
    },
  });
}

function createRequest(
  body: unknown,
) {
  return new Request(
    "http://localhost/api/device/activate",
    {
      method:
        "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(body),
    },
  );
}

function mockAuthenticatedUser(
  user: {
    id: string;
    restaurantId: string;
    name: string;
    email: string ;
    role: Role;
  },
) {
  mockedGetAuthUser.mockResolvedValue({
    id:
      user.id,

    restaurantId:
      user.restaurantId,

    name:
      user.name,

    email:
      user.email,

    role:
      user.role,
  });
}

// ======================================================
// TEST SUITE
// ======================================================

describe(
  "POST /api/device/activate",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    // ==================================================
    // 1. SUCCESSFUL ACTIVATION
    // ==================================================

    it(
      "activates the restaurant subscription and device",
      async () => {
        const suffix =
          `${Date.now()}-api-success`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        const user =
          await createTestOwner(
            restaurant.id,
            suffix,
          );

        mockAuthenticatedUser(
          user,
        );

        const activationCode =
          await createActivationCode({
            plan:
              SubscriptionPlan.PRO,

            durationMonths:
              12,
          });

        const response =
          await POST(
            createRequest({
              code:
                activationCode.code,

              deviceKey:
                `api-device-key-${suffix}`,

              deviceName:
                "Main POS",
            }),
          );

        expect(
          response.status,
        ).toBe(200);

        const body =
          await response.json();

        expect(
          body.success,
        ).toBe(true);

        // ----------------------------------------------
        // Subscription response
        // ----------------------------------------------

        expect(
          body.subscription,
        ).toBeTruthy();

        expect(
          body.subscription.id,
        ).toBeTruthy();

        expect(
          body.subscription.restaurantId,
        ).toBe(
          restaurant.id,
        );

        expect(
          body.subscription.plan,
        ).toBe(
          SubscriptionPlan.PRO,
        );

        expect(
          body.subscription.status,
        ).toBe(
          SubscriptionStatus.ACTIVE,
        );

        expect(
          body.subscription.maxDevices,
        ).toBe(1);

        expect(
          body.subscription.startsAt,
        ).toBeTruthy();

        expect(
          body.subscription.expiresAt,
        ).toBeTruthy();

        // ----------------------------------------------
        // Device response
        // ----------------------------------------------

        expect(
          body.device,
        ).toBeTruthy();

        expect(
          body.device.id,
        ).toBeTruthy();

        expect(
          body.device.restaurantId,
        ).toBe(
          restaurant.id,
        );

        expect(
          body.device.status,
        ).toBe(
          DeviceStatus.ACTIVE,
        );

        expect(
          body.device.name,
        ).toBe(
          "Main POS",
        );

        expect(
          body.device.activatedAt,
        ).toBeTruthy();

        // ----------------------------------------------
        // Activation code
        // ----------------------------------------------

        const databaseCode =
          await prisma.activationCode.findUnique({
            where: {
              id:
                activationCode.id,
            },
          });

        expect(
          databaseCode,
        ).not.toBeNull();

        expect(
          databaseCode?.status,
        ).toBe("USED");

        expect(
          databaseCode?.usedAt,
        ).not.toBeNull();

        expect(
          databaseCode?.restaurantId,
        ).toBe(
          restaurant.id,
        );

        // ----------------------------------------------
        // Database subscription
        // ----------------------------------------------

        const subscription =
          await prisma.subscription.findUnique({
            where: {
              id:
                body.subscription.id,
            },
          });

        expect(
          subscription,
        ).not.toBeNull();

        expect(
          subscription?.restaurantId,
        ).toBe(
          restaurant.id,
        );

        expect(
          subscription?.plan,
        ).toBe(
          SubscriptionPlan.PRO,
        );

        expect(
          subscription?.status,
        ).toBe(
          SubscriptionStatus.ACTIVE,
        );

        // ----------------------------------------------
        // Database device
        // ----------------------------------------------

        const device =
          await prisma.device.findUnique({
            where: {
              id:
                body.device.id,
            },
          });

        expect(
          device,
        ).not.toBeNull();

        expect(
          device?.restaurantId,
        ).toBe(
          restaurant.id,
        );

        expect(
          device?.status,
        ).toBe(
          DeviceStatus.ACTIVE,
        );
      },
    );

    // ==================================================
    // 2. UNAUTHENTICATED
    // ==================================================

    it(
      "rejects an unauthenticated request",
      async () => {
        mockedGetAuthUser.mockResolvedValue(
          null,
        );

        const response =
          await POST(
            createRequest({
              code:
                "KD-XXXX-XXXX-XXXX",

              deviceKey:
                "test-device-key",
            }),
          );

        expect(
          response.status,
        ).toBe(401);

        const body =
          await response.json();

        expect(
          body.success,
        ).toBe(false);

        expect(
          body.error,
        ).toBe(
          "Authentication required.",
        );
      },
    );

    // ==================================================
    // 3. MISSING ACTIVATION CODE
    // ==================================================

    it(
      "rejects a request without an activation code",
      async () => {
        mockAuthenticatedUser({
          id:
            "test-user-id",

          restaurantId:
            "test-restaurant-id",

          name:
            "Test User",

          email:
            "test@example.com",

          role:
            Role.OWNER,
        });

        const response =
          await POST(
            createRequest({
              deviceKey:
                "test-device-key",
            }),
          );

        expect(
          response.status,
        ).toBe(400);

        const body =
          await response.json();

        expect(
          body.success,
        ).toBe(false);

        expect(
          body.error,
        ).toBe(
          "Activation code is required.",
        );
      },
    );

    // ==================================================
    // 4. MISSING DEVICE KEY
    // ==================================================

    it(
      "rejects a request without a device key",
      async () => {
        mockAuthenticatedUser({
          id:
            "test-user-id",

          restaurantId:
            "test-restaurant-id",

          name:
            "Test User",

          email:
            "test@example.com",

          role:
            Role.OWNER,
        });

        const response =
          await POST(
            createRequest({
              code:
                "KD-XXXX-XXXX-XXXX",
            }),
          );

        expect(
          response.status,
        ).toBe(400);

        const body =
          await response.json();

        expect(
          body.success,
        ).toBe(false);

        expect(
          body.error,
        ).toBe(
          "Device key is required.",
        );
      },
    );

    // ==================================================
    // 5. INVALID DEVICE NAME
    // ==================================================

    it(
      "rejects a non-string device name",
      async () => {
        mockAuthenticatedUser({
          id:
            "test-user-id",

          restaurantId:
            "test-restaurant-id",

          name:
            "Test User",

          email:
            "test@example.com",

          role:
            Role.OWNER,
        });

        const response =
          await POST(
            createRequest({
              code:
                "KD-XXXX-XXXX-XXXX",

              deviceKey:
                "test-device-key",

              deviceName:
                123,
            }),
          );

        expect(
          response.status,
        ).toBe(400);

        const body =
          await response.json();

        expect(
          body.success,
        ).toBe(false);

        expect(
          body.error,
        ).toBe(
          "Device name must be a string.",
        );
      },
    );

    // ==================================================
    // 6. INVALID ACTIVATION CODE
    // ==================================================

    it(
      "rejects an invalid activation code",
      async () => {
        mockAuthenticatedUser({
          id:
            "test-user-id",

          restaurantId:
            "test-restaurant-id",

          name:
            "Test User",

          email:
            "test@example.com",

          role:
            Role.OWNER,
        });

        const response =
          await POST(
            createRequest({
              code:
                "KD-XXXX-XXXX-XXXX",

              deviceKey:
                "test-device-key",
            }),
          );

        expect(
          response.status,
        ).toBe(400);

        const body =
          await response.json();

        expect(
          body.success,
        ).toBe(false);

        expect(
  body.error,
).toBe(
  "Invalid, expired, revoked, or already used activation code.",
);
      },
    );
  },
);