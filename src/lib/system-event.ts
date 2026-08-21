import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type UserBugSeverity = "INFO" | "WARN" | "ERROR";

interface RecordUserBugInput {
  source: string;
  message: string;
  severity?: UserBugSeverity;
  restaurantId?: string | null;
  deviceId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}

type SanitizedJsonValue =
  | string
  | number
  | boolean
  | null
  | SanitizedJsonValue[]
  | { [key: string]: SanitizedJsonValue };

const SECRET_KEY_PATTERN =
  /password|passcode|token|secret|authorization|cookie|devicekey|apikey|api_key/i;

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength)}…`;
}

function sanitizeText(value: string, maxLength: number): string {
  return truncate(
    value
      .replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/gi, "Bearer [REDACTED]")
      .replace(
        /((?:password|passcode|token|secret|authorization|cookie|devicekey|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi,
        "$1[REDACTED]",
      ),
    maxLength,
  );
}

function sanitizeJsonValue(
  value: unknown,
  depth = 0,
): SanitizedJsonValue | undefined {
  if (depth > 4 || value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return sanitizeText(value, 12_000);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    const output: SanitizedJsonValue[] = [];

    for (const item of value.slice(0, 30)) {
      const sanitized = sanitizeJsonValue(item, depth + 1);
      if (sanitized !== undefined) {
        output.push(sanitized);
      }
    }

    return output;
  }

  if (typeof value === "object") {
    const output: Record<string, SanitizedJsonValue> = {};

    for (const [key, nestedValue] of Object.entries(value).slice(0, 60)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        output[key] = "[REDACTED]";
        continue;
      }

      const sanitized = sanitizeJsonValue(nestedValue, depth + 1);
      if (sanitized !== undefined) {
        output[key] = sanitized;
      }
    }

    return output;
  }

  return truncate(String(value), 2_000);
}

function normalizeSource(source: string): string {
  const normalized = source
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .slice(0, 80);

  return normalized.startsWith("USER_BUG_")
    ? normalized
    : `USER_BUG_${normalized || "UNKNOWN"}`;
}

export async function recordUserBug(
  input: RecordUserBugInput,
): Promise<void> {
  try {
    const metadata = sanitizeJsonValue({
      kind: "USER_BUG",
      ...input.metadata,
    });

    await prisma.systemEvent.create({
      data: {
        severity: input.severity ?? "ERROR",
        source: normalizeSource(input.source),
        message: sanitizeText(
          input.message.trim() || "Unknown application error.",
          2_000,
        ),
        requestId: input.requestId?.slice(0, 160) || null,
        restaurantId: input.restaurantId || null,
        deviceId: input.deviceId || null,
        metadata:
          metadata && typeof metadata === "object" && !Array.isArray(metadata)
            ? (metadata as Prisma.InputJsonObject)
            : Prisma.JsonNull,
      },
    });
  } catch (loggingError: unknown) {
    // Error reporting must never break the restaurant workflow that failed.
    console.error("USER_BUG_LOGGING_FAILED", {
      source: input.source,
      error:
        loggingError instanceof Error
          ? loggingError.message
          : "Unknown logging error",
    });
  }
}
