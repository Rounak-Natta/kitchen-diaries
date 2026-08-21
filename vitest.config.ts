import {
  defineConfig,
} from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },

  test: {
    environment: "node",

    setupFiles: [
      "./src/test/setup.ts",
    ],

    include: [
      "src/**/*.spec.ts",
    ],

    exclude: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "coverage-critical/**",
      "tests/integration/**",
    ],

    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    coverage: {
      provider: "v8",

      reporter: [
        "text",
        "html",
        "json-summary",
      ],

      reportsDirectory:
        "./coverage",

      /*
       * Overall application baseline.
       * No threshold is attached because many existing
       * application modules do not yet have tests.
       */
      include: [
        "src/lib/**/*.ts",
        "src/features/**/lib/**/*.ts",
        "src/features/**/validations/**/*.ts",
      ],

      exclude: [
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/index.ts",
        "src/lib/prisma.ts",
      ],
    },
  },
});