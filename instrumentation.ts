export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate environment variables at startup
    const { validateEnvOrThrow } = await import("./lib/env-validation");

    try {
      validateEnvOrThrow();
    } catch (error) {
      // In development, we might want to continue with warnings
      // In production, this should fail fast
      if (process.env.NODE_ENV === "production") {
        console.error(
          "[instrumentation] Critical: Environment validation failed",
          error
        );
        process.exit(1);
      } else {
        console.warn(
          "[instrumentation] Warning: Environment validation failed, continuing in development mode",
          error
        );
      }
    }
  }
}
