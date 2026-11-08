import { logger } from "./lib/logger";
import { recordSecurityFailure, setSecurityMetricSink } from "./lib/security-events";
import { verifyDatabaseReadiness } from "./lib/database-readiness";

setSecurityMetricSink((event) => logger.info(event, "Security counters; no application alert sink configured"));

async function start() {
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Valid PORT is required");
  // Dynamic import catches configuration/DB initialization errors as well.
  const { default: app } = await import("./app");
  const { pool, rateLimitPool } = await import("@workspace/db");
  for (const client of [pool, rateLimitPool]) {
    client.on("error", () => recordSecurityFailure("database_failure"));
  }
  await verifyDatabaseReadiness(pool);
  await new Promise<void>((resolve, reject) => {
    const server = app.listen(port, () => resolve());
    server.once("error", reject);
  });
  logger.info({ port }, "Server listening");
}
start().catch(() => {
  recordSecurityFailure("startup_failure");
  // No raw error/SQL/connection string. A failed readiness check may have
  // opened a pool connection, so exit explicitly after the immediate event.
  process.exit(1);
});
