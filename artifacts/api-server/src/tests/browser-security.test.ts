import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { after, before, test } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { csrfProtection } from "../middlewares/csrf.ts";
import { SecurityMetrics } from "../lib/security-events.ts";
import { browserHeaders } from "../../../../lib/browser-security/headers.mjs";
let server: http.Server;
let base: string;
let writes = 0;
before(async () => {
  const app = express();
  const csrf = csrfProtection("test-only".repeat(8));
  app.use(cookieParser(), express.json(), express.urlencoded({ extended: false }));
  app.get("/csrf", (req, res) => res.json({ token: csrf.issue(req, res) }));
  app.use(csrf.guard);
  app.post(["/write", "/logout"], (_req, res) => { writes++; res.sendStatus(204); });
  app.get("/dashboard/daily-summary", (_req, res) => res.sendStatus(204));
  server = http.createServer(app).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
async function issue(sid = "owner-a") {
  const response = await fetch(`${base}/csrf`, { headers: { cookie: `sid=${sid}` } });
  const nonce = /pm_csrf=([^;]+)/.exec(response.headers.get("set-cookie")!)![1];
  assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(response.headers.get("set-cookie")!, /SameSite=Lax/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return { token: (await response.json() as { token: string }).token, cookie: `sid=${sid}; pm_csrf=${nonce}` };
}
test("cookie mutations require valid session-bound proof; malformed, missing and foreign-session tokens fail", async () => {
  const a = await issue();
  const b = await issue("owner-b");
  const before = writes;
  for (const token of ["", "junk", a.token.slice(0, -1), b.token]) {
    const response = await fetch(`${base}/write`, { method: "POST", headers: { cookie: a.cookie, "X-CSRF-Token": token } });
    assert.equal(response.status, 403);
  }
  assert.equal(writes, before);
  assert.equal((await fetch(`${base}/write`, { method: "POST", headers: { cookie: a.cookie, "X-CSRF-Token": a.token } })).status, 204);
  assert.equal(writes, before + 1);
});
test("a forged nonce/signature and adding Bearer cannot bypass cookie protection", async () => {
  for (const headers of [
    { cookie: `sid=owner-a; pm_csrf=${"a".repeat(64)}`, "X-CSRF-Token": `${"a".repeat(64)}.${"b".repeat(64)}` },
    { cookie: "sid=owner-a", authorization: "Bearer unrelated" },
    { "sec-fetch-site": "cross-site" },
  ]) assert.equal((await fetch(`${base}/write`, { method: "POST", headers })).status, 403);
});
test("native Bearer requests stay token-based; browser Origin requests and logout require CSRF proof", async () => {
  assert.equal((await fetch(`${base}/write`, { method: "POST", headers: { authorization: "Bearer native-test-token" } })).status, 204);
  assert.equal((await fetch(`${base}/write`, { method: "POST", headers: { origin: "https://foreign.invalid" } })).status, 403);
  assert.equal((await fetch(`${base}/logout`, { method: "POST" })).status, 403);
});
test("logout confirmation form supports body proof, but proof from a previous session cannot be reused", async () => {
  const a = await issue();
  assert.equal((await fetch(`${base}/logout`, { method: "POST", headers: { cookie: a.cookie }, body: new URLSearchParams({ _csrf: a.token }) })).status, 204);
  assert.equal((await fetch(`${base}/logout`, { method: "POST", headers: { cookie: a.cookie.replace("owner-a", "owner-b") }, body: new URLSearchParams({ _csrf: a.token }) })).status, 403);
});
test("cost-incurring GET and HEAD cannot be triggered with ambient cookies without proof", async () => {
  const a = await issue();
  for (const method of ["GET", "HEAD"]) {
    assert.equal((await fetch(`${base}/dashboard/daily-summary`, { method, headers: { cookie: a.cookie } })).status, 403);
    assert.equal((await fetch(`${base}/dashboard/daily-summary`, { method, headers: { cookie: a.cookie, "X-CSRF-Token": a.token } })).status, 204);
  }
});
test("production nonce cookie is host-only Secure and is not reissued from client input", async () => {
  const old = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const response = await fetch(`${base}/csrf`, { headers: { cookie: "sid=owner-a" } });
    const cookie = response.headers.get("set-cookie")!;
    assert.match(cookie, /^__Host-pm_csrf=[a-f0-9]{64};/);
    assert.match(cookie, /Secure/);
    assert.doesNotMatch(cookie, /Domain=/i);
    const pair = cookie.split(";")[0];
    const again = await fetch(`${base}/csrf`, { headers: { cookie: `sid=owner-a; ${pair}` } });
    assert.equal(again.headers.get("set-cookie"), null);
    assert.equal((await again.json() as { token: string }).token, (await response.json() as { token: string }).token);
  } finally {
    if (old === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = old;
  }
});
test("production CSP denies inline scripts/eval/framing but supports current fonts, inline React styles and Replit OIDC forms", () => {
  const headers = browserHeaders();
  const csp = headers["Content-Security-Policy"];
  assert.match(csp, /script-src 'self';/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.match(csp, /style-src 'self' 'unsafe-inline' https:\/\/fonts.googleapis.com/);
  assert.match(csp, /form-action 'self' https:\/\/replit.com/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "no-referrer");
});
test("security counters use bounded labels, aggregate and flush without request data", () => {
  const emitted: unknown[] = [];
  const metrics = new SecurityMetrics((event) => emitted.push(event));
  metrics.record("rate_limited", "generation");
  metrics.record("rate_limited", "generation");
  metrics.record("csrf_rejected");
  assert.throws(() => metrics.record("rate_limited", "raw-ip-or-user"));
  metrics.flush();
  metrics.flush();
  assert.deepEqual(emitted, [
    { event: "security_metrics", windowSeconds: 60, counters: [{ name: "rate_limited", policy: "generation", count: 2 }, { name: "csrf_rejected", policy: "all", count: 1 }] },
    { event: "security_metrics", windowSeconds: 60, counters: [] },
  ]);
});
