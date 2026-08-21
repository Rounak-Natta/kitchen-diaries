import {
  z,
} from "zod";

const postgresUrlSchema =
  z
    .string()
    .trim()
    .min(
      1,
      "Database URL is required.",
    )
    .refine(
      (value) => {
        try {
          const url =
            new URL(value);

          return (
            url.protocol ===
              "postgresql:" ||
            url.protocol ===
              "postgres:"
          );
        } catch {
          return false;
        }
      },
      {
        message:
          "Must be a valid PostgreSQL connection URL.",
      },
    );

const serverEnvironmentSchema =
  z
    .object({
      NODE_ENV:
        z.enum([
          "development",
          "test",
          "production",
        ]),

      DATABASE_URL:
        postgresUrlSchema,

      DIRECT_URL:
        postgresUrlSchema,

      JWT_SECRET:
        z
          .string()
          .trim()
          .min(
            32,
            "JWT_SECRET must contain at least 32 characters.",
          ),

      PORT:
        z
          .string()
          .trim()
          .regex(
            /^\d+$/,
            "PORT must be a positive integer.",
          )
          .transform(
            (value) =>
              Number(value),
          )
          .pipe(
            z
              .number()
              .int()
              .min(1)
              .max(65_535),
          )
          .optional(),

      HOSTNAME:
        z
          .string()
          .trim()
          .min(1)
          .optional(),

      NEXT_TELEMETRY_DISABLED:
        z
          .enum([
            "0",
            "1",
          ])
          .optional(),
    })
    .strict();

export type ServerEnvironment =
  z.infer<
    typeof serverEnvironmentSchema
  >;

let cachedEnvironment:
  ServerEnvironment | null =
  null;

function formatEnvironmentErrors(
  issues: z.ZodIssue[],
): string {
  return issues
    .map((issue) => {
      const key =
        issue.path.join(
          ".",
        ) ||
        "environment";

      return `${key}: ${issue.message}`;
    })
    .join("\n");
}

export function getServerEnvironment(): ServerEnvironment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  const result =
    serverEnvironmentSchema.safeParse({
      NODE_ENV:
        process.env.NODE_ENV,

      DATABASE_URL:
        process.env.DATABASE_URL,

      DIRECT_URL:
        process.env.DIRECT_URL,

      JWT_SECRET:
        process.env.JWT_SECRET,

      PORT:
        process.env.PORT,

      HOSTNAME:
        process.env.HOSTNAME,

      NEXT_TELEMETRY_DISABLED:
        process.env
          .NEXT_TELEMETRY_DISABLED,
    });

  if (!result.success) {
    throw new Error(
      [
        "Invalid server environment configuration:",
        formatEnvironmentErrors(
          result.error.issues,
        ),
      ].join("\n"),
    );
  }

  cachedEnvironment =
    result.data;

  return cachedEnvironment;
}

export function clearServerEnvironmentCacheForTests(): void {
  cachedEnvironment =
    null;
}