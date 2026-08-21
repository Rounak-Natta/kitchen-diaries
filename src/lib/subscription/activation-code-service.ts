import {
  SubscriptionPlan,
  ActivationCodeStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  generateActivationCode,
} from "@/lib/subscription/activation-code";

interface CreateActivationCodeInput {
  plan: SubscriptionPlan;
  durationMonths: number;
  expiresAt?: Date;
  restaurantId?: string;
  maxDevices?: number;
  priceAmount?: number;
  currency?: string;
}

interface CreatedActivationCode {
  id: string;
  code: string;
  plan: SubscriptionPlan;
  durationMonths: number;
  status: ActivationCodeStatus;
  expiresAt: Date | null;
}

export async function createActivationCode(
  input: CreateActivationCodeInput,
): Promise<CreatedActivationCode> {
  if (
    !Number.isInteger(
      input.durationMonths,
    ) ||
    input.durationMonths <= 0
  ) {
    throw new Error(
      "durationMonths must be a positive integer.",
    );
  }

  const {
    code,
    codeHash,
  } = await generateActivationCode();

  const activationCode =
    await prisma.activationCode.create({
      data: {
        codeHash,

        plan:
          input.plan,

        durationMonths:
          input.durationMonths,

        maxDevices: Math.max(1, Math.floor(input.maxDevices ?? 10)),
        priceAmount: input.priceAmount ?? null,
        currency: input.currency ?? "INR",

        expiresAt:
          input.expiresAt,

        restaurantId:
          input.restaurantId,

        status:
          ActivationCodeStatus.AVAILABLE,
      },

      select: {
        id: true,
        plan: true,
        durationMonths: true,
        status: true,
        expiresAt: true,
      },
    });

  return {
    id:
      activationCode.id,

    code,

    plan:
      activationCode.plan,

    durationMonths:
      activationCode.durationMonths,

    status:
      activationCode.status,

    expiresAt:
      activationCode.expiresAt,
  };
}