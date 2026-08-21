export async function register(): Promise<void> {
  /*
   * Do not load Node-only environment validation
   * when Next.js initializes an Edge runtime.
   */
  if (
    process.env.NEXT_RUNTIME !==
    "nodejs"
  ) {
    return;
  }

  const {
    getServerEnvironment,
  } = await import(
    "@/lib/server-env"
  );

  const environment =
    getServerEnvironment();

  console.info(
    "SERVER_ENVIRONMENT_VALIDATED",
    {
      environment:
        environment.NODE_ENV,

      port:
        environment.PORT ??
        3000,

      hostname:
        environment.HOSTNAME ??
        "localhost",
    },
  );
}