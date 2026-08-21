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
        "./coverage-critical",

      include: [
        "src/lib/auth.ts",
        "src/lib/business-date.ts",
        "src/lib/transaction.ts",

        "src/lib/rbac/access.ts",
        "src/lib/rbac/permissions.ts",
        "src/lib/rbac/roles.ts",

        "src/features/order-lifecycle/lib/order-state-machine.ts",
        "src/features/users/validations/user-schemas.ts",
        "src/features/reports/lib/report-range.ts",
        "src/features/data-exports/lib/json-export.ts",
      ],

      exclude: [
        "**/*.spec.ts",
        "**/*.test.ts",
      ],

      thresholds: {
        statements: 70,
        lines: 70,
        functions: 70,
        branches: 55,
      },
    },
  },
});