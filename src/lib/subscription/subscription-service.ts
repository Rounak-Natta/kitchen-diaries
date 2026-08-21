import {
  ActivationCodeStatus,
  SubscriptionStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  findUsableActivationCode,
} from "@/lib/subscription/activation-code";

interface ActivateSubscriptionInput {
  code: string;
  restaurantId: string;
}

interface ActivatedSubscription {
  id: string;
  restaurantId: string;
  plan: import("@prisma/client").SubscriptionPlan;
  status: SubscriptionStatus;
  startsAt: Date;
  expiresAt: Date;
  maxDevices: number;
}

export async function activateSubscription(
  input: ActivateSubscriptionInput,
): Promise<ActivatedSubscription> {
  const activationCode =
    await findUsableActivationCode(
      input.code,
    );

  if (!activationCode) {
    throw new Error(
      "Invalid, expired, revoked, or already used activation code.",
    );
  }

  if (
    activationCode.restaurantId &&
    activationCode.restaurantId !==
      input.restaurantId
  ) {
    throw new Error(
      "Activation code does not belong to this restaurant.",
    );
  }

  const startsAt = new Date();

  const expiresAt =
    new Date(startsAt);

  expiresAt.setMonth(
    expiresAt.getMonth() +
      activationCode.durationMonths,
  );

  const subscription =
    await prisma.$transaction(
      async (transaction) => {
        const existingSubscription =
          await transaction.subscription.findFirst({
            where: {
              restaurantId:
                input.restaurantId,

              status:
                SubscriptionStatus.ACTIVE,

              expiresAt: {
                gt: startsAt,
              },
            },
          });

        if (existingSubscription) {
          throw new Error(
            "Restaurant already has an active subscription.",
          );
        }

        const updatedCode =
          await transaction.activationCode.updateMany({
            where: {
              id:
                activationCode.id,

              status:
                ActivationCodeStatus.AVAILABLE,
            },

            data: {
              status:
                ActivationCodeStatus.USED,

              usedAt:
                startsAt,

              restaurantId:
                input.restaurantId,
            },
          });

        if (
          updatedCode.count !== 1
        ) {
          throw new Error(
            "Activation code is no longer available.",
          );
        }

        return transaction.subscription.create({
          data: {
            plan:
              activationCode.plan,

            status:
              SubscriptionStatus.ACTIVE,

            startsAt,

            expiresAt,

            maxDevices: activationCode.maxDevices || 1,
            priceAmount: activationCode.priceAmount ?? null,
            currency: activationCode.currency,

            restaurantId:
              input.restaurantId,
          },

          select: {
            id: true,
            restaurantId: true,
            plan: true,
            status: true,
            startsAt: true,
            expiresAt: true,
            maxDevices: true,
          },
        });
      },
    );

  return subscription;
}