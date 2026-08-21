import {
  config as loadEnvironment,
} from "dotenv";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  join,
  relative,
} from "node:path";

loadEnvironment({
  path: ".env",
});

type Severity =
  | "ERROR"
  | "WARNING";

interface SecurityIssue {
  severity: Severity;
  message: string;
  file?: string;
}

const rootDirectory =
  process.cwd();

const issues:
  SecurityIssue[] = [];

function addIssue(
  severity: Severity,
  message: string,
  file?: string,
): void {
  issues.push({
    severity,
    message,
    ...(file
      ? {
          file,
        }
      : {}),
  });
}

function readProjectFile(
  path: string,
): string | null {
  const absolutePath =
    join(
      rootDirectory,
      path,
    );

  if (
    !existsSync(
      absolutePath,
    )
  ) {
    return null;
  }

  return readFileSync(
    absolutePath,
    "utf8",
  );
}

function walkSourceFiles(
  directory: string,
): string[] {
  const absoluteDirectory =
    join(
      rootDirectory,
      directory,
    );

  if (
    !existsSync(
      absoluteDirectory,
    )
  ) {
    return [];
  }

  const files:
    string[] = [];

  for (
    const entry of
    readdirSync(
      absoluteDirectory,
    )
  ) {
    const absoluteEntry =
      join(
        absoluteDirectory,
        entry,
      );

    const stats =
      statSync(
        absoluteEntry,
      );

    if (
      stats.isDirectory()
    ) {
      files.push(
        ...walkSourceFiles(
          relative(
            rootDirectory,
            absoluteEntry,
          ),
        ),
      );

      continue;
    }

    if (
      absoluteEntry.endsWith(
        ".ts",
      ) ||
      absoluteEntry.endsWith(
        ".tsx",
      )
    ) {
      files.push(
        absoluteEntry,
      );
    }
  }

  return files;
}

function reviewEnvironment(): void {
  const jwtSecret =
    process.env.JWT_SECRET
      ?.trim();

  if (!jwtSecret) {
    addIssue(
      "ERROR",
      "JWT_SECRET is missing.",
    );
  } else {
    if (
      jwtSecret.length < 32
    ) {
      addIssue(
        "ERROR",
        "JWT_SECRET must contain at least 32 characters.",
      );
    }

    const weakSecrets = [
      "secret",
      "jwtsecret",
      "password",
      "admin123",
      "changeme",
    ];

    if (
      weakSecrets.includes(
        jwtSecret.toLowerCase(),
      )
    ) {
      addIssue(
        "ERROR",
        "JWT_SECRET uses a known weak value.",
      );
    }
  }

  for (
    const environmentKey of
    Object.keys(
      process.env,
    )
  ) {
    if (
      environmentKey.startsWith(
        "NEXT_PUBLIC_",
      ) &&
      /SECRET|PASSWORD|TOKEN|DATABASE_URL|DIRECT_URL/i.test(
        environmentKey,
      )
    ) {
      addIssue(
        "ERROR",
        `${environmentKey} exposes a sensitive value to the browser.`,
      );
    }
  }

  const databaseUrl =
    process.env.DATABASE_URL;

  if (
    databaseUrl &&
    !databaseUrl.startsWith(
      "postgresql://",
    ) &&
    !databaseUrl.startsWith(
      "postgres://",
    )
  ) {
    addIssue(
      "ERROR",
      "DATABASE_URL is not a PostgreSQL connection string.",
    );
  }
}

function reviewSchema(): void {
  const schema =
    readProjectFile(
      "prisma/schema.prisma",
    );

  if (!schema) {
    addIssue(
      "ERROR",
      "Prisma schema was not found.",
      "prisma/schema.prisma",
    );

    return;
  }

  const requiredPatterns: Array<{
    pattern: RegExp;
    message: string;
  }> = [
    {
      pattern:
        /email\s+String\s+@unique/,

      message:
        "User email must remain unique.",
    },
    {
      pattern:
        /@@unique\(\[restaurantId,\s*idempotencyKey\]\)/,

      message:
        "Restaurant-scoped idempotency constraints are missing.",
    },
    {
      pattern:
        /@@unique\(\[restaurantId,\s*documentType,\s*businessDate\]\)/,

      message:
        "BusinessSequence uniqueness constraint is missing.",
    },
    {
      pattern:
        /businessDayStartHour\s+Int\s+@default\(4\)/,

      message:
        "The required 04:00 business-day default is missing.",
    },
    {
      pattern:
        /timezone\s+String\s+@default\("Asia\/Kolkata"\)/,

      message:
        "The required Asia/Kolkata timezone default is missing.",
    },
  ];

  for (
    const requirement of
    requiredPatterns
  ) {
    if (
      !requirement.pattern.test(
        schema,
      )
    ) {
      addIssue(
        "ERROR",
        requirement.message,
        "prisma/schema.prisma",
      );
    }
  }
}

function reviewAuthentication(): void {
  const apiAuth =
    readProjectFile(
      "src/lib/api-auth.ts",
    );

  if (!apiAuth) {
    addIssue(
      "ERROR",
      "Authentication resolver was not found.",
      "src/lib/api-auth.ts",
    );

    return;
  }

  if (
    !apiAuth.includes(
      "databaseUser.isActive",
    )
  ) {
    addIssue(
      "ERROR",
      "Authentication does not appear to reject deactivated users immediately.",
      "src/lib/api-auth.ts",
    );
  }

  if (
    !apiAuth.includes(
      "restaurant",
    ) ||
    !apiAuth.includes(
      ".isActive",
    )
  ) {
    addIssue(
      "WARNING",
      "Confirm that authentication rejects users belonging to inactive restaurants.",
      "src/lib/api-auth.ts",
    );
  }

  const auth =
    readProjectFile(
      "src/lib/auth.ts",
    );

  if (
    auth?.includes(
      'expiresIn: "7d"',
    )
  ) {
    addIssue(
      "WARNING",
      "JWT lifetime is seven days. Confirm this is acceptable before production deployment.",
      "src/lib/auth.ts",
    );
  }
}

function reviewDocumentNumbers(): void {
  const criticalFiles = [
    "src/features/orders/actions/create-order.ts",
    "src/features/billing/actions/billing-actions.ts",
    "src/features/billing-adjustments/actions/billing-adjustment-actions.ts",
    "src/features/wastage/actions/wastage-actions.ts",
    "src/features/data-exports/services/full-data-export-service.ts",
  ];

  const numberKeywords =
    /orderNumber|billNumber|receiptNumber|refundNumber|wastageNumber|exportNumber|transactionNumber/i;

  for (
    const file of
    criticalFiles
  ) {
    const content =
      readProjectFile(
        file,
      );

    if (!content) {
      addIssue(
        "WARNING",
        "Critical file was not found during document-number review.",
        file,
      );

      continue;
    }

    const forbiddenPatterns = [
      /Date\.now\s*\(/g,
      /Math\.random\s*\(/g,
    ];

    for (
      const pattern of
      forbiddenPatterns
    ) {
      for (
        const match of
        content.matchAll(
          pattern,
        )
      ) {
        const index =
          match.index ?? 0;

        const nearbyText =
          content.slice(
            Math.max(
              0,
              index - 400,
            ),
            index + 400,
          );

        if (
          numberKeywords.test(
            nearbyText,
          )
        ) {
          addIssue(
            "ERROR",
            `${match[0]} appears near business document-number generation.`,
            file,
          );
        }
      }
    }
  }
}

function reviewDataExport(): void {
  const exportService =
    readProjectFile(
      "src/features/data-exports/services/full-data-export-service.ts",
    );

  if (!exportService) {
    addIssue(
      "WARNING",
      "Full-data export service was not found.",
      "src/features/data-exports/services/full-data-export-service.ts",
    );

    return;
  }

  const userQueryStart =
    exportService.indexOf(
      "transaction.user.findMany",
    );

  if (
    userQueryStart < 0
  ) {
    addIssue(
      "ERROR",
      "User export query was not found.",
      "src/features/data-exports/services/full-data-export-service.ts",
    );

    return;
  }

  const nextQueryStart =
    exportService.indexOf(
      "transaction.",
      userQueryStart + 30,
    );

  const userQueryBlock =
    exportService.slice(
      userQueryStart,
      nextQueryStart > 0
        ? nextQueryStart
        : userQueryStart +
            2500,
    );

  if (
    /\bpassword\s*:\s*true|\bpassword\s*,/i.test(
      userQueryBlock,
    )
  ) {
    addIssue(
      "ERROR",
      "Full-data export appears to include password hashes.",
      "src/features/data-exports/services/full-data-export-service.ts",
    );
  }
}

function reviewHardcodedCredentials(): void {
  const files =
    walkSourceFiles(
      "src",
    );

  const credentialPattern =
    /["'`]admin123["'`]/i;

  for (
    const absoluteFile of
    files
  ) {
    const content =
      readFileSync(
        absoluteFile,
        "utf8",
      );

    if (
      credentialPattern.test(
        content,
      )
    ) {
      addIssue(
        "ERROR",
        "Hardcoded development credential found in application source.",
        relative(
          rootDirectory,
          absoluteFile,
        ),
      );
    }
  }
}

function printResults(): void {
  const errors =
    issues.filter(
      (issue) =>
        issue.severity ===
        "ERROR",
    );

  const warnings =
    issues.filter(
      (issue) =>
        issue.severity ===
        "WARNING",
    );

  console.log(
    "\nKitchen Diaries Security Review\n",
  );

  if (
    issues.length === 0
  ) {
    console.log(
      "PASS: No automated security issues were detected.",
    );

    return;
  }

  for (
    const issue of
    issues
  ) {
    const location =
      issue.file
        ? ` [${issue.file}]`
        : "";

    console.log(
      `${issue.severity}: ${issue.message}${location}`,
    );
  }

  console.log(
    `\nErrors: ${errors.length}`,
  );

  console.log(
    `Warnings: ${warnings.length}`,
  );

  if (
    errors.length > 0
  ) {
    process.exitCode =
      1;
  }
}

reviewEnvironment();
reviewSchema();
reviewAuthentication();
reviewDocumentNumbers();
reviewDataExport();
reviewHardcodedCredentials();
printResults();