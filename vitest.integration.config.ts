import {
  config as loadEnvironment,
} from "dotenv";
import {
  defineConfig,
} from "vitest/config";

const environmentResult =
  loadEnvironment({
    path: ".env.test",
    override: true,
  });

if (
  environmentResult.error
) {
  throw new Error(
    `Unable to load .env.test: ${environmentResult.error.message}`,
  );
}

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL
    ?.trim();

const testDirectUrl =
  process.env.TEST_DIRECT_URL
    ?.trim();

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required in .env.test.",
  );
}

process.env.DATABASE_URL =
  testDatabaseUrl;

process.env.DIRECT_URL =
  testDirectUrl ||
  testDatabaseUrl;

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },

  test: {
    environment: "node",

    setupFiles: [
      "./tests/integration/setup.ts",
    ],

    include: [
      "tests/integration/**/*.integration.test.ts",
    ],

    exclude: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "coverage-critical/**",
    ],

    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    fileParallelism: false,

    testTimeout:
      30_000,

    hookTimeout:
      30_000,
  },
});