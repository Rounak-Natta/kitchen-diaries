import {
  describe,
  expect,
  it,
} from "vitest";

import {
  DeviceStatus,
  Role,
  SubscriptionPlan,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  createActivationCode,
} from "@/lib/subscription/activation-code-service";

import {
  activateDevice,
} from "@/lib/device/device-activation";

// ======================================================
// TEST HELPERS
// ======================================================

async function createTestRestaurant(
  suffix: string,
  options?: {
    isActive?: boolean;
  },
) {
  return prisma.restaurant.create({
    data: {
      name:
        `Device Test Restaurant ${suffix}`,

      isActive:
        options?.isActive ?? true,
    },
  });
}

async function createTestOwner(
  restaurantId: string,
  suffix: string,
  options?: {
    isActive?: boolean;
  },
) {
  return prisma.user.create({
    data: {
      name:
        `Device Test Owner ${suffix}`,

      email:
        `device-test-${suffix}@example.com`,

      password:
        "test-password",

      role:
        Role.OWNER,

      isActive:
        options?.isActive ?? true,

      restaurantId,
    },
  });
}

async function createBasicActivationCode() {
  return createActivationCode({
    plan:
      SubscriptionPlan.BASIC,

    durationMonths:
      6,
  });
}

async function countRestaurantDevices(
  restaurantId: string,
) {
  return prisma.device.count({
    where: {
      restaurantId,
    },
  });
}

// ======================================================
// TEST SUITE
// ======================================================

describe(
  "device activation service",
  () => {
    // ==================================================
    // 1. SUCCESSFUL ACTIVATION
    // ==================================================

    it(
      "activates one device for a restaurant",
      async () => {
        const suffix =
          `${Date.now()}-basic`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        const user =
          await createTestOwner(
            restaurant.id,
            suffix,
          );

        const activationCode =
          await createBasicActivationCode();

        const deviceKey =
          `device-key-${suffix}`;

        const device =
          await activateDevice({
            code:
              activationCode.code,

            userId:
              user.id,

            deviceKey,

            deviceName:
              "Main POS",
          });

        expect(
          device.id,
        ).toBeTruthy();

        expect(
          device.restaurantId,
        ).toBe(
          restaurant.id,
        );

        expect(
          device.status,
        ).toBe(
          DeviceStatus.ACTIVE,
        );

        expect(
          device.name,
        ).toBe(
          "Main POS",
        );

        expect(
          device.activatedAt,
        ).not.toBeNull();

        const updatedCode =
          await prisma.activationCode.findUnique({
            where: {
              id:
                activationCode.id,
            },
          });

        expect(
          updatedCode?.status,
        ).toBe("USED");

        expect(
          updatedCode?.usedAt,
        ).not.toBeNull();

        expect(
          updatedCode?.restaurantId,
        ).toBe(
          restaurant.id,
        );

        expect(
          await countRestaurantDevices(
            restaurant.id,
          ),
        ).toBe(1);
      },
    );

    // ==================================================
    // 2. SECOND DEVICE IS NOT ALLOWED
    // ==================================================

    it(
      "prevents a restaurant from activating a second device",
      async () => {
        const suffix =
          `${Date.now()}-second`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        const user =
          await createTestOwner(
            restaurant.id,
            suffix,
          );

        const firstCode =
          await createBasicActivationCode();

        await activateDevice({
          code:
            firstCode.code,

          userId:
            user.id,

          deviceKey:
            `device-key-${suffix}-first`,
        });

        const secondCode =
          await createActivationCode({
            plan:
              SubscriptionPlan.PRO,

            durationMonths:
              12,
          });

        await expect(
          activateDevice({
            code:
              secondCode.code,

            userId:
              user.id,

            deviceKey:
              `device-key-${suffix}-second`,
          }),
        ).rejects.toThrow(
          "This restaurant already has an active device.",
        );

        const secondCodeRecord =
          await prisma.activationCode.findUnique({
            where: {
              id:
                secondCode.id,
            },
          });

        expect(
          secondCodeRecord?.status,
        ).toBe("AVAILABLE");

        expect(
          secondCodeRecord?.usedAt,
        ).toBeNull();

        expect(
          secondCodeRecord?.restaurantId,
        ).toBeNull();

        expect(
          await countRestaurantDevices(
            restaurant.id,
          ),
        ).toBe(1);
      },
    );

    // ==================================================
    // 3. DEVICE CANNOT MOVE TO ANOTHER RESTAURANT
    // ==================================================

    it(
      "prevents a device from being bound to another restaurant",
      async () => {
        const suffix =
          `${Date.now()}-shared`;

        const restaurantA =
          await createTestRestaurant(
            `${suffix}-a`,
          );

        const restaurantB =
          await createTestRestaurant(
            `${suffix}-b`,
          );

        const userA =
          await createTestOwner(
            restaurantA.id,
            `${suffix}-user-a`,
          );

        const userB =
          await createTestOwner(
            restaurantB.id,
            `${suffix}-user-b`,
          );

        const deviceKey =
          `shared-device-key-${suffix}`;

        const firstCode =
          await createBasicActivationCode();

        await activateDevice({
          code:
            firstCode.code,

          userId:
            userA.id,

          deviceKey,
        });

        const secondCode =
          await createActivationCode({
            plan:
              SubscriptionPlan.PRO,

            durationMonths:
              12,
          });

        await expect(
          activateDevice({
            code:
              secondCode.code,

            userId:
              userB.id,

            deviceKey,
          }),
        ).rejects.toThrow(
          "Device is already bound to another restaurant.",
        );

        const secondCodeRecord =
          await prisma.activationCode.findUnique({
            where: {
              id:
                secondCode.id,
            },
          });

        expect(
          secondCodeRecord?.status,
        ).toBe("AVAILABLE");

        expect(
          secondCodeRecord?.usedAt,
        ).toBeNull();

        expect(
          secondCodeRecord?.restaurantId,
        ).toBeNull();

        expect(
          await countRestaurantDevices(
            restaurantA.id,
          ),
        ).toBe(1);

        expect(
          await countRestaurantDevices(
            restaurantB.id,
          ),
        ).toBe(0);
      },
    );

    // ==================================================
    // 4. USED ACTIVATION CODE
    // ==================================================

    it(
      "cannot reuse a used activation code",
      async () => {
        const suffix =
          `${Date.now()}-reuse`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        const user =
          await createTestOwner(
            restaurant.id,
            suffix,
          );

        const activationCode =
          await createBasicActivationCode();

        await activateDevice({
          code:
            activationCode.code,

          userId:
            user.id,

          deviceKey:
            `device-key-${suffix}-first`,
        });

        await expect(
          activateDevice({
            code:
              activationCode.code,

            userId:
              user.id,

            deviceKey:
              `device-key-${suffix}-second`,
          }),
        ).rejects.toThrow(
          "Invalid or unavailable activation code.",
        );

        const databaseCode =
          await prisma.activationCode.findUnique({
            where: {
              id:
                activationCode.id,
            },
          });

        expect(
          databaseCode?.status,
        ).toBe("USED");

        expect(
          databaseCode?.restaurantId,
        ).toBe(
          restaurant.id,
        );

        expect(
          databaseCode?.usedAt,
        ).not.toBeNull();

        expect(
          await countRestaurantDevices(
            restaurant.id,
          ),
        ).toBe(1);
      },
    );

    // ==================================================
    // 5. EXPIRED ACTIVATION CODE
    // ==================================================

    it(
      "rejects an expired activation code without creating a device",
      async () => {
        const suffix =
          `${Date.now()}-expired`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        const user =
          await createTestOwner(
            restaurant.id,
            suffix,
          );

        const activationCode =
          await createActivationCode({
            plan:
              SubscriptionPlan.BASIC,

            durationMonths:
              6,

            expiresAt:
              new Date(
                Date.now() -
                  24 *
                    60 *
                    60 *
                    1000,
              ),
          });

        await expect(
          activateDevice({
            code:
              activationCode.code,

            userId:
              user.id,

            deviceKey:
              `expired-device-${suffix}`,
          }),
        ).rejects.toThrow(
          "Invalid or unavailable activation code.",
        );

        const databaseCode =
          await prisma.activationCode.findUnique({
            where: {
              id:
                activationCode.id,
            },
          });

        expect(
          databaseCode?.status,
        ).toBe("AVAILABLE");

        expect(
          databaseCode?.usedAt,
        ).toBeNull();

        expect(
          databaseCode?.restaurantId,
        ).toBeNull();

        expect(
          await countRestaurantDevices(
            restaurant.id,
          ),
        ).toBe(0);
      },
    );

    // ==================================================
    // 6. INACTIVE USER
    // ==================================================

    it(
      "rejects activation for an inactive user",
      async () => {
        const suffix =
          `${Date.now()}-inactive-user`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        const user =
          await createTestOwner(
            restaurant.id,
            suffix,
            {
              isActive:
                false,
            },
          );

        const activationCode =
          await createBasicActivationCode();

        await expect(
          activateDevice({
            code:
              activationCode.code,

            userId:
              user.id,

            deviceKey:
              `inactive-user-device-${suffix}`,
          }),
        ).rejects.toThrow(
          "User is not authorized.",
        );

        const databaseCode =
          await prisma.activationCode.findUnique({
            where: {
              id:
                activationCode.id,
            },
          });

        expect(
          databaseCode?.status,
        ).toBe("AVAILABLE");

        expect(
          databaseCode?.usedAt,
        ).toBeNull();

        expect(
          databaseCode?.restaurantId,
        ).toBeNull();

        expect(
          await countRestaurantDevices(
            restaurant.id,
          ),
        ).toBe(0);
      },
    );

    // ==================================================
    // 7. INACTIVE RESTAURANT
    // ==================================================

    it(
      "rejects activation for an inactive restaurant",
      async () => {
        const suffix =
          `${Date.now()}-inactive-restaurant`;

        const restaurant =
          await createTestRestaurant(
            suffix,
            {
              isActive:
                false,
            },
          );

        const user =
          await createTestOwner(
            restaurant.id,
            suffix,
          );

        const activationCode =
          await createBasicActivationCode();

        await expect(
          activateDevice({
            code:
              activationCode.code,

            userId:
              user.id,

            deviceKey:
              `inactive-restaurant-device-${suffix}`,
          }),
        ).rejects.toThrow(
          "User is not authorized.",
        );

        const databaseCode =
          await prisma.activationCode.findUnique({
            where: {
              id:
                activationCode.id,
            },
          });

        expect(
          databaseCode?.status,
        ).toBe("AVAILABLE");

        expect(
          databaseCode?.usedAt,
        ).toBeNull();

        expect(
          databaseCode?.restaurantId,
        ).toBeNull();

        expect(
          await countRestaurantDevices(
            restaurant.id,
          ),
        ).toBe(0);
      },
    );

    // ==================================================
    // 8. INVALID USER
    // ==================================================

    it(
      "rejects activation for a non-existent user",
      async () => {
        const suffix =
          `${Date.now()}-missing-user`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        const activationCode =
          await createBasicActivationCode();

        await expect(
          activateDevice({
            code:
              activationCode.code,

            userId:
              "non-existent-user-id",

            deviceKey:
              `missing-user-device-${suffix}`,
          }),
        ).rejects.toThrow(
          "User is not authorized.",
        );

        expect(
          await countRestaurantDevices(
            restaurant.id,
          ),
        ).toBe(0);

        const databaseCode =
          await prisma.activationCode.findUnique({
            where: {
              id:
                activationCode.id,
            },
          });

        expect(
          databaseCode?.status,
        ).toBe("AVAILABLE");
      },
    );

    // ==================================================
    // 9. EMPTY DEVICE KEY
    // ==================================================

    it(
      "rejects an empty device key",
      async () => {
        const suffix =
          `${Date.now()}-empty-key`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        const user =
          await createTestOwner(
            restaurant.id,
            suffix,
          );

        await expect(
          activateDevice({
            code:
              "KD-XXXX-XXXX-XXXX",

            userId:
              user.id,

            deviceKey:
              "   ",
          }),
        ).rejects.toThrow(
          "Device key is required.",
        );

        expect(
          await countRestaurantDevices(
            restaurant.id,
          ),
        ).toBe(0);
      },
    );

    // ==================================================
    // 10. SAME ACTIVE DEVICE
    // ==================================================

    it(
      "returns the existing active device when the same device key is activated again",
      async () => {
        const suffix =
          `${Date.now()}-same-device`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        const user =
          await createTestOwner(
            restaurant.id,
            suffix,
          );

        const firstCode =
          await createBasicActivationCode();

        const deviceKey =
          `same-device-key-${suffix}`;

        const firstDevice =
          await activateDevice({
            code:
              firstCode.code,

            userId:
              user.id,

            deviceKey,

            deviceName:
              "Main POS",
          });

        const secondCode =
          await createActivationCode({
            plan:
              SubscriptionPlan.PRO,

            durationMonths:
              12,
          });

        const secondDevice =
          await activateDevice({
            code:
              secondCode.code,

            userId:
              user.id,

            deviceKey,

            deviceName:
              "Updated POS Name",
          });

        expect(
          secondDevice.id,
        ).toBe(
          firstDevice.id,
        );

        expect(
          secondDevice.restaurantId,
        ).toBe(
          restaurant.id,
        );

        expect(
          secondDevice.status,
        ).toBe(
          DeviceStatus.ACTIVE,
        );

        expect(
          await countRestaurantDevices(
            restaurant.id,
          ),
        ).toBe(1);
      },
    );

    it(
  "allows only one device when two activations race concurrently",
  async () => {
    const suffix =
      `${Date.now()}-concurrency`;

    const restaurant =
      await createTestRestaurant(
        suffix,
      );

    const user =
      await createTestOwner(
        restaurant.id,
        suffix,
      );

    const firstCode =
      await createBasicActivationCode();

    const secondCode =
      await createActivationCode({
        plan:
          SubscriptionPlan.PRO,

        durationMonths:
          12,
      });

    const results =
      await Promise.allSettled([
        activateDevice({
          code:
            firstCode.code,

          userId:
            user.id,

          deviceKey:
            `concurrent-device-${suffix}-1`,
        }),

        activateDevice({
          code:
            secondCode.code,

          userId:
            user.id,

          deviceKey:
            `concurrent-device-${suffix}-2`,
        }),
      ]);

    const successful =
      results.filter(
        (result) =>
          result.status ===
          "fulfilled",
      );

    const failed =
      results.filter(
        (result) =>
          result.status ===
          "rejected",
      );

    expect(
      successful,
    ).toHaveLength(1);

    expect(
      failed,
    ).toHaveLength(1);

    const devices =
      await prisma.device.findMany({
        where: {
          restaurantId:
            restaurant.id,

          status:
            DeviceStatus.ACTIVE,
        },
      });

    expect(
      devices,
    ).toHaveLength(1);

    const firstCodeRecord =
      await prisma.activationCode.findUnique({
        where: {
          id:
            firstCode.id,
        },
      });

    const secondCodeRecord =
      await prisma.activationCode.findUnique({
        where: {
          id:
            secondCode.id,
        },
      });

    const usedCodes = [
      firstCodeRecord,
      secondCodeRecord,
    ].filter(
      (code) =>
        code?.status ===
        "USED",
    );

    expect(
      usedCodes,
    ).toHaveLength(1);
  },
);

    // ==================================================
    // 11. DEVICE KEY IS NORMALIZED
    // ==================================================

    it(
      "normalizes whitespace around the device key",
      async () => {
        const suffix =
          `${Date.now()}-normalize`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        const user =
          await createTestOwner(
            restaurant.id,
            suffix,
          );

        const activationCode =
          await createBasicActivationCode();

        const device =
          await activateDevice({
            code:
              activationCode.code,

            userId:
              user.id,

            deviceKey:
              `   normalized-device-${suffix}   `,
          });

        expect(
          device.id,
        ).toBeTruthy();

        expect(
          device.restaurantId,
        ).toBe(
          restaurant.id,
        );

        expect(
          await countRestaurantDevices(
            restaurant.id,
          ),
        ).toBe(1);
      },
    );
  },
);