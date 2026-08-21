import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";

const ACTIVATION_CODE_PREFIX = "KD";

const ACTIVATION_CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const ACTIVATION_CODE_RANDOM_LENGTH = 12;

function generateRandomPart(): string {
  const bytes = crypto.randomBytes(
    ACTIVATION_CODE_RANDOM_LENGTH,
  );

  let result = "";

  for (let index = 0; index < bytes.length; index += 1) {
    result +=
      ACTIVATION_CODE_ALPHABET[
        bytes[index] %
          ACTIVATION_CODE_ALPHABET.length
      ];
  }

  return result;
}

function formatActivationCode(
  randomPart: string,
): string {
  return [
    ACTIVATION_CODE_PREFIX,
    randomPart.slice(0, 4),
    randomPart.slice(4, 8),
    randomPart.slice(8, 12),
  ].join("-");
}

function normalizeActivationCode(
  code: string,
): string {
  return code
    .trim()
    .toUpperCase();
}

function hashActivationCode(
  code: string,
): string {
  return crypto
    .createHash("sha256")
    .update(
      normalizeActivationCode(code),
      "utf8",
    )
    .digest("hex");
}

export async function generateActivationCode(): Promise<{
  code: string;
  codeHash: string;
}> {
  for (;;) {
    const code =
      formatActivationCode(
        generateRandomPart(),
      );

    const codeHash =
      hashActivationCode(code);

    const existing =
      await prisma.activationCode.findUnique({
        where: {
          codeHash,
        },
        select: {
          id: true,
        },
      });

    if (!existing) {
      return {
        code,
        codeHash,
      };
    }
  }
}

export function getActivationCodeHash(
  code: string,
): string {
  return hashActivationCode(code);
}
export async function findActivationCode(
  code: string,
) {
  const codeHash =
    hashActivationCode(code);

  return prisma.activationCode.findUnique({
    where: {
      codeHash,
    },
  });
}
export async function findUsableActivationCode(
  code: string,
) {
  const activationCode =
    await findActivationCode(code);

  if (!activationCode) {
    return null;
  }

  if (
    activationCode.status !==
    "AVAILABLE"
  ) {
    return null;
  }

  if (
    activationCode.expiresAt &&
    activationCode.expiresAt <= new Date()
  ) {
    return null;
  }

  return activationCode;
}