import crypto from "node:crypto";

import {
  ActivationCodeStatus,
  DeviceStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  findUsableActivationCode,
} from "@/lib/subscription/activation-code";

// ======================================================
// TYPES
// ======================================================

interface ActivateDeviceInput {
  code: string;
  userId: string;
  deviceKey: string;
  deviceName?: string;
}

interface ActivatedDevice {
  id: string;
  restaurantId: string;
  status: DeviceStatus;
  activatedAt: Date | null;
  name: string | null;
}

// ======================================================
// HELPERS
// ======================================================

function hashDeviceKey(
  deviceKey: string,
): string {
  return crypto
    .createHash("sha256")
    .update(
      deviceKey.trim(),
      "utf8",
    )
    .digest("hex");
}

// ======================================================
// DEVICE ACTIVATION
// ======================================================

export async function activateDevice(
  input: ActivateDeviceInput,
): Promise<ActivatedDevice> {
  const deviceKey =
    input.deviceKey.trim();

  if (!deviceKey) {
    throw new Error(
      "Device key is required.",
    );
  }

  // ----------------------------------------------------
  // Validate authenticated user + restaurant
  // ----------------------------------------------------

  const user =
    await prisma.user.findUnique({
      where: {
        id: input.userId,
      },

      select: {
        id: true,
        restaurantId: true,
        isActive: true,

        restaurant: {
          select: {
            isActive: true,
          },
        },
      },
    });

  if (
    !user ||
    !user.isActive ||
    !user.restaurant.isActive
  ) {
    throw new Error(
      "User is not authorized.",
    );
  }

  // ----------------------------------------------------
  // Validate activation code
  // ----------------------------------------------------

  const activationCode =
    await findUsableActivationCode(
      input.code,
    );

  if (!activationCode) {
    throw new Error(
      "Invalid or unavailable activation code.",
    );
  }

  // ----------------------------------------------------
  // Hash device key
  // ----------------------------------------------------

  const deviceKeyHash =
    hashDeviceKey(deviceKey);

  // ----------------------------------------------------
  // Atomic activation transaction
  // ----------------------------------------------------

  return prisma.$transaction(
    async (transaction) => {
      // ----------------------------------------------
      // Check whether this device already exists
      // ----------------------------------------------

      const existingDevice =
        await transaction.device.findUnique({
          where: {
            deviceKeyHash,
          },

          select: {
            id: true,
            restaurantId: true,
            status: true,
            activatedAt: true,
            name: true,
          },
        });

      if (existingDevice) {
        // Device belongs to another restaurant
        if (
          existingDevice.restaurantId !==
          user.restaurantId
        ) {
          throw new Error(
            "Device is already bound to another restaurant.",
          );
        }

        // Same device but revoked/inactive
        if (
          existingDevice.status !==
          DeviceStatus.ACTIVE
        ) {
          throw new Error(
            "Device is not active.",
          );
        }

        // Same active device.
        // Treat activation as idempotent.
        return existingDevice;
      }

      // ----------------------------------------------
      // One active device per restaurant for now
      // ----------------------------------------------

      const existingActiveDevice =
        await transaction.device.findFirst({
          where: {
            restaurantId:
              user.restaurantId,

            status:
              DeviceStatus.ACTIVE,
          },

          select: {
            id: true,
          },
        });

      if (existingActiveDevice) {
        throw new Error(
          "This restaurant already has an active device.",
        );
      }

      // ----------------------------------------------
      // Create device
      // ----------------------------------------------

      const now =
        new Date();

      const device =
        await transaction.device.create({
          data: {
            deviceKeyHash,

            name:
              input.deviceName?.trim() ||
              null,

            status:
              DeviceStatus.ACTIVE,

            activatedAt:
              now,

            lastSeenAt:
              now,

            restaurantId:
              user.restaurantId,

            activatedById:
              user.id,
          },

          select: {
            id: true,
            restaurantId: true,
            status: true,
            activatedAt: true,
            name: true,
          },
        });

      // ----------------------------------------------
      // Consume activation code
      // ----------------------------------------------

      await transaction.activationCode.update({
        where: {
          id:
            activationCode.id,
        },

        data: {
          status:
            ActivationCodeStatus.USED,

          usedAt:
            now,

          restaurantId:
            user.restaurantId,
        },
      });

      return device;
    },
  );
}