import { readFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run database migrations");
}

const migrationUrl = new URL(
  "../migrations/0001_validation_hypotheses_phase2.sql",
  import.meta.url,
);
const sql = await readFile(migrationUrl, "utf8");
const client = new pg.Client({ connectionString });

await client.connect();
try {
  await client.query("BEGIN");
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext($1))",
    ["validation-hypotheses-phase2"],
  );
  await client.query(sql);
  await client.query("COMMIT");
  console.log("Validation Phase 2 database migration is up to date.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}