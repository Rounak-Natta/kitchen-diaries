import {
  Prisma,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";

const DEFAULT_MAX_RETRIES =
  10;

const DEFAULT_BASE_DELAY_MS =
  25;

const DEFAULT_MAX_DELAY_MS =
  750;

const DEFAULT_MAX_WAIT_MS =
  10_000;

const DEFAULT_TIMEOUT_MS =
  30_000;

export interface SerializableTransactionOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxWaitMs?: number;
  timeoutMs?: number;
}

function getErrorCode(
  error: unknown,
): string | null {
  if (
    error instanceof
    Prisma.PrismaClientKnownRequestError
  ) {
    return error.code;
  }

  if (
    typeof error ===
      "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code ===
      "string"
  ) {
    return error.code;
  }

  return null;
}

function isRetryableTransactionError(
  error: unknown,
): boolean {
  const errorCode =
    getErrorCode(error);

  if (
    errorCode === "P2034"
  ) {
    return true;
  }

  if (
    error instanceof Error
  ) {
    const message =
      error.message.toLowerCase();

    return (
      message.includes(
        "write conflict",
      ) ||
      message.includes(
        "deadlock",
      ) ||
      message.includes(
        "serialization failure",
      ) ||
      message.includes(
        "could not serialize access",
      )
    );
  }

  return false;
}

function wait(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

function getRetryDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponentialDelay =
    Math.min(
      baseDelayMs *
        2 ** attempt,
      maxDelayMs,
    );

  /*
   * Jitter prevents all conflicting transactions
   * from retrying at exactly the same moment.
   */
  const jitter =
    Math.floor(
      Math.random() *
        Math.max(
          baseDelayMs,
          1,
        ),
    );

  return Math.min(
    exponentialDelay +
      jitter,
    maxDelayMs,
  );
}

export async function withSerializableTransaction<T>(
  operation: (
    transaction:
      Prisma.TransactionClient,
  ) => Promise<T>,
  options:
    SerializableTransactionOptions = {},
): Promise<T> {
  const maxRetries =
    options.maxRetries ??
    DEFAULT_MAX_RETRIES;

  const baseDelayMs =
    options.baseDelayMs ??
    DEFAULT_BASE_DELAY_MS;

  const maxDelayMs =
    options.maxDelayMs ??
    DEFAULT_MAX_DELAY_MS;

  const maxWaitMs =
    options.maxWaitMs ??
    DEFAULT_MAX_WAIT_MS;

  const timeoutMs =
    options.timeoutMs ??
    DEFAULT_TIMEOUT_MS;

  let attempt = 0;

  while (true) {
    try {
      return await prisma.$transaction(
        operation,
        {
          isolationLevel:
            Prisma
              .TransactionIsolationLevel
              .Serializable,

          maxWait:
            maxWaitMs,

          timeout:
            timeoutMs,
        },
      );
    } catch (error: unknown) {
      const canRetry =
        isRetryableTransactionError(
          error,
        );

      if (
        !canRetry ||
        attempt >= maxRetries
      ) {
        throw error;
      }

      const delayMs =
        getRetryDelay(
          attempt,
          baseDelayMs,
          maxDelayMs,
        );

      attempt += 1;

      await wait(delayMs);
    }
  }
}