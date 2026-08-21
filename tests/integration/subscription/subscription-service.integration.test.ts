import {
  describe,
  expect,
  it,
} from "vitest";

import {
  Role,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  createActivationCode,
} from "@/lib/subscription/activation-code-service";

import {
  activateSubscription,
} from "@/lib/subscription/subscription-service";

// ======================================================
// TEST HELPERS
// ======================================================

async function createTestRestaurant(
  suffix: string,
) {
  return prisma.restaurant.create({
    data: {
      name:
        `Subscription Test Restaurant ${suffix}`,
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
        `Subscription Test Owner ${suffix}`,

      email:
        `subscription-test-${suffix}@example.com`,

      password:
        "test-password",

      role:
        Role.OWNER,

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

// ======================================================
// TEST SUITE
// ======================================================

describe(
  "subscription service",
  () => {
    // ==================================================
    // 1. SUCCESSFUL ACTIVATION
    // ==================================================

    it(
      "creates an active subscription from an activation code",
      async () => {
        const suffix =
          `${Date.now()}-create`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        await createTestOwner(
          restaurant.id,
          suffix,
        );

        const activationCode =
          await createBasicActivationCode();

        const subscription =
          await activateSubscription({
            code:
              activationCode.code,

            restaurantId:
              restaurant.id,
          });

        expect(
          subscription.id,
        ).toBeTruthy();

        expect(
          subscription.restaurantId,
        ).toBe(
          restaurant.id,
        );

        expect(
          subscription.plan,
        ).toBe(
          SubscriptionPlan.BASIC,
        );

        expect(
          subscription.status,
        ).toBe(
          SubscriptionStatus.ACTIVE,
        );

        expect(
          subscription.maxDevices,
        ).toBe(1);

        expect(
          subscription.startsAt,
        ).toBeInstanceOf(Date);

        expect(
          subscription.expiresAt,
        ).toBeInstanceOf(Date);

        expect(
          subscription.expiresAt.getTime(),
        ).toBeGreaterThan(
          subscription.startsAt.getTime(),
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
          databaseCode?.usedAt,
        ).not.toBeNull();

        expect(
          databaseCode?.restaurantId,
        ).toBe(
          restaurant.id,
        );
      },
    );

    // ==================================================
    // 2. INVALID CODE
    // ==================================================

    it(
      "rejects an invalid activation code",
      async () => {
        const suffix =
          `${Date.now()}-invalid`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        await expect(
          activateSubscription({
            code:
              "KD-XXXX-XXXX-XXXX",

            restaurantId:
              restaurant.id,
          }),
        ).rejects.toThrow(
          "Invalid, expired, revoked, or already used activation code.",
        );

        const subscriptions =
          await prisma.subscription.count({
            where: {
              restaurantId:
                restaurant.id,
            },
          });

        expect(
          subscriptions,
        ).toBe(0);
      },
    );

    // ==================================================
    // 3. DUPLICATE ACTIVE SUBSCRIPTION
    // ==================================================

    it(
      "prevents a restaurant from having two active subscriptions",
      async () => {
        const suffix =
          `${Date.now()}-duplicate`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        const firstCode =
          await createBasicActivationCode();

        const firstSubscription =
          await activateSubscription({
            code:
              firstCode.code,

            restaurantId:
              restaurant.id,
          });

        expect(
          firstSubscription.status,
        ).toBe(
          SubscriptionStatus.ACTIVE,
        );

        const secondCode =
          await createActivationCode({
            plan:
              SubscriptionPlan.PRO,

            durationMonths:
              12,
          });

        await expect(
          activateSubscription({
            code:
              secondCode.code,

            restaurantId:
              restaurant.id,
          }),
        ).rejects.toThrow(
          "Restaurant already has an active subscription.",
        );

        const secondDatabaseCode =
          await prisma.activationCode.findUnique({
            where: {
              id:
                secondCode.id,
            },
          });

        expect(
          secondDatabaseCode?.status,
        ).toBe("AVAILABLE");

        expect(
          secondDatabaseCode?.usedAt,
        ).toBeNull();

        expect(
          secondDatabaseCode?.restaurantId,
        ).toBeNull();

        const subscriptions =
          await prisma.subscription.findMany({
            where: {
              restaurantId:
                restaurant.id,

              status:
                SubscriptionStatus.ACTIVE,
            },
          });

        expect(
          subscriptions,
        ).toHaveLength(1);
      },
    );

    // ==================================================
    // 4. RESTAURANT OWNERSHIP
    // ==================================================

    it(
      "rejects an activation code belonging to another restaurant",
      async () => {
        const suffix =
          `${Date.now()}-ownership`;

        const restaurantA =
          await createTestRestaurant(
            `${suffix}-a`,
          );

        const restaurantB =
          await createTestRestaurant(
            `${suffix}-b`,
          );

        const activationCode =
          await createActivationCode({
            plan:
              SubscriptionPlan.PRO,

            durationMonths:
              12,

            restaurantId:
              restaurantA.id,
          });

        await expect(
          activateSubscription({
            code:
              activationCode.code,

            restaurantId:
              restaurantB.id,
          }),
        ).rejects.toThrow(
          "Activation code does not belong to this restaurant.",
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
        ).toBe(
          restaurantA.id,
        );

        const subscriptions =
          await prisma.subscription.count({
            where: {
              restaurantId:
                restaurantB.id,
            },
          });

        expect(
          subscriptions,
        ).toBe(0);
      },
    );

    // ==================================================
    // 5. EXPIRED CODE
    // ==================================================

    it(
      "rejects an expired activation code",
      async () => {
        const suffix =
          `${Date.now()}-expired`;

        const restaurant =
          await createTestRestaurant(
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
                  60_000,
              ),
          });

        await expect(
          activateSubscription({
            code:
              activationCode.code,

            restaurantId:
              restaurant.id,
          }),
        ).rejects.toThrow(
          "Invalid, expired, revoked, or already used activation code.",
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

        const subscriptions =
          await prisma.subscription.count({
            where: {
              restaurantId:
                restaurant.id,
            },
          });

        expect(
          subscriptions,
        ).toBe(0);
      },
    );

    // ==================================================
    // 6. REVOKED CODE
    // ==================================================

    it(
      "rejects a revoked activation code",
      async () => {
        const suffix =
          `${Date.now()}-revoked`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        const activationCode =
          await createBasicActivationCode();

        await prisma.activationCode.update({
          where: {
            id:
              activationCode.id,
          },

          data: {
            status:
              "REVOKED",
          },
        });

        await expect(
          activateSubscription({
            code:
              activationCode.code,

            restaurantId:
              restaurant.id,
          }),
        ).rejects.toThrow(
          "Invalid, expired, revoked, or already used activation code.",
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
        ).toBe("REVOKED");

        expect(
          databaseCode?.usedAt,
        ).toBeNull();

        const subscriptions =
          await prisma.subscription.count({
            where: {
              restaurantId:
                restaurant.id,
            },
          });

        expect(
          subscriptions,
        ).toBe(0);
      },
    );

    // ==================================================
    // 7. EXPIRY DURATION
    // ==================================================

    it(
      "sets the subscription expiry according to the activation code duration",
      async () => {
        const suffix =
          `${Date.now()}-expiry`;

        const restaurant =
          await createTestRestaurant(
            suffix,
          );

        const activationCode =
          await createActivationCode({
            plan:
              SubscriptionPlan.PRO,

            durationMonths:
              12,
          });

        const before =
          new Date();

        const subscription =
          await activateSubscription({
            code:
              activationCode.code,

            restaurantId:
              restaurant.id,
          });

        const after =
          new Date();

        const expectedEarliestExpiry =
          new Date(before);

        expectedEarliestExpiry.setMonth(
          expectedEarliestExpiry.getMonth() +
            12,
        );

        const expectedLatestExpiry =
          new Date(after);

        expectedLatestExpiry.setMonth(
          expectedLatestExpiry.getMonth() +
            12,
        );

        expect(
          subscription.startsAt.getTime(),
        ).toBeGreaterThanOrEqual(
          before.getTime(),
        );

        expect(
          subscription.startsAt.getTime(),
        ).toBeLessThanOrEqual(
          after.getTime(),
        );

        expect(
          subscription.expiresAt.getTime(),
        ).toBeGreaterThanOrEqual(
          expectedEarliestExpiry.getTime(),
        );

        expect(
          subscription.expiresAt.getTime(),
        ).toBeLessThanOrEqual(
          expectedLatestExpiry.getTime(),
        );

        expect(
          subscription.plan,
        ).toBe(
          SubscriptionPlan.PRO,
        );
      },
    );

    // ==================================================
    // 8. CONCURRENT ACTIVATION
    // ==================================================

    it(
      "allows only one subscription when two activations race concurrently",
      async () => {
        const suffix =
          `${Date.now()}-concurrency`;

        const restaurant =
          await createTestRestaurant(
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
            activateSubscription({
              code:
                firstCode.code,

              restaurantId:
                restaurant.id,
            }),

            activateSubscription({
              code:
                secondCode.code,

              restaurantId:
                restaurant.id,
            }),
          ]);

        const successful =
          results.filter(
            (
              result,
            ) =>
              result.status ===
              "fulfilled",
          );

        const failed =
          results.filter(
            (
              result,
            ) =>
              result.status ===
              "rejected",
          );

        expect(
          successful,
        ).toHaveLength(1);

        expect(
          failed,
        ).toHaveLength(1);

        const subscriptions =
          await prisma.subscription.findMany({
            where: {
              restaurantId:
                restaurant.id,

              status:
                SubscriptionStatus.ACTIVE,
            },
          });

        expect(
          subscriptions,
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
          (
            code,
          ) =>
            code?.status ===
            "USED",
        );

        expect(
          usedCodes,
        ).toHaveLength(1);
      },
    );
  },
);