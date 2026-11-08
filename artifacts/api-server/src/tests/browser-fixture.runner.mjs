import http from "node:http";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { writeFile, rm } from "node:fs/promises";
import { createOwnershipTestDatabase, runTestCommand } from "./workspace-ownership.cleanup.ts";
import { createFrontendServer } from "../../../pm-copilot/server.mjs";

// Reusable, disposable browser fixture. Never inherits an application database.
const abort = new AbortController();
let stop;
const stopped = new Promise((resolve) => { stop = () => { abort.abort(); resolve(); }; });
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
const database = await createOwnershipTestDatabase(abort.signal);
const statePath = "/tmp/pm-security-browser-fixture.json";
let api, frontend, proxy, pool, rateLimitPool;
try {
  await runTestCommand("pnpm", ["--filter", "@workspace/db", "exec", "drizzle-kit", "push", "--force"], database.env, abort.signal);
  Object.assign(process.env, database.env, {
    NODE_ENV: "test", SESSION_SECRET: randomBytes(32).toString("hex"),
    CORS_ALLOWED_ORIGINS: "http://127.0.0.1:9185", TRUSTED_PROXY_CIDRS: "",
    ISSUER_URL: "https://no-live-oauth.example.invalid",
    AI_INTEGRATIONS_OPENAI_API_KEY: "isolated-not-a-credential",
    AI_INTEGRATIONS_OPENAI_BASE_URL: "http://127.0.0.1:1",
  });
  const data = await import("@workspace/db");
  ({ pool, rateLimitPool } = data);
  const user = { id: "isolated-browser-owner", email: "browser-owner@example.invalid", firstName: "Browser", lastName: "Fixture", profileImageUrl: null };
  const sid = randomBytes(32).toString("hex");
  await data.db.insert(data.usersTable).values(user);
  await data.db.insert(data.sessionsTable).values({ sid, sess: { user, access_token: "fixture-only" }, expire: new Date(Date.now() + 3_600_000) });
  const { default: app } = await import("../app.ts");
  api = http.createServer(app).listen(0, "127.0.0.1");
  await once(api, "listening");
  frontend = createFrontendServer();
  proxy = http.createServer((req, res) => {
    if (!req.url?.startsWith("/api/")) return frontend.emit("request", req, res);
    const upstream = http.request({
      host: "127.0.0.1", port: api.address().port, path: req.url, method: req.method,
      headers: req.headers,
    }, (reply) => { res.writeHead(reply.statusCode, reply.headers); reply.pipe(res); });
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(upstream);
  }).listen(9185, "127.0.0.1");
  await once(proxy, "listening");
  await writeFile(statePath, JSON.stringify({ origin: "http://127.0.0.1:9185", sid, pid: process.pid }), { mode: 0o600 });
  console.log("ISOLATED_BROWSER_READY http://127.0.0.1:9185");
  await stopped;
} finally {
  for (const server of [proxy, api]) {
    if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  }
  await rateLimitPool?.end();
  await pool?.end();
  await database.dispose();
  await rm(statePath, { force: true });
}
