import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { db, pool, rateLimitPool, usersTable, sessionsTable } from "@workspace/db";
import { csrfHeaders } from "./csrf-client.fixture.ts";

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
