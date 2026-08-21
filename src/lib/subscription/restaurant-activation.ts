import crypto from "node:crypto";

import {
  ActivationCodeStatus,
  DeviceStatus,
  Role,
  SubscriptionPlan,
  SubscriptionStatus,
  Prisma,
} from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { findUsableActivationCode } from "@/lib/subscription/activation-code";

export interface ActivationResult {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    restaurantId: string;
  };
  subscription: {
    id: string;
    restaurantId: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    startsAt: Date;
    expiresAt: Date;
    maxDevices: number;
    priceAmount: unknown;
    currency: string;
  };
  device: {
    id: string;
    restaurantId: string;
    status: DeviceStatus;
    name: string | null;
    activatedAt: Date | null;
  };
}

export interface ActivateExistingCustomerInput {
  code: string;
  restaurantId: string;
  userId: string;
  deviceKey: string;
  deviceName?: string;
}

export interface CreateCustomerFromActivationInput {
  code: string;
  name?: string;
  email: string;
  password: string;
  restaurantName?: string;
  deviceKey: string;
  deviceName?: string;
}

function hashDeviceKey(deviceKey: string): string {
  return crypto.createHash("sha256").update(deviceKey.trim(), "utf8").digest("hex");
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}


function addMonths(from: Date, months: number): Date {
  const result = new Date(from);
  result.setMonth(result.getMonth() + months);
  return result;
}

function validateCustomerInput(input: CreateCustomerFromActivationInput & { name: string; restaurantName: string }): void {
  if (input.name.trim().length < 2 || input.name.trim().length > 80) {
    throw new Error("Name must be between 2 and 80 characters.");
  }
  if (input.restaurantName.trim().length < 2 || input.restaurantName.trim().length > 120) {
    throw new Error("Restaurant name must be between 2 and 120 characters.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    throw new Error("Enter a valid email address.");
  }
  if (input.password.length < 10 || input.password.length > 72) {
    throw new Error("Password must be between 10 and 72 characters.");
  }
  if (input.deviceKey.trim().length < 16 || input.deviceKey.trim().length > 256) {
    throw new Error("Device key is invalid.");
  }
}

async function consumeActivationCode(
  transaction: Prisma.TransactionClient,
  activationCodeId: string,
  restaurantId: string,
  now: Date,
): Promise<void> {
  const updated = await transaction.activationCode.updateMany({
    where: { id: activationCodeId, status: ActivationCodeStatus.AVAILABLE },
    data: { status: ActivationCodeStatus.USED, usedAt: now, restaurantId },
  });
  if (updated.count !== 1) {
    throw new Error("Activation code is no longer available.");
  }
}

async function createSubscriptionAndDevice(
  transaction: Prisma.TransactionClient,
  activationCode: Awaited<ReturnType<typeof findUsableActivationCode>>,
  restaurantId: string,
  userId: string,
  deviceKey: string,
  deviceName: string | undefined,
  now: Date,
): Promise<ActivationResult["subscription"] & { device: ActivationResult["device"] }> {
  if (!activationCode) throw new Error("Invalid activation code.");

  const existingSubscription = await transaction.subscription.findFirst({
    where: { restaurantId, status: SubscriptionStatus.ACTIVE, expiresAt: { gt: now } },
    select: { id: true },
  });
  if (existingSubscription) {
    throw new Error("Restaurant already has an active subscription.");
  }

  const deviceKeyHash = hashDeviceKey(deviceKey);
  const existingDevice = await transaction.device.findUnique({
    where: { deviceKeyHash },
    select: { id: true, restaurantId: true, status: true },
  });
  if (existingDevice && existingDevice.restaurantId !== restaurantId) {
    throw new Error("This device is already bound to another restaurant.");
  }

  const activeDeviceCount = await transaction.device.count({
    where: { restaurantId, status: DeviceStatus.ACTIVE },
  });
  const maxDevices = Math.max(1, activationCode.maxDevices || 1);
  if (activeDeviceCount >= maxDevices && !existingDevice) {
    throw new Error(`Device limit reached (${maxDevices}).`);
  }

  const expiresAt = addMonths(now, activationCode.durationMonths);
  await consumeActivationCode(transaction, activationCode.id, restaurantId, now);

  const subscription = await transaction.subscription.create({
    data: {
      plan: activationCode.plan,
      status: SubscriptionStatus.ACTIVE,
      startsAt: now,
      expiresAt,
      maxDevices,
      priceAmount: activationCode.priceAmount ?? null,
      currency: activationCode.currency,
      restaurantId,
    },
    select: {
      id: true, restaurantId: true, plan: true, status: true,
      startsAt: true, expiresAt: true, maxDevices: true,
      priceAmount: true, currency: true,
    },
  });

  const device = existingDevice
    ? await transaction.device.update({
        where: { id: existingDevice.id },
        data: {
          name: normalizeName(deviceName || "POS Device") || "POS Device",
          status: DeviceStatus.ACTIVE,
          activatedAt: now,
          lastSeenAt: now,
          revokedAt: null,
          activatedById: userId,
        },
        select: { id: true, restaurantId: true, status: true, name: true, activatedAt: true },
      })
    : await transaction.device.create({
        data: {
          deviceKeyHash,
          name: normalizeName(deviceName || "POS Device") || "POS Device",
          status: DeviceStatus.ACTIVE,
          activatedAt: now,
          lastSeenAt: now,
          restaurantId,
          activatedById: userId,
        },
        select: { id: true, restaurantId: true, status: true, name: true, activatedAt: true },
      });

  return { ...subscription, device };
}

export async function activateExistingCustomer(
  input: ActivateExistingCustomerInput,
): Promise<ActivationResult> {
  const code = input.code.trim().toUpperCase();
  const deviceKey = input.deviceKey.trim();
  if (!code) throw new Error("Activation code is required.");
  if (!deviceKey) throw new Error("Device key is required.");

  const activationCode = await findUsableActivationCode(code);
  if (!activationCode) throw new Error("Invalid, expired, revoked, or already used activation code.");
  if (activationCode.restaurantId && activationCode.restaurantId !== input.restaurantId) {
    throw new Error("Activation code does not belong to this restaurant.");
  }

  const now = new Date();
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { id: input.userId },
      select: { id: true, name: true, email: true, role: true, restaurantId: true, isActive: true, restaurant: { select: { isActive: true } } },
    });
    if (!user || !user.isActive || !user.restaurant.isActive) throw new Error("User or restaurant is inactive.");
    if (user.restaurantId !== input.restaurantId) throw new Error("User is not authorized for this restaurant.");

    const result = await createSubscriptionAndDevice(
      transaction, activationCode, input.restaurantId, user.id, deviceKey, input.deviceName, now,
    );
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, restaurantId: user.restaurantId },
      subscription: result,
      device: result.device,
    };
  });
}

export async function createCustomerFromActivation(
  input: CreateCustomerFromActivationInput,
): Promise<ActivationResult> {
  const code = input.code.trim().toUpperCase();
  const email = input.email.trim().toLowerCase();
  const activationCode = await findUsableActivationCode(code);
  if (!activationCode) throw new Error("Invalid, expired, revoked, or already used activation code.");
  if (activationCode.restaurantId) {
    throw new Error("This activation code is already assigned. Sign in with the assigned account.");
  }

  if (activationCode.customerEmail && activationCode.customerEmail.trim().toLowerCase() !== email) {
    throw new Error("This activation code was issued to a different customer email address.");
  }

  const effectiveName = normalizeName(activationCode.customerName || input.name || "");
  const effectiveRestaurantName = normalizeName(activationCode.restaurantName || input.restaurantName || "");
  validateCustomerInput({ ...input, name: effectiveName, restaurantName: effectiveRestaurantName });

  const now = new Date();
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.$transaction(async (transaction) => {
    const existingUser = await transaction.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) throw new Error("An account with this email already exists. Sign in instead.");

    const existingRestaurant = await transaction.restaurant.findUnique({ where: { email }, select: { id: true } });
    if (existingRestaurant) throw new Error("A restaurant with this email already exists.");

    const restaurant = await transaction.restaurant.create({
      data: {
        name: effectiveRestaurantName,
        email,
        phone: activationCode.customerPhone?.trim() || null,
        address: null,
        currency: activationCode.currency || "INR",
        timezone: "Asia/Kolkata",
        isActive: true,
      },
    });

    const user = await transaction.user.create({
      data: {
        name: effectiveName,
        email,
        password: passwordHash,
        role: Role.OWNER,
        isActive: true,
        restaurantId: restaurant.id,
      },
      select: { id: true, name: true, email: true, role: true, restaurantId: true },
    });

    const result = await createSubscriptionAndDevice(
      transaction, activationCode, restaurant.id, user.id, input.deviceKey, input.deviceName, now,
    );

    return { user, subscription: result, device: result.device };
  });
}

/** Backward-compatible service entry point for existing integration tests and internal callers. */
export async function activateRestaurant(input: ActivateExistingCustomerInput): Promise<ActivationResult> {
  return activateExistingCustomer(input);
}
