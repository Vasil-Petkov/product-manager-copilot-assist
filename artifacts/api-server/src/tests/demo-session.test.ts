import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { demoSessionMiddleware } from "../middlewares/demoSession.ts";
import { requireAuth } from "../middlewares/requireAuth.ts";
import demoRouter from "../routes/demo.ts";
import { createDemoSession, getDemoSession } from "../lib/demoSession.ts";

function createTestServer() {
  const app = express();
  let protectedHandlerCalls = 0;
  app.use(cookieParser());
  app.use(express.json());
  app.use(demoSessionMiddleware);
  app.use((req, _res, next) => {
    req.isAuthenticated = function (this): this is Express.AuthedRequest {
      return req.headers["x-test-auth"] === "valid";
    };
    if (req.isAuthenticated()) {
      req.user = {
        id: "test-user",
        email: "test@example.invalid",
        firstName: "Test",
        lastName: "User",
        profileImageUrl: null,
      };
    }
    next();
  });
  app.use(demoRouter);
  app.get("/private", requireAuth, (_req, res) => {
    protectedHandlerCalls += 1;
    res.json({ ok: true });
  });
  app.get("/openai/conversations", requireAuth, (_req, res) => {
    protectedHandlerCalls += 1;
    res.json([]);
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error instanceof Error && "statusCode" in error
      ? Number((error as { statusCode: number }).statusCode)
      : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : "error" });
  });

  const server = http.createServer(app);
  return {
    server,
    getProtectedHandlerCalls: () => protectedHandlerCalls,
  };
}

async function request(
  server: http.Server,
  path: string,
  options: { method?: string; cookie?: string; auth?: boolean } = {},
) {
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return new Promise<{
    status: number;
    body: string;
    cookies: string[];
  }>((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port: address.port,
      path,
      method: options.method ?? "GET",
      headers: {
        ...(options.cookie ? { cookie: options.cookie } : {}),
        ...(options.auth ? { "x-test-auth": "valid" } : {}),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => resolve({
        status: res.statusCode ?? 0,
        body: Buffer.concat(chunks).toString("utf8"),
        cookies: res.headers["set-cookie"] ?? [],
      }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("anonymous private requests remain unauthorized", async (t) => {
  const testServer = createTestServer();
  const server = testServer.server.listen(0);
  await once(server, "listening");
  t.after(() => server.close());

  const response = await request(server, "/private");
  assert.equal(response.status, 401);
});

test("demo sessions are created, block private APIs with or without auth, and exit cleanly", async (t) => {
  const testServer = createTestServer();
  const server = testServer.server.listen(0);
  await once(server, "listening");
  t.after(() => server.close());

  const created = await request(server, "/demo/session", { method: "POST" });
  assert.equal(created.status, 201);
  const demoCookie = created.cookies[0]?.split(";", 1)[0];
  assert.ok(demoCookie);
  assert.match(demoCookie ?? "", /^pm_demo_session=/);
  assert.match(created.cookies.join(";"), /HttpOnly/i);
  assert.match(created.cookies.join(";"), /SameSite=Lax/i);
  assert.match(created.cookies.join(";"), /Path=\//i);
  assert.doesNotMatch(created.cookies.join(";"), /(?:Max-Age|Expires)=/i);

  const blocked = await request(server, "/private", { cookie: demoCookie });
  assert.equal(blocked.status, 403);

  const blockedWithAuth = await request(server, "/private", {
    cookie: demoCookie,
    auth: true,
  });
  assert.equal(blockedWithAuth.status, 403);

  const blockedOpenAi = await request(server, "/openai/conversations", {
    cookie: demoCookie,
    auth: true,
  });
  assert.equal(blockedOpenAi.status, 403);
  assert.equal(testServer.getProtectedHandlerCalls(), 0);

  const active = await request(server, "/demo/session", { cookie: demoCookie });
  assert.equal(active.status, 200);
  assert.deepEqual(JSON.parse(active.body), { active: true });

  const exited = await request(server, "/demo/session/exit", {
    method: "POST",
    cookie: demoCookie,
  });
  assert.equal(exited.status, 200);
  assert.match(exited.cookies.join(";"), /pm_demo_session=/);

  const fullWorkspace = await request(server, "/private", { auth: true });
  assert.equal(fullWorkspace.status, 200);
  assert.equal(testServer.getProtectedHandlerCalls(), 1);

  const inactive = await request(server, "/demo/session", { cookie: demoCookie });
  assert.equal(inactive.status, 200);
  assert.deepEqual(JSON.parse(inactive.body), { active: false });
});

test("invalid demo sessions do not grant private access", async (t) => {
  const testServer = createTestServer();
  const server = testServer.server.listen(0);
  await once(server, "listening");
  t.after(() => server.close());

  const response = await request(server, "/private", {
    cookie: "pm_demo_session=invalid",
  });
  assert.equal(response.status, 401);
});

test("expired demo sessions are treated as inactive", () => {
  const sessionId = createDemoSession(0);
  assert.equal(getDemoSession(sessionId), null);
});
