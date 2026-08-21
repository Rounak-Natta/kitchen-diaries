import { describe, expect, it } from "vitest";
import { DeviceStatus, Role, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createActivationCode } from "@/lib/subscription/activation-code-service";
import { activateRestaurant } from "@/lib/subscription/restaurant-activation";

async function createTestRestaurant(suffix: string) {
  return prisma.restaurant.create({ data: { name: `Restaurant Activation Test ${suffix}` } });
}

async function createTestOwner(restaurantId: string, suffix: string) {
  return prisma.user.create({
    data: {
      name: `Restaurant Activation Owner ${suffix}`,
      email: `restaurant-activation-${suffix}@example.com`,
      password: "test-password",
      role: Role.OWNER,
      restaurantId,
    },
  });
}

describe("restaurant activation service", () => {
  it("creates a subscription and device and consumes the activation code", async () => {
    const suffix = `${Date.now()}-success`;
    const restaurant = await createTestRestaurant(suffix);
    const user = await createTestOwner(restaurant.id, suffix);
    const activationCode = await createActivationCode({ plan: SubscriptionPlan.PRO, durationMonths: 12, maxDevices: 1, priceAmount: 7999 });

    const result = await activateRestaurant({
      code: activationCode.code,
      restaurantId: restaurant.id,
      userId: user.id,
      deviceKey: `restaurant-device-${suffix}`,
      deviceName: "Main POS",
    });

    expect(result.subscription.plan).toBe(SubscriptionPlan.PRO);
    expect(result.subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(result.subscription.maxDevices).toBe(1);
    expect(result.subscription.priceAmount).toBeTruthy();
    expect(result.device.status).toBe(DeviceStatus.ACTIVE);
    expect(result.device.name).toBe("Main POS");

    const databaseCode = await prisma.activationCode.findUnique({ where: { id: activationCode.id } });
    expect(databaseCode?.status).toBe("USED");
    expect(await prisma.subscription.count({ where: { restaurantId: restaurant.id } })).toBe(1);
    expect(await prisma.device.count({ where: { restaurantId: restaurant.id } })).toBe(1);
  });

  it("rejects a device already bound to another restaurant without consuming the code", async () => {
    const suffix = `${Date.now()}-bound`;
    const restaurantA = await createTestRestaurant(`${suffix}-a`);
    const restaurantB = await createTestRestaurant(`${suffix}-b`);
    const userB = await createTestOwner(restaurantB.id, `${suffix}-b`);
    const deviceKey = `cross-restaurant-device-${suffix}`;
    const crypto = await import("node:crypto");
    const deviceKeyHash = crypto.createHash("sha256").update(deviceKey, "utf8").digest("hex");

    await prisma.device.create({
      data: {
        deviceKeyHash,
        name: "Existing Device",
        status: DeviceStatus.ACTIVE,
        activatedAt: new Date(),
        lastSeenAt: new Date(),
        restaurantId: restaurantB.id,
        activatedById: userB.id,
      },
    });

    const userA = await createTestOwner(restaurantA.id, `${suffix}-a`);
    const activationCode = await createActivationCode({ plan: SubscriptionPlan.BASIC, durationMonths: 6 });

    await expect(activateRestaurant({
      code: activationCode.code,
      restaurantId: restaurantA.id,
      userId: userA.id,
      deviceKey,
    })).rejects.toThrow("already bound to another restaurant");

    const databaseCode = await prisma.activationCode.findUnique({ where: { id: activationCode.id } });
    expect(databaseCode?.status).toBe("AVAILABLE");
    expect(await prisma.subscription.count({ where: { restaurantId: restaurantA.id } })).toBe(0);
  });

  it("rejects a second activation for the same restaurant", async () => {
    const suffix = `${Date.now()}-second`;
    const restaurant = await createTestRestaurant(suffix);
    const user = await createTestOwner(restaurant.id, suffix);
    const firstCode = await createActivationCode({ plan: SubscriptionPlan.BASIC, durationMonths: 6 });

    await activateRestaurant({ code: firstCode.code, restaurantId: restaurant.id, userId: user.id, deviceKey: `first-device-${suffix}` });

    const secondCode = await createActivationCode({ plan: SubscriptionPlan.PRO, durationMonths: 12 });
    await expect(activateRestaurant({
      code: secondCode.code,
      restaurantId: restaurant.id,
      userId: user.id,
      deviceKey: `second-device-${suffix}`,
    })).rejects.toThrow("Restaurant already has an active subscription");

    const secondCodeRecord = await prisma.activationCode.findUnique({ where: { id: secondCode.id } });
    expect(secondCodeRecord?.status).toBe("AVAILABLE");
  });
});
