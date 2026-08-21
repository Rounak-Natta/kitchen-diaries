import {
  afterAll,
  beforeAll,
} from "vitest";

import {
  prisma,
} from "@/lib/prisma";

function assertSafeTestDatabase(): void {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    throw new Error(
      "Integration tests cannot run with NODE_ENV=production.",
    );
  }

  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required for integration tests.",
    );
  }

  let databaseName:
    string;

  try {
    const parsedUrl =
      new URL(
        databaseUrl,
      );

    databaseName =
      parsedUrl.pathname
        .replace(
          /^\/+/,
          "",
        )
        .split("?")[0] ??
      "";
  } catch {
    throw new Error(
      "TEST_DATABASE_URL is invalid.",
    );
  }

  if (
    !databaseName
      .toLowerCase()
      .includes(
        "test",
      )
  ) {
    throw new Error(
      `Unsafe integration database name: "${databaseName}". The database name must contain "test".`,
    );
  }
}

beforeAll(
  async () => {
    assertSafeTestDatabase();

    await prisma.$connect();
  },
);

afterAll(
  async () => {
    await prisma.$disconnect();
  },
);