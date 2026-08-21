import {
  NextResponse,
} from "next/server";

import {
  prisma,
} from "@/lib/prisma";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const DATABASE_PROBE_TIMEOUT_MS =
  5_000;

class ReadinessTimeoutError extends Error {
  constructor() {
    super(
      "Database readiness check timed out.",
    );

    this.name =
      "ReadinessTimeoutError";
  }
}

function createTimeoutPromise(): Promise<never> {
  return new Promise(
    (
      _resolve,
      reject,
    ) => {
      const timeout =
        setTimeout(
          () => {
            reject(
              new ReadinessTimeoutError(),
            );
          },
          DATABASE_PROBE_TIMEOUT_MS,
        );

      timeout.unref();
    },
  );
}

async function checkDatabase(): Promise<void> {
  const databaseProbe =
    prisma.$queryRaw<
      Array<{
        ready: number;
      }>
    >`
      SELECT 1 AS "ready"
    `;

  const result =
    await Promise.race([
      databaseProbe,
      createTimeoutPromise(),
    ]);

  if (
    !Array.isArray(result) ||
    result[0]?.ready !== 1
  ) {
    throw new Error(
      "Unexpected database readiness response.",
    );
  }
}

export async function GET(): Promise<Response> {
  const startedAt =
    performance.now();

  try {
    await checkDatabase();

    const durationMs =
      Math.round(
        performance.now() -
          startedAt,
      );

    return NextResponse.json(
      {
        status: "ready",

        checks: {
          database: "ok",
        },

        durationMs,

        timestamp:
          new Date().toISOString(),
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",

          Pragma:
            "no-cache",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (
    error: unknown
  ) {
    const durationMs =
      Math.round(
        performance.now() -
          startedAt,
      );

    console.error(
  "READINESS_CHECK_FAILED",
  {
    errorName:
      error instanceof Error
        ? error.name
        : "UnknownError",

    durationMs,
  },
);

    /*
     * Do not expose database credentials,
     * hostnames or Prisma errors publicly.
     */
    return NextResponse.json(
      {
        status:
          "not_ready",

        checks: {
          database:
            "unavailable",
        },

        durationMs,

        timestamp:
          new Date().toISOString(),
      },
      {
        status: 503,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",

          Pragma:
            "no-cache",

          "Retry-After":
            "5",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  }
}