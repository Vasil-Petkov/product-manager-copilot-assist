import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import http from "node:http";
import { test } from "node:test";
import express from "express";
import type { TestContext } from "node:test";
import { readSecurityConfig, DEFAULT_POLICIES } from "../lib/security-config.ts";
import { securityCors } from "../middlewares/security-cors.ts";
import { securityRateLimit, policyFor } from "../middlewares/security-rate-limit.ts";
import type { Bucket, RateLimitStore } from "../lib/rate-limit-store.ts";
import { DemoSessionStore, DemoCapacityError } from "../lib/demoSession.ts";

const secret = randomBytes(32).toString("hex");
async function serve(t: TestContext, app: express.Express) {
  const server = http.createServer(app).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return (path: string, init: RequestInit = {}) => fetch(`http://127.0.0.1:${address.port}${path}`, {
    ...init, headers: { connection: "close", ...init.headers },
  });
}

test("production requires explicit CORS and verified proxy configuration", () => {
  assert.throws(() => readSecurityConfig({ NODE_ENV: "production" }), /CORS_ALLOWED_ORIGINS/);
  assert.throws(() => readSecurityConfig({ NODE_ENV: "production", CORS_ALLOWED_ORIGINS: "https://frontend.example" }), /TRUSTED_PROXY_CIDRS/);
  for (const origin of ["*", "null", "https://*.example", "https://frontend.example/", "https://frontend.example/path",
    "https://user:password@frontend.example", "https://frontend.example#x", "http://frontend.example", "https://frontend.example?x=1"]) {
    assert.throws(() => readSecurityConfig({ NODE_ENV: "production", CORS_ALLOWED_ORIGINS: origin, TRUSTED_PROXY_CIDRS: "127.0.0.1/32" }));
  }
  for (const cidr of ["0.0.0.0/0", "::/0", "true", "1", "127.0.0.1/33", "127.0.0.1/x"]) {
    assert.throws(() => readSecurityConfig({ NODE_ENV: "test", TRUSTED_PROXY_CIDRS: cidr }));
  }
  for (const override of ['{"unknown":{}}', '{"__proto__":{}}', '{"auth":{"ipLimit":0}}', '{"auth":{"userLimit":5}}']) {
    assert.throws(() => readSecurityConfig({ NODE_ENV: "test", RATE_LIMITS_JSON: override }));
  }
});

test("CORS exact allow/deny, credentials, no-Origin and preflight", async (t) => {
  const config = readSecurityConfig({ NODE_ENV: "production", CORS_ALLOWED_ORIGINS: "https://frontend.example,https://frontend.example:8443", TRUSTED_PROXY_CIDRS: "127.0.0.1/32" });
  const app = express();
  let calls = 0;
  app.use(securityCors(config.origins));
  app.use((_req, res) => { calls++; res.json({ ok: true }); });
  const request = await serve(t, app);
  assert.equal((await request("/")).status, 200);
  for (const origin of config.origins) {
    const response = await request("/", { headers: { origin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    const preflight = await request("/", { method: "OPTIONS", headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type,authorization" } });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get("access-control-allow-methods")!, /POST/);
    assert.match(preflight.headers.get("access-control-allow-headers")!, /Authorization/i);
  }
  const before = calls;
  for (const origin of ["https://frontend.example.evil.invalid", "http://frontend.example", "https://frontend.example:8444", "null"]) {
    for (const method of ["POST", "OPTIONS"]) {
      const denied = await request("/", { method, headers: { origin } });
      assert.equal(denied.status, 403);
      assert.equal(denied.headers.get("access-control-allow-origin"), null);
    }
  }
  assert.equal(calls, before);
});

test("client IP ignores forged XFF unless the immediate proxy is explicitly trusted", async (t) => {
  for (const [cidrs, expected] of [["", "127.0.0.1"], ["127.0.0.1/32", "192.0.2.9"]]) {
    const app = express();
    app.set("trust proxy", readSecurityConfig({ TRUSTED_PROXY_CIDRS: cidrs }).isTrustedProxy);
    app.get("/", (req, res) => res.json({ ip: req.ip }));
    const request = await serve(t, app);
    const response = await request("/", { headers: { "x-forwarded-for": "198.51.100.7, 192.0.2.9" } });
    assert.equal((await response.json() as { ip: string }).ip, expected);
  }
});

class MemoryFixture implements RateLimitStore {
  readonly counts = new Map<string, number>();
  readonly requests: Bucket[][] = [];
  async consume(buckets: Bucket[]) {
    this.requests.push(buckets);
    let allowed = true;
    for (const bucket of buckets) {
      const count = (this.counts.get(bucket.key) ?? 0) + 1;
      this.counts.set(bucket.key, count);
      allowed &&= count <= bucket.limit;
    }
    return { allowed, retryAfter: allowed ? 0 : 10 };
  }
}

test("public throttling cannot be bypassed by forged IP headers; returns safe 429", async (t) => {
  const store = new MemoryFixture();
  const policies = structuredClone(DEFAULT_POLICIES);
  policies.auth.ipLimit = 2;
  const app = express();
  app.set("trust proxy", false);
  app.use(securityRateLimit(store, policies, "public", secret));
  app.get("/login", (_req, res) => res.json({ ok: true }));
  const request = await serve(t, app);
  for (let i = 0; i < 2; i++) assert.equal((await request("/login")).status, 200);
  const blocked = await request("/LOGIN/", { headers: { "x-forwarded-for": "198.51.100.22" } });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "10");
  assert.equal(store.counts.size, 1);
  assert.match(await blocked.text(), /Too many requests/);
});

test("AI counters combine per-user across IPs and per-IP across users", async (t) => {
  const store = new MemoryFixture();
  const policies = structuredClone(DEFAULT_POLICIES);
  policies.generation = { ipLimit: 2, userLimit: 1, windowMs: 1000 };
  const app = express();
  app.set("trust proxy", readSecurityConfig({ TRUSTED_PROXY_CIDRS: "127.0.0.1/32" }).isTrustedProxy);
  app.use((req, _res, next) => {
    if (req.headers["x-test-user"]) req.user = { id: String(req.headers["x-test-user"]) } as Express.User;
    req.isAuthenticated = function(this): this is Express.AuthedRequest { return Boolean(this.user); };
    req.isDemoSession = () => req.headers["x-test-demo"] === "yes";
    next();
  });
  app.use(securityRateLimit(store, policies, "authenticated", secret));
  app.use((_req, res) => res.json({ ok: true }));
  const request = await serve(t, app);
  const send = (user: string, extra = {}) => request("/documents/generate", { method: "POST", headers: { "x-test-user": user, "x-forwarded-for": "198.51.100.1", ...extra } });
  assert.equal((await send("a")).status, 200);
  assert.equal((await send("a", { "x-forwarded-for": "198.51.100.2" })).status, 429);
  assert.equal((await send("b")).status, 200);
  assert.equal((await send("c")).status, 429);
  const before = store.requests.length;
  await send("a", { "x-test-demo": "yes" });
  await request("/documents/generate", { method: "POST" });
  assert.equal(store.requests.length, before);
  assert.equal(store.requests[0].length, 2);
  assert.ok(store.requests.flat().every((b) => /^[a-f0-9]{64}$/.test(b.key)));
});

test("counter store failure is fail-closed, with no error leakage", async (t) => {
  const app = express();
  const store: RateLimitStore = { consume: async () => { throw new Error("internal database failure"); } };
  app.use(securityRateLimit(store, DEFAULT_POLICIES, "public", secret));
  app.use((_req, res) => res.sendStatus(200));
  const response = await (await serve(t, app))("/demo/session", { method: "POST" });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "30");
  assert.doesNotMatch(await response.text(), /database failure/);
});

test("all public and expensive route classes have policies, including HEAD aliases", () => {
  for (const path of ["/login", "/callback", "/logout", "/auth/user", "/demo/session"]) assert.ok(policyFor("GET", path));
  for (const path of ["/mobile-auth/token-exchange", "/mobile-auth/logout", "/demo/session", "/demo/session/exit"]) assert.ok(policyFor("POST", path));
  for (const path of ["/competitors/1/analyze", "/meetings/1/analyze", "/opportunities/1/analyze",
    "/product-ideas/1/similarity", "/product-ideas/similarity/compare", "/prioritization/ai-recommend", "/prioritization/analyze/1",
    "/prioritization/compare", "/documents/generate", "/documents/1/regenerate", "/insights/generate", "/roadmap/proposal",
    "/validation/hypotheses/improve", "/validation/experiments/assist", "/validation/experiments/1/analyze-result",
    "/openai/conversations/1/messages"]) {
    assert.ok(DEFAULT_POLICIES[policyFor("POST", path)!]?.userLimit, path);
  }
  assert.equal(policyFor("POST", "/DASHBOARD/DAILY-SUMMARY/"), "analysis");
  assert.equal(policyFor("GET", "/DASHBOARD/DAILY-SUMMARY/"), undefined);
  assert.equal(policyFor("HEAD", "/DASHBOARD/DAILY-SUMMARY/"), undefined);
  assert.equal(policyFor("HEAD", "/AUTH/USER/"), "authRead");
  assert.equal(policyFor("OPTIONS", "/documents/generate"), undefined);
});

test("demo capacity is bounded without eviction; expired sessions free capacity", () => {
  let now = 0;
  const store = new DemoSessionStore(2, () => now);
  try {
    const first = store.create(10);
    store.create(10);
    assert.throws(() => store.create(), DemoCapacityError);
    assert.ok(store.get(first));
    assert.equal(store.size, 2);
    now = 11;
    assert.equal(store.get(first), null);
    const fresh = store.create();
    assert.equal(store.size, 1);
    assert.ok(store.get(fresh));
  } finally { store.dispose(); }
});

test("timer cleans expired demo sessions without incoming requests", async () => {
  let now = 0;
  const store = new DemoSessionStore(2, () => now, 5);
  try {
    store.create(1);
    now = 2;
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(store.size, 0);
  } finally { store.dispose(); }
});
