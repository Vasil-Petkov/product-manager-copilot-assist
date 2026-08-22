import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('roadmap-v1'))");
    const sql = await readFile(new URL("../migrations/0004_roadmap_v1.sql", import.meta.url), "utf8");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Roadmap V1 migration is up to date.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}