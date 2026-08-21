import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ActivationCodeStatus,
  SubscriptionPlan,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  createActivationCode,
} from "@/lib/subscription/activation-code-service";

import {
  findActivationCode,
  findUsableActivationCode,
} from "@/lib/subscription/activation-code";

describe(
  "activation code service",
  () => {
    it(
      "creates an activation code and stores only its hash",
      async () => {
        const result =
          await createActivationCode({
            plan:
              SubscriptionPlan.BASIC,

            durationMonths:
              6,
          });

        expect(
          result.id,
        ).toBeTruthy();

        expect(
          result.code,
        ).toMatch(
          /^KD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/,
        );

        expect(
          result.plan,
        ).toBe(
          SubscriptionPlan.BASIC,
        );

        expect(
          result.durationMonths,
        ).toBe(6);

        expect(
          result.status,
        ).toBe(
          ActivationCodeStatus.AVAILABLE,
        );

        const databaseRecord =
          await prisma.activationCode.findUnique({
            where: {
              id:
                result.id,
            },
          });

        expect(
          databaseRecord,
        ).not.toBeNull();

        expect(
          databaseRecord?.codeHash,
        ).toBeTruthy();

        expect(
          databaseRecord?.codeHash,
        ).not.toBe(
          result.code,
        );
      },
    );

    it(
      "finds an activation code using the plaintext code",
      async () => {
        const result =
          await createActivationCode({
            plan:
              SubscriptionPlan.PRO,

            durationMonths:
              12,
          });

        const found =
          await findActivationCode(
            result.code,
          );

        expect(
          found,
        ).not.toBeNull();

        expect(
          found?.id,
        ).toBe(
          result.id,
        );

        expect(
          found?.plan,
        ).toBe(
          SubscriptionPlan.PRO,
        );

        expect(
          found?.durationMonths,
        ).toBe(12);

        expect(
          found?.status,
        ).toBe(
          ActivationCodeStatus.AVAILABLE,
        );
      },
    );

    it(
      "does not find an invalid activation code",
      async () => {
        const found =
          await findActivationCode(
            "KD-XXXX-XXXX-XXXX",
          );

        expect(
          found,
        ).toBeNull();
      },
    );

    it(
      "finds an available non-expired activation code",
      async () => {
        const result =
          await createActivationCode({
            plan:
              SubscriptionPlan.BASIC,

            durationMonths:
              6,

            expiresAt:
              new Date(
                Date.now() +
                  24 *
                    60 *
                    60 *
                    1000,
              ),
          });

        const found =
          await findUsableActivationCode(
            result.code,
          );

        expect(
          found,
        ).not.toBeNull();

        expect(
          found?.id,
        ).toBe(
          result.id,
        );

        expect(
          found?.status,
        ).toBe(
          ActivationCodeStatus.AVAILABLE,
        );
      },
    );

    it(
      "rejects an expired activation code",
      async () => {
        const result =
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

        const found =
          await findUsableActivationCode(
            result.code,
          );

        expect(
          found,
        ).toBeNull();
      },
    );

    it(
      "rejects a non-available activation code",
      async () => {
        const result =
          await createActivationCode({
            plan:
              SubscriptionPlan.PRO,

            durationMonths:
              12,
          });

        await prisma.activationCode.update({
          where: {
            id:
              result.id,
          },

          data: {
            status:
              ActivationCodeStatus.REVOKED,
          },
        });

        const found =
          await findUsableActivationCode(
            result.code,
          );

        expect(
          found,
        ).toBeNull();
      },
    );
  },
);