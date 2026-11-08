import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { db, pool, rateLimitPool, usersTable, sessionsTable } from "@workspace/db";
import { csrfHeaders } from "./csrf-client.fixture.ts";
import { verifyDatabaseReadiness } from "../lib/database-readiness.ts";
import { flushSecurityMetrics, setSecurityMetricSink } from "../lib/security-events.ts";

let server: http.Server;
let base: string;
let discoveries = 0;
const actualFetch = globalThis.fetch;
const issuer = "https://oidc-fixture.example.invalid/oidc";
before(async () => {
  const directory = process.env.OWNERSHIP_TEST_DIRECTORY;
  assert.ok(directory);
  assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get("host"), directory);
  assert.equal((await pool.query("SHOW data_directory")).rows[0].data_directory, join(directory, "data"));
  process.env.ISSUER_URL = issuer;
  process.env.CORS_ALLOWED_ORIGINS = "https://csrf-fixture.example.invalid";
  // Stub only public provider metadata; no OAuth completion, forged auth claims
  // or authorization/session-store mocks. All state is in the isolated cluster.
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.hostname === "oidc-fixture.example.invalid" && url.pathname.endsWith("/.well-known/openid-configuration")) {
      discoveries++;
      return Response.json({
        issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`,
        end_session_endpoint: `${issuer}/logout`, jwks_uri: `${issuer}/jwks`,
        response_types_supported: ["code"], subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"],
      });
    }
    assert.equal(url.hostname, "127.0.0.1", "No real OAuth/provider/AI requests allowed");
    return actualFetch(input, init);
  };
  const user = { id: "csrf-isolated-owner", email: "csrf-owner@example.invalid", firstName: "Fixture", lastName: "Owner", profileImageUrl: null };
  await db.insert(usersTable).values(user);
  for (const sid of ["csrf-browser", "csrf-mobile", "csrf-other"]) {
    await db.insert(sessionsTable).values({ sid, sess: { user, access_token: "isolated-only" }, expire: new Date(Date.now() + 3_600_000) });
  }
  const { default: app } = await import("../app.ts");
  server = http.createServer(app).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  process.env.REPLIT_DOMAINS = `127.0.0.1:${address.port}`;
  base = `http://127.0.0.1:${address.port}/api`;
});
after(async () => {
  globalThis.fetch = actualFetch;
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await rateLimitPool.end();
  await pool.end();
});
test("GET/HEAD logout never clears the session or calls the provider; unprotected POST is denied", async () => {
  for (const method of ["GET", "HEAD", "POST"]) {
    const response = await fetch(`${base}/logout?returnTo=%22%3E%3Cscript%3E`, { method, headers: { cookie: "sid=csrf-browser" }, redirect: "manual" });
    assert.equal(response.status, method === "POST" ? 403 : 200);
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.headers.get("cache-control"), "no-store");
    if (method === "GET") assert.doesNotMatch(await response.text(), /<script>/);
  }
  assert.equal(discoveries, 0);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM sessions WHERE sid = 'csrf-browser'")).rows[0].n, 1);
});
test("browser mutation succeeds with CSRF, fails without proof, and private ownership checks still apply", async () => {
  const headers = await csrfHeaders(base, "sid=csrf-browser");
  assert.equal((await fetch(`${base}/opportunities`, { method: "POST", headers: { cookie: headers.cookie, "content-type": "application/json" }, body: '{"title":"Denied CSRF","sourceType":"manual"}' })).status, 403);
  const created = await fetch(`${base}/opportunities`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: '{"title":"Browser CSRF fixture","description":"Isolated owner workflow","sourceType":"manual"}' });
  assert.equal(created.status, 201);
  const { id } = await created.json() as { id: number };
  assert.equal((await fetch(`${base}/opportunities/${id}`, { method: "DELETE", headers })).status, 204);
});
test("valid protected form POST clears only its session and redirects to validated OIDC metadata", async () => {
  const headers = await csrfHeaders(base, "sid=csrf-browser");
  const response = await fetch(`${base}/logout`, {
    method: "POST", headers: { cookie: headers.cookie }, redirect: "manual",
    body: new URLSearchParams({ _csrf: headers["X-CSRF-Token"], returnTo: "/?signed-out=true" }),
  });
  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get("location")!).origin, new URL(issuer).origin);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM sessions WHERE sid = 'csrf-browser'")).rows[0].n, 0);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM sessions WHERE sid = 'csrf-other'")).rows[0].n, 1);
});
test("native Bearer owner can mutate and log out without browser cookies or CSRF", async () => {
  const headers = { authorization: "Bearer csrf-mobile", "content-type": "application/json" };
  const created = await fetch(`${base}/opportunities`, { method: "POST", headers, body: '{"title":"Native fixture","description":"Isolated native owner workflow","sourceType":"manual"}' });
  assert.equal(created.status, 201);
  const { id } = await created.json() as { id: number };
  assert.equal((await fetch(`${base}/opportunities/${id}`, { method: "DELETE", headers })).status, 204);
  assert.equal((await fetch(`${base}/mobile-auth/logout`, { method: "POST", headers })).status, 200);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM sessions WHERE sid = 'csrf-mobile'")).rows[0].n, 0);
});
test("real same-origin form/fetch pass; cross-site Origin/Referer and missing proof cannot write", async () => {
  const proof = await csrfHeaders(base, "sid=csrf-other");
  const before = (await pool.query("SELECT count(*)::int AS n FROM opportunities")).rows[0].n;
  for (const source of [
    { origin: "https://attacker.invalid" },
    { referer: "https://csrf-fixture.example.invalid.attacker.invalid/form" },
    { referer: "null" },
    { "sec-fetch-site": "cross-site" },
  ]) {
    const response = await fetch(`${base}/opportunities`, {
      method: "POST", headers: { ...proof, ...source }, body: new URLSearchParams({ title: "Blocked", description: "Cross-site fixture", _csrf: proof["X-CSRF-Token"] }),
    });
    assert.equal(response.status, 403);
  }
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM opportunities")).rows[0].n, before);
  for (const source of [{ origin: "https://csrf-fixture.example.invalid" }, { referer: "https://csrf-fixture.example.invalid/workspace" }, {}]) {
    const response = await fetch(`${base}/opportunities`, {
      method: "POST", headers: { ...proof, ...source, "content-type": "application/json" },
      body: '{"title":"Allowed source","description":"Isolated origin regression"}',
    });
    assert.equal(response.status, 201);
    const { id } = await response.json() as { id: number };
    assert.equal((await fetch(`${base}/opportunities/${id}`, { method: "DELETE", headers: proof })).status, 204);
    assert.equal((await fetch(`${base}/opportunities`, {
      method: "POST", headers: { cookie: proof.cookie, ...source }, body: new URLSearchParams({ title: "No proof", description: "Blocked" }),
    })).status, 403);
  }
});
test("actual API rejects GET/HEAD generation and permits protected POST; response headers do not trust forwarded HTTPS", async () => {
  const proof = await csrfHeaders(base, "sid=csrf-other");
  for (const method of ["GET", "HEAD"]) {
    const response = await fetch(`${base}/dashboard/daily-summary`, { method, headers: proof });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
  }
  assert.equal((await fetch(`${base}/dashboard/daily-summary`, { method: "POST", headers: { cookie: proof.cookie } })).status, 403);
  const generated = await fetch(`${base}/dashboard/daily-summary`, { method: "POST", headers: proof });
  assert.equal(generated.status, 200); // No owned ideas => no provider call.
  const response = await fetch(`${base}/auth/user`, { headers: { ...proof, "x-forwarded-proto": "https" } });
  assert.match(response.headers.get("content-security-policy")!, /object-src 'none'/);
  assert.doesNotMatch(response.headers.get("content-security-policy")!, /unsafe-eval/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("permissions-policy")!, /camera=\(\)/);
  assert.equal(response.headers.get("strict-transport-security"), null);
  assert.equal(response.headers.get("x-powered-by"), null);
});
test("callback failures emit bounded auth events without codes, query parameters or credentials", async () => {
  const events: unknown[] = [];
  setSecurityMetricSink((event) => events.push(event));
  flushSecurityMetrics();
  events.length = 0;
  const response = await fetch(`${base}/callback?code=do-not-log-fixture-value`, { redirect: "manual" });
  assert.equal(response.status, 302);
  flushSecurityMetrics();
  assert.match(JSON.stringify(events), /auth_callback_error/);
  assert.doesNotMatch(JSON.stringify(events), /do-not-log|csrf-other|example.invalid/);
});
test("readiness is SELECT-only and fails closed for missing ownership schema in an isolated rollback transaction", async () => {
  await verifyDatabaseReadiness(pool);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("ALTER TABLE signals RENAME COLUMN user_id TO fixture_hidden_owner");
    await assert.rejects(verifyDatabaseReadiness(client), /Required database schema is not ready/);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  await verifyDatabaseReadiness(pool);
});
