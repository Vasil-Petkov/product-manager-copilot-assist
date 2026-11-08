import { writeSync } from "node:fs";

// Only imported by explicit migration CLIs, never by application startup.
// Driver errors can include SQL/parameters/connection strings; do not log them.
function fail() {
  writeSync(2, `${JSON.stringify({ event: "security_failure", name: "migration_failure", component: "migration_runner" })}\n`);
  process.exit(1);
}
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);
