import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { pool } from "@workspace/db";
import { PostgresRateLimitStore } from "../lib/rate-limit-store.ts";

before(async () => {
  const directory = process.env.OWNERSHIP_TEST_DIRECTORY;
  assert.ok(directory?.startsWith(join(tmpdir(), "pm-ownership-")), "Only runner-created disposable PostgreSQL is permitted");
  assert.ok(directory);
  assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get("host"), directory);
  const data = await pool.query("SELECT current_setting('data_directory') AS path");
  assert.equal(data.rows[0].path, join(directory, "data"));
});
after(() => pool.end());

test("independent SQL clients atomically share limits and retain counters across store recreation", async () => {
  const clientA = await pool.connect();
  const clientB = await pool.connect();
  try {
    const a = new PostgresRateLimitStore(clientA);
    const b = new PostgresRateLimitStore(clientB);
    const key = randomUUID();
    const bucket = { key, limit: 8, windowMs: 60_000 };
    const results = await Promise.all(Array.from({ length: 24 }, (_, i) => (i % 2 ? a : b).consume([bucket])));
    assert.equal(results.filter((r) => r.allowed).length, 8);
    assert.ok(results.filter((r) => !r.allowed).every((r) => r.retryAfter > 0 && r.retryAfter <= 60));
    assert.equal((await new PostgresRateLimitStore(clientB).consume([bucket])).allowed, false);
    const row = await pool.query("SELECT hits FROM security_rate_limits WHERE bucket_key=$1", [key]);
    assert.equal(row.rows[0].hits, 25);
  } finally { clientA.release(); clientB.release(); }
});

test("expired windows reset, independent identities do not interfere, cleanup touches counters only", async () => {
  const store = new PostgresRateLimitStore(pool);
  const key = randomUUID();
  const bucket = { key, limit: 1, windowMs: 60_000 };
  assert.equal((await store.consume([bucket])).allowed, true);
  assert.equal((await store.consume([bucket])).allowed, false);
  await pool.query("UPDATE security_rate_limits SET expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE bucket_key=$1", [key]);
  assert.equal((await store.consume([bucket])).allowed, true);
  const second = { ...bucket, key: randomUUID() };
  assert.equal((await store.consume([second])).allowed, true);
  assert.equal((await store.consume([bucket, second])).allowed, false);
});
