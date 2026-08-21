import {
  config as loadEnvironment,
} from "dotenv";

import {
  getServerEnvironment,
} from "../src/lib/server-env";

function main(): void {
  const environmentFile =
    process.argv[2] ??
    ".env";

  const loadResult =
    loadEnvironment({
      path:
        environmentFile,

      override:
        true,
    });

  if (
    loadResult.error
  ) {
    console.error(
      `Unable to load ${environmentFile}: ${loadResult.error.message}`,
    );

    process.exitCode =
      1;

    return;
  }

  try {
    const environment =
      getServerEnvironment();

    const databaseUrl =
      new URL(
        environment.DATABASE_URL,
      );

    console.log(
      "Environment validation passed.",
    );

    console.log({
      file:
        environmentFile,

      environment:
        environment.NODE_ENV,

      databaseProtocol:
        databaseUrl.protocol,

      databaseHost:
        databaseUrl.hostname,

      databasePort:
        databaseUrl.port ||
        "5432",

      databaseName:
        databaseUrl.pathname
          .replace(
            /^\/+/,
            "",
          ),

      jwtSecretPresent:
        environment.JWT_SECRET
          .length >= 32,

      port:
        environment.PORT ??
        3000,

      hostname:
        environment.HOSTNAME ??
        "localhost",
    });
  } catch (
    error: unknown
  ) {
    console.error(
      error instanceof Error
        ? error.message
        : "Environment validation failed.",
    );

    process.exitCode =
      1;
  }
}

main();