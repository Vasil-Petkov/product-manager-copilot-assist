import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { db, pool, rateLimitPool, sessionsTable, usersTable } from "@workspace/db";
import { createDemoSession } from "../lib/demoSession.ts";
import { csrfHeaders } from "./csrf-client.fixture.ts";

let server: http.Server;
let base: string;
const origin = "https://fixture.example.invalid";
const user = { id: "limiter-http-fixture", email: "limiter@example.invalid", firstName: "Fixture", lastName: "Owner", profileImageUrl: null };
before(async () => {
  const directory = process.env.OWNERSHIP_TEST_DIRECTORY;
  assert.ok(directory?.startsWith(join(tmpdir(), "pm-ownership-")));
  assert.ok(directory);
  assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get("host"), directory);
  const settings = await pool.query("SELECT current_setting('data_directory') AS path");
  assert.equal(settings.rows[0].path, join(directory, "data"));
  await db.insert(usersTable).values(user);
  await db.insert(sessionsTable).values({
    sid: "limiter-http-fixture-session", sess: { user }, expire: new Date(Date.now() + 60_000),
  });
  const { default: app } = await import("../app.ts");
  server = http.createServer(app).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}/api`;
});
beforeEach(async () => {
  // Only the dedicated counter table, and only after the disposable DB guard.
  await pool.query("DELETE FROM security_rate_limits");
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>((r) => server.close(() => r())); }
  await rateLimitPool.end();
  await pool.end();
});
async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (headers.has("cookie") || (headers.get("origin") === origin && init.method !== "OPTIONS")) {
    for (const [name, value] of Object.entries(await csrfHeaders(base, headers.get("cookie") ?? ""))) headers.set(name, value);
  }
  headers.set("connection", "close");
  return fetch(base + path, { ...init, headers });
}

test("real application rejects foreign Origin before counters and permits configured preflight", async () => {
  const denied = await request("/demo/session", { method: "POST", headers: { origin: "https://foreign.invalid" } });
  assert.equal(denied.status, 403);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM security_rate_limits")).rows[0].count, 0);
  const preflight = await request("/demo/session", { method: "OPTIONS", headers: {
    origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type,x-csrf-token",
  } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
  assert.match(preflight.headers.get("access-control-allow-headers")!, /X-CSRF-Token/i);
  assert.equal((await request("/demo/session", { method: "POST", headers: { origin } })).status, 201);
});

test("real demo create/status/exit and auth reads enforce shared SQL budgets with Retry-After", async () => {
  for (const [path, method] of [["/demo/session", "POST"], ["/demo/session", "GET"], ["/demo/session/exit", "POST"], ["/auth/user", "GET"]]) {
    assert.ok((await request(path, { method })).status < 400);
    const denied = await request(path, { method, headers: { "x-forwarded-for": "198.51.100.10" } });
    assert.equal(denied.status, 429, `${method} ${path}`);
    assert.ok(Number(denied.headers.get("retry-after")) > 0);
  }
});

test("real authenticated AI budget blocks before generation; demo and anonymous requests remain denied without AI counters", async () => {
  const cookie = "sid=limiter-http-fixture-session";
  const first = await request("/documents/generate", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}" });
  assert.equal(first.status, 400); // Original request validation, no provider call.
  const denied = await request("/documents/generate", { method: "POST", headers: { cookie }, body: "{}" });
  assert.equal(denied.status, 429);
  const before = (await pool.query("SELECT * FROM security_rate_limits ORDER BY bucket_key")).rows;
  assert.equal((await request("/documents/generate", { method: "POST" })).status, 401);
  const demo = createDemoSession();
  assert.equal((await request("/documents/generate", { method: "POST", headers: { cookie: `${cookie}; pm_demo_session=${demo}` } })).status, 403);
  assert.deepEqual((await pool.query("SELECT * FROM security_rate_limits ORDER BY bucket_key")).rows, before);
});
